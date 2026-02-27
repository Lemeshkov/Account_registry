
# backend/crud.py

from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import re  
import uuid                     
from utils.numbers import parse_number


def _json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def create_imported_request(db: Session, data: Dict[str, Any], batch_id: str, file_name: str, file_type: str):
    payload = dict(data)
    payload['import_batch'] = batch_id
    payload['file_name'] = file_name
    payload['file_type'] = file_type

    obj = models.ImportedRequest(**payload)
    db.add(obj)
    db.flush()
    create_history(db, action="IMPORT", entity="ImportedRequest", entity_id=obj.id, details=payload)
    return obj


def create_payment_registry_item(db: Session, data: Dict[str, Any], batch_id: str, position: Optional[int] = None):
    payload = dict(data)
    payload['imported_batch'] = batch_id
    
    # ⭐⭐ ВАЖНО: Определяем position для сохранения порядка ⭐⭐
    if position is None:
        # Находим максимальное значение position в текущем batch
        max_pos = db.query(func.max(models.PaymentRegistry.position)).filter(
            models.PaymentRegistry.imported_batch == batch_id
        ).scalar() or 0
        position = max_pos + 1
    
    payload['position'] = position
    
    obj = models.PaymentRegistry(**payload)
    db.add(obj)
    db.flush()
    create_history(db, action="CREATE", entity="PaymentRegistry", entity_id=obj.id, details=payload)
    return obj


def create_history(db: Session, action: str, entity: str, entity_id: int = None, user: str = None, details: Any = None):
    safe_details = _json_safe(details)
    entry = models.HistoryLog(
        action=action,
        entity=entity,
        entity_id=entity_id,
        user=user,
        details=safe_details
    )
    db.add(entry)
    return entry


def build_registry_from_batch(db: Session, batch_id: str):
    # ⭐⭐ ВАЖНО: Сортируем по position для сохранения исходного порядка ⭐⭐
    registry_items = (
        db.query(models.PaymentRegistry)
        .filter(models.PaymentRegistry.imported_batch == batch_id)
        .order_by(models.PaymentRegistry.position)  # Сортировка по position
        .all()
    )

    preview = []

    for item in registry_items:
        invoice = item.invoice_details

        # НОРМАЛИЗАЦИЯ
        if isinstance(invoice, str):
            try:
                invoice = json.loads(invoice)
            except Exception:
                invoice = {}

        invoice = invoice or {}
        status = "MATCHED" if invoice else "WAITING_INVOICE"

        # ===== 🏷 ФОРМИРОВАНИЕ "ПОСТАВЩИК" =====
        supplier_display = None
        if item.vehicle:
            supplier_display = item.vehicle.strip().split()[0]
        if item.license_plate:
            m = re.search(r"\d+", item.license_plate)
            if m:
                digits = m.group(0)
                supplier_display = (
                    f"{supplier_display} №{digits}"
                    if supplier_display
                    else f"№{digits}"
                )

        # ==== КОНТРАГЕНТ ====
        contractor = (
           item.contractor.strip()
           if item.contractor and item.contractor.strip()
           else invoice.get("contractor")
        )
        
        # ==== invoice_full_text - создаем если нет ====
        invoice_full_text = invoice.get("invoice_full_text")
        if not invoice_full_text:
            invoice_number = invoice.get("invoice_number")
            invoice_date = invoice.get("invoice_date")
            if invoice_number and invoice_date:
                invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                invoice_full_text = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                invoice_full_text = f"Счет от {invoice_date}"
            else:
                invoice_full_text = ""

        preview.append({
            "id": item.id,
            "position": item.position,  # ⭐⭐ Добавляем position в ответ ⭐⭐
            "batch_id": batch_id,
            "imported_batch": item.imported_batch,
            "supplier": supplier_display,
            "contractor": contractor,
            "invoice_full_text": invoice_full_text,
            "vehicle": item.vehicle,
            "license_plate": item.license_plate,
            "amount": item.amount,
            "vat_amount": item.vat_amount,
            "comment": item.comment,
            "status": status,
            "invoice_confidence": item.invoice_confidence,
            "invoice_id": item.invoice_id,
            "invoice_details": invoice,
            "payer": item.payer,
            "payment_system": item.payment_system,
            "source": {
                "request": bool(item.matched_request_id),
                "invoice": bool(invoice),
            },
        })
    
    print(f"\n=== DEBUG build_registry_from_batch ===")
    print(f"Batch ID: {batch_id}")
    print(f"Found {len(preview)} registry items")
    print(f"Order by position: {[item['position'] for item in preview]}")
    
    return preview


