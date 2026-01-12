# backend/main.py

from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException,
    Depends,
    BackgroundTasks,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pathlib import Path
import uuid
import shutil
import logging
from collections import defaultdict

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

from backend.models import PaymentRegistry, InvoiceLine
from backend.services.invoice_buffer import (
    list_invoices,
    add_invoice,
    save_invoice_lines,
    mark_invoice_line_used,
)

log = logging.getLogger(__name__)

# -------------------------------------------------------------------
# APP
# -------------------------------------------------------------------

app = FastAPI(title="Registry Control API", version="1.0.0")


@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        log.info("Database connected and tables ensured")
    except Exception:
        log.exception("Database connection failed (startup continues)")


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
    """
    OCR → match → apply
    PDF не создаёт PaymentRegistry
    """
    db = SessionLocal()
    try:
        log.info(f"OCR started for {file_path}")

        parsed = parse_invoice_from_pdf(file_path)
        if not parsed:
            log.warning("Invoice parsing returned empty result")
            return

        parsed["id"] = str(uuid.uuid4())
        parsed["batch_id"] = batch_id
        parsed["file"] = file_path.name

        match = try_match_invoice(
            db,
            parsed["data"],
            batch_id=batch_id,
        )

        if not match:
            add_invoice(parsed)

             #  ПРИВЯЗЫВАЕМ invoice_id ко ВСЕМ строкам batch
            db.query(PaymentRegistry).filter(
                 PaymentRegistry.imported_batch == batch_id,
                 PaymentRegistry.invoice_id.is_(None)
            ).update(
                {PaymentRegistry.invoice_id: parsed["id"]},
                 synchronize_session=False
            )

            save_invoice_lines(
                db,
                invoice_id=parsed["id"],
                batch_id=batch_id,
                lines=parsed.get("lines", []),
            )

            db.commit()
            log.info("Invoice stored as unmatched", extra={"invoice_id": parsed["id"]})
            return

        apply_invoice_ocr_to_registry(db, match.id, parsed)
        db.commit()

        log.info(f"Invoice applied to registry {match.id}")

    except Exception:
        db.rollback()
        log.exception("Background OCR failed")
    finally:
        db.close()

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
# APPLY INVOICE LINE
# -------------------------------------------------------------------

@app.post("/invoice/apply-line")
def apply_invoice_line(
    invoice_id: str,
    line_no: int,
    registry_id: int,
    db: Session = Depends(get_db),
):
    line = (
        db.query(InvoiceLine)
        .filter(
            InvoiceLine.invoice_id == invoice_id,
            InvoiceLine.line_no == line_no,
            InvoiceLine.used.is_(False),
        )
        .first()
    )

    if not line:
        raise HTTPException(404, "Invoice line not found or already used")

    registry = db.query(PaymentRegistry).get(registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")

    registry.amount = line.total
    mark_invoice_line_used(db, invoice_id, line_no)

    create_history(
        db,
        action="APPLY_INVOICE_LINE",
        entity="PaymentRegistry",
        entity_id=registry.id,
        details={
            "invoice_id": invoice_id,
            "line_no": line_no,
            "amount": float(line.total),
        },
    )

    db.commit()
    return {"status": "ok"}

# -------------------------------------------------------------------
# ROOT
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Registry Control API"}

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
