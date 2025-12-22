import pandas as pd
from datetime import datetime
from typing import List, Dict, Any


class ExcelParser:
    """
    Парсер Excel заявок фиксированной структуры
    """

    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        df = pd.read_excel(file_path, header=None, engine="xlrd")

        df = df.dropna(how="all")

        results: List[Dict[str, Any]] = []

        for _, row in df.iterrows():
            try:
                # первая колонка — номер заявки
                if not str(row[0]).strip().isdigit():
                    continue

                record = {
                    "request_number": str(row[0]).strip(),
                    "request_date": self._parse_date(row[1]),
                    "car_brand": str(row[2]).strip(),        # Марка
                    "license_plate": str(row[3]).strip(),   # ✅ Гос. номер
                    "item_name": str(row[4]).strip(),       # Наименование
                    "article": str(row[5]).strip(),         # Артикул
                    "quantity": self._parse_int(row[6]),
                    "approved": self._parse_bool(row[7]),
                    "completion_date": self._parse_date(row[8]) if len(row) > 8 else None
                }

                results.append(record)

            except Exception as e:
                continue

        return results

    def _parse_date(self, value):
        if isinstance(value, datetime):
            return value
        try:
            return datetime.strptime(str(value), "%d.%m.%Y")
        except Exception:
            return None

    def _parse_int(self, value) -> int:
        try:
            return int(value)
        except Exception:
            return 0

    def _parse_bool(self, value) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ["да", "✓", "✔"]
        return False
