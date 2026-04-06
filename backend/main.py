

# backend/main.py
from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException,
    Depends,
    BackgroundTasks,
    Form,
    WebSocket,
    WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
import uuid
import shutil
import logging
from collections import defaultdict
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import os
import asyncio
import time

# JWT и пароли
from jose import JWTError, jwt
from passlib.context import CryptContext

# Импорты из проекта
from database import get_db, SessionLocal
from models import (
    PaymentRegistry,
    InvoiceLine,
    DefectSheet,
    DefectSheetItem,
    User,
    ApprovalNotification
)
from parsers.excel_parser import ExcelParser
from parsers.invoice_parser import parse_invoice_from_pdf
from crud import (
    build_registry_from_batch,
    apply_invoice_ocr_to_registry,
    create_imported_request,
    create_payment_registry_item,
    create_history,
    update_registry_position,
    reorder_registry_batch,
    create_defect_sheet,
    create_defect_sheet_items,
    get_defect_sheet,
    get_defect_sheet_by_batch,
    get_defect_sheet_items,
    update_defect_sheet_status,
    update_defect_sheet_item_calculation,
    mark_items_for_calculation,
    delete_defect_sheet,
)
from redis_manager import redis_manager
from services.invoice_matcher import try_match_invoice
from services.invoice_buffer import (
    list_invoices,
    add_invoice,
    save_invoice_lines,
    mark_invoice_line_used,
    get_invoice,
)
from parsers.defect_parser import parse_defect_sheet
from services.metal_calculator import metal_calculator
from websocket_manager import websocket_manager

log = logging.getLogger(__name__)

# -------------------------------------------------------------------
# APP
# -------------------------------------------------------------------

app = FastAPI(title="Registry Control API", version="1.0.0")

# -------------------------------------------------------------------
# CORS MIDDLEWARE
# -------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",  
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Конфигурация JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# -------------------------------------------------------------------
# PYDANTIC МОДЕЛИ
# -------------------------------------------------------------------

# Модели для аутентификации
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str
    role: str = "user"

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    is_active: bool
    
    model_config = {
        "from_attributes": True
    }

# Модели для инвойсов
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
    apply_type: str = "full"

class ReorderRequest(BaseModel):
    batch_id: str
    items: List[Dict[str, Any]]

class ApplyMultipleLinesRequest(BaseModel):
    invoice_id: str
    line_nos: List[int]
    registry_id: int
    batch_id: str

class ApplyAllLinesRequest(BaseModel):
    invoice_id: str
    registry_id: int
    batch_id: str

# Модели для дефектной ведомости
class DefectSheetResponse(BaseModel):
    id: int
    batch_id: str
    file_name: str
    upload_date: datetime
    status: str
    total_items: int = 0
    
    model_config = {
        "from_attributes": True
    }

class DefectSheetItemResponse(BaseModel):
    id: int
    position: Optional[int]
    address: Optional[str]
    material_name: Optional[str]
    requested_quantity: Optional[float]
    weight_tons: Optional[float]
    profile_type: Optional[str]
    profile_params: Optional[Dict]
    calculated_meters: Optional[float]
    formula_used: Optional[str]
    is_calculated: bool
    selected_for_calculation: bool
    
    model_config = {
        "from_attributes": True
    }

class DefectSheetPreviewResponse(BaseModel):
    sheet_id: int
    batch_id: str
    file_name: str
    upload_date: datetime
    status: str
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    total_items: int
    items: List[DefectSheetItemResponse]

class CalculationRequest(BaseModel):
    sheet_id: int
    item_ids: Optional[List[int]] = None
    profile_type: str = "pipe"
    profile_params: Dict[str, Any] = {}

class ExportRequest(BaseModel):
    sheet_id: int
    format: str = "excel"

class CreateDefectItemRequest(BaseModel):
    sheet_id: int
    position: Optional[int] = None
    address: Optional[str] = None
    material_name: Optional[str] = None
    requested_quantity: Optional[float] = None
    weight_tons: Optional[float] = None
    profile_type: Optional[str] = None
    profile_params: Optional[Dict[str, Any]] = None
    calculated_meters: Optional[float] = None
    formula_used: Optional[str] = None
    is_calculated: bool = False

class BatchDeleteRequest(BaseModel):
    item_ids: List[int]

class UpdateDefectItemFieldRequest(BaseModel):
    field: str
    value: Any

# Модели для согласования
class SubmitForApprovalRequest(BaseModel):
    sheet_id: int
    comment: Optional[str] = None

class ApprovalRequest(BaseModel):
    sheet_id: int
    approved: bool
    comment: Optional[str] = None

# -------------------------------------------------------------------
# ФУНКЦИИ АУТЕНТИФИКАЦИИ
# -------------------------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# -------------------------------------------------------------------


BASE_UPLOAD_DIR = Path("uploads")
BASE_UPLOAD_DIR.mkdir(exist_ok=True)

DEFECT_UPLOAD_DIR = Path("uploads/defect_sheets")
DEFECT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=BASE_UPLOAD_DIR), name="uploads")

# -------------------------------------------------------------------
# ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ
# -------------------------------------------------------------------

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# -------------------------------------------------------------------
# BACKGROUND OCR TASK
# -------------------------------------------------------------------

def process_invoice_pdf_background(file_path: Path, batch_id: str):
    db = SessionLocal()
    try:
        parsed = parse_invoice_from_pdf(file_path)
        if not parsed:
            log.error("[OCR] Failed to parse PDF: %s", file_path.name)
            return
        
        invoice_id = str(uuid.uuid4())
        parsed["id"] = invoice_id
        parsed["batch_id"] = batch_id
        parsed["file"] = file_path.name
        
        if parsed.get("lines"):
            log.info("[OCR] Saving %d invoice lines to database", len(parsed["lines"]))
            save_invoice_lines(
                db,
                invoice_id=invoice_id,
                batch_id=batch_id,
                lines=parsed.get("lines", []),
            )
        
        if 'data' not in parsed:
            parsed['data'] = {}
        
        if 'invoice_full_text' not in parsed['data']:
            invoice_number = parsed['data'].get('invoice_number')
            invoice_date = parsed['data'].get('invoice_date')
            if invoice_number and invoice_date:
                parsed['data']['invoice_full_text'] = f"Счет на оплату № {invoice_number} от {invoice_date}"
            elif invoice_number:
                parsed['data']['invoice_full_text'] = f"Счет на оплату № {invoice_number}"
            elif invoice_date:
                parsed['data']['invoice_full_text'] = f"Счет от {invoice_date}"
        
        add_invoice(parsed)
        db.commit()
        
        try:
            websocket_manager.broadcast_to_batch(batch_id, {
                "type": "invoice_processed",
                "batch_id": batch_id,
                "invoice_id": invoice_id,
                "filename": file_path.name,
                "contractor": parsed.get('data', {}).get('contractor'),
                "status": "completed"
            })
        except Exception as e:
            log.error(f"Failed to send WebSocket notification: {e}")
        
    except Exception as e:
        db.rollback()
        log.exception("[OCR] Failed to process invoice %s: %s", file_path.name, str(e))
    finally:
        db.close()

