
import re
from typing import Optional, Tuple, List, Dict, Any
from backend.services.ocr_service import ocr_pdf
from backend.parsers.regex_patterns import *
from ..utils.numbers import parse_number


# -------------------------------------------------
# ДОПОЛНИТЕЛЬНЫЕ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
# -------------------------------------------------

INVOICE_NUMBER_RE = r"сч[её]т\s*№?\s*(\d+)"
INVOICE_DATE_RE = r"от\s*(\d{1,2}\s+[а-яё]+\s+\d{4})"


# -------------------------------------------------
# HELPERS
# -------------------------------------------------

def search(pattern: str, text: str, flags: int = re.IGNORECASE | re.DOTALL):
    """Безопасный regex-поиск"""
    m = re.search(pattern, text, flags)
    if not m:
        return None
    if m.lastindex == 1:
        return m.group(1).strip()
    if m.lastindex and m.lastindex > 1:
        return tuple(g.strip() for g in m.groups())
    return m.group(0).strip()


def normalize_text(text: str) -> str:
    """Нормализация текста для парсинга"""
    text = text.replace("\u00A0", " ")  # Неразрывный пробел
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")
    # Заменяем множественные пробелы на один
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_price_string(price_str: str) -> str:
    """Очистка строки с ценой/суммой"""
    if not price_str:
        return ""
    # Удаляем все пробелы и заменяем запятую на точку
    cleaned = price_str.replace(" ", "").replace(",", ".")
    # Удаляем все нецифровые символы, кроме точек
    cleaned = re.sub(r"[^\d\.]", "", cleaned)
    return cleaned


def extract_contractor(text: str) -> Optional[str]:
    """Извлекаем контрагента"""
    # ИП
    ip_match = re.search(
        r"Индивидуальный\s+предприниматель\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})",
        text,
        re.IGNORECASE,
    )
    if ip_match:
        return f"ИП {ip_match.group(1)}"
    
    # ООО
    ooo_match = re.search(
        r'(?:ООО|Общество с ограниченной ответственностью)\s+[«"]([^»"]+)[»"]',
        text,
        re.IGNORECASE,
    )
    if ooo_match:
        return f'ООО "{ooo_match.group(1).strip()}"'
    
    return None


def fix_ocr_errors(text: str) -> str:
    """Исправляет типичные ошибки OCR"""
    replacements = [
        (r'Кiа', 'Kia'),
        (r'Кіа', 'Kia'),
        (r'Вопда', 'Bonga'),
        (r'Вопgа', 'Bonga'),
        (r'ШT', 'шт'),
        (r'WT', 'шт'),
        (r'uт', 'шт'),
        (r'шt', 'шт'),
        (r'Кол-во', 'Количество'),
        (r'\sшт\s+', ' '),
        (r'\sш\.\s+', ' '),
        (r'\.\.\.', ''),
        (r'\s+', ' '),
    ]
    
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
    return text


# -------------------------------------------------
# ФИНАЛЬНЫЙ ИСПРАВЛЕННЫЙ ПАРСЕР
# -------------------------------------------------

def parse_invoice_lines(text: str) -> List[Dict[str, Any]]:
    """
    Финальный исправленный парсер
    """
    # Исправляем ошибки OCR
    text = fix_ocr_errors(text)
    text = normalize_text(text)
    
    print("\n=== FINAL IMPROVED PARSER ===")
    
    # Извлекаем таблицу товаров
    table_text = extract_goods_table_final(text)
    if not table_text:
        print("ERROR: Could not extract table!")
        return []
    
    print(f"Table text length: {len(table_text)} chars")
    
    if len(table_text) > 500:
        preview = table_text[:500] + "..."
    else:
        preview = table_text
    print(f"Table preview: {preview}")
    
    # Парсим все строки финальным методом
    lines = parse_table_final(table_text)
    
    # Фильтруем и валидируем строки
    valid_lines = []
    seen_line_nos = set()
    
    for line in lines:
        line_no = line.get("line_no")
        
        # Проверяем что нет дубликатов по номеру строки
        if line_no in seen_line_nos:
            print(f"  Skipping duplicate line {line_no}")
            continue
            
        if is_valid_line_final(line):
            valid_lines.append(line)
            seen_line_nos.add(line_no)
        else:
            print(f"  Filtered invalid line {line_no}: {line.get('description', '')[:30]}")
    
    # Сортируем по номеру строки
    valid_lines.sort(key=lambda x: x["line_no"])
    
    print(f"\nTOTAL VALID LINES FOUND: {len(valid_lines)}")
    for line in valid_lines:
        desc = line['description'][:20] + '...' if len(line['description']) > 20 else line['description']
        print(f"  {line['line_no']:2d}: {desc:25} "
              f"x{line['qty']:4.0f} @ {line['price']:>10} = {line['total']:>12}")
    
    return valid_lines


