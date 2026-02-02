
# backend/main.py
from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException,
    Depends,
    BackgroundTasks,
    Form,
    Path
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pathlib import Path
import uuid
import shutil
import logging
from collections import defaultdict
from pydantic import BaseModel
from typing import List, Dict, Any
from .database import get_db, engine, SessionLocal
from .models import Base, PaymentRegistry, InvoiceLine
from .parsers.excel_parser import ExcelParser
from .parsers.invoice_parser import parse_invoice_from_pdf
from .crud import (
    build_registry_from_batch,
    apply_invoice_ocr_to_registry,
    create_imported_request,
    create_payment_registry_item,
    create_history,
    update_registry_position,
    reorder_registry_batch,
)
from .services.invoice_matcher import try_match_invoice
from .services.invoice_buffer import (
    list_invoices,
    add_invoice,
    save_invoice_lines,
    mark_invoice_line_used,
    get_invoice,
)

log = logging.getLogger(__name__)

# -------------------------------------------------------------------
# APP
# -------------------------------------------------------------------

app = FastAPI(title="Registry Control API", version="1.0.0")

# Pydantic модели для запросов
class ApplyInvoiceLineRequest(BaseModel):
    invoice_id: str
    line_no: int
    registry_id: int

class ApplyInvoiceMetadataRequest(BaseModel):
    invoice_id: str
    registry_id: int
    apply_fields: List[str] = ["contractor", "invoice_number", "invoice_date"]

class ManualInvoiceMatchRequest(BaseModel):
    batch_id: str
    registry_id: int
    invoice_id: str
    apply_type: str = "full"  # "full", "metadata_only", "amount_only"

class ReorderRequest(BaseModel):
    batch_id: str
    items: List[Dict[str, Any]]  # [{id: 1, position: 0}, {id: 2, position: 1}, ...]

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_UPLOAD_DIR = Path("backend/uploads")
BASE_UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=BASE_UPLOAD_DIR), name="uploads")

# -------------------------------------------------------------------
# BACKGROUND OCR TASK
# -------------------------------------------------------------------