# -------------------------------------------------------------------
# ЭНДПОИНТЫ ДЛЯ ИНВОЙСОВ
# -------------------------------------------------------------------

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
        log.warning("[APPLY_LINE] invoice line not found or already used: invoice_id=%s, line_no=%s",
                   payload.invoice_id, payload.line_no)

    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")

    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }

    apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        invoice_data,
        apply_full_metadata=True,
        line_no=payload.line_no
    )

    if line:
        mark_invoice_line_used(db, payload.invoice_id, payload.line_no)

    db.commit()

    try:
        websocket_manager.broadcast_to_batch(registry.imported_batch, {
            "type": "invoice_applied",
            "batch_id": registry.imported_batch,
            "registry_id": registry.id,
            "invoice_id": payload.invoice_id,
            "contractor": registry.contractor
        })
    except Exception as e:
        log.error(f"Failed to send WebSocket notification: {e}")

    return {"status": "ok"}

@app.post("/invoice/apply-batch/{batch_id}")
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

@app.post("/upload")
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

    if ext in ("xlsx", "xls"):
        parser = ExcelParser()
        try:
            parsed_data = parser.parse_file_with_positions(file_path)
        except Exception as e:
            raise HTTPException(500, f"Excel parse error: {e}")

        grouped: dict[str, list[dict]] = defaultdict(list)

        for row_data, excel_position in parsed_data:
            plate = row_data.get("license_plate")
            if plate:
                grouped[plate].append({
                    "row_data": row_data,
                    "excel_position": excel_position
                })

        created_items = []
        
        for plate, rows in grouped.items():
            for row_info in rows:
                create_imported_request(db, row_info["row_data"], batch_id, file.filename, ext)

            first = rows[0]
            comments = list(
                dict.fromkeys(
                    row_info["row_data"]["item_name"] for row_info in rows if row_info["row_data"].get("item_name")
                )
            )

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
                position=first["excel_position"]
            )
            created_items.append(registry_item)

        db.commit()

        registry_preview = build_registry_from_batch(db, batch_id)
    
        return {
            "message": f"Excel imported, {len(parsed_data)} rows processed",
            "batch_id": batch_id,
            "registry_preview": registry_preview,
            "data": registry_preview,
        }

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

@app.get("/invoice/{batch_id}/preview")
def get_invoice_preview(batch_id: str, db: Session = Depends(get_db)):
    registry_preview = build_registry_from_batch(db, batch_id)
    pending_invoices = list_invoices(batch_id)
    
    invoices_by_id = {}
    for inv in pending_invoices:
        inv_id = inv.get("id")
        if inv_id and inv.get("data"):
            data = inv["data"]
            
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
    
    updated_registry = []
    for item in registry_preview:
        invoice_id = item.get("invoice_id")
        
        if invoice_id and invoice_id in invoices_by_id:
            invoice_data = invoices_by_id[invoice_id]
            current_details = item.get("invoice_details", {})
            if not isinstance(current_details, dict):
                current_details = {}
            updated_details = {**current_details, **invoice_data}
            item["invoice_details"] = updated_details
            
            if not item.get("contractor") and invoice_data.get("contractor"):
                item["contractor"] = invoice_data.get("contractor")
        
        updated_registry.append(item)
    
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
    
    return {
        "registry_preview": updated_registry,
        "pending_invoices": len(pending_invoices),
        "invoices": invoices_data,
        "batch_id": batch_id,
    }

@app.get("/invoices/unmatched/{batch_id}")
def unmatched(batch_id: str):
    return list_invoices(batch_id)

@app.get("/invoice/{invoice_id}/lines")
def get_invoice_lines_endpoint(
    invoice_id: str,
    db: Session = Depends(get_db),
):
    from services.invoice_buffer import get_invoice
    
    invoice_in_buffer = get_invoice(invoice_id)
    
    db_lines = (
        db.query(InvoiceLine)
        .filter(InvoiceLine.invoice_id == invoice_id)
        .order_by(InvoiceLine.line_no)
        .all()
    )
    
    result = []
    
    if db_lines:
        for l in db_lines:
            try:
                line_data = {
                    "line_no": l.line_no,
                    "description": l.description,
                    "quantity": l.quantity,
                    "price": float(l.price) if l.price else None,
                    "total": float(l.total) if l.total else None,
                    "used": l.used,
                }
                result.append(line_data)
            except Exception as e:
                print(f"  Error formatting line {l.line_no}: {e}")
    elif invoice_in_buffer and 'lines' in invoice_in_buffer:
        buffer_lines = invoice_in_buffer.get('lines', [])
        
        for i, line in enumerate(buffer_lines):
            try:
                line_data = {
                    "line_no": line.get('line_no', i + 1),
                    "description": line.get('description', ''),
                    "quantity": int(line.get('qty', 1)),
                    "price": float(line.get('price', 0)) if line.get('price') else 0,
                    "total": float(line.get('total', 0)) if line.get('total') else 0,
                    "used": line.get('used', False),
                }
                result.append(line_data)
            except Exception as e:
                print(f"  Error formatting buffer line {i}: {e}")
    
    return result

@app.get("/registry/{batch_id}/invoices-from-buffer")
def get_invoices_from_buffer(batch_id: str):
    try:
        pending_invoices = list_invoices(batch_id)
        
        formatted_invoices = []
        for inv in pending_invoices:
            data = inv.get("data", {})
            
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
        
        return {
            "invoices": formatted_invoices,
            "count": len(formatted_invoices),
            "batch_id": batch_id
        }
        
    except Exception as e:
        log.error(f"Error getting invoices from buffer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/invoice/apply-metadata")
def apply_invoice_metadata(payload: ApplyInvoiceMetadataRequest, db: Session = Depends(get_db)):
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

    modified_data = invoice_data.copy()
    if "data" in modified_data:
        if "total" in modified_data["data"]:
            del modified_data["data"]["total"]
        if "amount" in modified_data["data"]:
            del modified_data["data"]["amount"]

    registry = apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        modified_data,
        apply_full_metadata=False
    )
    
    data = invoice["data"]
    
    if "contractor" in payload.apply_fields and data.get("contractor"):
        registry.contractor = data["contractor"]
    
    if "invoice_number" in payload.apply_fields and data.get("invoice_number"):
        registry.invoice_number = data["invoice_number"]
    
    if "invoice_date" in payload.apply_fields and data.get("invoice_date"):
        registry.invoice_date = data["invoice_date"]
    
    if "invoice_full_text" in payload.apply_fields and data.get("invoice_full_text"):
        registry.invoice_full_text = data["invoice_full_text"]
    
    db.commit()
    
    return {"status": "ok", "applied_fields": payload.apply_fields}

@app.post("/invoice/manual-match")
def manual_invoice_match(payload: ManualInvoiceMatchRequest, db: Session = Depends(get_db)):
    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")
    
    if registry.imported_batch != payload.batch_id:
        raise HTTPException(400, "Registry item does not belong to this batch")
    
    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }
    
    if payload.apply_type == "full":
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=True,
            line_no=0
        )
        
    elif payload.apply_type == "metadata_only":
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=True,
            line_no=None
        )
        
    elif payload.apply_type == "amount_only":
        apply_invoice_ocr_to_registry(
            db, registry.id, invoice_data,
            apply_full_metadata=False,
            line_no=0
        )
    
    db.commit()
    
    return {
        "status": "ok",
        "message": f"Invoice applied ({payload.apply_type})",
        "registry_id": registry.id,
        "invoice_id": payload.invoice_id,
        "contractor": registry.contractor,
        "amount": registry.amount,
        "position": registry.position
    }

