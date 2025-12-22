import pdfplumber
from typing import List, Dict, Any

class InvoicePDFParser:
    """
    Парсер PDF счета.
    Извлекает артикул, товары, количество, цену, сумму.
    """
    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        invoices = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        headers = [h.lower() for h in table[0]]  # первая строка - заголовки
                        for row in table[1:]:
                            item = {headers[i]: row[i] for i in range(len(row))}
                            invoices.append(item)
            return invoices
        except Exception as e:
            print(f"Ошибка парсинга PDF счета: {e}")
            return []
