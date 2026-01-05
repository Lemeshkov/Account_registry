import re
from backend.services.ocr_service import ocr_pdf
from backend.parsers.regex_patterns import *

def find_invoice_text(pages: list[str]) -> str:
    """
    Находит страницу со словами 'счет на оплату'.
    Если нет — объединяет все страницы.
    """
    for page in pages:
        if "счет на оплату" in page.lower():
            return page
    return " ".join(pages)  # если счет не найден, берем весь текст

def search(pattern: str, text: str):
    """
    Безопасный поиск по регулярке.
    Если regex содержит группу — возвращаем group(1),
    иначе весь матч.
    """
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    if m.lastindex is None:
        return m.group(0).strip()
    return m.group(1).strip()

def parse_invoice_from_pdf(pdf_path: str) -> dict:
    print(">>> parse_invoice_from_pdf CALLED:", pdf_path)

    try:
        pages = ocr_pdf(pdf_path)  # только один вызов
        print(">>> OCR PAGES:", len(pages))
    except Exception as e:
        pages = []
        print(f"[OCR ERROR] {e}")

    text = find_invoice_text(pages) if pages else ""

    data = {
        "inn": search(INN, text),
        "account": search(ACCOUNT, text),
        "total": search(TOTAL, text),
        "vat": search(VAT, text),
    }

    confidence = round(sum(1 for v in data.values() if v) / len(data), 2)

    return {"data": data, "confidence": confidence}

