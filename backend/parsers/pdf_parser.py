
# backend/parsers/pdf_parser.py
import pdfplumber
import re
from datetime import datetime
from typing import List, Dict, Any


class PDFParser:
    """
    Парсер PDF заявок фиксированной структуры.
    Работает с многострочными PDF (реальный формат).
    """

    DATE_RE = re.compile(r"\d{2}\.\d{2}\.\d{4}")
    TIME_RE = re.compile(r"\d{1,2}:\d{2}:\d{2}")
    PLATE_RE = re.compile(r"[А-ЯA-Z]{1}\d{3}[А-ЯA-Z]{2}\d{2,3}")
    QTY_RE = re.compile(r"\b\d+\b")

    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []

        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                lines = [l.strip() for l in (page.extract_text() or "").splitlines() if l.strip()]

                buffer: List[str] = []

                for line in lines:
                    # начало новой заявки — строка начинается с номера
                    if line[0].isdigit() and buffer:
                        record = self._parse_block(buffer)
                        if record:
                            results.append(record)
                        buffer = []

                    buffer.append(line)

                # последняя заявка
                if buffer:
                    record = self._parse_block(buffer)
                    if record:
                        results.append(record)

        return results

    def _parse_block(self, lines: List[str]) -> Dict[str, Any]:
        text = " ".join(lines)

        date = self._find(self.DATE_RE, text)
        plate = self._find(self.PLATE_RE, text)
        qty = self._find(self.QTY_RE, text)

        # Марка = строка, где есть КАМАЗ / ГАЗ / УРАЛ и т.п.
        brand = None
        for l in lines:
            if any(x in l.upper() for x in ["КАМАЗ", "ГАЗ", "УРАЛ", "МАЗ"]):
                brand = l.strip()
                break

        # Комментарий = строка после госномера
        comment = None
        if plate:
            for l in lines:
                if plate in l:
                    comment = l.replace(plate, "").strip()
                    break

        if not brand or not plate:
            return None

        return {
            "request_number": lines[0].split()[0],
            "request_date": self._parse_date(date),
            "car_brand": brand,
            "license_plate": plate,
            "item_name": comment,
            "quantity": int(qty) if qty else 1,
            "approved": True,
        }

    def _find(self, regex, text):
        m = regex.search(text)
        return m.group(0) if m else None

    def _parse_date(self, value):
        try:
            return datetime.strptime(value, "%d.%m.%Y")
        except:
            return None
