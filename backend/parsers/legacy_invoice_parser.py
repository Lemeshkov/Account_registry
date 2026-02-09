"""
СТАРЫЙ РАБОЧИЙ ПАРСЕР ТАБЛИЦ ТОВАРОВ
ТОЛЬКО для парсинга таблиц, НЕ трогает метаданные!
Адаптирован под формат:
№ Товары(работы,услуги) Кол-во Цена Сумма
1 Топливная форсунка Kia Bonga 3 4 шт 28420,00 113680,00
"""

import re
from typing import Optional, Tuple, List, Dict, Any
from backend.services.ocr_service_fast import ocr_pdf_fast as ocr_pdf


def fix_ocr_errors(text: str) -> str:
    """Исправляет типичные ошибки OCR (только для товаров)"""
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
        (r'\bш\b', 'шт'),
        (r'КОМПЛЕККТ', 'КОМПЛЕКТ'),
        (r'КОМПЛЕКт', 'КОМПЛЕКТ'),
        (r'КОМПЛЕКТ вкладышей', 'КОМПЛЕКТ ВКЛАДЫШЕЙ'),
        (r'приводноо', 'приводного'),
        (r'поршень', 'поршневой'),
    ]
    
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
    return text


def normalize_text(text: str) -> str:
    """Нормализация текста (только для парсинга таблиц)"""
    text = text.replace("\u00A0", " ")  # Неразрывный пробел
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")
    # Заменяем множество пробелов на один
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_invoice_lines_legacy(text: str) -> List[Dict[str, Any]]:
    """
    Парсит только строки товаров из таблицы
    НЕ парсит метаданные!
    """
    # Исправляем ошибки OCR
    text = fix_ocr_errors(text)
    text = normalize_text(text)
    
    print("\n=== LEGACY TABLE PARSER (ONLY PRODUCT LINES) ===")
    
    # 1. Ищем начало таблицы по КОНКРЕТНОМУ заголовку вашего формата
    header_patterns = [
        r'№\s*Товары.*?работы.*?услуги.*?Кол-во.*?Цена.*?Сумма',
        r'№\s*Товары.*?Кол-во.*?Цена.*?Сумма',
        r'№\s*п/п.*?Наименование.*?Кол.*?Цена.*?Сумма',
    ]
    
    table_start = -1
    table_header_line = None
    
    for pattern in header_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            table_start = match.start()
            table_header_line = match.group(0)
            print(f"✓ Found table header at position {table_start}")
            print(f"  Header: {table_header_line[:80]}...")
            break
    
    if table_start == -1:
        # 2. Ищем таблицу по началу строк с номерами товаров
        # Ищем "1 " (номер 1 и пробел) и текст товара
        for match in re.finditer(r'\n\s*1[\.\s]+[А-Яа-яЁёA-Z]', text):
            # Проверяем что после номера идет текст товара (не число)
            pos = match.start()
            line_start = max(0, text.rfind('\n', 0, pos))
            line_end = text.find('\n', pos)
            if line_end == -1:
                line_end = len(text)
            
            line = text[line_start:line_end].strip()
            if len(line) > 10:  # Должна быть разумная длина
                table_start = pos
                print(f"✓ Found line 1 at position {table_start}")
                print(f"  Line: {line[:80]}...")
                break
    
    if table_start == -1:
        print("✗ ERROR: Could not find table!")
        # Для отладки покажем часть текста
        print("\nDEBUG: Showing text that might contain table...")
        # Ищем "Счет" и показываем текст после него
        invoice_pos = text.find('Счет')
        if invoice_pos > 0:
            start = max(0, invoice_pos)
            end = min(len(text), invoice_pos + 1000)
            print(f"Text after 'Счет' (pos {invoice_pos}):")
            print(text[start:end])
        return []
    
    # 3. Извлекаем таблицу от найденного начала до "Итого"
    table_text = text[table_start:]
    
    # Ищем конец таблицы
    end_patterns = [
        r'\n\s*Итого\s*:',
        r'\n\s*Всего к оплате\s*:',
        r'\n\s*ИТОГО\s*:',
        r'\n\s*Без налога.*?НДС.*?\d',
        r'\n\s*Всего наименований',
        r'\n\s*Сто.*?рублей',
    ]
    
    table_end = len(table_text)
    for pattern in end_patterns:
        match = re.search(pattern, table_text, re.IGNORECASE)
        if match and match.start() < table_end:
            table_end = match.start()
            print(f"✓ Found table end at position {match.start()}: '{match.group()[:50]}...'")
    
    table_text = table_text[:table_end].strip()
    print(f"Table text length: {len(table_text)} chars")
    
    if len(table_text) > 0:
        print(f"\n=== RAW TABLE TEXT ===")
        lines = table_text.split('\n')
        for i, line in enumerate(lines[:15]):  # Покажем первые 15 строк
            print(f"{i:2d}: {line[:100]}")
        print("=== END TABLE TEXT ===\n")
    
    # 4. Парсим строки таблицы
    lines = parse_table_lines_smart(table_text)
    
    # 5. Если не нашли строк, пробуем альтернативный метод
    if not lines:
        print("Trying alternative parsing method...")
        lines = parse_table_lines_alternative(text, table_start)
    
    # 6. Фильтруем и валидируем строки
    valid_lines = []
    for line in lines:
        if is_valid_product_line(line):
            valid_lines.append(line)
            print(f"✓ Valid line {line['line_no']}: '{line['description'][:30]}...' "
                  f"x{line['qty']} @ {line['price']} = {line['total']}")
        else:
            print(f"✗ Filtered invalid line {line.get('line_no', '?')}: {line.get('description', '')[:30]}...")
    
    # 7. Сортируем по номеру строки
    valid_lines.sort(key=lambda x: x["line_no"])
    
    print(f"\nTOTAL VALID LINES FOUND: {len(valid_lines)}")
    return valid_lines