def process_invoice_pdf_background(file_path: Path, batch_id: str):
    db = SessionLocal()
    try:
        # 1. Парсим PDF
        parsed = parse_invoice_from_pdf(file_path)
        if not parsed:
            log.error("[OCR] Failed to parse PDF: %s", file_path.name)
            return
        
        print(f"\n=== DEBUG: parse_invoice_from_pdf result ===")
        print(f"Contractor: {parsed.get('data', {}).get('contractor')}")
        print(f"Invoice number: {parsed.get('data', {}).get('invoice_number')}")
        print(f"Invoice date: {parsed.get('data', {}).get('invoice_date')}")
        
        # 2. Добавляем ID и информацию о batch
        invoice_id = str(uuid.uuid4())
        parsed["id"] = invoice_id
        parsed["batch_id"] = batch_id
        parsed["file"] = file_path.name
        
        # 3. ВСЕГДА сохраняем строки счета в базу
        if parsed.get("lines"):
            log.info("[OCR] Saving %d invoice lines to database", len(parsed["lines"]))
            save_invoice_lines(
                db,
                invoice_id=invoice_id,
                batch_id=batch_id,
                lines=parsed.get("lines", []),
            )
        else:
            log.warning("[OCR] No product lines found in invoice")
        
        # 4. ВСЕГДА сохраняем счет в буфер (для предпросмотра)
        print(f"\n=== DEBUG: Adding to buffer ===")
        print(f"Invoice ID: {invoice_id}")
        
        # ОБЕСПЕЧИВАЕМ что data есть
        if 'data' not in parsed:
            parsed['data'] = {}
        
        # Добавляем обязательные поля если их нет
        if 'invoice_full_text' not in parsed['data']:
            invoice_number = parsed['data'].get('invoice_number')
            invoice_date = parsed['data'].get('invoice_date')
            if invoice_number and invoice_date:
                parsed['data']['invoice_full_text'] = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                parsed['data']['invoice_full_text'] = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                parsed['data']['invoice_full_text'] = f"Счет от {invoice_date}"
        
        # Сохраняем в буфер
        add_invoice(parsed)
        
        # 5. Фиксируем только строки товаров, НЕ изменяем реестр
        db.commit()
        log.info("[OCR] Processing complete for %s", file_path.name)
        print(f"[DEBUG] Invoice saved to buffer: {invoice_id}")
        print(f"[DEBUG] NO automatic application to registry!")
        
    except Exception as e:
        db.rollback()
        log.exception("[OCR] Failed to process invoice %s: %s", file_path.name, str(e))
        print(f"\n=== DEBUG: EXCEPTION ===")
        print(f"Error processing invoice: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print(f"[DEBUG] Database connection closed")

# -------------------------------------------------------------------
# APPLY INVOICE LINE 
# -------------------------------------------------------------------

@app.post("/invoice/apply-line")
def apply_invoice_line(payload: ApplyInvoiceLineRequest, db: Session = Depends(get_db)):
    log.info(
        "[APPLY_LINE] invoice_id=%s line_no=%s registry_id=%s",
        payload.invoice_id,
        payload.line_no,
        payload.registry_id,
    )

    # Проверяем существует ли строка счета
    line = (
        db.query(InvoiceLine)
        .filter(
            InvoiceLine.invoice_id == payload.invoice_id,
            InvoiceLine.line_no == payload.line_no,
            InvoiceLine.used.is_(False),
        )
        .first()
    )
    
    # Строка счета может быть уже использована или не существовать
    # Это не должно блокировать применение, просто логируем
    if not line:
        log.warning("[APPLY_LINE] invoice line not found or already used: invoice_id=%s, line_no=%s",
                   payload.invoice_id, payload.line_no)

    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        log.warning("[APPLY_LINE] registry not found")
        raise HTTPException(404, "Registry item not found")

    # Получаем данные счета из буфера
    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        log.error("[APPLY_LINE] invoice not found in buffer")
        raise HTTPException(404, "Invoice not found")

    log.info("[APPLY_LINE] OCR DATA FROM BUFFER: %s", invoice["data"])

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }

    #  Применяем счет к строке реестра с указанием номера строки
    apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        invoice_data,
        apply_full_metadata=True,  # Применяем все метаданные
        line_no=payload.line_no  # Указываем номер строки для суммы
    )

    # Помечаем строку счета как использованную если она существует
    if line:
        mark_invoice_line_used(db, payload.invoice_id, payload.line_no)

    db.commit()

    log.info(
        "[APPLY_LINE] APPLIED OK registry_id=%s contractor=%s amount=%s position=%s",
        registry.id,
        registry.contractor,
        registry.amount,
        registry.position,  #  Показываем позицию строки
    )

    return {"status": "ok"}

# -------------------------------------------------------------------
# APPLY BATCH INVOICES
# -------------------------------------------------------------------

@app.post("/invoice/apply-batch/{batch_id}", summary="Применить OCR-счета ко всем строкам batch")
def apply_batch_invoices(batch_id: str, db: Session = Depends(get_db)):
    registries = (
        db.query(PaymentRegistry)
        .filter(PaymentRegistry.imported_batch == batch_id)
        .all()
    )

    if not registries:
        raise HTTPException(404, detail="Batch not found or empty")

    invoices = list_invoices(batch_id)

    for r in registries:
        if r.invoice_id:
            invoices.append({"id": r.invoice_id, "data": r.invoice_details})

    applied_count = 0

    for registry in registries:
        vehicle_text = (registry.vehicle or "").lower()
        license_plate_text = (registry.license_plate or "").replace(" ", "").lower()

        for invoice in invoices:
            data = invoice.get("data") or {}
            invoice_full_text = (data.get("invoice_full_text") or "").lower()

            if not invoice_full_text:
                continue

            if vehicle_text.split()[0] in invoice_full_text or license_plate_text in invoice_full_text:
                apply_invoice_ocr_to_registry(db, registry.id, invoice)
                applied_count += 1
                break

    db.commit()
    return {
        "status": "ok",
        "registries_processed": len(registries),
        "invoices_applied": applied_count,
    }

