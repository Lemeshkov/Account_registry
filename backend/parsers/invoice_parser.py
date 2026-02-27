
#---------------------------------гибридный парсер
"""
Главный парсер счетов - ТОЛЬКО для вызова других парсеров
1. universal_parser для метаданных
2. legacy_parser для товаров
"""

import os
from typing import Dict, Any, List
from services.ocr_service_fast import ocr_pdf_fast as ocr_pdf
from parsers.legacy_invoice_parser import parse_invoice_lines_legacy
from parsers.universal_parser import extract_metadata_universal
from parsers.legacy_invoice_parser import parse_invoice_lines_only
from parsers.legacy_invoice_parser import parse_this_specific_invoice

def parse_invoice_from_pdf(pdf_path: str, excel_record: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    ГЛАВНЫЙ ПАРСЕР:
    1. universal_parser для метаданных (всегда работает)
    2. legacy_parser ТОЛЬКО для товаров
    """
    print(f"\n{'='*60}")
    print(f"MAIN INVOICE PARSER: {os.path.basename(str(pdf_path))}")
    print(f"{'='*60}")
    
    # 1. Получаем текст из PDF
    pages = ocr_pdf(pdf_path)
    if not pages:
        return create_error_response("Не удалось извлечь текст из PDF")
    
    full_text = "\n\n".join(pages)
    
    # 2. Используем universal_parser ТОЛЬКО для метаданных
    print("\n--- EXTRACTING METADATA (UNIVERSAL PARSER) ---")
    metadata = extract_metadata_universal(full_text)
    
    # 3. Используем legacy_parser ТОЛЬКО для товаров
    print("\n--- PARSING PRODUCT LINES (LEGACY PARSER) ---")
    
    product_lines = []
    try:
        # legacy_parser теперь ВОЗВРАЩАЕТ ТОЛЬКО СТРОКИ ТОВАРОВ
        product_lines = parse_this_specific_invoice(full_text)
        if product_lines:
            print(f"✓ Legacy parser found {len(product_lines)} product lines")
        else:
            print("✗ Legacy parser found 0 lines")
    except Exception as e:
        print(f"✗ Legacy parser error: {e}")
        # Продолжаем работу даже если legacy парсер упал
    
    # 4. Рассчитываем confidence
    confidence = calculate_confidence(metadata, product_lines, excel_record)
    
    # 5. Формируем результат
    result = {
        "data": metadata,
        "lines": product_lines,
        "confidence": confidence,
        "source_file": os.path.basename(str(pdf_path)),
        "excel_match": bool(excel_record),
    }
    
    # Логируем результат
    print(f"\n{'='*60}")
    print("MAIN PARSING RESULT:")
    print(f"{'='*60}")
    print(f"✓ Метаданные: {'Найдены' if metadata.get('metadata_found') else 'Не найдены'}")
    print(f"✓ Товаров в счете: {len(product_lines)}")
    print(f"✓ Достоверность: {confidence:.1%}")
    
    if excel_record:
        print(f"✓ Связь с Excel: Заявка №{excel_record.get('request_number')}")
    
    return result


def calculate_confidence(metadata: Dict[str, Any], 
                         lines: List[Dict[str, Any]], 
                         excel_record: Dict[str, Any] = None) -> float:
    """Рассчитывает достоверность парсинга"""
    score = 0.0
    
    # 1. Оценка метаданных (самое важное для реестра!)
    if metadata.get("contractor"):
        score += 0.4  # Контрагент - критически важен
    
    if metadata.get("invoice_number"):
        score += 0.2
    
    if metadata.get("invoice_date"):
        score += 0.1
    
    if metadata.get("total"):
        score += 0.1
    
    # 2. Оценка товаров
    if lines:
        score += min(len(lines) * 0.03, 0.15)  # До 15% за товары
    
    # 3. Бонус за соответствие с Excel
    if excel_record and excel_record.get('item_name') and lines:
        item_found = any(excel_record['item_name'].lower() in line.get('description', '').lower() 
                        for line in lines[:5])
        if item_found:
            score += 0.15
    
    return min(score, 1.0)


def create_error_response(error_msg: str) -> Dict[str, Any]:
    """Создает ответ об ошибке"""
    return {
        "data": {
            "error": error_msg,
            "metadata_found": False,
        },
        "lines": [],
        "confidence": 0.0,
        "source_file": "unknown",
        "excel_match": False,
    }