"""
Парсеры для системы реестра счетов
"""

from .excel_parser import ExcelParser
from .universal_parser import extract_metadata_universal  # ТОЛЬКО метаданные
from .invoice_parser import parse_invoice_from_pdf         # Главный парсер
# from .legacy_invoice_parser import parse_invoice_legacy  # УБРАТЬ ЭТУ СТРОКУ!
from .legacy_invoice_parser import parse_invoice_lines_only  # ИСПРАВЛЕННАЯ СТРОКА

__all__ = [
    'ExcelParser',
    'extract_metadata_universal',
    'parse_invoice_from_pdf',
    'parse_invoice_lines_only',  # ИСПРАВЛЕННОЕ ИМЯ
]