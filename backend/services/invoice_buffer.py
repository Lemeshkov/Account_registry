import uuid
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import InvoiceLine
from backend.utils.numbers import parse_number

log = logging.getLogger(__name__)

INVOICE_BUFFER: dict[str, dict] = {}

def add_invoice(invoice: dict):
    """Добавить счет в буфер с гарантированной структурой"""
    invoice_id = invoice.get("id")
    if not invoice_id:
        invoice_id = str(uuid.uuid4())
        invoice["id"] = invoice_id
    
    print(f"\n[BUFFER DEBUG] Adding invoice to buffer:")
    print(f"  Invoice ID: {invoice_id}")
    print(f"  Has 'data' key: {'data' in invoice}")
    
    # Гарантируем правильную структуру данных
    invoice_data = invoice.get("data", {})
    if not isinstance(invoice_data, dict):
        print(f"  WARNING: invoice['data'] is not a dict, it's {type(invoice_data)}")
        invoice_data = {}
    
    # Гарантируем наличие всех необходимых полей
    INVOICE_BUFFER[invoice_id] = {
        "id": invoice_id,
        "batch_id": invoice.get("batch_id"),
        "file": invoice.get("file", ""),
        "source_file": invoice.get("source_file", ""),
        "confidence": invoice.get("confidence", 0),
        "data": invoice_data,  # Метаданные (гарантированно словарь)
        "lines": invoice.get("lines", []),  # Строки товаров
        "excel_match": invoice.get("excel_match", False),
        "status": "pending",
        "processed_at": datetime.now().isoformat()
    }
    
    print(f"  Added to buffer with data keys: {list(INVOICE_BUFFER[invoice_id]['data'].keys())}")
    print(f"  Contractor in buffer: {INVOICE_BUFFER[invoice_id]['data'].get('contractor')}")
    
    log.info("[BUFFER] Invoice added: %s (confidence: %.1f%%)", 
             invoice_id, invoice.get("confidence", 0) * 100)
    
    return invoice_id

# def list_invoices(batch_id: str | None = None) -> list[dict]:
#     if not batch_id:
#         return list(INVOICE_BUFFER.values())
#     return [
#         inv for inv in INVOICE_BUFFER.values()
#         if inv.get("batch_id") == batch_id
#     ]
# backend/services/invoice_buffer.py
def list_invoices(batch_id: str = None) -> list:
    """Получить список счетов из буфера"""
    print(f"\n[BUFFER DEBUG] list_invoices called for batch_id={batch_id}")
    print(f"[BUFFER DEBUG] Total invoices in buffer: {len(INVOICE_BUFFER)}")
    
    result = []
    for invoice_id, invoice in INVOICE_BUFFER.items():
        print(f"[BUFFER DEBUG] Checking invoice {invoice_id}: batch_id={invoice.get('batch_id')}")
        if batch_id is None or invoice.get("batch_id") == batch_id:
            result.append(invoice)
            print(f"[BUFFER DEBUG] Added invoice {invoice_id} to result")
    
    print(f"[BUFFER DEBUG] Returning {len(result)} invoices for batch {batch_id}")
    return result

def get_invoice(invoice_id: str) -> dict | None:
    return INVOICE_BUFFER.get(invoice_id)

def remove_invoice(invoice_id: str):
    INVOICE_BUFFER.pop(invoice_id, None)

def save_invoice_lines(db: Session, invoice_id: str, batch_id: str, lines: list[dict]):
    for l in lines:
        db.add(
            InvoiceLine(
                invoice_id=invoice_id,
                batch_id=batch_id,
                line_no=l["line_no"],
                description=l["description"],
                quantity=l["qty"],
                price=parse_number(l["price"]),
                total=parse_number(l["total"]),
                raw=l.get("raw"),
                used=False,
            )
        )
    db.flush()

def get_invoice_lines(db: Session, invoice_id: str):
    return (
        db.query(InvoiceLine)
        .filter(InvoiceLine.invoice_id == invoice_id)
        .order_by(InvoiceLine.line_no)
        .all()
    )

def mark_invoice_line_used(db: Session, invoice_id: str, line_no: int):
    line = (
        db.query(InvoiceLine)
        .filter(
            InvoiceLine.invoice_id == invoice_id,
            InvoiceLine.line_no == line_no,
        )
        .first()
    )

    if not line:
        raise ValueError("Invoice line not found")

    line.used = True
    db.flush()
    return line