@app.post("/registry/reorder")
def reorder_registry(request: ReorderRequest, db: Session = Depends(get_db)):
    updated_count = 0
    error_messages = []
    
    for item in request.items:
        try:
            registry_id = item.get("id")
            new_position = item.get("position")
            
            if not registry_id or new_position is None:
                error_messages.append(f"Invalid item: {item}")
                continue
            
            registry = db.query(PaymentRegistry).filter(
                PaymentRegistry.id == registry_id,
                PaymentRegistry.imported_batch == request.batch_id
            ).first()
            
            if not registry:
                error_messages.append(f"Registry item {registry_id} not found in batch {request.batch_id}")
                continue
            
            old_position = registry.position
            registry.position = new_position
            updated_count += 1
            
        except Exception as e:
            error_messages.append(f"Error updating registry_id {registry_id}: {str(e)}")
    
    db.commit()
    
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

@app.get("/registry/{batch_id}/order")
def get_registry_order(batch_id: str, db: Session = Depends(get_db)):
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

@app.post("/invoice/apply-multiple-lines")
def apply_multiple_invoice_lines(payload: ApplyMultipleLinesRequest, db: Session = Depends(get_db)):
    log.info(
        "[APPLY_MULTIPLE] invoice_id=%s lines=%s registry_id=%s",
        payload.invoice_id,
        payload.line_nos,
        payload.registry_id,
    )

    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")

    if registry.imported_batch != payload.batch_id:
        raise HTTPException(400, "Registry item does not belong to this batch")

    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    total_amount = 0
    applied_lines = []
    
    for line_no in payload.line_nos:
        line = (
            db.query(InvoiceLine)
            .filter(
                InvoiceLine.invoice_id == payload.invoice_id,
                InvoiceLine.line_no == line_no,
                InvoiceLine.used.is_(False),
            )
            .first()
        )
        
        if line:
            try:
                line_total = float(line.total) if line.total else 0
                total_amount += line_total
                applied_lines.append(line_no)
                
                mark_invoice_line_used(db, payload.invoice_id, line_no)
            except (ValueError, TypeError):
                log.warning(f"Invalid total for line {line_no}: {line.total}")
        else:
            log.warning(f"Line {line_no} not found or already used")

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }

    modified_data = invoice_data.copy()
    if "data" in modified_data:
        modified_data["data"]["total"] = str(total_amount)
    
    apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        modified_data,
        apply_full_metadata=True,
        line_no=None
    )

    registry.amount = total_amount

    db.commit()

    return {
        "status": "ok",
        "message": f"Applied {len(applied_lines)} lines",
        "total_amount": total_amount,
        "lines_applied": applied_lines,
        "registry_id": registry.id
    }

@app.post("/invoice/apply-all-lines")
def apply_all_invoice_lines(payload: ApplyAllLinesRequest, db: Session = Depends(get_db)):
    log.info(
        "[APPLY_ALL] invoice_id=%s registry_id=%s",
        payload.invoice_id,
        payload.registry_id,
    )

    registry = db.query(PaymentRegistry).get(payload.registry_id)
    if not registry:
        raise HTTPException(404, "Registry item not found")

    if registry.imported_batch != payload.batch_id:
        raise HTTPException(400, "Registry item does not belong to this batch")

    invoice = get_invoice(payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    lines = (
        db.query(InvoiceLine)
        .filter(
            InvoiceLine.invoice_id == payload.invoice_id,
            InvoiceLine.used.is_(False),
        )
        .all()
    )

    total_amount = 0
    applied_lines = []
    
    for line in lines:
        try:
            line_total = float(line.total) if line.total else 0
            total_amount += line_total
            applied_lines.append(line.line_no)
            
            mark_invoice_line_used(db, payload.invoice_id, line.line_no)
        except (ValueError, TypeError):
            log.warning(f"Invalid total for line {line.line_no}: {line.total}")

    invoice_data = {
        "id": payload.invoice_id,
        "data": dict(invoice["data"]),
        "lines": invoice.get("lines", []),
        "confidence": invoice.get("confidence", 0)
    }

    modified_data = invoice_data.copy()
    if "data" in modified_data:
        modified_data["data"]["total"] = str(total_amount)
    
    apply_invoice_ocr_to_registry(
        db, 
        registry.id, 
        modified_data,
        apply_full_metadata=True,
        line_no=None
    )

    registry.amount = total_amount

    db.commit()

    return {
        "status": "ok",
        "message": f"Applied all {len(applied_lines)} lines",
        "total_amount": total_amount,
        "lines_applied": applied_lines,
        "registry_id": registry.id
    }

# -------------------------------------------------------------------
# ЭНДПОИНТЫ ДЛЯ ДЕФЕКТНЫХ ВЕДОМОСТЕЙ
# -------------------------------------------------------------------

@app.post("/api/defect/upload")
async def upload_defect_sheet(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    batch_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ("xlsx", "xls"):
        raise HTTPException(400, "Поддерживаются только Excel файлы (.xlsx, .xls)")
    
    if not batch_id:
        batch_id = str(uuid.uuid4())
    
    file_path = DEFECT_UPLOAD_DIR / f"{batch_id}_{file.filename}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Создаем ведомость с user_id текущего пользователя
    sheet = create_defect_sheet(
        db=db, 
        file_name=file.filename, 
        batch_id=batch_id,
        user_id=current_user.id
    )
    db.commit()
    
    # Уведомляем создателя о начале обработки
    await websocket_manager.send_to_user(str(current_user.id), {
        "type": "defect_sheet_uploaded",
        "sheet_id": sheet.id,
        "batch_id": batch_id,
        "status": "processing",
        "message": "Файл загружен, начинается обработка"
    })
    
    background_tasks.add_task(
        process_defect_sheet_background,
        file_path,
        batch_id,
        file.filename,
        current_user.id
    )
    
    await websocket_manager.broadcast_to_batch(batch_id, {
        "type": "defect_sheet_processing",
        "batch_id": batch_id,
        "sheet_id": sheet.id,
        "status": "processing",
        "message": "Файл принят, начинаем парсинг"
    })
    
    return {
        "message": "Файл принят в обработку",
        "batch_id": batch_id,
        "sheet_id": sheet.id,
        "status": "processing"
    }


def process_defect_sheet_background(file_path: Path, batch_id: str, original_filename: str, user_id: int = None):
    db = SessionLocal()
    sheet = None
    items = []
    metadata = {}
    
    try:
        log.info(f"[DEFECT] Starting parsing of {file_path.name}")
        
        # Отправляем статус через WebSocket
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                websocket_manager.broadcast_to_batch(batch_id, {
                    "type": "defect_sheet_status",
                    "batch_id": batch_id,
                    "status": "parsing",
                    "progress": 30
                })
            )
            loop.close()
        except Exception as ws_error:
            log.warning(f"WebSocket status update failed: {ws_error}")
        
        # Парсим файл
        try:
            items, metadata = parse_defect_sheet(file_path)
            log.info(f"[DEFECT] Parsed {len(items)} items")
        except Exception as parse_error:
            log.exception(f"[DEFECT] Parse error: {parse_error}")
            items = []
            metadata = {"error": str(parse_error)}
        
        # Получаем существующий sheet
        sheet = get_defect_sheet_by_batch(db, batch_id)
        if not sheet:
            log.warning(f"[DEFECT] Sheet not found for batch {batch_id}, creating new one")
            from crud import create_defect_sheet
            sheet = create_defect_sheet(
                db=db,
                file_name=original_filename,
                batch_id=batch_id,
                user_id=user_id
            )
            log.info(f"[DEFECT] Created new sheet with id {sheet.id}")
        
        # Обновляем метаданные
        if metadata.get("period_start"):
            sheet.period_start = metadata["period_start"]
        if metadata.get("period_end"):
            sheet.period_end = metadata["period_end"]
        
        # Сохраняем элементы
        if items:
            try:
                create_defect_sheet_items(db, sheet.id, items)
                log.info(f"[DEFECT] Saved {len(items)} items to DB")
            except Exception as db_error:
                log.exception(f"[DEFECT] DB save error: {db_error}")
        
        # Обновляем статус и общее количество
        sheet.status = "processed" if items else "no_data"
        sheet.total_items = len(items)
        db.commit()
        
        # Небольшая задержка перед отправкой финального статуса
        time.sleep(1)
        
        # Отправляем финальный статус
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            message = {
                "type": "defect_sheet_processed",
                "batch_id": batch_id,
                "sheet_id": sheet.id,
                "status": "processed",
                "total_items": len(items),
                "metadata": metadata
            }
            
            log.info(f"📤 Sending WebSocket message: {message}")
            loop.run_until_complete(
                websocket_manager.broadcast_to_batch(batch_id, message)
            )
            
            # Уведомляем создателя о завершении обработки
            if user_id:
                loop.run_until_complete(
                    websocket_manager.send_to_user(str(user_id), {
                        "type": "defect_sheet_ready",
                        "sheet_id": sheet.id,
                        "batch_id": batch_id,
                        "total_items": len(items),
                        "message": f"Ведомость обработана, найдено {len(items)} позиций"
                    })
                )
            
            loop.close()
            
        except Exception as ws_error:
            log.error(f"Failed to send WebSocket notification: {ws_error}")
        
        log.info(f"[DEFECT] Successfully processed {file_path.name}")
        
    except Exception as e:
        log.exception(f"[DEFECT] Error processing {file_path.name}: {e}")
        
        if sheet:
            sheet.status = "error"
            db.commit()
        
        # Отправляем ошибку
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                websocket_manager.broadcast_to_batch(batch_id, {
                    "type": "defect_sheet_error",
                    "batch_id": batch_id,
                    "error": str(e)
                })
            )
            # Уведомляем создателя об ошибке
            if user_id:
                loop.run_until_complete(
                    websocket_manager.send_to_user(str(user_id), {
                        "type": "defect_sheet_error",
                        "sheet_id": sheet.id if sheet else None,
                        "batch_id": batch_id,
                        "error": str(e),
                        "message": f"Ошибка обработки файла: {str(e)}"
                    })
                )
            loop.close()
        except:
            pass
    finally:
        db.close()