# -------------------------------------------------------------------
# UPLOAD EXCEL/PDF
# -------------------------------------------------------------------

@app.post("/upload", summary="Upload Excel or PDF")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    batch_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ("xlsx", "xls", "pdf"):
        raise HTTPException(400, "Supported: xlsx, xls, pdf")

    if not batch_id:
        batch_id = str(uuid.uuid4())

    file_path = BASE_UPLOAD_DIR / f"{batch_id}_{file.filename}"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # ----------------------------------------------------------------
    # EXCEL
    # ----------------------------------------------------------------
    if ext in ("xlsx", "xls"):
        parser = ExcelParser()
        try:
            # Используем новый метод, который возвращает данные с позициями
            parsed_data = parser.parse_file_with_positions(file_path)
        except Exception as e:
            raise HTTPException(500, f"Excel parse error: {e}")

        grouped: dict[str, list[dict]] = defaultdict(list)

        # Группируем строки по номеру машины, сохраняя позиции
        for row_data, excel_position in parsed_data:
            plate = row_data.get("license_plate")
            if plate:
                grouped[plate].append({
                    "row_data": row_data,
                    "excel_position": excel_position
                })

        created_items = []
        current_position = 0
        
        for plate, rows in grouped.items():
            # Создаем ImportedRequest для каждой строки в группе
            for row_info in rows:
                create_imported_request(db, row_info["row_data"], batch_id, file.filename, ext)

            first = rows[0]
            comments = list(
                dict.fromkeys(
                    row_info["row_data"]["item_name"] for row_info in rows if row_info["row_data"].get("item_name")
                )
            )

            # Создаем строку реестра с сохранением позиции из Excel
            # Используем позицию первой строки в группе
            registry_item = create_payment_registry_item(
                db,
                {
                    "supplier": None,
                    "vehicle": first["row_data"].get("car_brand"),
                    "license_plate": plate,
                    "amount": 0,
                    "vat_amount": 0,
                    "comment": "; ".join(comments),
                    "matched_request_id": None,
                },
                batch_id,
                position=first["excel_position"]  #  Передаем позицию из Excel 
            )
            created_items.append(registry_item)
            current_position += 1

        db.commit()

        registry_preview = build_registry_from_batch(db, batch_id)
    
        print(f"\n=== DEBUG /upload response ===")
        print(f"Excel parsed: {len(parsed_data)} rows")
        print(f"Registry preview: {len(registry_preview)} items")
        print(f"Positions: {[item.get('position') for item in registry_preview]}")
        
        # Возвращаем совместимый формат
        return {
            "message": f"Excel imported, {len(parsed_data)} rows processed",
            "batch_id": batch_id,
            "registry_preview": registry_preview,
            "data": registry_preview,  # Дублирование для совместимости
        }

    # ----------------------------------------------------------------
    # PDF
    # ----------------------------------------------------------------
    background_tasks.add_task(
        process_invoice_pdf_background,
        file_path,
        batch_id,
    )

    return {
        "message": "Invoice accepted for processing",
        "status": "processing",
        "batch_id": batch_id,
    }

# -------------------------------------------------------------------
# PREVIEW
# -------------------------------------------------------------------

