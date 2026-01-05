# backend/services/invoice_buffer.py

INVOICE_BUFFER: list[dict] = []

def add_invoice(invoice: dict):
    INVOICE_BUFFER.append(invoice)

def pop_invoices() -> list[dict]:
    invoices = INVOICE_BUFFER.copy()
    INVOICE_BUFFER.clear()
    return invoices

def has_invoices() -> bool:
    return len(INVOICE_BUFFER) > 0