# @app.post("/api/defect/upload")
# async def upload_defect_sheet(
#     background_tasks: BackgroundTasks,
#     file: UploadFile = File(...),
#     batch_id: Optional[str] = Form(None),
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_active_user)  # Добавляем текущего пользователя
# ):
#     ext = file.filename.split(".")[-1].lower()
#     if ext not in ("xlsx", "xls"):
#         raise HTTPException(400, "Поддерживаются только Excel файлы (.xlsx, .xls)")
    
#     if not batch_id:
#         batch_id = str(uuid.uuid4())
    
#     file_path = DEFECT_UPLOAD_DIR / f"{batch_id}_{file.filename}"
#     with open(file_path, "wb") as f:
#         shutil.copyfileobj(file.file, f)
    
#     # Передаем user_id в функцию создания
#     sheet = create_defect_sheet(
#         db=db, 
#         file_name=file.filename, 
#         batch_id=batch_id,
#         user_id=current_user.id  # Передаем ID текущего пользователя
#     )
#     db.commit()
    
#     background_tasks.add_task(
#         process_defect_sheet_background,
#         file_path,
#         batch_id,
#         file.filename
#     )
    
#     await websocket_manager.broadcast_to_batch(batch_id, {
#         "type": "defect_sheet_processing",
#         "batch_id": batch_id,
#         "sheet_id": sheet.id,
#         "status": "processing",
#         "message": "Файл принят, начинаем парсинг"
#     })
    
#     return {
#         "message": "Файл принят в обработку",
#         "batch_id": batch_id,
#         "sheet_id": sheet.id,
#         "status": "processing"
#     }

# def process_defect_sheet_background(file_path: Path, batch_id: str, original_filename: str):
#     db = SessionLocal()
#     sheet = None
#     items = []
#     metadata = {}
    
#     try:
#         log.info(f"[DEFECT] Starting parsing of {file_path.name}")
        
#         # Отправляем статус через WebSocket
#         try:
#             loop = asyncio.new_event_loop()
#             asyncio.set_event_loop(loop)
#             loop.run_until_complete(
#                 websocket_manager.broadcast_to_batch(batch_id, {
#                     "type": "defect_sheet_status",
#                     "batch_id": batch_id,
#                     "status": "parsing",
#                     "progress": 30
#                 })
#             )
#             loop.close()
#         except Exception as ws_error:
#             log.warning(f"WebSocket status update failed: {ws_error}")
        
#         # Парсим файл
#         try:
#             items, metadata = parse_defect_sheet(file_path)
#             log.info(f"[DEFECT] Parsed {len(items)} items")
#         except Exception as parse_error:
#             log.exception(f"[DEFECT] Parse error: {parse_error}")
#             items = []
#             metadata = {"error": str(parse_error)}
        
#         # Получаем существующий sheet
#         sheet = get_defect_sheet_by_batch(db, batch_id)
#         if not sheet:
#             log.warning(f"[DEFECT] Sheet not found for batch {batch_id}, creating new one")
#             # ИСПРАВЛЕНО: Используем правильный порядок параметров
#             # В crud.py у нас теперь одна функция create_defect_sheet с параметрами:
#             # create_defect_sheet(db, file_name, batch_id, user_id)
#             # Но здесь у нас нет user_id, поэтому передаем None
#             from crud import create_defect_sheet
#             sheet = create_defect_sheet(
#                 db=db,
#                 file_name=original_filename,
#                 batch_id=batch_id,
#                 user_id=None  # В фоновой задаче нет пользователя
#             )
#             log.info(f"[DEFECT] Created new sheet with id {sheet.id}")
        
#         # Обновляем метаданные
#         if metadata.get("period_start"):
#             sheet.period_start = metadata["period_start"]
#         if metadata.get("period_end"):
#             sheet.period_end = metadata["period_end"]
        
#         # Сохраняем элементы
#         if items:
#             try:
#                 create_defect_sheet_items(db, sheet.id, items)
#                 log.info(f"[DEFECT] Saved {len(items)} items to DB")
#             except Exception as db_error:
#                 log.exception(f"[DEFECT] DB save error: {db_error}")
        
#         # Обновляем статус и общее количество
#         sheet.status = "processed" if items else "no_data"
#         sheet.total_items = len(items)
#         db.commit()
        
#         # Небольшая задержка перед отправкой финального статуса
#         time.sleep(1)
        
#         # Отправляем финальный статус
#         try:
#             loop = asyncio.new_event_loop()
#             asyncio.set_event_loop(loop)
            
#             message = {
#                 "type": "defect_sheet_processed",
#                 "batch_id": batch_id,
#                 "sheet_id": sheet.id,
#                 "status": "processed",
#                 "total_items": len(items),
#                 "metadata": metadata
#             }
            