@app.get("/invoice/{batch_id}/preview")
def get_invoice_preview(batch_id: str, db: Session = Depends(get_db)):
    print(f"\n=== DEBUG /invoice/{batch_id}/preview ===")
    
    # Получаем данные реестра из базы (сортировка по position)
    registry_preview = build_registry_from_batch(db, batch_id)
    
    print(f"Batch ID from URL: {batch_id}")
    print(f"Registry preview items: {len(registry_preview)}")
    print(f"Order by position: {[item.get('position') for item in registry_preview]}")
    
    if len(registry_preview) == 0:
        print(" WARNING: Registry preview is EMPTY!")
    
    # Получаем все счета для этого batch
    pending_invoices = list_invoices(batch_id)
    
    # Создаем словарь счетов по ID для быстрого доступа
    invoices_by_id = {}
    for inv in pending_invoices:
        inv_id = inv.get("id")
        if inv_id and inv.get("data"):
            data = inv["data"]
            
            # Создаем invoice_full_text если его нет
            invoice_full_text = data.get("invoice_full_text")
            if not invoice_full_text:
                invoice_number = data.get("invoice_number")
                invoice_date = data.get("invoice_date")
                if invoice_number and invoice_date:
                    invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
                elif invoice_number:
                    invoice_full_text = f"Счет на оплату № {invoice_number}"
                elif invoice_date:
                    invoice_full_text = f"Счет от {invoice_date}"
                else:
                    invoice_full_text = ""
            
            invoices_by_id[inv_id] = {
                "contractor": data.get("contractor"),
                "invoice_number": data.get("invoice_number"),
                "invoice_date": data.get("invoice_date"),
                "total": data.get("total"),
                "inn": data.get("inn"),
                "account": data.get("account"),
                "metadata_found": data.get("metadata_found", False),
                "invoice_full_text": invoice_full_text,
            }
    
    # Обновляем registry_preview данными из счетов
    updated_registry = []
    for item in registry_preview:
        invoice_id = item.get("invoice_id")
        
        # Если у строки есть invoice_id и у нас есть данные для этого счета
        if invoice_id and invoice_id in invoices_by_id:
            invoice_data = invoices_by_id[invoice_id]
            
            # Обновляем invoice_details в item
            current_details = item.get("invoice_details", {})
            if not isinstance(current_details, dict):
                current_details = {}
            
            # Объединяем существующие данные с новыми
            updated_details = {**current_details, **invoice_data}
            item["invoice_details"] = updated_details
            
            # Также обновляем contractor если его нет
            if not item.get("contractor") and invoice_data.get("contractor"):
                item["contractor"] = invoice_data.get("contractor")
        
        updated_registry.append(item)
    
    # Форматируем данные счетов для фронтенд

    invoices_data = []
    for inv in pending_invoices:
        invoice_data = {
            "id": inv.get("id"),
            "file": inv.get("file", ""),
            "confidence": inv.get("confidence", 0),
            "status": "pending",
        }
        
        if inv.get("data"):
            invoice_data["has_metadata"] = True
            invoice_data["ocr_data"] = inv["data"]
        else:
            invoice_data["has_metadata"] = False
        
        invoice_data["has_lines"] = bool(inv.get("lines") and len(inv["lines"]) > 0)
        invoices_data.append(invoice_data)
    
    print(f"Returning {len(updated_registry)} registry items and {len(pending_invoices)} invoices")
    
    response_data = {
        "registry_preview": updated_registry,
        "pending_invoices": len(pending_invoices),
        "invoices": invoices_data,
        "batch_id": batch_id,
    }
    
    return response_data

# -------------------------------------------------------------------
# UNMATCHED INVOICES
# -------------------------------------------------------------------

@app.get("/invoices/unmatched/{batch_id}")
def unmatched(batch_id: str):
    return list_invoices(batch_id)

# -------------------------------------------------------------------
# INVOICE LINES
# -------------------------------------------------------------------

@app.get("/invoice/{invoice_id}/lines")
def get_invoice_lines_endpoint(
    invoice_id: str,
    db: Session = Depends(get_db),
):
    lines = (
        db.query(InvoiceLine)
        .filter(InvoiceLine.invoice_id == invoice_id)
        .order_by(InvoiceLine.line_no)
        .all()
    )

    return [
        {
            "line_no": l.line_no,
            "description": l.description,
            "quantity": l.quantity,
            "price": float(l.price) if l.price else None,
            "total": float(l.total) if l.total else None,
            "used": l.used,
        }
        for l in lines
    ]

