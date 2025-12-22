
# backend/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os, uuid, shutil

from .database import get_db, engine
from .models import Base, ImportedRequest, PaymentRegistry
from .parsers.excel_parser import ExcelParser
from .parsers.pdf_parser import PDFParser
from .parsers.invoice_pdf_parser import InvoicePDFParser
from . import crud, schemas
import pandas as pd

# создаём таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Registry Control API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Папка для загрузки файлов
UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Делаем загруженные файлы доступными через URL
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.post("/upload", summary="Upload Excel or PDF and import requests")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = file.filename.split('.')[-1].lower()
    if ext not in ("xlsx", "xls", "pdf"):
        raise HTTPException(status_code=400, detail="Supported: xlsx, xls, pdf")

    batch_id = str(uuid.uuid4())
    safe_filename = f"{batch_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    # сохраняем файл
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    file.file.close()

    # выбираем парсер
    if ext in ("xlsx", "xls"):
        parser = ExcelParser()
    else:
        parser = InvoicePDFParser() if "счет" in file.filename.lower() else PDFParser()

    try:
        parsed_rows = parser.parse_file(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Parsing error: {e}")

    # Сохраняем заявки и сразу формируем реестр
    try:
        for row in parsed_rows:
            crud.create_imported_request(db, row, batch_id, file.filename, ext)
        db.commit()
        # формируем preview реестра
        registry_preview = crud.build_registry_from_batch(db, batch_id)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    return {
        "message": "Imported and added to registry",
        "count": len(parsed_rows),
        "batch_id": batch_id,
        "registry_preview": registry_preview
    }



@app.get("/requests", response_model=list[schemas.ImportedRequest])
def get_requests(limit: int = 200, db: Session = Depends(get_db)):
    return crud.list_imported_requests(db, limit=limit)


@app.post("/registries", summary="Create payment registry from JSON list")
def create_registry(items: list[schemas.PaymentRegistryCreate] = Body(...), db: Session = Depends(get_db)):
    batch_id = str(uuid.uuid4())
    created = []
    try:
        for it in items:
            d = it.model_dump()
            obj = crud.create_payment_registry_item(db, d, batch_id=batch_id)
            created.append(obj)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    return {"created": len(created), "batch_id": batch_id}


@app.get("/registries", response_model=list[schemas.PaymentRegistry])
def get_registries(limit: int = 200, db: Session = Depends(get_db)):
    return crud.list_payment_registry(db, limit=limit)


@app.post("/compare/{registry_batch}", summary="Compare registry batch to imported requests and auto-link")
def compare_registry_batch(registry_batch: str, db: Session = Depends(get_db)):
    regs = db.query(PaymentRegistry).filter_by(imported_batch=registry_batch).all()
    report = {"linked": [], "unmatched": []}
    for r in regs:
        matches = crud.find_matches(db, r)
        if matches:
            crud.link_registry_to_request(db, r, matches[0])
            report["linked"].append({"registry_id": r.id, "matched_request_id": matches[0].id})
        else:
            report["unmatched"].append({"registry_id": r.id})
    db.commit()
    return report


@app.get("/history", response_model=list[schemas.HistoryLogItem])
def get_history(limit: int = 200, db: Session = Depends(get_db)):
    q = db.query(__import__("backend.models").HistoryLog).order_by(__import__("backend.models").HistoryLog.id.desc()).limit(limit).all()
    return q


@app.get("/")
def root():
    return {"message": "Registry Control API (Postgres-ready)"}
