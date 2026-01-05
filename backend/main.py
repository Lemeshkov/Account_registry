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

from .database import get_db, engine, SessionLocal
from .models import Base
from .parsers.excel_parser import ExcelParser
from .parsers.invoice_parser import parse_invoice_from_pdf
from .crud import (
    build_registry_from_batch,
    apply_invoice_ocr_to_registry,
    create_imported_request,
    create_payment_registry_item,
)
from .services.invoice_matcher import try_match_invoice
from .services.invoice_buffer import add_invoice, pop_invoices

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
INVOICE_UPLOAD_DIR = BASE_UPLOAD_DIR / "invoices"

BASE_UPLOAD_DIR.mkdir(exist_ok=True)
INVOICE_UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=BASE_UPLOAD_DIR), name="uploads")

# -------------------------------------------------------------------
# BACKGROUND OCR TASK
# -------------------------------------------------------------------

def process_invoice_pdf_background(file_path: Path, batch_id: str):
    """
    Фоновая задача OCR + матчинг
    """
    db = SessionLocal()
    try:
        log.info(f"OCR started for {file_path}")

        parsed = parse_invoice_from_pdf(file_path)
        if not parsed or "data" not in parsed:
            log.error("Invoice parsing failed")
            return

        # сохраняем batch_id в parsed для отслеживания
        parsed["batch_id"] = batch_id

        match = try_match_invoice(db, parsed["data"])
        if match:
            apply_invoice_ocr_to_registry(db, match.id, parsed)
            db.commit()
            log.info(f"Invoice applied to registry {match.id}")
        else:
            # 🔥 СОЗДАЁМ НОВУЮ СТРОКУ В РЕЕСТРЕ
           from .crud import parse_number

           log.info(
    f"PDF parsed totals: total={parsed['data'].get('total')} "
    f"→ {parse_number(parsed['data'].get('total'))}"
)


        create_payment_registry_item(
            db,
            {
                "supplier": parsed["data"].get("supplier"),
                "vehicle": None,
                "license_plate": None,
                "amount": parse_number(parsed["data"].get("total")),
                "vat_amount": parse_number(parsed["data"].get("vat")),
                "comment": "Счёт (PDF)",
                "matched_request_id": None,
                "invoice_details": parsed,
             },
             batch_id,
            )

        db.commit()
        log.info("Invoice created as new registry item")

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
        raise HTTPException(status_code=400, detail="Supported: xlsx, xls, pdf")
    
    if not batch_id:
     batch_id = str(uuid.uuid4())
    file_path = BASE_UPLOAD_DIR / f"{batch_id}_{file.filename}"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    file.file.close()

    # ----------------------------------------------------------------
    # EXCEL
    # ----------------------------------------------------------------
    if ext in ("xlsx", "xls"):
        parser = ExcelParser()
        try:
            parsed_rows = parser.parse_file(file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Excel parse error: {e}")

        from .crud import create_payment_registry_item

        for row in parsed_rows:
            create_imported_request(db, row, batch_id, file.filename, ext)
            create_payment_registry_item(
                db,
                {
                    "supplier": row.get("supplier"),
                    "vehicle": row.get("car_brand"),
                    "license_plate": row.get("license_plate"),
                    "amount": row.get("amount") or 0,
                    "vat_amount": row.get("vat_amount") or 0,
                    "comment": row.get("item_name"),
                    "matched_request_id": None,
                },
                batch_id,
            )

        db.commit()

        registry_preview = build_registry_from_batch(db, batch_id)

        # applied = 0
        # for invoice in pop_invoices():
        #     match = try_match_invoice(db, invoice["data"])
        #     if match:
        #         apply_invoice_ocr_to_registry(db, match.id, invoice)
        #         applied += 1

        # db.commit()

        return {
            "message": f"Excel imported, {len(parsed_rows)} rows processed",
            "batch_id": batch_id,
            "registry_preview": registry_preview,
          
        }

    # ----------------------------------------------------------------
    # PDF — фоновая обработка
    # ----------------------------------------------------------------
    if ext == "pdf":
        background_tasks.add_task(
            process_invoice_pdf_background,
            file_path,
            batch_id
        )

        return {
            "message": "Invoice accepted for processing",
            "status": "processing",
            "batch_id": batch_id,
        }

# -------------------------------------------------------------------
# PREVIEW ENDPOINT
# -------------------------------------------------------------------

@app.get("/invoice/{batch_id}/preview")
def get_invoice_preview(batch_id: str, db: Session = Depends(get_db)):
    """
    Возвращает preview реестра для batch_id
    и количество непримененных счетов
    """
    registry_preview = build_registry_from_batch(db, batch_id)
    pending = [inv for inv in pop_invoices() if inv.get("batch_id") == batch_id]

    return {
        "registry_preview": registry_preview,
        "pending_invoices": len(pending),
    }

# -------------------------------------------------------------------
# ROOT
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Registry Control API"}