# -------------------------------------------------------------------
# INVOICES FROM BUFFER
# -------------------------------------------------------------------

@app.get("/registry/{batch_id}/invoices-from-buffer")
def get_invoices_from_buffer(batch_id: str):
    """Получить все счета из буфера для данного batch (для фронтенда)"""
    try:
        # Получаем счета из буфера
        pending_invoices = list_invoices(batch_id)
        
        print(f"\n=== DEBUG /invoices-from-buffer for batch {batch_id} ===")
        print(f"Found {len(pending_invoices)} invoices in buffer")
        
        # Форматируем для фронтенда
        formatted_invoices = []
        for inv in pending_invoices:
            data = inv.get("data", {})
            
            # Создаем invoice_full_text если его нет
            invoice_full_text = data.get("invoice_full_text")
            if not invoice_full_text:
                invoice_number = data.get("invoice_number")
                invoice_date = data.get("invoice_date")
                if invoice_number and invoice_date:
                    invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
                elif invoice_number:
                    invoice_full_text = f"Счет на оплату № {invoice_number}"
                elif invoice_date:
                    invoice_full_text = f"Счет от {invoice_date}"
                else:
                    invoice_full_text = ""
            
            formatted_invoices.append({
                "id": inv.get("id"),
                "file": inv.get("file", ""),
                "contractor": data.get("contractor"),
                "invoice_number": data.get("invoice_number"),
                "invoice_date": data.get("invoice_date"),
                "total": data.get("total"),
                "invoice_full_text": invoice_full_text,
                "has_lines": bool(inv.get("lines") and len(inv["lines"]) > 0),
                "lines_count": len(inv.get("lines", [])),
                "status": "pending"
            })
        
        print(f"Returning {len(formatted_invoices)} formatted invoices")
        
        return {
            "invoices": formatted_invoices,
            "count": len(formatted_invoices),
            "batch_id": batch_id
        }
        
    except Exception as e:
        log.error(f"Error getting invoices from buffer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------
# APPLY INVOICE METADATA
# -------------------------------------------------------------------

@app.post("/invoice/apply-metadata")
def apply_invoice_metadata(payload: ApplyInvoiceMetadataRequest, db: Session = Depends(get_db)):
    """Применить только метаданные счета без изменения суммы"""
    
    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")

    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "confidence": invoice.get("confidence", 0)
    }

    # Создаем модифицированные данные с обнуленной суммой
    modified_data = invoice_data.copy()
    if "data" in modified_data:
        # Удаляем сумму из данных, если не хотим ее применять
        if "total" in modified_data["data"]:
            del modified_data["data"]["total"]
        if "amount" in modified_data["data"]:
            del modified_data["data"]["amount"]

    # Применяем с указанием не применять полные метаданные
    registry = apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        modified_data,
        apply_full_metadata=False  # Не применяем автоматически contractor и т.д.
    )
    
    # Вручную применяем только выбранные поля
    data = invoice["data"]
    
    if "contractor" in payload.apply_fields and data.get("contractor"):
        registry.contractor = data["contractor"]
    
    if "invoice_number" in payload.apply_fields and data.get("invoice_number"):
        registry.invoice_number = data["invoice_number"]
    
    if "invoice_date" in payload.apply_fields and data.get("invoice_date"):
        registry.invoice_date = data["invoice_date"]
    
    # Обновляем invoice_full_text если нужно
    if "invoice_full_text" in payload.apply_fields and data.get("invoice_full_text"):
        registry.invoice_full_text = data["invoice_full_text"]
    
    db.commit()
    
    return {"status": "ok", "applied_fields": payload.apply_fields}

# -------------------------------------------------------------------
# MANUAL INVOICE MATCH
# -------------------------------------------------------------------