def apply_invoice_ocr_to_registry(
    db: Session, 
    registry_id: int, 
    invoice_data: dict,
    apply_full_metadata: bool = True,
    line_no: int = None
):
    """
    Применить данные счета к строке реестра.
    ⭐⭐ ВАЖНО: Эта функция НЕ меняет position строки! ⭐⭐
    """
    registry = db.query(models.PaymentRegistry).get(registry_id)
    if not registry:
        raise ValueError("PaymentRegistry not found")

    data = invoice_data.get("data") or {}
    confidence = invoice_data.get("confidence")
    applied_fields = []

    # --- Основные поля, которые применяются всегда ---
    if invoice_data.get("id"):
        registry.invoice_id = invoice_data["id"]
        applied_fields.append("invoice_id")
    
    # Сохраняем полные данные счета в details
    registry.invoice_details = data
    applied_fields.append("invoice_details")

    if confidence is not None:
        registry.invoice_confidence = confidence
        applied_fields.append("invoice_confidence")

    # --- Метаданные применяются ТОЛЬКО если apply_full_metadata = True ---
    if apply_full_metadata:
        # Contractor / контрагент
        contractor = data.get("contractor")
        if contractor:
            registry.contractor = contractor
            applied_fields.append("contractor")

        # Invoice full text / реквизиты счета
        invoice_full_text = data.get("invoice_full_text")
        if not invoice_full_text:
            # Собираем из invoice_number и invoice_date
            invoice_number = data.get("invoice_number")
            invoice_date = data.get("invoice_date")
            if invoice_number and invoice_date:
                invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                invoice_full_text = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                invoice_full_text = f"Счет от {invoice_date}"
        
        if invoice_full_text:
            registry.invoice_full_text = invoice_full_text
            applied_fields.append("invoice_full_text")

    # --- Amounts: логика для частичного применения ---
    total = parse_number(data.get("total"))
    vat = parse_number(data.get("vat"))
    
    if line_no is not None:
        # Если указан номер строки, ищем конкретную строку в счете
        invoice_lines = invoice_data.get("lines", [])
        if line_no < len(invoice_lines):
            line_data = invoice_lines[line_no]
            line_total = parse_number(line_data.get("total") or line_data.get("amount"))
            if line_total and line_total > 0:
                registry.amount = line_total
                applied_fields.append("amount (from line)")
    elif total and total > 0:
        # Если не указана строка, применяем общую сумму
        registry.amount = total
        applied_fields.append("amount")
    
    if vat is not None and vat >= 0:
        registry.vat_amount = vat
        applied_fields.append("vat_amount")

    create_history(
        db,
        action="OCR_APPLY",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "confidence": confidence,
            "applied_fields": applied_fields,
            "apply_full_metadata": apply_full_metadata,
            "line_no": line_no,
            "position_unchanged": registry.position,  # ⭐⭐ Сохраняем информацию о позиции ⭐⭐
            "data_preview": {
                "contractor": data.get("contractor"),
                "invoice_number": data.get("invoice_number"),
                "invoice_date": data.get("invoice_date"),
                "total": data.get("total"),
            }
        },
    )

    db.flush()
    return registry


def update_registry_position(db: Session, registry_id: int, position: int):
    """
    Обновить position строки реестра.
    Используется для изменения порядка строк.
    """
    registry = db.query(models.PaymentRegistry).get(registry_id)
    if not registry:
        raise ValueError("PaymentRegistry not found")
    
    old_position = registry.position
    registry.position = position
    
    create_history(
        db,
        action="POSITION_UPDATE",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "old_position": old_position,
            "new_position": position,
            "batch_id": registry.imported_batch
        }
    )
    
    db.flush()
    return registry


def reorder_registry_batch(db: Session, batch_id: str, order_mapping: Dict[int, int]):
    """
    Переупорядочить все строки в batch.
    order_mapping: {registry_id: new_position}
    """
    updated_count = 0
    
    for registry_id, new_position in order_mapping.items():
        try:
            update_registry_position(db, registry_id, new_position)
            updated_count += 1
        except Exception as e:
            print(f"Error updating position for registry_id {registry_id}: {e}")
    
    return updated_count




