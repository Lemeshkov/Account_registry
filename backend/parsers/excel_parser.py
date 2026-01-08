import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
import logging
from xlsx2csv import Xlsx2csv
from io import StringIO

log = logging.getLogger(__name__)


class ExcelParser:
    """
    Супер-надёжный парсер Excel (читает ДАЖЕ битые xlsx через CSV)
    """

    def parse_file(self, file_path: str) -> List[Dict[str, Any]]:
        df = None

        # 1️⃣ обычный путь
        try:
            df = pd.read_excel(file_path, header=None)
        except Exception as e:
            log.warning(f"pandas failed: {e}")

        # 2️⃣ АБСОЛЮТНО НАДЁЖНЫЙ FALLBACK
        if df is None:
            try:
                output = StringIO()
                Xlsx2csv(file_path, outputencoding="utf-8").convert(output)
                output.seek(0)
                df = pd.read_csv(output, header=None)
                log.warning("Excel read via xlsx2csv fallback")
            except Exception as e:
                log.error(f"xlsx2csv failed: {e}")

        if df is None:
            raise ValueError("Не удалось прочитать Excel файл (повреждён или нестандартный)")

        df = df.dropna(how="all")

        results: List[Dict[str, Any]] = []

        for _, row in df.iterrows():
            try:
                if not row[0] or not str(row[0]).strip().isdigit():
                    continue

                record = {
                    "request_number": str(row[0]).strip(),
                    "request_date": self._parse_date(row[1]),
                    "car_brand": self._safe(row[2]),
                    "license_plate": self._safe(row[3]),
                    "item_name": self._safe(row[4]),
                    "article": self._safe(row[5]) if len(row) > 5 else None,
                    "quantity": self._parse_int(row[6]) if len(row) > 6 else 0,
                    "approved": self._parse_bool(row[7]) if len(row) > 7 else False,
                    "completion_date": self._parse_date(row[8]) if len(row) > 8 else None,
                }

                results.append(record)

            except Exception as e:
                log.warning(f"Row skipped: {e}")

        return results

    def _safe(self, value):
        return str(value).strip() if value not in (None, "", "nan") else None

    def _parse_date(self, value):
        if isinstance(value, datetime):
            return value
        try:
            return datetime.strptime(str(value), "%d.%m.%Y")
        except Exception:
            return None

    def _parse_int(self, value) -> int:
        try:
            return int(float(value))
        except Exception:
            return 0

    def _parse_bool(self, value) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ["да", "✓", "✔"]
        return False