def extract_goods_table_final(text: str) -> str:
    """Извлекает таблицу товаров финальным методом"""
    # 1. Сначала ищем "СЧЕТ №" в тексте
    invoice_patterns = [
        r'Счет\s+[№#]\s*\d+',
        r'Счет\s+на\s+оплату\s+[№#]',
        r'СЧЕТ\s+[№#]',
    ]
    
    invoice_pos = -1
    for pattern in invoice_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice_pos = match.end()
            print(f"Found 'Счет №' at position {invoice_pos}")
            break
    
    if invoice_pos == -1:
        print("Warning: 'Счет №' not found, trying alternative methods")
        # Если не нашли "Счет №", используем старый метод
        return extract_goods_table_backup(text)
    
    # 2. Ищем таблицу товаров ПОСЛЕ "Счет №"
    text_after_invoice = text[invoice_pos:]
    
    # Ищем первую строку с номером 1 и названием товара
    # Более точный паттерн: "1 " и потом текст (не число)
    pattern = r'\b1[\.\s]+[А-Яа-яЁёA-Z][^0-9]{5,}'
    match = re.search(pattern, text_after_invoice)
    
    if match:
        start_pos = invoice_pos + match.start()
        print(f"Found table start at position {start_pos} with line 1 (after 'Счет №')")
    else:
        # Резервный поиск
        return extract_goods_table_backup(text)
    
    # Извлекаем таблицу до "Итого"
    table_text = text[start_pos:]
    end_match = re.search(r'\sИтого\s*:', table_text, re.IGNORECASE)
    if end_match:
        table_text = table_text[:end_match.start()].strip()
        print(f"Found table end at position {end_match.start()}")
    
    return table_text


def extract_goods_table_backup(text: str) -> str:
    """Резервный метод извлечения таблицы"""
    # Ищем начало таблицы по паттерну "1 Название"
    for i in range(1, 50):
        pattern = rf'\b{i}[\.\s]+[А-Яа-яЁёA-Z][^0-9]{{5,}}'
        match = re.search(pattern, text)
        if match:
            start_pos = match.start()
            print(f"Found table start at position {start_pos} with line {i} (backup method)")
            break
    else:
        return ""
    
    # Извлекаем таблицу до "Итого"
    table_text = text[start_pos:]
    end_match = re.search(r'\sИтого\s*:', table_text, re.IGNORECASE)
    if end_match:
        table_text = table_text[:end_match.start()].strip()
        print(f"Found table end at position {end_match.start()}")
    
    return table_text


def parse_table_final(table_text: str) -> List[Dict[str, Any]]:
    """
    Финальный парсинг таблицы
    """
    lines = []
    
    # Разбиваем текст на строки по номерам
    line_positions = {}
    
    # Ищем все номера строк
    for i in range(1, 50):
        # Паттерн: номер, потом точка или пробел, потом буква (начало названия)
        pattern = rf'(?<!\d){i}(?!\d)[\.\s]+[А-Яа-яЁёA-Z]'
        match = re.search(pattern, table_text)
        if match:
            line_positions[i] = match.start()
    
    print(f"Found line positions for numbers: {list(line_positions.keys())}")
    
    if not line_positions:
        print("No line numbers found!")
        return lines
    
    # Сортируем позиции
    sorted_positions = sorted(line_positions.items(), key=lambda x: x[1])
    
    # Добавляем конец текста
    sorted_positions.append((0, len(table_text)))
    
    # Парсим каждую строку
    for idx in range(len(sorted_positions) - 1):
        line_no, start_pos = sorted_positions[idx]
        next_line_no, next_start_pos = sorted_positions[idx + 1]
        
        # Вырезаем строку
        line_text = table_text[start_pos:next_start_pos].strip()
        
        # Парсим строку
        line_data = parse_line_final(line_no, line_text)
        if line_data:
            lines.append(line_data)
    
    return lines