#             log.info(f"📤 Sending WebSocket message: {message}")
#             loop.run_until_complete(
#                 websocket_manager.broadcast_to_batch(batch_id, message)
#             )
#             loop.close()
            
#         except Exception as ws_error:
#             log.error(f"Failed to send WebSocket notification: {ws_error}")
        
#         log.info(f"[DEFECT] Successfully processed {file_path.name}")
        
#     except Exception as e:
#         log.exception(f"[DEFECT] Error processing {file_path.name}: {e}")
        
#         if sheet:
#             sheet.status = "error"
#             db.commit()
        
#         # Отправляем ошибку
#         try:
#             loop = asyncio.new_event_loop()
#             asyncio.set_event_loop(loop)
#             loop.run_until_complete(
#                 websocket_manager.broadcast_to_batch(batch_id, {
#                     "type": "defect_sheet_error",
#                     "batch_id": batch_id,
#                     "error": str(e)
#                 })
#             )
#             loop.close()
#         except:
#             pass
#     finally:
#         db.close()

@app.get("/api/defect/{batch_id}/preview", response_model=DefectSheetPreviewResponse)
def preview_defect_sheet(batch_id: str, db: Session = Depends(get_db)):
    sheet = get_defect_sheet_by_batch(db, batch_id)
    if not sheet:
        raise HTTPException(404, f"Дефектная ведомость с batch_id {batch_id} не найдена")
    
    items = get_defect_sheet_items(db, sheet.id)
    
    return {
        "sheet_id": sheet.id,
        "batch_id": sheet.batch_id,
        "file_name": sheet.file_name,
        "upload_date": sheet.upload_date,
        "status": sheet.status,
        "period_start": sheet.period_start,
        "period_end": sheet.period_end,
        "total_items": len(items),
        "items": items
    }

@app.get("/api/defect/{sheet_id}/items")
def get_defect_items(sheet_id: int, db: Session = Depends(get_db)):
    items = get_defect_sheet_items(db, sheet_id)
    
    print(f"📊 Found {len(items)} items in DB for sheet {sheet_id}")

    result = []
    for item in items:
        result.append({
            "id": item.id,
            "position": item.position,
            "excel_position": item.excel_position,
            "subposition": item.subposition,
            "address": item.address,
            "material_name": item.material_name,
            "requested_quantity": float(item.requested_quantity) if item.requested_quantity else None,
            "weight_tons": float(item.weight_tons) if item.weight_tons else None,
            "calculated_meters": float(item.calculated_meters) if item.calculated_meters else None,
            "profile_type": item.profile_type,
            "profile_params": item.profile_params,
            "formula_used": item.formula_used,
            "is_calculated": item.is_calculated,
            "selected_for_calculation": item.selected_for_calculation,
            "calculated_at": item.calculated_at.isoformat() if item.calculated_at else None,
            "requirement_number": item.requirement_number,
            "requirement_date": item.requirement_date.isoformat() if item.requirement_date else None,
            "car_brand": item.car_brand,
            "license_plate": item.license_plate,
            "recipient": item.recipient,
            "article": item.article
        })
    
    return {
        "items": result,
        "total": len(result)
    }

@app.post("/api/defect/calculate")
def calculate_defect_items(
    request: CalculationRequest,
    db: Session = Depends(get_db)
):
    sheet = get_defect_sheet(db, request.sheet_id)
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    all_items = get_defect_sheet_items(db, request.sheet_id)
    
    items_to_calc = []
    if request.item_ids:
        items_to_calc = [item for item in all_items if item.id in request.item_ids]
    else:
        items_to_calc = [item for item in all_items if not item.is_calculated]
    
    if not items_to_calc:
        return {
            "sheet_id": request.sheet_id,
            "total_items": len(all_items),
            "calculated_items": 0,
            "results": []
        }
    
    calc_items = []
    for item in items_to_calc:
        weight = item.weight_tons or item.requested_quantity
        if not weight:
            continue
        
        profile_params = request.profile_params.copy()
        if item.profile_params:
            profile_params.update(item.profile_params)
        
        calc_items.append({
            "id": item.id,
            "weight_tons": float(weight),
            "profile_type": request.profile_type,
            "profile_params": profile_params
        })
    
    results = metal_calculator.calculate_batch(
        items=calc_items,
        default_profile_type=request.profile_type,
        default_params=request.profile_params
    )
    
    calculated_count = 0
    for result in results:
        if result.get("calculated_meters") and not result.get("error"):
            update_defect_sheet_item_calculation(
                db,
                result["id"],
                result["calculated_meters"],
                result["formula_used"]
            )
            calculated_count += 1
    
    if calculated_count > 0:
        all_calculated = all(item.is_calculated for item in all_items)
        sheet.status = "calculated" if all_calculated else "partially_calculated"
    
    db.commit()
    
    asyncio.run(websocket_manager.broadcast_to_batch(sheet.batch_id, {
        "type": "defect_calculation_complete",
        "sheet_id": sheet.id,
        "batch_id": sheet.batch_id,
        "calculated_items": calculated_count,
        "total_items": len(all_items)
    }))
    
    return {
        "sheet_id": request.sheet_id,
        "total_items": len(all_items),
        "calculated_items": calculated_count,
        "results": results
    }

@app.get("/api/defect/formulas")
def get_calculation_formulas():
    formulas = []
    for profile_type, info in metal_calculator.formulas.items():
        formulas.append({
            "type": profile_type,
            "name": info["name"],
            "formula": info["formula"],
            "description": info["description"],
            "params": info["params"]
        })
    return {"formulas": formulas}

@app.post("/api/defect/save")
def save_defect_sheet(
    sheet_id: int,
    db: Session = Depends(get_db)
):
    sheet = get_defect_sheet(db, sheet_id)
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    items = get_defect_sheet_items(db, sheet_id)
    uncounted = [item for item in items if not item.is_calculated and item.weight_tons]
    
    if uncounted and sheet.status != "partially_calculated":
        return {
            "warning": f"Есть непересчитанные строки ({len(uncounted)}). Сохранить как есть?",
            "can_save": True
        }
    
    sheet.status = "exported"
    db.commit()
    
    asyncio.run(websocket_manager.broadcast_to_batch(sheet.batch_id, {
        "type": "defect_sheet_saved",
        "sheet_id": sheet.id,
        "batch_id": sheet.batch_id
    }))
    
    return {
        "status": "saved",
        "sheet_id": sheet_id,
        "message": "Дефектная ведомость сохранена"
    }

