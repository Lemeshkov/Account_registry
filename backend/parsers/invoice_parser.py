# backend/parsers/invoice_parser.py
import re
from backend.services.ocr_service import ocr_pdf
from backend.parsers.regex_patterns import *

def parse_invoice_lines(text: str) -> list[dict]:
    lines = []

    pattern = re.compile(
        INVOICE_LINE_RE,
        re.IGNORECASE 
    )


    for m in pattern.finditer(text):
        lines.append({
            "line_no": int(m.group(1)),
            "description": m.group(2).strip(),
            "qty": int(m.group(3)),
            "price": m.group(4).replace(" ", ""),
            "total": m.group(5).replace(" ", ""),
            "used": False,
            "raw": m.group(0).strip(),
        })

    print("LINES FOUND:", len(lines))
    for l in lines:
        print(l["raw"])   

    return lines



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


def extract_table_text(text: str) -> str:
    """
    Вырезаем только тело таблицы товаров.
    Начинаем после заголовков таблицы.
    """
    m = re.search(
        r"(?:Товары|Товары\s*\(работы,\s*услуги\)).*?Цена(.+)",
        text,
        re.IGNORECASE | re.DOTALL
    )
    return m.group(1) if m else text



def parse_invoice_from_pdf(pdf_path: str) -> dict:
    pages = ocr_pdf(pdf_path)
    text = find_invoice_text(pages)
    table_text = extract_table_text(text)
    lines = parse_invoice_lines(table_text)

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
    "lines": lines,
    "confidence": confidence,
    }



