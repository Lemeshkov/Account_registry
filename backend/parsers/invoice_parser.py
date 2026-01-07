# backend/parsers/invoice_parser.py
import re
from backend.services.ocr_service import ocr_pdf
from backend.parsers.regex_patterns import *

def find_invoice_text(pages: list[str]) -> str:
    """
    Ищем страницу со словами 'счет' и 'оплат'.
    Если нет — объединяем все страницы.
    """
    for page in pages:
        low = page.lower()
        if "счет" in low and "оплат" in low:
            return page
    return "\n".join(pages)


def search(pattern: str, text: str):
    """
    Безопасный regex-поиск с учётом переносов строк.
    """
    m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    if m.lastindex == 1:
        return m.group(1).strip()
    if m.lastindex and m.lastindex > 1:
        return tuple(g.strip() for g in m.groups())
    return m.group(0).strip()


def parse_invoice_from_pdf(pdf_path: str) -> dict:
    pages = ocr_pdf(pdf_path)
    text = find_invoice_text(pages)

    # ---- ИНФОРМАЦИЯ О СЧЕТЕ ----
    invoice_match = search(INVOICE_NUMBER_DATE, text)
    invoice_number = None
    invoice_date = None
    if isinstance(invoice_match, tuple):
        invoice_number, invoice_date = invoice_match

    # ---- ДАННЫЕ О КОНТРАГЕНТЕ ----
    supplier = search(SUPPLIER_RE, text)

    # ---- ФИНАНСЫ ----
    inn = search(INN, text)
    account = search(ACCOUNT, text)
    total = search(TOTAL, text)
    vat = search(VAT, text)

    data = {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "supplier": supplier,
        "inn": inn,
        "account": account,
        "total": total,
        "vat": vat,
    }

    confidence = round(sum(1 for v in data.values() if v) / len(data), 3)

    # ---- ЛОГИ ----
    print("========== OCR TEXT (first 1000 chars) ==========")
    print(text[:1000])
    print("========== PARSED DATA ==========")
    print(data)
    print("Confidence:", confidence)

    return {
        "data": data,
        "confidence": confidence,
    }