def parse_line_final(line_no: int, line_text: str) -> Optional[Dict[str, Any]]:
    """Финальный парсинг одной строки с правильным извлечением чисел"""
    try:
        print(f"\nParsing line {line_no}: '{line_text[:80]}...'")
        
        # Удаляем номер строки из начала
        content = re.sub(rf'^{line_no}[\.\s]+', '', line_text)
        
        # ИМЕННО ВАЖНО: Сначала извлекаем все числа из строки правильно
        numbers = extract_numbers_from_text(content)
        
        print(f"  Found {len(numbers)} numbers in line: {numbers}")
        
        if len(numbers) < 2:
            print(f"  Line {line_no}: not enough numbers ({len(numbers)})")
            return None
        
        # Определяем количество, цену и сумму
        qty, price, total = determine_qtp_from_numbers(numbers)
        
        if price is None or total is None:
            print(f"  Line {line_no}: could not determine price and total")
            return None
        
        # Проверяем согласованность
        expected = round(price * qty, 2)
        if abs(expected - total) > 0.01:
            # Пробуем разные комбинации
            found = False
            for i in range(len(numbers)):
                for j in range(i+1, len(numbers)):
                    for k in range(j+1, len(numbers)):
                        test_qty = numbers[i]
                        test_price = numbers[j]
                        test_total = numbers[k]
                        test_expected = round(test_price * test_qty, 2)
                        if abs(test_expected - test_total) < 0.01:
                            qty, price, total = test_qty, test_price, test_total
                            print(f"  Line {line_no}: found better combination qty={qty}, price={price}, total={total}")
                            found = True
                            break
                    if found:
                        break
                if found:
                    break
            
            if not found:
                print(f"  Line {line_no}: correcting total {total} -> {expected}")
                total = expected
        
        # Получаем описание
        description = extract_description_from_line(content, numbers)
        
        # Очищаем описание
        description = clean_description_final(description)
        
        # Проверяем что описание не пустое
        if not description or len(description) < 2:
            print(f"  Line {line_no}: description too short")
            return None
        
        print(f"  Line {line_no} parsed: '{description[:30]}...' x{qty} @ {price} = {total}")
        
        return {
            "line_no": line_no,
            "description": description,
            "qty": qty,
            "price": str(price),
            "total": str(total),
            "used": False,
            "raw": line_text,
        }
        
    except (ValueError, AttributeError, IndexError, TypeError) as e:
        print(f"  Error parsing line {line_no}: {e}")
        return None


def extract_numbers_from_text(text: str) -> List[float]:
    """Правильное извлечение чисел из текста"""
    numbers = []
    
    # Паттерн для чисел с разделителями тысяч: 26 000,00 или 26.000,00 или 26000,00
    # Ищем последовательности: цифры, возможно пробелы/точки, потом запятая и 2 цифры
    number_pattern = r'\b\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?\b'
    
    # Ищем все совпадения
    for match in re.finditer(number_pattern, text):
        num_str = match.group(0)
        
        # Очищаем и парсим число
        # 1. Удаляем все пробелы
        clean_num = num_str.replace(' ', '')
        # 2. Заменяем запятую на точку если есть
        if ',' in clean_num:
            clean_num = clean_num.replace(',', '.')
        # 3. Удаляем лишние точки (оставляем только одну как десятичный разделитель)
        parts = clean_num.split('.')
        if len(parts) > 2:
            # Слишком много точек - это разделители тысяч
            clean_num = parts[0] + '.' + parts[-1] if len(parts[-1]) <= 2 else parts[0]
        
        try:
            num = float(clean_num)
            numbers.append(num)
        except ValueError:
            continue
    
    return numbers


def determine_qtp_from_numbers(numbers: List[float]) -> Tuple[float, Optional[float], Optional[float]]:
    """Определяет количество, цену и сумму из списка чисел"""
    qty = 1.0
    price = None
    total = None
    
    if not numbers:
        return qty, price, total
    
    # Стратегия для формата с НДС
    # Ищем процент НДС (20 или 10)
    vat_found = False
    vat_index = -1
    
    for i, num in enumerate(numbers):
        if num in [10, 20]:
            vat_found = True
            vat_index = i
            break
    
    if vat_found and vat_index > 0:
        # Формат с НДС: [количество, цена, НДС%, сумма_НДС, сумма]
        # ИЛИ: [цена, НДС%, сумма_НДС, сумма] (количество=1)
        
        # Пробуем определить количество
        if vat_index >= 1:
            # Число перед процентом НДС может быть количеством или ценой
            candidate = numbers[vat_index - 1]
            if candidate <= 100 and candidate == int(candidate):
                qty = candidate
                # Цена ищем перед количеством или берем следующее подходящее
                if vat_index >= 2:
                    price = numbers[vat_index - 2]
                else:
                    # Нет числа перед количеством, берем сумму как цену
                    price = numbers[-1] if numbers else None
            else:
                # Это цена, количество = 1
                price = candidate
                qty = 1.0
        else:
            qty = 1.0
        
        # Сумма - последнее число
        total = numbers[-1] if numbers else None
        
        # Если цена не определена, ищем большое число
        if price is None:
            for num in numbers:
                if num > 100 and num != total:
                    price = num
                    break
        
        print(f"    VAT format: qty={qty}, price={price}, total={total}")
    
    else:
        # Простой формат без НДС
        if len(numbers) >= 3:
            # Первое маленькое число - количество
            if numbers[0] <= 100 and numbers[0] == int(numbers[0]):
                qty = numbers[0]
                price = numbers[1] if len(numbers) > 1 else None
                total = numbers[2] if len(numbers) > 2 else None
            else:
                # Нет четкого количества, предполагаем qty=1
                qty = 1.0
                price = numbers[0]
                total = numbers[1] if len(numbers) > 1 else None
        elif len(numbers) == 2:
            qty = 1.0
            price = numbers[0]
            total = numbers[1]
        
        print(f"    Simple format: qty={qty}, price={price}, total={total}")
    
    return qty, price, total