@app.post("/api/defect/submit-for-approval")
async def submit_defect_sheet_for_approval(
    request: SubmitForApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sheet = db.query(DefectSheet).filter(DefectSheet.id == request.sheet_id).first()
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    if sheet.created_by and sheet.created_by != current_user.id and current_user.role not in ["admin", "approver"]:
        raise HTTPException(403, "У вас нет прав на отправку этой ведомости")
    
    sheet.status = "pending"
    sheet.submitted_at = datetime.now()
    sheet.submitted_by = current_user.id
    
    approvers = db.query(User).filter(User.role.in_(["approver", "admin"])).all()
    
    for approver in approvers:
        notification = ApprovalNotification(
            sheet_id=sheet.id,
            approver_id=approver.id,
            created_by_id=current_user.id,
            message=f"Дефектная ведомость #{sheet.id} от {current_user.full_name or current_user.username} ожидает согласования",
            status="unread"
        )
        db.add(notification)
    
    db.commit()
    
    for approver in approvers:
        asyncio.create_task(websocket_manager.send_to_user(str(approver.id), {
            "type": "approval_request",
            "sheet_id": sheet.id,
            "batch_id": sheet.batch_id,
            "message": f"Новая ведомость на согласование от {current_user.full_name or current_user.username}",
            "submitted_by": current_user.full_name or current_user.username,
            "submitted_at": sheet.submitted_at.isoformat()
        }))
    
    return {
        "status": "submitted",
        "sheet_id": sheet.id,
        "message": "Ведомость отправлена на согласование"
    }



@app.get("/api/defect/pending-approvals")
async def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in ["approver", "admin"]:
        raise HTTPException(403, "Только согласователи могут просматривать этот список")
    
    # Получаем все непрочитанные уведомления для текущего пользователя
    notifications = db.query(ApprovalNotification).filter(
        ApprovalNotification.approver_id == current_user.id,
        ApprovalNotification.status == "unread"
    ).all()
    
    result = []
    for notification in notifications:
        sheet = notification.sheet
        if not sheet:
            continue  # Пропускаем, если ведомость удалена
            
        creator = db.query(User).filter(User.id == sheet.created_by).first()
        
        # Получаем количество элементов в ведомости
        items_count = sheet.total_items or 0
        if items_count == 0:
            # Если total_items не заполнено, подсчитываем через items
            items_count = db.query(func.count(DefectSheetItem.id)).filter(
                DefectSheetItem.sheet_id == sheet.id
            ).scalar() or 0
        
        result.append({
            "notification_id": notification.id,
            "sheet_id": sheet.id,
            "batch_id": sheet.batch_id,
            "file_name": sheet.file_name,
            "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None,
            "submitted_by": creator.full_name or creator.username if creator else "Неизвестно",
            "message": notification.message,
            "total_items": items_count,
            "status": sheet.status,
            "preview_url": f"/api/defect/{sheet.id}/items"
        })
    
    return {
        "pending_count": len(result),
        "approvals": result
    }



@app.get("/api/defect/my-sheets")
async def get_my_sheets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sheets = db.query(DefectSheet).filter(
        DefectSheet.created_by == current_user.id
    ).order_by(DefectSheet.created_at.desc()).all()
    
    result = []
    for sheet in sheets:
        approver = None
        if sheet.approved_by:
            approver = db.query(User).filter(User.id == sheet.approved_by).first()
        
        result.append({
            "id": sheet.id,
            "batch_id": sheet.batch_id,
            "file_name": sheet.file_name,
            "created_at": sheet.created_at,
            "status": sheet.status,
            "total_items": sheet.total_items,
            "submitted_at": sheet.submitted_at,
            "approved_at": sheet.approved_at,
            "approved_by": approver.full_name or approver.username if approver else None,
            "rejection_reason": sheet.rejection_reason
        })
    
    return result

@app.post("/api/defect/export")
async def export_defect_sheet(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    sheet = get_defect_sheet(db, request.sheet_id)
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    items = get_defect_sheet_items(db, request.sheet_id)
    
    import xlwt
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    workbook = xlwt.Workbook(encoding='utf-8')
    worksheet = workbook.add_sheet('Дефектная ведомость')
    
    header_style = xlwt.XFStyle()
    header_font = xlwt.Font()
    header_font.bold = True
    header_font.colour_index = 1
    header_font.height = 200
    
    header_pattern = xlwt.Pattern()
    header_pattern.pattern = xlwt.Pattern.SOLID_PATTERN
    header_pattern.pattern_fore_colour = 5
    
    header_style.font = header_font
    header_style.pattern = header_pattern
    header_style.alignment.horz = xlwt.Alignment.HORZ_CENTER
    
    headers = [
        "№ п/п", "Марка (Адрес)", "Наименование материала",
        "Затреб (тонн)", "Вес (тонн)", "Тип профиля",
        "Параметры", "Пересчитано (метров)", "Формула", "Статус"
    ]
    
    for col, header in enumerate(headers):
        worksheet.write(0, col, header, header_style)
        worksheet.col(col).width = 256 * 20
    
    worksheet.col(2).width = 256 * 50
    worksheet.col(1).width = 256 * 25
    worksheet.col(8).width = 256 * 30
    
    number_style = xlwt.XFStyle()
    number_style.num_format_str = '#,##0.000'
    number_style.alignment.horz = xlwt.Alignment.HORZ_RIGHT
    
    number_style_2dec = xlwt.XFStyle()
    number_style_2dec.num_format_str = '#,##0.00'
    number_style_2dec.alignment.horz = xlwt.Alignment.HORZ_RIGHT
    
    text_style = xlwt.XFStyle()
    text_style.alignment.horz = xlwt.Alignment.HORZ_LEFT
    
    status_style = xlwt.XFStyle()
    status_style.alignment.horz = xlwt.Alignment.HORZ_CENTER
    
    row_count = 0
    for row, item in enumerate(items, start=1):
        try:
            worksheet.write(row, 0, item.position or "", text_style)
            worksheet.write(row, 1, item.address or "", text_style)
            worksheet.write(row, 2, item.material_name or "", text_style)
            
            if item.requested_quantity:
                worksheet.write(row, 3, float(item.requested_quantity), number_style)
            else:
                worksheet.write(row, 3, "", text_style)
                
            if item.weight_tons:
                worksheet.write(row, 4, float(item.weight_tons), number_style)
            else:
                worksheet.write(row, 4, "", text_style)
            
            worksheet.write(row, 5, item.profile_type or "", text_style)
            worksheet.write(row, 6, str(item.profile_params) if item.profile_params else "", text_style)
            
            if item.calculated_meters:
                worksheet.write(row, 7, float(item.calculated_meters), number_style_2dec)
            else:
                worksheet.write(row, 7, "", text_style)
            
            worksheet.write(row, 8, item.formula_used or "", text_style)
            
            status = "✓ Пересчитано" if item.is_calculated else "Ожидает"
            worksheet.write(row, 9, status, status_style)
            
            row_count += 1
            
        except Exception as e:
            print(f"❌ Error writing row {row}: {e}")
            continue
    
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    
    filename = f"defect_sheet_{sheet.batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xls"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.ms-excel",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/defect/export-excel")
async def export_defect_sheet_excel(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    sheet = get_defect_sheet(db, request.sheet_id)
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    items = get_defect_sheet_items(db, request.sheet_id)
    
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Дефектная ведомость"
    
    title_font = Font(name='Arial', size=14, bold=True)
    header_font = Font(name='Arial', size=11, bold=True)
    
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    center_alignment = Alignment(horizontal='center', vertical='center')
    left_alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
    
    ws.merge_cells('A1:E1')
    cell = ws['A1']
    cell.value = "Дефектная ведомость"
    cell.font = title_font
    cell.alignment = center_alignment
    
    ws.merge_cells('A2:E2')
    cell = ws['A2']
    cell.value = f"За период: {datetime.now().strftime('%d.%m.%Y')}"
    cell.alignment = center_alignment
    
    ws.row_dimensions[3].height = 15
    
    headers = ["№ п/п", "Дата требования", "Марка/Адрес", "Наименование работ", "Наименование материалов"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border
        cell.alignment = center_alignment
    
    sorted_items = sorted(items, key=lambda x: x.position if x.position else 0)
    
    current_row = 5
    position_counter = 1
    
    for idx, item in enumerate(sorted_items):
        cell = ws.cell(row=current_row, column=1, value=position_counter)
        cell.border = thin_border
        cell.alignment = center_alignment
        
        date_value = ""
        if item.requirement_date:
            if isinstance(item.requirement_date, datetime):
                date_value = item.requirement_date.strftime('%d.%m.%Y')
            else:
                date_value = str(item.requirement_date)
        
        cell = ws.cell(row=current_row, column=2, value=date_value)
        cell.border = thin_border
        cell.alignment = center_alignment
        
        cell = ws.cell(row=current_row, column=3, value=item.address or "")
        cell.border = thin_border
        cell.alignment = left_alignment
        
        cell = ws.cell(row=current_row, column=4, value=item.address or "")
        cell.border = thin_border
        cell.alignment = left_alignment
        
        material_parts = []
        
        if item.material_name:
            material_parts.append(item.material_name)
        
        if item.calculated_meters:
            material_parts.append(f"пересчитано: {float(item.calculated_meters):.2f} м")
        
        if item.weight_tons:
            material_parts.append(f"вес: {float(item.weight_tons):.3f} т")
        
        combined_material = "\n".join(material_parts)
        
        cell = ws.cell(row=current_row, column=5, value=combined_material)
        cell.border = thin_border
        cell.alignment = left_alignment
        
        current_row += 1
        position_counter += 1
    
    ws.column_dimensions['A'].width = 10
    ws.column_dimensions['B'].width = 15
    ws.column_dimensions['C'].width = 25
    ws.column_dimensions['D'].width = 30
    ws.column_dimensions['E'].width = 60
    
    for row in ws.iter_rows(min_row=4, max_row=current_row-1, min_col=1, max_col=5):
        for cell in row:
            if not cell.border:
                cell.border = thin_border
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"defect_sheet_{sheet.batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/defect/items", response_model=DefectSheetItemResponse)
async def create_defect_item(
    request: CreateDefectItemRequest,
    db: Session = Depends(get_db)
):
    sheet = db.query(DefectSheet).filter(DefectSheet.id == request.sheet_id).first()
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    position = request.position
    if position is None:
        max_pos = db.query(func.max(DefectSheetItem.position)).filter(
            DefectSheetItem.sheet_id == request.sheet_id
        ).scalar() or 0
        position = max_pos + 1
    
    new_item = DefectSheetItem(
        sheet_id=request.sheet_id,
        position=position,
        address=request.address,
        material_name=request.material_name,
        requested_quantity=request.requested_quantity,
        weight_tons=request.weight_tons,
        profile_type=request.profile_type,
        profile_params=request.profile_params,
        calculated_meters=request.calculated_meters,
        formula_used=request.formula_used,
        is_calculated=request.is_calculated,
        selected_for_calculation=False
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    total_items = db.query(func.count(DefectSheetItem.id)).filter(
        DefectSheetItem.sheet_id == request.sheet_id
    ).scalar()
    sheet.total_items = total_items
    db.commit()
    
    asyncio.create_task(websocket_manager.broadcast_to_batch(sheet.batch_id, {
        "type": "defect_item_created",
        "sheet_id": sheet.id,
        "batch_id": sheet.batch_id,
        "item_id": new_item.id,
        "position": new_item.position
    }))
    
    return new_item

@app.delete("/api/defect/items/{item_id}")
async def delete_defect_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    item = db.query(DefectSheetItem).filter(
        DefectSheetItem.id == item_id
    ).first()
    
    if not item:
        raise HTTPException(404, "Строка не найдена")
    
    sheet_id = item.sheet_id
    batch_id = item.sheet.batch_id
    
    db.delete(item)
    db.commit()
    
    total_items = db.query(func.count(DefectSheetItem.id)).filter(
        DefectSheetItem.sheet_id == sheet_id
    ).scalar()
    sheet = db.query(DefectSheet).filter(DefectSheet.id == sheet_id).first()
    if sheet:
        sheet.total_items = total_items
        db.commit()
    
    asyncio.create_task(websocket_manager.broadcast_to_batch(batch_id, {
        "type": "defect_item_deleted",
        "sheet_id": sheet_id,
        "batch_id": batch_id,
        "item_id": item_id
    }))
    
    return {"status": "deleted", "item_id": item_id}

@app.delete("/api/defect/{sheet_id}")
def delete_defect_sheet_endpoint(
    sheet_id: int,
    db: Session = Depends(get_db)
):
    sheet = get_defect_sheet(db, sheet_id)
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    batch_id = sheet.batch_id
    delete_defect_sheet(db, sheet_id)
    db.commit()
    
    return {"status": "deleted", "batch_id": batch_id}

@app.post("/api/defect/items/batch-delete")
async def batch_delete_defect_items(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db)
):
    if not request.item_ids:
        raise HTTPException(400, "Список ID пуст")
    
    first_item = db.query(DefectSheetItem).filter(
        DefectSheetItem.id == request.item_ids[0]
    ).first()
    
    if not first_item:
        raise HTTPException(404, "Строки не найдены")
    
    sheet_id = first_item.sheet_id
    batch_id = first_item.sheet.batch_id
    
    deleted = db.query(DefectSheetItem).filter(
        DefectSheetItem.id.in_(request.item_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    total_items = db.query(func.count(DefectSheetItem.id)).filter(
        DefectSheetItem.sheet_id == sheet_id
    ).scalar()
    
    sheet = db.query(DefectSheet).filter(DefectSheet.id == sheet_id).first()
    if sheet:
        sheet.total_items = total_items
        db.commit()
    
    asyncio.create_task(websocket_manager.broadcast_to_batch(batch_id, {
        "type": "defect_items_deleted",
        "sheet_id": sheet_id,
        "batch_id": batch_id,
        "deleted_count": deleted
    }))
    
    return {
        "status": "deleted",
        "deleted_count": deleted,
        "item_ids": request.item_ids
    }

@app.patch("/api/defect/items/{item_id}")
async def update_defect_item_field(
    item_id: int,
    request: UpdateDefectItemFieldRequest,
    db: Session = Depends(get_db)
):
    item = db.query(DefectSheetItem).filter(
        DefectSheetItem.id == item_id
    ).first()
    
    if not item:
        raise HTTPException(404, "Строка не найдена")
    
    if not hasattr(item, request.field):
        raise HTTPException(400, f"Поле {request.field} не существует")
    
    setattr(item, request.field, request.value)
    
    if request.field == "calculated_meters":
        item.is_calculated = True
        item.calculated_at = datetime.now()
    
    db.commit()
    
    asyncio.create_task(websocket_manager.broadcast_to_batch(item.sheet.batch_id, {
        "type": "defect_item_updated",
        "sheet_id": item.sheet_id,
        "batch_id": item.sheet.batch_id,
        "item_id": item.id,
        "field": request.field,
        "value": request.value
    }))
    
    return {
        "status": "updated",
        "item_id": item.id,
        "field": request.field,
        "value": request.value
    }



@app.post("/api/defect/approve")
async def approve_defect_sheet(
    request: ApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in ["approver", "admin"]:
        raise HTTPException(403, "Только согласователи могут выполнять это действие")
    
    sheet = db.query(DefectSheet).filter(DefectSheet.id == request.sheet_id).first()
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    if sheet.status != "pending":
        raise HTTPException(400, f"Ведомость уже {sheet.status}")
    
    approver_name = current_user.full_name or current_user.username
    
    if request.approved:
        sheet.status = "approved"
        sheet.approved_at = datetime.now()
        sheet.approved_by = current_user.id
        sheet.approval_comment = request.comment
        
        message = f"Ведомость #{sheet.id} согласована"
        notification_type = "approval_approved"
        color = "success"
    else:
        sheet.status = "rejected"
        sheet.rejected_at = datetime.now()
        sheet.rejected_by = current_user.id
        sheet.rejection_reason = request.comment
        
        message = f"Ведомость #{sheet.id} отклонена"
        notification_type = "approval_rejected"
        color = "error"
    
    # Отмечаем уведомления как обработанные
    db.query(ApprovalNotification).filter(
        ApprovalNotification.sheet_id == sheet.id,
        ApprovalNotification.status == "unread"
    ).update({"status": "processed", "processed_at": datetime.now()})
    
    db.commit()
    
    # Уведомляем создателя о результате
    if sheet.created_by:
        asyncio.create_task(websocket_manager.send_to_user(str(sheet.created_by), {
            "type": notification_type,
            "sheet_id": sheet.id,
            "batch_id": sheet.batch_id,
            "message": message,
            "comment": request.comment,
            "approved_by": approver_name,
            "approved_at": datetime.now().isoformat(),
            "status": sheet.status
        }))
    
    # Уведомляем всех согласователей об изменении статуса
    other_approvers = db.query(User).filter(
        User.role.in_(["approver", "admin"]),
        User.id != current_user.id
    ).all()
    
    for approver in other_approvers:
        asyncio.create_task(websocket_manager.send_to_user(str(approver.id), {
            "type": "approval_processed",
            "sheet_id": sheet.id,
            "batch_id": sheet.batch_id,
            "message": f"Ведомость #{sheet.id} {message.lower()} пользователем {approver_name}",
            "processed_by": approver_name,
            "processed_at": datetime.now().isoformat(),
            "status": sheet.status
        }))
    
    return {
        "status": sheet.status,
        "sheet_id": sheet.id,
        "message": message
    }

# -------------------------------------------------------------------
# WEB SOCKET SUPPORT
# -------------------------------------------------------------------

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "subscribe":
                batch_id = data.get("batch_id")
                if batch_id:
                    await websocket_manager.subscribe_to_batch(client_id, batch_id)
                    await websocket_manager.send_to_client(client_id, {
                        "type": "subscribed",
                        "batch_id": batch_id
                    })
            
            elif data.get("type") == "unsubscribe":
                batch_id = data.get("batch_id")
                if batch_id:
                    websocket_manager.unsubscribe_from_batch(client_id, batch_id)
                    await websocket_manager.send_to_client(client_id, {
                        "type": "unsubscribed",
                        "batch_id": batch_id
                    })
            
            elif data.get("type") == "authenticate":
                user_id = data.get("user_id")
                if user_id:
                    await websocket_manager.authenticate_client(client_id, user_id)
                    await websocket_manager.send_to_client(client_id, {
                        "type": "authenticated",
                        "user_id": user_id
                    })
            
            elif data.get("type") == "ping":
                await websocket_manager.send_to_client(client_id, {
                    "type": "pong",
                    "timestamp": asyncio.get_event_loop().time()
                })
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)
    except Exception as e:
        log.error(f"WebSocket error for client {client_id}: {e}")
        websocket_manager.disconnect(client_id)

# -------------------------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Registry Control API"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "registry-control-api",
        "version": "1.0.0",
        "websocket_connections": len(websocket_manager.active_connections),
        "batch_subscriptions": len(websocket_manager.batch_subscriptions)
    }

@app.get("/health/redis")
async def redis_health():
    try:
        await redis_manager.ping()
        return {"redis": "connected"}
    except Exception as e:
        return {"redis": "disconnected", "error": str(e)}

@app.get("/debug/invoice/{invoice_id}")
def debug_invoice_info(invoice_id: str, db: Session = Depends(get_db)):
    from services.invoice_buffer import get_invoice
    
    invoice_in_buffer = get_invoice(invoice_id)
    
    db_lines = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice_id).all()
    
    return {
        "invoice_id": invoice_id,
        "in_buffer": invoice_in_buffer is not None,
        "buffer_data": {
            "has_data": invoice_in_buffer is not None,
            "has_lines": invoice_in_buffer and 'lines' in invoice_in_buffer,
            "lines_count": len(invoice_in_buffer.get('lines', [])) if invoice_in_buffer else 0,
            "contractor": invoice_in_buffer.get('data', {}).get('contractor') if invoice_in_buffer else None,
            "metadata_keys": list(invoice_in_buffer.get('data', {}).keys()) if invoice_in_buffer else []
        },
        "in_database": {
            "lines_count": len(db_lines),
            "lines": [
                {
                    "line_no": l.line_no,
                    "description": l.description[:50],
                    "quantity": l.quantity,
                    "price": l.price,
                    "total": l.total
                }
                for l in db_lines[:5]
            ]
        }
    }

@app.get("/debug/check-invoice/{invoice_id}")
def debug_check_invoice(invoice_id: str, db: Session = Depends(get_db)):
    from services.invoice_buffer import get_invoice
    
    invoice_in_buffer = get_invoice(invoice_id)
    
    db_lines = db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice_id).all()
    
    buffer_info = {}
    if invoice_in_buffer:
        buffer_info = {
            "id": invoice_in_buffer.get("id"),
            "batch_id": invoice_in_buffer.get("batch_id"),
            "has_lines": "lines" in invoice_in_buffer,
            "lines_count": len(invoice_in_buffer.get("lines", [])),
            "lines_sample": invoice_in_buffer.get("lines", [])[:2] if invoice_in_buffer.get("lines") else [],
            "metadata": invoice_in_buffer.get("data", {})
        }
    
    return {
        "invoice_id": invoice_id,
        "in_buffer": buffer_info,
        "in_database": {
            "lines_count": len(db_lines),
            "lines": [
                {
                    "line_no": l.line_no,
                    "description": l.description[:50] if l.description else "",
                    "quantity": l.quantity,
                    "price": l.price,
                    "total": l.total
                }
                for l in db_lines[:5]
            ]
        },
        "api_endpoints": {
            "lines": f"/invoice/{invoice_id}/lines",
            "buffer": f"/debug/invoice/{invoice_id}"
        }
    }

# -------------------------------------------------------------------
# STARTUP/SHUTDOWN
# -------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    await redis_manager.connect()
    print("🚀 Application started with Redis support")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    #-------------------------------------------------------------
    #Эндпоинт для согласования
    #-----------------------------------------------------------------------

@app.get("/api/defect/{sheet_id}/info")
def get_defect_sheet_info(sheet_id: int, db: Session = Depends(get_db)):
    """Получить информацию о ведомости по ID"""
    sheet = db.query(DefectSheet).filter(DefectSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(404, "Дефектная ведомость не найдена")
    
    return {
        "id": sheet.id,
        "batch_id": sheet.batch_id,
        "file_name": sheet.file_name,
        "status": sheet.status,
        "total_items": sheet.total_items,
        "created_at": sheet.created_at,
        "submitted_at": sheet.submitted_at,
        "approved_at": sheet.approved_at,
        "rejected_at": sheet.rejected_at
    }