@app.post("/invoice/manual-match")
def manual_invoice_match(payload: ManualInvoiceMatchRequest, db: Session = Depends(get_db)):
    """Ручное сопоставление счета со строкой реестра"""
    
    # 1. Проверяем существование записи реестра
    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")
    
    # 2. Проверяем что запись принадлежит указанному batch
    if registry.imported_batch != payload.batch_id:
        raise HTTPException(400, "Registry item does not belong to this batch")
    
    # 3. Получаем счет из буфера
    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # 4. Подготавливаем данные счета
    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }
    
    # 5. Применяем в зависимости от типа
    if payload.apply_type == "full":
        # Применяем все данные (метаданные + сумму из первой строки)
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=True,
            line_no=0  # Первая строка счета
        )
        
    elif payload.apply_type == "metadata_only":
        # Применяем только метаданные
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=True,
            line_no=None  # Не применяем сумму
        )
        
    elif payload.apply_type == "amount_only":
        # Применяем только сумму из первой строки
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=False,  # Не применяем метаданные
            line_no=0  # Применяем сумму
        )
    
    db.commit()
    
    return {
        "status": "ok",
        "message": f"Invoice applied ({payload.apply_type})",
        "registry_id": registry.id,
        "invoice_id": payload.invoice_id,
        "contractor": registry.contractor,
        "amount": registry.amount,
        "position": registry.position  #  Возвращаем позицию строки 
    }

# -------------------------------------------------------------------
# REORDER REGISTRY
# -------------------------------------------------------------------

@app.post("/registry/reorder")
def reorder_registry(request: ReorderRequest, db: Session = Depends(get_db)):
    """
    Изменение порядка строк в реестре.
    Принимает массив элементов с id и новой позицией.
    """
    print(f"\n=== DEBUG /registry/reorder for batch {request.batch_id} ===")
    
    updated_count = 0
    error_messages = []
    
    for item in request.items:
        try:
            registry_id = item.get("id")
            new_position = item.get("position")
            
            if not registry_id or new_position is None:
                error_messages.append(f"Invalid item: {item}")
                continue
            
            print(f"Updating registry_id {registry_id} to position {new_position}")
            
            registry = db.query(PaymentRegistry).filter(
                PaymentRegistry.id == registry_id,
                PaymentRegistry.imported_batch == request.batch_id
            ).first()
            
            if not registry:
                error_messages.append(f"Registry item {registry_id} not found in batch {request.batch_id}")
                continue
            
            # Обновляем позицию
            old_position = registry.position
            registry.position = new_position
            updated_count += 1
            
            print(f"Updated: id={registry_id}, old={old_position}, new={new_position}")
            
        except Exception as e:
            error_messages.append(f"Error updating registry_id {registry_id}: {str(e)}")
    
    db.commit()
    
    # Получаем обновленный порядок
    registry_preview = build_registry_from_batch(db, request.batch_id)
    
    response = {
        "status": "ok",
        "message": f"Updated {updated_count} items",
        "updated_count": updated_count,
        "registry_preview": registry_preview
    }
    
    if error_messages:
        response["errors"] = error_messages
    
    return response

# -------------------------------------------------------------------
# GET REGISTRY ORDER
# -------------------------------------------------------------------

@app.get("/registry/{batch_id}/order")
def get_registry_order(batch_id: str, db: Session = Depends(get_db)):
    """
    Получить текущий порядок строк реестра.
    Возвращает mapping id -> position.
    """
    registries = (
        db.query(PaymentRegistry.id, PaymentRegistry.position)
        .filter(PaymentRegistry.imported_batch == batch_id)
        .order_by(PaymentRegistry.position)
        .all()
    )
    
    order_map = {registry.id: registry.position for registry in registries}
    
    return {
        "batch_id": batch_id,
        "order": order_map,
        "total_items": len(registries)
    }

# -------------------------------------------------------------------
# ROOT
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Registry Control API"}