def extract_description_from_line(text: str, numbers: List[float]) -> str:
    """Извлекает описание из строки"""
    if not numbers:
        return text.strip()
    
    # Находим позицию первого числа в тексте
    first_num_pattern = r'\b\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?\b'
    first_match = re.search(first_num_pattern, text)
    
    if first_match:
        # Берем текст до первого числа
        description = text[:first_match.start()].strip()
    else:
        # Удаляем все числа из текста
        description = re.sub(r'\b\d+\.?\d*\b', '', text)
        description = re.sub(r'\s+', ' ', description).strip()
    
    return description


def clean_description_final(description: str) -> str:
    """Очищает описание финальным методом"""
    # Удаляем единицы измерения
    description = re.sub(r'\s+шт\s*$', '', description, flags=re.IGNORECASE)
    description = re.sub(r'\s+штука\s*$', '', description, flags=re.IGNORECASE)
    
    # Удаляем "1 " если оно в начале и выглядит как количество
    description = re.sub(r'^1\s+', '', description)
    
    # Удаляем числа и проценты в конце
    description = re.sub(r'\s+\d+%?\s*$', '', description)
    description = re.sub(r'\s+\d+\.?\d*\s*$', '', description)
    
    # Удаляем лишние пробелы
    description = re.sub(r'\s+', ' ', description).strip()
    
    return description


def is_valid_line_final(line: Dict[str, Any]) -> bool:
    """Финальная проверка валидности строки"""
    try:
        # Проверяем номер строки
        line_no = line["line_no"]
        if not (1 <= line_no <= 50):
            return False
        
        # Проверяем описание
        description = line["description"]
        if len(description) < 2 or len(description) > 200:
            return False
        
        # Проверяем, что описание не содержит только цифры
        clean_desc = description.replace(' ', '').replace(',', '').replace('.', '')
        if clean_desc.isdigit():
            return False
        
        # Проверяем значения
        qty = line["qty"]
        price = float(line["price"])
        total = float(line["total"])
        
        # Проверяем разумные диапазоны
        if not (0.1 <= qty <= 100):
            return False
        if not (1 <= price <= 100000):
            return False
        if not (1 <= total <= 1000000):
            return False
        
        # Проверяем согласованность (более строгая проверка)
        expected = round(price * qty, 2)
        if abs(expected - total) > 0.01:
            return False
        
        return True
        
    except (KeyError, ValueError, TypeError):
        return False


# -------------------------------------------------
# ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений)
# -------------------------------------------------

def extract_metadata(text: str) -> Dict[str, Any]:
    """Извлечение метаданных из текста"""
    if not text:
        return {}
    
    text = fix_ocr_errors(text)
    
    # Номер и дата счета
    invoice_match = search(INVOICE_NUMBER_DATE, text)
    invoice_number, invoice_date = (
        invoice_match if isinstance(invoice_match, tuple) else (None, None)
    )
    
    if not invoice_number:
        patterns = [
            r'Счет\s*(?:на\s*оплату)?\s*[№#]\s*([A-Za-zА-Яа-я0-9\-\/]+)',
            r'[№#]\s*([^\s]+)\s+от',
            r'Счет\s*№\s*([^\s,]+)',
        ]
        for pattern in patterns:
            invoice_number = search(pattern, text)
            if invoice_number:
                break
    
    if not invoice_date:
        invoice_date = search(INVOICE_DATE_RE, text)
    
    invoice_full_text = None
    if invoice_number and invoice_date:
        invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date} г."
    elif invoice_number:
        invoice_full_text = f"Счет на оплату № {invoice_number}"
    
    # Контрагент
    contractor = extract_contractor(text)
    
    # ИНН
    inn = search(INN, text)
    
    # Расчетный счет
    account_raw = search(ACCOUNT, text)
    account = account_raw.replace(" ", "") if account_raw else None
    
    # Итоговая сумма
    total = search(TOTAL, text)
    if not total:
        total_match = re.search(r'Итого\s*:?\s*([\d\s,\.]+)', text, re.IGNORECASE)
        if total_match:
            total = total_match.group(1).strip()
    
    # НДС
    vat_raw = search(VAT, text)
    vat = vat_raw.replace(" ", "") if vat_raw else None
    
    return {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "invoice_full_text": invoice_full_text,
        "contractor": contractor,
        "inn": inn,
        "account": account,
        "total": total,
        "vat": vat,
    }


