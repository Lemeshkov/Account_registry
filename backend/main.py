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
from .database import get_db, engine, SessionLocal
from .models import Base
from .parsers.excel_parser import ExcelParser
from .parsers.invoice_parser import parse_invoice_from_pdf
from .crud import (
    build_registry_from_batch,
    apply_invoice_ocr_to_registry,
    create_imported_request,
    create_payment_registry_item,
    create_history,
)
from .services.invoice_matcher import try_match_invoice
from decimal import Decimal
from backend.models import PaymentRegistry, InvoiceLine
from backend.services.invoice_buffer import (
    list_invoices,
    add_invoice,
    save_invoice_lines,
    mark_invoice_line_used,
)
from backend.services.invoice_buffer import get_invoice

log = logging.getLogger(__name__)

# -------------------------------------------------------------------
# APP
# -------------------------------------------------------------------

app = FastAPI(title="Registry Control API", version="1.0.0")

class ApplyInvoiceLineRequest(BaseModel):
    invoice_id: str
    line_no: int
    registry_id: int


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
        parsed = parse_invoice_from_pdf(file_path)
        if not parsed:
            return

        parsed["id"] = str(uuid.uuid4())
        parsed["batch_id"] = batch_id
        parsed["file"] = file_path.name

        # --- TRY MATCH ---
        match = try_match_invoice(db, parsed["data"], batch_id=batch_id)

        #  СОХРАНЯЕМ СТРОКИ СЧЕТА ВСЕГДА
        save_invoice_lines(
            db,
            invoice_id=parsed["id"],
            batch_id=batch_id,
            lines=parsed.get("lines", []),
        )

        # --- MATCH ---
        if match:
            apply_invoice_ocr_to_registry(db, match.id, parsed)
            db.commit()
            return

        # --- UNMATCHED ---
        add_invoice(parsed)

        registries = (
            db.query(PaymentRegistry)
            .filter(PaymentRegistry.imported_batch == batch_id)
            .all()
        )

        # 🔹 ОБЕСПЕЧИВАЕМ, ЧТО invoice_id НЕ NULL
        for r in registries:
            if r.invoice_id is None:
                r.invoice_id = parsed["id"]

        # безопасный auto-apply для единственной строки
        if len(registries) == 1:
           registry = registries[0]
           apply_invoice_ocr_to_registry(db, registry.id, parsed)

        db.commit()

    except Exception:
        db.rollback()
        log.exception("OCR failed")
    finally:
        db.close()

# -------------------------------------------------------------------
# APPLY INVOICE LINE 
# -------------------------------------------------------------------

from backend.services.invoice_buffer import get_invoice

@app.post("/invoice/apply-line")
def apply_invoice_line(payload: ApplyInvoiceLineRequest, db: Session = Depends(get_db)):
    log.info(
        "[APPLY_LINE] invoice_id=%s line_no=%s registry_id=%s",
        payload.invoice_id,
        payload.line_no,
        payload.registry_id,
    )

    line = (
        db.query(InvoiceLine)
        .filter(
            InvoiceLine.invoice_id == payload.invoice_id,
            InvoiceLine.line_no == payload.line_no,
            InvoiceLine.used.is_(False),
        )
        .first()
    )
    if not line:
        log.warning("[APPLY_LINE] invoice line not found")
        raise HTTPException(404, "Invoice line not found")

    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        log.warning("[APPLY_LINE] registry not found")
        raise HTTPException(404, "Registry item not found")

    # 🔥 ЕДИНСТВЕННЫЙ ИСТОЧНИК OCR
    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        log.error("[APPLY_LINE] invoice not found in buffer")
        raise HTTPException(404, "Invoice not found")

    log.info("[APPLY_LINE] OCR DATA FROM BUFFER: %s", invoice["data"])

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
    }

    # ⬇️ подменяем сумму выбранной строкой
    invoice_data["data"]["total"] = float(line.total) if line.total else None

    log.info(
        "[APPLY_LINE] FINAL DATA BEFORE APPLY: %s",
        invoice_data["data"],
    )

    apply_invoice_ocr_to_registry(db, registry.id, invoice_data)

    mark_invoice_line_used(db, payload.invoice_id, payload.line_no)

    db.commit()

    log.info(
        "[APPLY_LINE] APPLIED OK registry_id=%s contractor=%s amount=%s",
        registry.id,
        registry.contractor,
        registry.amount,
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
# UPLOAD
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
            parsed_rows = parser.parse_file(file_path)
        except Exception as e:
            raise HTTPException(500, f"Excel parse error: {e}")

        grouped: dict[str, list[dict]] = defaultdict(list)

        for row in parsed_rows:
            plate = row.get("license_plate")
            if plate:
                grouped[plate].append(row)

        for plate, rows in grouped.items():
            for row in rows:
                create_imported_request(db, row, batch_id, file.filename, ext)

            first = rows[0]
            comments = list(
                dict.fromkeys(
                    r["item_name"] for r in rows if r.get("item_name")
                )
            )

            create_payment_registry_item(
                db,
                {
                    "supplier": None,
                    "vehicle": first.get("car_brand"),
                    "license_plate": plate,
                    "amount": 0,
                    "vat_amount": 0,
                    "comment": "; ".join(comments),
                    "matched_request_id": None,
                },
                batch_id,
            )

        db.commit()

        return {
            "message": f"Excel imported, {len(parsed_rows)} rows processed",
            "batch_id": batch_id,
            "registry_preview": build_registry_from_batch(db, batch_id),
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
    return {
        "registry_preview": build_registry_from_batch(db, batch_id),
        "pending_invoices": len(list_invoices(batch_id)),
    }

# -------------------------------------------------------------------
# UNMATCHED
# -------------------------------------------------------------------

@app.get("/invoices/unmatched/{batch_id}")
def unmatched(batch_id: str):
    return list_invoices(batch_id)

# -------------------------------------------------------------------
# ROOT
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Registry Control API"}

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


