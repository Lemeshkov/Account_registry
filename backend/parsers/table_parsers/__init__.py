"""
Инициализация парсеров таблиц
"""

from .standard_table import StandardTableParser
from .barcode_table import BarcodeTableParser
# from .simple_list import SimpleListParser
# from .fallback_scanner import FallbackScanner

# Все доступные парсеры
ALL_PARSERS = [
    StandardTableParser(),
    BarcodeTableParser(),
    # SimpleListParser(),
    # FallbackScanner(),
]