def calculate_confidence(data: Dict[str, Any], lines: List[Dict[str, Any]]) -> float:
    """Расчет confidence score"""
    if not data and not lines:
        return 0.0
    
    score = 0.0
    
    # Оценка метаданных
    metadata_score = 0.0
    if data.get("invoice_number"):
        metadata_score += 0.2
    if data.get("invoice_date"):
        metadata_score += 0.1
    if data.get("contractor"):
        metadata_score += 0.2
    if data.get("inn"):
        metadata_score += 0.05
    if data.get("total"):
        metadata_score += 0.05
    
    metadata_score = min(metadata_score, 0.6)
    
    # Оценка строк товаров
    lines_score = 0.0
    if lines:
        line_count = len(lines)
        if line_count >= 5:
            lines_score = 0.3
        elif line_count >= 3:
            lines_score = 0.2
        elif line_count >= 1:
            lines_score = 0.1
        
        # Дополнительная оценка за согласованность
        consistent_count = 0
        for line in lines:
            try:
                price = float(line["price"])
                qty = line["qty"]
                total = float(line["total"])
                expected = round(price * qty, 2)
                if abs(expected - total) <= 0.01:
                    consistent_count += 1
            except:
                pass
        
        if consistent_count > 0:
            consistency_ratio = consistent_count / len(lines)
            lines_score += consistency_ratio * 0.1
    
    lines_score = min(lines_score, 0.4)
    
    score = metadata_score + lines_score
    return round(score, 3)


def parse_invoice_from_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    Основная функция парсинга счета из PDF.
    """
    print(f"\n{'='*60}")
    print(f"PROCESSING PDF: {pdf_path}")
    print(f"{'='*60}")
    
    # Получаем текст из PDF через OCR
    pages = ocr_pdf(pdf_path)
    
    if not pages:
        print("ERROR: No text extracted from PDF")
        return {
            "data": {},
            "lines": [],
            "confidence": 0.0,
            "error": "No text extracted from PDF"
        }
    
    # Объединяем все страницы
    full_text = "\n\n".join(pages)
    print(f"Total pages: {len(pages)}, Total chars: {len(full_text)}")
    
    # Парсим строки товаров
    print("\n--- PARSING GOODS LINES ---")
    lines = parse_invoice_lines(full_text)
    
    # Извлекаем метаданные
    print("\n--- EXTRACTING METADATA ---")
    data = extract_metadata(full_text)
    
    # Рассчитываем confidence
    confidence = calculate_confidence(data, lines)
    
    # Выводим результаты
    print(f"\n{'='*60}")
    print("FINAL OCR RESULTS:")
    print(f"{'='*60}")
    print(f"Lines found: {len(lines)}")
    print(f"Confidence: {confidence:.3f}")
    
    if data.get("invoice_number"):
        print(f"Invoice: №{data['invoice_number']}")
    if data.get("invoice_date"):
        print(f"Date: {data['invoice_date']}")
    if data.get("contractor"):
        print(f"Contractor: {data['contractor']}")
    if data.get("total"):
        print(f"Total: {data['total']}")
    
    if lines:
        print(f"\nGOODS LINES ({len(lines)} items):")
        print("-" * 60)
        for line in lines:
            desc = line['description'][:35] + '...' if len(line['description']) > 35 else line['description']
            print(f"{line['line_no']:2d}. {desc:38} "
                  f"x{line['qty']:3.0f} @ {line['price']:>10} = {line['total']:>12}")
    else:
        print("\nNO GOODS LINES FOUND!")
    
    return {
        "data": data,
        "lines": lines,
        "confidence": confidence,
        "source_page": 1,
    }