# -------------------------------------------------------------------
# CRUD для дефектных ведомостей
# -------------------------------------------------------------------

def create_defect_sheet(db: Session, file_name: str, batch_id: Optional[str] = None) -> models.DefectSheet:
    """Создать запись о дефектной ведомости"""
    if not batch_id:
        batch_id = str(uuid.uuid4())
    
    sheet = models.DefectSheet(
        batch_id=batch_id,
        file_name=file_name,
        status="pending"
    )
    db.add(sheet)
    db.flush()  # Чтобы получить id
    return sheet

def create_defect_sheet_items(db: Session, sheet_id: int, items: List[Dict]) -> List[models.DefectSheetItem]:
    """Создать строки дефектной ведомости"""
    created_items = []
    
    for item_data in items:
        item = models.DefectSheetItem(
            sheet_id=sheet_id,
            position=item_data.get("position"),
            address=item_data.get("address"),
            material_name=item_data.get("material_name"),
            requested_quantity=item_data.get("requested_quantity"),
            requirement_number=item_data.get("requirement_number"),
            requirement_date=item_data.get("requirement_date"),
            car_brand=item_data.get("car_brand"),
            license_plate=item_data.get("license_plate"),
            recipient=item_data.get("recipient"),
            weight_tons=item_data.get("weight_tons") or item_data.get("requested_quantity"),
            profile_type=item_data.get("profile_type"),
            profile_params=item_data.get("profile_params"),
            is_calculated=False
        )
        db.add(item)
        created_items.append(item)
    
    db.flush()
    return created_items

def get_defect_sheet(db: Session, sheet_id: int) -> Optional[models.DefectSheet]:
    """Получить дефектную ведомость по ID"""
    return db.query(models.DefectSheet).filter(models.DefectSheet.id == sheet_id).first()

def get_defect_sheet_by_batch(db: Session, batch_id: str) -> Optional[models.DefectSheet]:
    """Получить дефектную ведомость по batch_id"""
    return db.query(models.DefectSheet).filter(models.DefectSheet.batch_id == batch_id).first()

def get_defect_sheet_items(db: Session, sheet_id: int) -> List[models.DefectSheetItem]:
    """Получить все строки дефектной ведомости"""
    return db.query(models.DefectSheetItem).filter(
        models.DefectSheetItem.sheet_id == sheet_id
    ).order_by(models.DefectSheetItem.position).all()

def update_defect_sheet_status(db: Session, sheet_id: int, status: str):
    """Обновить статус ведомости"""
    sheet = db.query(models.DefectSheet).filter(models.DefectSheet.id == sheet_id).first()
    if sheet:
        sheet.status = status
        db.flush()

def update_defect_sheet_item_calculation(
    db: Session, 
    item_id: int, 
    calculated_meters: float,
    formula_used: str
):
    """Обновить результат расчета для строки"""
    item = db.query(models.DefectSheetItem).filter(models.DefectSheetItem.id == item_id).first()
    if item:
        item.calculated_meters = calculated_meters
        item.formula_used = formula_used
        item.is_calculated = True
        item.calculated_at = func.now()
        db.flush()

def mark_items_for_calculation(db: Session, item_ids: List[int], selected: bool = True):
    """Отметить строки для пересчета"""
    db.query(models.DefectSheetItem).filter(
        models.DefectSheetItem.id.in_(item_ids)
    ).update({models.DefectSheetItem.selected_for_calculation: selected}, synchronize_session=False)
    db.flush()

def delete_defect_sheet(db: Session, sheet_id: int):
    """Удалить ведомость (каскадно удалит и строки)"""
    db.query(models.DefectSheet).filter(models.DefectSheet.id == sheet_id).delete()
    db.flush()

def create_defect_sheet(db: Session, batch_id: str, file_name: str) -> models.DefectSheet:
    """Создает запись о дефектной ведомости"""
    sheet = models.DefectSheet(
        batch_id=batch_id,
        file_name=file_name,
        status="pending",
        # uploaded_at=datetime.now()
    )
    db.add(sheet)
    db.flush()
    return sheet    