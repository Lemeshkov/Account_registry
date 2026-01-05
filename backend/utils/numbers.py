# backend/utils/numbers.py

from decimal import Decimal
from typing import Any


def parse_number(value: Any) -> Decimal | None:
    if value is None:
        return None

    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))

    if isinstance(value, str):
        value = value.replace(" ", "").replace(",", ".")
        try:
            return Decimal(value)
        except Exception:
            return None

    return None
