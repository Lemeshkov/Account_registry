from sqlalchemy.orm import Session
from backend.models import InvoiceLine
from backend.utils.numbers import parse_number

INVOICE_BUFFER: dict[str, dict] = {}

def add_invoice(invoice: dict):
    INVOICE_BUFFER[invoice["id"]] = invoice

def list_invoices(batch_id: str | None = None) -> list[dict]:
    if not batch_id:
        return list(INVOICE_BUFFER.values())
    return [
        inv for inv in INVOICE_BUFFER.values()
        if inv.get("batch_id") == batch_id
    ]

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