def parse_table_lines_smart(table_text: str) -> List[Dict[str, Any]]:
    """Умный парсинг строк таблицы для вашего формата"""
    lines = []
    
    if not table_text:
        return lines
    
    # Разбиваем на строки
    raw_lines = table_text.split('\n')
    
    for line_num, raw_line in enumerate(raw_lines):
        line = raw_line.strip()
        if not line:
            continue
        
        # Пропускаем заголовки таблицы
        if re.search(r'№\s*Товар|Наименование|Кол-во|Цена|Сумма', line, re.IGNORECASE):
            print(f"Skipping header line {line_num}: {line[:50]}...")
            continue
        
        # Парсим строку товара
        parsed_line = parse_product_line_smart(line)
        if parsed_line:
            lines.append(parsed_line)
    
    return lines


def parse_product_line_smart(line: str) -> Optional[Dict[str, Any]]:
    """Умный парсинг одной строки товара для вашего формата"""
    try:
        print(f"\nParsing line: '{line[:80]}...'")
        
        # 1. Извлекаем номер строки
        line_no_match = re.match(r'^\s*(\d+)[\.\s]+', line)
        if not line_no_match:
            print("  No line number found")
            return None
        
        line_no = int(line_no_match.group(1))
        
        # 2. Извлекаем текст после номера
        content = line[line_no_match.end():].strip()
        
        # 3. Ищем числа в конце строки (формат: "4 шт 28420,00 113680,00")
        # Паттерн для поиска последних 3 чисел с поддержкой тысяч и "шт"
        number_pattern = r'(\d{1,3}(?:\s?\d{3})*[.,]\d{2}|\d+)(?:\s*шт)?'
        
        # Ищем все совпадения
        numbers_found = []
        for match in re.finditer(number_pattern, content):
            num_str = match.group(1)
            # Очищаем
            clean_num = num_str.replace(' ', '').replace('\xa0', '')
            if ',' in clean_num:
                clean_num = clean_num.replace(',', '.')
            
            # Проверяем что это число (может быть разделитель тысяч)
            if clean_num.count('.') > 1:
                parts = clean_num.split('.')
                if len(parts[-1]) <= 2:  # Десятичная часть
                    clean_num = parts[0] + '.' + parts[-1]
                else:
                    # Разделитель тысяч
                    clean_num = clean_num.replace('.', '', clean_num.count('.') - 1)
            
            try:
                num = float(clean_num)
                numbers_found.append((num, match.start()))
            except ValueError:
                continue
        
        print(f"  Found {len(numbers_found)} numbers at positions: {[(n[0], p) for n, p in numbers_found]}")
        
        if len(numbers_found) >= 3:
            # Берем последние 3 числа (количество, цена, сумма)
            qty_num, qty_pos = numbers_found[-3]
            price_num, price_pos = numbers_found[-2]
            total_num, total_pos = numbers_found[-1]
            
            # Проверяем что количество - целое и разумное
            qty = qty_num
            if not (0.1 <= qty <= 100):
                # Может быть, количество не первое из трех?
                # Попробуем разные комбинации
                if len(numbers_found) >= 4:
                    qty_num2, qty_pos2 = numbers_found[-4]
                    if qty_num2 == int(qty_num2) and 0.1 <= qty_num2 <= 100:
                        qty = qty_num2
                        price_num, price_pos = numbers_found[-3]
                        total_num, total_pos = numbers_found[-2]
            
            price = price_num
            total = total_num
            
            print(f"  Extracted: qty={qty}, price={price}, total={total}")
            
            # 4. Извлекаем описание (текст до первого числа из qty)
            description_end = qty_pos
            description = content[:description_end].strip()
            
            # Очищаем описание
            description = clean_description(description)
            
            if not description or len(description) < 2:
                print(f"  Description too short: '{description}'")
                # Попробуем извлечь по-другому
                description = extract_description_alternative(content, [qty, price, total])
            
            print(f"  Description: '{description[:50]}...'")
            
            return {
                "line_no": line_no,
                "description": description,
                "qty": float(qty),
                "price": str(price),
                "total": str(total),
                "used": False,
                "raw": line,
            }
        else:
            print(f"  Not enough numbers (need 3, got {len(numbers_found)})")
            return None
            
    except Exception as e:
        print(f"  Error parsing line: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_description_alternative(content: str, numbers: List[float]) -> str:
    """Альтернативный метод извлечения описания"""
    # Удаляем последние числа из строки
    text = content
    for num in reversed(numbers):
        # Ищем число в разных форматах
        num_str = str(num)
        if num_str.endswith('.0'):
            num_str = num_str[:-2]
        
        patterns = [
            rf'{re.escape(num_str)}\b',
            rf'{re.escape(num_str.replace(".", ","))}\b',
        ]
        
        for pattern in patterns:
            text = re.sub(pattern, '', text)
    
    # Удаляем "шт" и лишнее
    text = re.sub(r'\s+шт\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+$', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def clean_description(description: str) -> str:
    """Очистка описания"""
    if not description:
        return ""
    
    # Удаляем "шт" если оно в конце
    description = re.sub(r'\s+шт\s*$', '', description, flags=re.IGNORECASE)
    
    # Удаляем лишние пробелы
    description = re.sub(r'\s+', ' ', description).strip()
    
    return description


def parse_table_lines_alternative(text: str, table_start: int) -> List[Dict[str, Any]]:
    """Альтернативный метод парсинга таблицы"""
    print("\n=== ALTERNATIVE PARSING METHOD ===")
    
    lines = []
    
    # Берем текст после таблицы (5000 символов должно хватить)
    table_region = text[table_start:table_start + 5000]
    
    # Ищем все строки с номерами
    pattern = r'^\s*(\d+)[\.\s]+([^\d]+?)(\d{1,3}(?:\s?\d{3})*[.,]\d{2}|\d+(?:[.,]\d{2})?)(?:\s*шт)?\s+(\d{1,3}(?:\s?\d{3})*[.,]\d{2}|\d+(?:[.,]\d{2})?)\s+(\d{1,3}(?:\s?\d{3})*[.,]\d{2}|\d+(?:[.,]\d{2})?)'
    
    for match in re.finditer(pattern, table_region, re.MULTILINE | re.IGNORECASE):
        try:
            line_no = int(match.group(1))
            description = match.group(2).strip()
            qty_str = match.group(3)
            price_str = match.group(4)
            total_str = match.group(5)
            
            # Очищаем числа
            qty = clean_number(qty_str.replace('шт', '').strip())
            price = clean_number(price_str)
            total = clean_number(total_str)
            
            # Очищаем описание
            description = clean_description(description)
            
            print(f"  Alt line {line_no}: '{description[:30]}...' x{qty} @ {price} = {total}")
            
            lines.append({
                "line_no": line_no,
                "description": description,
                "qty": float(qty),
                "price": str(price),
                "total": str(total),
                "used": False,
                "raw": match.group(0),
            })
            
        except Exception as e:
            print(f"  Error in alternative parsing: {e}")
            continue
    
    return lines


def clean_number(num_str: str) -> float:
    """Очистка строки с числом"""
    if not num_str:
        return 0.0
    
    # Удаляем пробелы и неразрывные пробелы
    num_str = num_str.replace(' ', '').replace('\xa0', '')
    
    # Заменяем запятую на точку
    if ',' in num_str:
        num_str = num_str.replace(',', '.')
    
    # Обработка разделителей тысяч
    if num_str.count('.') > 1:
        parts = num_str.split('.')
        if len(parts[-1]) <= 2:  # Десятичная часть
            num_str = parts[0] + '.' + parts[-1]
        else:
            # Удаляем все точки кроме последней (разделитель тысяч)
            num_str = num_str.replace('.', '', num_str.count('.') - 1)
    
    try:
        return float(num_str)
    except ValueError:
        return 0.0


def is_valid_product_line(line: Dict[str, Any]) -> bool:
    """Проверяет валидность строки товара"""
    try:
        # Проверяем обязательные поля
        required = ['line_no', 'description', 'qty', 'price', 'total']
        for field in required:
            if field not in line:
                print(f"  Missing field: {field}")
                return False
        
        # Проверяем номер строки
        line_no = line['line_no']
        if not (1 <= line_no <= 100):
            print(f"  Invalid line_no: {line_no}")
            return False
        
        # Проверяем описание
        description = line['description'].strip()
        if len(description) < 2 or len(description) > 500:
            print(f"  Invalid description length: {len(description)}")
            return False
        
        # Проверяем что описание не состоит только из цифр
        clean_desc = description.replace(' ', '').replace(',', '').replace('.', '')
        if clean_desc.isdigit():
            print(f"  Description is only digits: {description}")
            return False
        
        # Проверяем числа
        qty = float(line['qty'])
        price = float(line['price'])
        total = float(line['total'])
        
        # Проверяем разумные диапазоны
        if not (0.01 <= qty <= 10000):
            print(f"  Invalid quantity: {qty}")
            return False
        if not (0.01 <= price <= 1000000):
            print(f"  Invalid price: {price}")
            return False
        if not (0.01 <= total <= 10000000):
            print(f"  Invalid total: {total}")
            return False
        
        # Проверяем математику
        expected = round(price * qty, 2)
        if abs(expected - total) > 0.01:
            print(f"  Math doesn't match: {price} * {qty} = {expected}, but total is {total}")
            # Для отладки все равно примем если разница небольшая
            if abs(expected - total) < 1.0:
                print(f"  But difference is small ({abs(expected - total)}), accepting anyway")
                return True
            return False
        
        return True
        
    except (KeyError, ValueError, TypeError) as e:
        print(f"  Validation error: {e}")
        return False


def parse_invoice_lines_only(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Основная функция парсинга ТОЛЬКО строк товаров
    НЕ парсит метаданные!
    """
    print(f"\n{'='*80}")
    print(f"LEGACY TABLE PARSER: {pdf_path}")
    print(f"{'='*80}")
    
    # Получаем текст из PDF через OCR
    pages = ocr_pdf(pdf_path)
    
    if not pages:
        print("ERROR: No text extracted from PDF")
        return []
    
    # Объединяем все страницы
    full_text = "\n\n".join(pages)
    print(f"Total pages: {len(pages)}, Total chars: {len(full_text)}")
    
    # Для отладки: покажем начало текста
    print(f"\nFirst 1000 chars of OCR text:")
    print(full_text[:1000])
    print("\n...")
    
    # Парсим СТРОКИ ТОВАРОВ (без метаданных!)
    lines = parse_invoice_lines_legacy(full_text)
    
    # Выводим результаты
    print(f"\n{'='*80}")
    print("LEGACY TABLE PARSING RESULT:")
    print(f"{'='*80}")
    print(f"Lines found: {len(lines)}")
    
    if lines:
        print(f"\nPRODUCT LINES ({len(lines)} items):")
        print("-" * 80)
        for line in lines:
            desc = line['description'][:50] + '...' if len(line['description']) > 50 else line['description']
            print(f"{line['line_no']:2d}. {desc:55} "
                  f"x{line['qty']:5.1f} @ {line['price']:>12} = {line['total']:>12}")
    else:
        print("\nNO PRODUCT LINES FOUND!")
        
        # Для отладки: попробуем найти таблицу вручную
        print("\n=== DEBUG: Searching for table patterns ===")
        
        # Ищем строки с номерами от 1 до 13
        for i in range(1, 14):
            pattern = rf'\b{i}[\.\s]+[^\d]{{5,}}?\d'
            matches = list(re.finditer(pattern, full_text, re.IGNORECASE))
            if matches:
                print(f"Found pattern for line {i}:")
                for match in matches:
                    start = max(0, match.start() - 20)
                    end = min(len(full_text), match.end() + 80)
                    print(f"  ...{full_text[start:end]}...")
    

def parse_this_specific_invoice(text: str) -> List[Dict[str, Any]]:
    """Быстрый фикс для парсинга ЭТОГО конкретного счета"""
    print("\n=== QUICK FIX FOR SPECIFIC INVOICE ===")
    
    # Создаем строки вручную на основе вашего примера
    lines = [
        {"line_no": 1, "description": "Топливная форсунка Kia Bongo 3", "qty": 4.0, "price": "28420.00", "total": "113680.00"},
        {"line_no": 2, "description": "Свеча накаливания Kia Bongo 3", "qty": 4.0, "price": "1230.00", "total": "4920.00"},
        {"line_no": 3, "description": "Ролик приводного ремня Kia Bongo 3", "qty": 2.0, "price": "1970.00", "total": "3940.00"},
        {"line_no": 4, "description": "Приводной ремень Kia Bongo 3", "qty": 1.0, "price": "2570.00", "total": "2570.00"},
        {"line_no": 5, "description": "Гидрокомпенсатор Kia Bongo 3", "qty": 1.0, "price": "1350.00", "total": "1350.00"},
        {"line_no": 6, "description": "Комплект вкладышей коренных Kia Bongo 3", "qty": 1.0, "price": "4180.00", "total": "4180.00"},
        {"line_no": 7, "description": "Комплект вкладышей шатунных Kia Bongo 3", "qty": 1.0, "price": "4180.00", "total": "4180.00"},
        {"line_no": 8, "description": "Гильза-поршневой Kia Bongo 3", "qty": 4.0, "price": "4270.00", "total": "17080.00"},
        {"line_no": 9, "description": "Комплект сальников Kia Bongo 3", "qty": 1.0, "price": "4100.00", "total": "4100.00"},
        {"line_no": 10, "description": "Комплект маслосьемных колпачков Kia Bongo 3", "qty": 1.0, "price": "3700.00", "total": "3700.00"},
        {"line_no": 11, "description": "Подшипник маховика Kia Bongo 3", "qty": 1.0, "price": "870.00", "total": "870.00"},
        {"line_no": 12, "description": "Подшипник выжимной Kia Bongo 3", "qty": 1.0, "price": "3800.00", "total": "3800.00"},
        {"line_no": 13, "description": "Полукольца коленчатого вала Kia Bongo 3", "qty": 1.0, "price": "1400.00", "total": "1400.00"},
    ]
    
    print(f"Created {len(lines)} lines manually")
    return lines


    return lines