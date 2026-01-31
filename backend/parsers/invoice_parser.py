
# # import re
# # from typing import Optional, Tuple, List, Dict, Any
# # from backend.services.ocr_service import ocr_pdf
# # from backend.parsers.regex_patterns import *
# # from ..utils.numbers import parse_number

# import re
# from typing import Optional, Tuple, List, Dict, Any
# from backend.services.ocr_service_fast import ocr_pdf_fast as ocr_pdf
# from backend.parsers.regex_patterns import *
# from ..utils.numbers import parse_number


# # -------------------------------------------------
# # ДОПОЛНИТЕЛЬНЫЕ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
# # -------------------------------------------------

# INVOICE_NUMBER_RE = r"сч[её]т\s*№?\s*(\d+)"
# INVOICE_DATE_RE = r"от\s*(\d{1,2}\s+[а-яё]+\s+\d{4})"


# # -------------------------------------------------
# # HELPERS
# # -------------------------------------------------

# def search(pattern: str, text: str, flags: int = re.IGNORECASE | re.DOTALL):
#     """Безопасный regex-поиск"""
#     m = re.search(pattern, text, flags)
#     if not m:
#         return None
#     if m.lastindex == 1:
#         return m.group(1).strip()
#     if m.lastindex and m.lastindex > 1:
#         return tuple(g.strip() for g in m.groups())
#     return m.group(0).strip()


# def normalize_text(text: str) -> str:
#     """Нормализация текста для парсинга"""
#     text = text.replace("\u00A0", " ")  # Неразрывный пробел
#     text = text.replace("\r\n", "\n")
#     text = text.replace("\r", "\n")
#     # Заменяем множественные пробелы на один
#     text = re.sub(r"\s+", " ", text)
#     return text.strip()


# def clean_price_string(price_str: str) -> str:
#     """Очистка строки с ценой/суммой"""
#     if not price_str:
#         return ""
#     # Удаляем все пробелы и заменяем запятую на точку
#     cleaned = price_str.replace(" ", "").replace(",", ".")
#     # Удаляем все нецифровые символы, кроме точек
#     cleaned = re.sub(r"[^\d\.]", "", cleaned)
#     return cleaned


# def extract_contractor(text: str) -> Optional[str]:
#     """Извлекаем контрагента"""
#     # ИП
#     ip_match = re.search(
#         r"Индивидуальный\s+предприниматель\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})",
#         text,
#         re.IGNORECASE,
#     )
#     if ip_match:
#         return f"ИП {ip_match.group(1)}"
    
#     # ООО
#     ooo_match = re.search(
#         r'(?:ООО|Общество с ограниченной ответственностью)\s+[«"]([^»"]+)[»"]',
#         text,
#         re.IGNORECASE,
#     )
#     if ooo_match:
#         return f'ООО "{ooo_match.group(1).strip()}"'
    
#     return None


# def fix_ocr_errors(text: str) -> str:
#     """Исправляет типичные ошибки OCR"""
#     replacements = [
#         (r'Кiа', 'Kia'),
#         (r'Кіа', 'Kia'),
#         (r'Вопда', 'Bonga'),
#         (r'Вопgа', 'Bonga'),
#         (r'ШT', 'шт'),
#         (r'WT', 'шт'),
#         (r'uт', 'шт'),
#         (r'шt', 'шт'),
#         (r'Кол-во', 'Количество'),
#         (r'\sшт\s+', ' '),
#         (r'\sш\.\s+', ' '),
#         (r'\.\.\.', ''),
#         (r'\s+', ' '),
#     ]
    
#     for pattern, replacement in replacements:
#         text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
#     return text


# # -------------------------------------------------
# # ФИНАЛЬНЫЙ ИСПРАВЛЕННЫЙ ПАРСЕР
# # -------------------------------------------------

# def parse_invoice_lines(text: str) -> List[Dict[str, Any]]:
#     """
#     Финальный исправленный парсер
#     """
#     # Исправляем ошибки OCR
#     text = fix_ocr_errors(text)
#     text = normalize_text(text)
    
#     print("\n=== FINAL IMPROVED PARSER ===")
    
#     # Извлекаем таблицу товаров
#     table_text = extract_goods_table_final(text)
#     if not table_text:
#         print("ERROR: Could not extract table!")
#         return []
    
#     print(f"Table text length: {len(table_text)} chars")
    
#     if len(table_text) > 500:
#         preview = table_text[:500] + "..."
#     else:
#         preview = table_text
#     print(f"Table preview: {preview}")
    
#     # Парсим все строки финальным методом
#     lines = parse_table_final(table_text)
    
#     # Фильтруем и валидируем строки
#     valid_lines = []
#     seen_line_nos = set()
    
#     for line in lines:
#         line_no = line.get("line_no")
        
#         # Проверяем что нет дубликатов по номеру строки
#         if line_no in seen_line_nos:
#             print(f"  Skipping duplicate line {line_no}")
#             continue
            
#         if is_valid_line_final(line):
#             valid_lines.append(line)
#             seen_line_nos.add(line_no)
#         else:
#             print(f"  Filtered invalid line {line_no}: {line.get('description', '')[:30]}")
    
#     # Сортируем по номеру строки
#     valid_lines.sort(key=lambda x: x["line_no"])
    
#     print(f"\nTOTAL VALID LINES FOUND: {len(valid_lines)}")
#     for line in valid_lines:
#         desc = line['description'][:20] + '...' if len(line['description']) > 20 else line['description']
#         print(f"  {line['line_no']:2d}: {desc:25} "
#               f"x{line['qty']:4.0f} @ {line['price']:>10} = {line['total']:>12}")
    
#     return valid_lines


# def extract_goods_table_final(text: str) -> str:
#     """Извлекает таблицу товаров финальным методом"""
#     # 1. Сначала ищем "СЧЕТ №" в тексте
#     invoice_patterns = [
#         r'Счет\s+[№#]\s*\d+',
#         r'Счет\s+на\s+оплату\s+[№#]',
#         r'СЧЕТ\s+[№#]',
#     ]
    
#     invoice_pos = -1
#     for pattern in invoice_patterns:
#         match = re.search(pattern, text, re.IGNORECASE)
#         if match:
#             invoice_pos = match.end()
#             print(f"Found 'Счет №' at position {invoice_pos}")
#             break
    
#     if invoice_pos == -1:
#         print("Warning: 'Счет №' not found, trying alternative methods")
#         # Если не нашли "Счет №", используем старый метод
#         return extract_goods_table_backup(text)
    
#     # 2. Ищем таблицу товаров ПОСЛЕ "Счет №"
#     text_after_invoice = text[invoice_pos:]
    
#     # Ищем первую строку с номером 1 и названием товара
#     # Более точный паттерн: "1 " и потом текст (не число)
#     pattern = r'\b1[\.\s]+[А-Яа-яЁёA-Z][^0-9]{5,}'
#     match = re.search(pattern, text_after_invoice)
    
#     if match:
#         start_pos = invoice_pos + match.start()
#         print(f"Found table start at position {start_pos} with line 1 (after 'Счет №')")
#     else:
#         # Резервный поиск
#         return extract_goods_table_backup(text)
    
#     # Извлекаем таблицу до "Итого"
#     table_text = text[start_pos:]
#     end_match = re.search(r'\sИтого\s*:', table_text, re.IGNORECASE)
#     if end_match:
#         table_text = table_text[:end_match.start()].strip()
#         print(f"Found table end at position {end_match.start()}")
    
#     return table_text


# def extract_goods_table_backup(text: str) -> str:
#     """Резервный метод извлечения таблицы"""
#     # Ищем начало таблицы по паттерну "1 Название"
#     for i in range(1, 50):
#         pattern = rf'\b{i}[\.\s]+[А-Яа-яЁёA-Z][^0-9]{{5,}}'
#         match = re.search(pattern, text)
#         if match:
#             start_pos = match.start()
#             print(f"Found table start at position {start_pos} with line {i} (backup method)")
#             break
#     else:
#         return ""
    
#     # Извлекаем таблицу до "Итого"
#     table_text = text[start_pos:]
#     end_match = re.search(r'\sИтого\s*:', table_text, re.IGNORECASE)
#     if end_match:
#         table_text = table_text[:end_match.start()].strip()
#         print(f"Found table end at position {end_match.start()}")
    
#     return table_text


# def parse_table_final(table_text: str) -> List[Dict[str, Any]]:
#     """
#     Финальный парсинг таблицы
#     """
#     lines = []
    
#     # Разбиваем текст на строки по номерам
#     line_positions = {}
    
#     # Ищем все номера строк
#     for i in range(1, 50):
#         # Паттерн: номер, потом точка или пробел, потом буква (начало названия)
#         pattern = rf'(?<!\d){i}(?!\d)[\.\s]+[А-Яа-яЁёA-Z]'
#         match = re.search(pattern, table_text)
#         if match:
#             line_positions[i] = match.start()
    
#     print(f"Found line positions for numbers: {list(line_positions.keys())}")
    
#     if not line_positions:
#         print("No line numbers found!")
#         return lines
    
#     # Сортируем позиции
#     sorted_positions = sorted(line_positions.items(), key=lambda x: x[1])
    
#     # Добавляем конец текста
#     sorted_positions.append((0, len(table_text)))
    
#     # Парсим каждую строку
#     for idx in range(len(sorted_positions) - 1):
#         line_no, start_pos = sorted_positions[idx]
#         next_line_no, next_start_pos = sorted_positions[idx + 1]
        
#         # Вырезаем строку
#         line_text = table_text[start_pos:next_start_pos].strip()
        
#         # Парсим строку
#         line_data = parse_line_final(line_no, line_text)
#         if line_data:
#             lines.append(line_data)
    
#     return lines


# def parse_line_final(line_no: int, line_text: str) -> Optional[Dict[str, Any]]:
#     """Финальный парсинг одной строки с правильным извлечением чисел"""
#     try:
#         print(f"\nParsing line {line_no}: '{line_text[:80]}...'")
        
#         # Удаляем номер строки из начала
#         content = re.sub(rf'^{line_no}[\.\s]+', '', line_text)
        
#         # ИМЕННО ВАЖНО: Сначала извлекаем все числа из строки правильно
#         numbers = extract_numbers_from_text(content)
        
#         print(f"  Found {len(numbers)} numbers in line: {numbers}")
        
#         if len(numbers) < 2:
#             print(f"  Line {line_no}: not enough numbers ({len(numbers)})")
#             return None
        
#         # Определяем количество, цену и сумму
#         qty, price, total = determine_qtp_from_numbers(numbers)
        
#         if price is None or total is None:
#             print(f"  Line {line_no}: could not determine price and total")
#             return None
        
#         # Проверяем согласованность
#         expected = round(price * qty, 2)
#         if abs(expected - total) > 0.01:
#             # Пробуем разные комбинации
#             found = False
#             for i in range(len(numbers)):
#                 for j in range(i+1, len(numbers)):
#                     for k in range(j+1, len(numbers)):
#                         test_qty = numbers[i]
#                         test_price = numbers[j]
#                         test_total = numbers[k]
#                         test_expected = round(test_price * test_qty, 2)
#                         if abs(test_expected - test_total) < 0.01:
#                             qty, price, total = test_qty, test_price, test_total
#                             print(f"  Line {line_no}: found better combination qty={qty}, price={price}, total={total}")
#                             found = True
#                             break
#                     if found:
#                         break
#                 if found:
#                     break
            
#             if not found:
#                 print(f"  Line {line_no}: correcting total {total} -> {expected}")
#                 total = expected
        
#         # Получаем описание
#         description = extract_description_from_line(content, numbers)
        
#         # Очищаем описание
#         description = clean_description_final(description)
        
#         # Проверяем что описание не пустое
#         if not description or len(description) < 2:
#             print(f"  Line {line_no}: description too short")
#             return None
        
#         print(f"  Line {line_no} parsed: '{description[:30]}...' x{qty} @ {price} = {total}")
        
#         return {
#             "line_no": line_no,
#             "description": description,
#             "qty": qty,
#             "price": str(price),
#             "total": str(total),
#             "used": False,
#             "raw": line_text,
#         }
        
#     except (ValueError, AttributeError, IndexError, TypeError) as e:
#         print(f"  Error parsing line {line_no}: {e}")
#         return None


# def extract_numbers_from_text(text: str) -> List[float]:
#     """Правильное извлечение чисел из текста"""
#     numbers = []
    
#     # Паттерн для чисел с разделителями тысяч: 26 000,00 или 26.000,00 или 26000,00
#     # Ищем последовательности: цифры, возможно пробелы/точки, потом запятая и 2 цифры
#     number_pattern = r'\b\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?\b'
    
#     # Ищем все совпадения
#     for match in re.finditer(number_pattern, text):
#         num_str = match.group(0)
        
#         # Очищаем и парсим число
#         # 1. Удаляем все пробелы
#         clean_num = num_str.replace(' ', '')
#         # 2. Заменяем запятую на точку если есть
#         if ',' in clean_num:
#             clean_num = clean_num.replace(',', '.')
#         # 3. Удаляем лишние точки (оставляем только одну как десятичный разделитель)
#         parts = clean_num.split('.')
#         if len(parts) > 2:
#             # Слишком много точек - это разделители тысяч
#             clean_num = parts[0] + '.' + parts[-1] if len(parts[-1]) <= 2 else parts[0]
        
#         try:
#             num = float(clean_num)
#             numbers.append(num)
#         except ValueError:
#             continue
    
#     return numbers


# def determine_qtp_from_numbers(numbers: List[float]) -> Tuple[float, Optional[float], Optional[float]]:
#     """Определяет количество, цену и сумму из списка чисел"""
#     qty = 1.0
#     price = None
#     total = None
    
#     if not numbers:
#         return qty, price, total
    
#     # Стратегия для формата с НДС
#     # Ищем процент НДС (20 или 10)
#     vat_found = False
#     vat_index = -1
    
#     for i, num in enumerate(numbers):
#         if num in [10, 20]:
#             vat_found = True
#             vat_index = i
#             break
    
#     if vat_found and vat_index > 0:
#         # Формат с НДС: [количество, цена, НДС%, сумма_НДС, сумма]
#         # ИЛИ: [цена, НДС%, сумма_НДС, сумма] (количество=1)
        
#         # Пробуем определить количество
#         if vat_index >= 1:
#             # Число перед процентом НДС может быть количеством или ценой
#             candidate = numbers[vat_index - 1]
#             if candidate <= 100 and candidate == int(candidate):
#                 qty = candidate
#                 # Цена ищем перед количеством или берем следующее подходящее
#                 if vat_index >= 2:
#                     price = numbers[vat_index - 2]
#                 else:
#                     # Нет числа перед количеством, берем сумму как цену
#                     price = numbers[-1] if numbers else None
#             else:
#                 # Это цена, количество = 1
#                 price = candidate
#                 qty = 1.0
#         else:
#             qty = 1.0
        
#         # Сумма - последнее число
#         total = numbers[-1] if numbers else None
        
#         # Если цена не определена, ищем большое число
#         if price is None:
#             for num in numbers:
#                 if num > 100 and num != total:
#                     price = num
#                     break
        
#         print(f"    VAT format: qty={qty}, price={price}, total={total}")
    
#     else:
#         # Простой формат без НДС
#         if len(numbers) >= 3:
#             # Первое маленькое число - количество
#             if numbers[0] <= 100 and numbers[0] == int(numbers[0]):
#                 qty = numbers[0]
#                 price = numbers[1] if len(numbers) > 1 else None
#                 total = numbers[2] if len(numbers) > 2 else None
#             else:
#                 # Нет четкого количества, предполагаем qty=1
#                 qty = 1.0
#                 price = numbers[0]
#                 total = numbers[1] if len(numbers) > 1 else None
#         elif len(numbers) == 2:
#             qty = 1.0
#             price = numbers[0]
#             total = numbers[1]
        
#         print(f"    Simple format: qty={qty}, price={price}, total={total}")
    
#     return qty, price, total


# def extract_description_from_line(text: str, numbers: List[float]) -> str:
#     """Извлекает описание из строки"""
#     if not numbers:
#         return text.strip()
    
#     # Находим позицию первого числа в тексте
#     first_num_pattern = r'\b\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?\b'
#     first_match = re.search(first_num_pattern, text)
    
#     if first_match:
#         # Берем текст до первого числа
#         description = text[:first_match.start()].strip()
#     else:
#         # Удаляем все числа из текста
#         description = re.sub(r'\b\d+\.?\d*\b', '', text)
#         description = re.sub(r'\s+', ' ', description).strip()
    
#     return description


# def clean_description_final(description: str) -> str:
#     """Очищает описание финальным методом"""
#     # Удаляем единицы измерения
#     description = re.sub(r'\s+шт\s*$', '', description, flags=re.IGNORECASE)
#     description = re.sub(r'\s+штука\s*$', '', description, flags=re.IGNORECASE)
    
#     # Удаляем "1 " если оно в начале и выглядит как количество
#     description = re.sub(r'^1\s+', '', description)
    
#     # Удаляем числа и проценты в конце
#     description = re.sub(r'\s+\d+%?\s*$', '', description)
#     description = re.sub(r'\s+\d+\.?\d*\s*$', '', description)
    
#     # Удаляем лишние пробелы
#     description = re.sub(r'\s+', ' ', description).strip()
    
#     return description


# def is_valid_line_final(line: Dict[str, Any]) -> bool:
#     """Финальная проверка валидности строки"""
#     try:
#         # Проверяем номер строки
#         line_no = line["line_no"]
#         if not (1 <= line_no <= 50):
#             return False
        
#         # Проверяем описание
#         description = line["description"]
#         if len(description) < 2 or len(description) > 200:
#             return False
        
#         # Проверяем, что описание не содержит только цифры
#         clean_desc = description.replace(' ', '').replace(',', '').replace('.', '')
#         if clean_desc.isdigit():
#             return False
        
#         # Проверяем значения
#         qty = line["qty"]
#         price = float(line["price"])
#         total = float(line["total"])
        
#         # Проверяем разумные диапазоны
#         if not (0.1 <= qty <= 100):
#             return False
#         if not (1 <= price <= 100000):
#             return False
#         if not (1 <= total <= 1000000):
#             return False
        
#         # Проверяем согласованность (более строгая проверка)
#         expected = round(price * qty, 2)
#         if abs(expected - total) > 0.01:
#             return False
        
#         return True
        
#     except (KeyError, ValueError, TypeError):
#         return False


# # -------------------------------------------------
# # ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений)
# # -------------------------------------------------

# def extract_metadata(text: str) -> Dict[str, Any]:
#     """Извлечение метаданных из текста"""
#     if not text:
#         return {}
    
#     text = fix_ocr_errors(text)
    
#     # Номер и дата счета
#     invoice_match = search(INVOICE_NUMBER_DATE, text)
#     invoice_number, invoice_date = (
#         invoice_match if isinstance(invoice_match, tuple) else (None, None)
#     )
    
#     if not invoice_number:
#         patterns = [
#             r'Счет\s*(?:на\s*оплату)?\s*[№#]\s*([A-Za-zА-Яа-я0-9\-\/]+)',
#             r'[№#]\s*([^\s]+)\s+от',
#             r'Счет\s*№\s*([^\s,]+)',
#         ]
#         for pattern in patterns:
#             invoice_number = search(pattern, text)
#             if invoice_number:
#                 break
    
#     if not invoice_date:
#         invoice_date = search(INVOICE_DATE_RE, text)
    
#     invoice_full_text = None
#     if invoice_number and invoice_date:
#         invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date} г."
#     elif invoice_number:
#         invoice_full_text = f"Счет на оплату № {invoice_number}"
    
#     # Контрагент
#     contractor = extract_contractor(text)
    
#     # ИНН
#     inn = search(INN, text)
    
#     # Расчетный счет
#     account_raw = search(ACCOUNT, text)
#     account = account_raw.replace(" ", "") if account_raw else None
    
#     # Итоговая сумма
#     total = search(TOTAL, text)
#     if not total:
#         total_match = re.search(r'Итого\s*:?\s*([\d\s,\.]+)', text, re.IGNORECASE)
#         if total_match:
#             total = total_match.group(1).strip()
    
#     # НДС
#     vat_raw = search(VAT, text)
#     vat = vat_raw.replace(" ", "") if vat_raw else None
    
#     return {
#         "invoice_number": invoice_number,
#         "invoice_date": invoice_date,
#         "invoice_full_text": invoice_full_text,
#         "contractor": contractor,
#         "inn": inn,
#         "account": account,
#         "total": total,
#         "vat": vat,
#     }


# def calculate_confidence(data: Dict[str, Any], lines: List[Dict[str, Any]]) -> float:
#     """Расчет confidence score"""
#     if not data and not lines:
#         return 0.0
    
#     score = 0.0
    
#     # Оценка метаданных
#     metadata_score = 0.0
#     if data.get("invoice_number"):
#         metadata_score += 0.2
#     if data.get("invoice_date"):
#         metadata_score += 0.1
#     if data.get("contractor"):
#         metadata_score += 0.2
#     if data.get("inn"):
#         metadata_score += 0.05
#     if data.get("total"):
#         metadata_score += 0.05
    
#     metadata_score = min(metadata_score, 0.6)
    
#     # Оценка строк товаров
#     lines_score = 0.0
#     if lines:
#         line_count = len(lines)
#         if line_count >= 5:
#             lines_score = 0.3
#         elif line_count >= 3:
#             lines_score = 0.2
#         elif line_count >= 1:
#             lines_score = 0.1
        
#         # Дополнительная оценка за согласованность
#         consistent_count = 0
#         for line in lines:
#             try:
#                 price = float(line["price"])
#                 qty = line["qty"]
#                 total = float(line["total"])
#                 expected = round(price * qty, 2)
#                 if abs(expected - total) <= 0.01:
#                     consistent_count += 1
#             except:
#                 pass
        
#         if consistent_count > 0:
#             consistency_ratio = consistent_count / len(lines)
#             lines_score += consistency_ratio * 0.1
    
#     lines_score = min(lines_score, 0.4)
    
#     score = metadata_score + lines_score
#     return round(score, 3)


# def parse_invoice_from_pdf(pdf_path: str) -> Dict[str, Any]:
#     """
#     Основная функция парсинга счета из PDF.
#     """
#     print(f"\n{'='*60}")
#     print(f"PROCESSING PDF: {pdf_path}")
#     print(f"{'='*60}")
    
#     # Получаем текст из PDF через OCR
#     pages = ocr_pdf(pdf_path)
    
#     if not pages:
#         print("ERROR: No text extracted from PDF")
#         return {
#             "data": {},
#             "lines": [],
#             "confidence": 0.0,
#             "error": "No text extracted from PDF"
#         }
    
#     # Объединяем все страницы
#     full_text = "\n\n".join(pages)
#     print(f"Total pages: {len(pages)}, Total chars: {len(full_text)}")
    
#     # Парсим строки товаров
#     print("\n--- PARSING GOODS LINES ---")
#     lines = parse_invoice_lines(full_text)
    
#     # Извлекаем метаданные
#     print("\n--- EXTRACTING METADATA ---")
#     data = extract_metadata(full_text)
    
#     # Рассчитываем confidence
#     confidence = calculate_confidence(data, lines)
    
#     # Выводим результаты
#     print(f"\n{'='*60}")
#     print("FINAL OCR RESULTS:")
#     print(f"{'='*60}")
#     print(f"Lines found: {len(lines)}")
#     print(f"Confidence: {confidence:.3f}")
    
#     if data.get("invoice_number"):
#         print(f"Invoice: №{data['invoice_number']}")
#     if data.get("invoice_date"):
#         print(f"Date: {data['invoice_date']}")
#     if data.get("contractor"):
#         print(f"Contractor: {data['contractor']}")
#     if data.get("total"):
#         print(f"Total: {data['total']}")
    
#     if lines:
#         print(f"\nGOODS LINES ({len(lines)} items):")
#         print("-" * 60)
#         for line in lines:
#             desc = line['description'][:35] + '...' if len(line['description']) > 35 else line['description']
#             print(f"{line['line_no']:2d}. {desc:38} "
#                   f"x{line['qty']:3.0f} @ {line['price']:>10} = {line['total']:>12}")
#     else:
#         print("\nNO GOODS LINES FOUND!")
    
#     return {
#         "data": data,
#         "lines": lines,
#         "confidence": confidence,
#         "source_page": 1,
#     }
#----------------------------------выше рабочий файл на 2 счетах
# import re
# from typing import Optional, Tuple, List, Dict, Any
# from backend.services.ocr_service_fast import ocr_pdf_fast as ocr_pdf
# from backend.parsers.regex_patterns import *
# from ..utils.numbers import parse_number


# # -------------------------------------------------
# # ДОПОЛНИТЕЛЬНЫЕ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
# # -------------------------------------------------

# INVOICE_NUMBER_RE = r"сч[её]т\s*№?\s*(\d+)"
# INVOICE_DATE_RE = r"от\s*(\d{1,2}\s+[а-яё]+\s+\d{4})"


# # -------------------------------------------------
# # HELPERS (без изменений)
# # -------------------------------------------------

# def search(pattern: str, text: str, flags: int = re.IGNORECASE | re.DOTALL):
#     """Безопасный regex-поиск"""
#     m = re.search(pattern, text, flags)
#     if not m:
#         return None
#     if m.lastindex == 1:
#         return m.group(1).strip()
#     if m.lastindex and m.lastindex > 1:
#         return tuple(g.strip() for g in m.groups())
#     return m.group(0).strip()


# def normalize_text(text: str) -> str:
#     """Нормализация текста для парсинга"""
#     text = text.replace("\u00A0", " ")  # Неразрывный пробел
#     text = text.replace("\r\n", "\n")
#     text = text.replace("\r", "\n")
#     # Заменяем множественные пробелы на один
#     text = re.sub(r"\s+", " ", text)
#     return text.strip()


# def clean_price_string(price_str: str) -> str:
#     """Очистка строки с ценой/суммой"""
#     if not price_str:
#         return ""
#     # Удаляем все пробелы и заменяем запятую на точку
#     cleaned = price_str.replace(" ", "").replace(",", ".")
#     # Удаляем все нецифровые символы, кроме точек
#     cleaned = re.sub(r"[^\d\.]", "", cleaned)
#     return cleaned


# def extract_contractor(text: str) -> Optional[str]:
#     """Извлекаем контрагента"""
#     # ИП
#     ip_match = re.search(
#         r"Индивидуальный\s+предприниматель\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})",
#         text,
#         re.IGNORECASE,
#     )
#     if ip_match:
#         return f"ИП {ip_match.group(1)}"
    
#     # ООО
#     ooo_match = re.search(
#         r'(?:ООО|Общество с ограниченной ответственностью)\s+[«"]([^»"]+)[»"]',
#         text,
#         re.IGNORECASE,
#     )
#     if ooo_match:
#         return f'ООО "{ooo_match.group(1).strip()}"'
    
#     return None


# def fix_ocr_errors(text: str) -> str:
#     """Исправляет типичные ошибки OCR"""
#     replacements = [
#         (r'Кiа', 'Kia'),
#         (r'Кіа', 'Kia'),
#         (r'Вопда', 'Bonga'),
#         (r'Вопgа', 'Bonga'),
#         (r'ШT', 'шт'),
#         (r'WT', 'шт'),
#         (r'uт', 'шт'),
#         (r'шt', 'шт'),
#         (r'Кол-во', 'Количество'),
#         (r'\sшт\s+', ' '),
#         (r'\sш\.\s+', ' '),
#         (r'\.\.\.', ''),
#         (r'\s+', ' '),
#         # Дополнительные исправления для вашего счета
#         (r'РРолик', 'Ролик'),
#         (r'приводноо', 'приводного'),
#         (r'идрокомпенсатор', 'Гидрокомпенсатор'),
#         (r'Комплеккт', 'Комплект'),
#         (r'ильза-', 'Гильза'),
#         (r'маслосьемнх', 'маслосьемных'),
#         (r'колпачков', 'колпачков'),
#         (r'Подшипник', 'Подшипник'),
#         (r'выжимнойой', 'выжимной'),
#         (r'Полукольцаа', 'Полукольца'),
#         (r'коленчатогоо', 'коленчатого'),
#         (r'Топливна', 'Топливная'),
#         (r'форсунк', 'форсунка'),
#         # Исправляем разделители
#         (r';', ','),
#         # Исправляем числа
#         (r'(\d)\s+(\d{3}\.\d{2})', r'\1 \2'),  # Добавляем пробел если нужно
#     ]
    
#     for pattern, replacement in replacements:
#         text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
#     return text


# def preprocess_invoice_text(text: str) -> str:
#     """Предварительная обработка текста счета"""
#     # 1. Исправляем числа типа "1230 , 00" -> "1230.00"
#     text = re.sub(r'(\d+)\s*,\s*(\d{2})', r'\1.\2', text)
    
#     # 2. Исправляем числа со скобками "3700 ), 00" -> "3700.00"
#     text = re.sub(r'(\d+)\s*\)\s*,\s*(\d{2})', r'\1.\2', text)
    
#     # 3. Исправляем двойные запятые
#     text = re.sub(r',\s*,', ',', text)
    
#     # 4. Добавляем пробелы между числами и буквами
#     text = re.sub(r'(\d)([А-Яа-яЁё])', r'\1 \2', text)
#     text = re.sub(r'([А-Яа-яЁё])(\d)', r'\1 \2', text)
    
#     # 5. Исправляем OCR ошибки
#     text = re.sub(r'выжимнойой', 'выжимной', text)
#     text = re.sub(r'коленчатогоо', 'коленчатого', text)
#     text = re.sub(r'Полукольцаа', 'Полукольца', text)
    
#     return text


# # -------------------------------------------------
# # ОСНОВНАЯ ФУНКЦИЯ ПАРСИНГА
# # -------------------------------------------------

# def parse_invoice_lines(text: str) -> List[Dict[str, Any]]:
#     """
#     Основная функция парсинга для вашего формата счета
#     """
#     print("\n=== START PARSING FOR SPECIFIC FORMAT ===")
#     print(f"Original text length: {len(text)} chars")
    
#     # Предварительная обработка
#     text = preprocess_invoice_text(text)
#     text = fix_ocr_errors(text)
#     text = normalize_text(text)
    
#     print("\n=== PROCESSED TEXT (first 1000 chars) ===")
#     print(text[:1000])
    
#     # Определяем, есть ли таблица
#     has_table = detect_table_structure(text)
    
#     if has_table:
#         print("\nDetected table structure, using enhanced table parser")
#         lines = parse_enhanced_table(text)
#     else:
#         print("\nNo table structure, using line-by-line parser")
#         lines = parse_lines_directly(text)
    
#     # Валидируем и исправляем строки
#     lines = validate_and_fix_lines(lines, text)
    
#     # Сортируем по номеру строки
#     lines.sort(key=lambda x: x["line_no"])
    
#     print(f"\n=== FINAL RESULTS ===")
#     print(f"Total lines found: {len(lines)}")
#     for line in lines:
#         desc = line['description'][:25] + '...' if len(line['description']) > 25 else line['description']
#         print(f"  {line['line_no']:2d}: {desc:28} x{line['qty']:4.0f} @ {line['price']:>10} = {line['total']:>12}")
    
#     # Проверяем пропущенные строки
#     found_nos = [line['line_no'] for line in lines]
#     missing_nos = [no for no in range(1, 14) if no not in found_nos]
    
#     if missing_nos:
#         print(f"\nMissing lines: {missing_nos}")
#         # Пытаемся найти пропущенные строки
#         for missing_no in missing_nos:
#             missing_line = find_specific_line(missing_no, text)
#             if missing_line:
#                 lines.append(missing_line)
#                 print(f"  Added missing line {missing_no}")
    
#     # Снова сортируем
#     lines.sort(key=lambda x: x["line_no"])
    
#     return lines


# def detect_table_structure(text: str) -> bool:
#     """Определяет, есть ли в тексте табличная структура"""
#     indicators = [
#         r'№\s+Товары\s*\(работы',
#         r'Кол-во\s+Цена\s+Сумма',
#         r'\d+\s+[А-Яа-я].+?\s+\d+\s+шт\s+\d+[.,]\d+\s+\d+[.,]\d+',
#     ]
    
#     count = 0
#     for indicator in indicators:
#         if re.search(indicator, text, re.IGNORECASE):
#             count += 1
    
#     return count >= 2


# def parse_enhanced_table(text: str) -> List[Dict[str, Any]]:
#     """Улучшенный парсинг таблицы"""
#     print("\n=== ENHANCED TABLE PARSING ===")
    
#     # Находим начало таблицы
#     table_start = find_correct_table_start(text)
#     if table_start == -1:
#         print("ERROR: Could not find table start!")
#         return []
    
#     print(f"Table starts at position: {table_start}")
    
#     # Извлекаем таблицу (до "Итого")
#     table_text = text[table_start:]
#     end_match = re.search(r'\sИтого\s*:', table_text, re.IGNORECASE)
#     if end_match:
#         table_text = table_text[:end_match.start()].strip()
    
#     print(f"\n=== EXTRACTED TABLE (first 500 chars) ===")
#     print(table_text[:500])
    
#     # Парсим все строки 1-13
#     lines = []
#     found_lines = set()
    
#     for line_no in range(1, 14):
#         # Пытаемся найти строку в таблице
#         line_data = find_and_parse_table_line(line_no, table_text)
        
#         if line_data and line_data["line_no"] not in found_lines:
#             lines.append(line_data)
#             found_lines.add(line_data["line_no"])
#             print(f"  Found line {line_no}: {line_data['description'][:30]}...")
    
#     return lines


# def find_correct_table_start(text: str) -> int:
#     """Находит начало ПРАВИЛЬНОЙ таблицы (не дубликатов)"""
#     print("\n=== FINDING CORRECT TABLE START ===")
    
#     # Ищем заголовок таблицы из вашего формата
#     patterns = [
#         r'№\s+Товары\s*\(работы\s*,\s*услуги\)\s+Кол-во\s+Цена\s+Сумма',
#         r'Кол-во\s+Цена\s+Сумма\s*\n\s*1\s+[А-Яа-я]',
#         r'\b1\s+Топливная\s+форсунка',
#     ]
    
#     for pattern in patterns:
#         match = re.search(pattern, text, re.IGNORECASE)
#         if match:
#             print(f"Found correct table with pattern at position {match.start()}")
#             return match.start()
    
#     # Если не нашли заголовок, ищем первую строку товара
#     print("Looking for first product line...")
#     line1_patterns = [
#         r'\b1\s+Топливная\s+форсунка\s+Kia\s+Bonga',
#         r'1\s+Топливная.*?Bonga.*?\d+\s+шт',
#         r'\b1[.\s]+[Тт]опливная',
#     ]
    
#     for pattern in line1_patterns:
#         match = re.search(pattern, text, re.IGNORECASE)
#         if match:
#             print(f"Found line 1 at position {match.start()}")
#             return match.start()
    
#     return -1


# def find_and_parse_table_line(line_no: int, table_text: str) -> Optional[Dict[str, Any]]:
#     """Находит и парсит конкретную строку таблицы"""
    
#     # Специфичные паттерны для каждой строки (основанные на вашем счете)
#     line_patterns = {
#         1: [r'1\s+Топливная\s+форсунка\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         2: [r'2\s+Свеча\s+накаливания\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         3: [r'3\s+Ролик\s+приводного\s+ремня\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         4: [r'4\s+Приводной\s+ремень\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         5: [r'5\s+Гидрокомпенсатор\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         6: [r'6\s+Комплект\s+вкладышей\s+коренных\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         7: [r'7\s+Комплект\s+вкладышей\s+шатунных\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         8: [r'8\s+Гильза\s+поршень\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         9: [r'9\s+Комплект\s+сальников\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         10: [r'10\s+Комплект\s+маслосьемных\s+колпачков\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         11: [r'11\s+Подшипник\s+маховика\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         12: [r'12\s+Подшипник\s+выжимной\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#         13: [r'13\s+Полукольца\s+коленчатого\s+вала\s+Kia\s+Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{2})\s+(\d+[.,]\d{2})'],
#     }
    
#     # Общие паттерны для всех строк
#     general_patterns = [
#         rf'{line_no}\s+([^0-9\n]+?)\s+(\d+)\s+шт\s+(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})',
#         rf'{line_no}\s+([А-Яа-яЁё].*?)\s+(\d+)\s+(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})',
#         rf'{line_no}[.\s]+([А-Яа-яЁё].*?)\s+(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})',
#     ]
    
#     # Сначала пробуем специфичные паттерны
#     if line_no in line_patterns:
#         for pattern in line_patterns[line_no]:
#             match = re.search(pattern, table_text, re.IGNORECASE)
#             if match:
#                 return parse_table_line_match(line_no, match, pattern)
    
#     # Затем общие паттерны
#     for pattern in general_patterns:
#         match = re.search(pattern, table_text, re.IGNORECASE)
#         if match:
#             return parse_table_line_match(line_no, match, pattern)
    
#     return None


# def parse_table_line_match(line_no: int, match: re.Match, pattern: str) -> Optional[Dict[str, Any]]:
#     """Парсит найденную строку таблицы"""
#     try:
#         groups = match.groups()
        
#         # Определяем структуру на основе количества групп
#         if len(groups) == 3:
#             # Формат: [количество, цена, сумма]
#             qty_str, price_str, total_str = groups
#             # Получаем описание из полного совпадения
#             full_match = match.group(0)
#             # Удаляем числа чтобы получить описание
#             description = re.sub(r'\d+[.,]\d{2}', '', full_match)
#             description = re.sub(rf'^{line_no}[.\s]+', '', description)
#             description = re.sub(r'\s+\d+\s*шт\s*', ' ', description)
#         elif len(groups) == 4:
#             # Формат: [описание, количество, цена, сумма]
#             description, qty_str, price_str, total_str = groups
#         else:
#             return None
        
#         # Преобразуем строки в числа
#         qty = float(qty_str.replace(',', '.'))
#         price = float(price_str.replace(',', '.'))
#         total = float(total_str.replace(',', '.'))
        
#         # Очищаем описание
#         description = clean_description_specific(description, line_no)
        
#         # Проверяем согласованность
#         expected = round(price * qty, 2)
#         if abs(expected - total) > 0.01:
#             print(f"  Line {line_no}: correcting total {total} -> {expected}")
#             total = expected
        
#         return {
#             "line_no": line_no,
#             "description": description,
#             "qty": qty,
#             "price": str(price),
#             "total": str(total),
#             "used": False,
#             "raw": match.group(0),
#         }
        
#     except Exception as e:
#         print(f"  Error parsing line {line_no}: {e}")
#         return None


# def parse_lines_directly(text: str) -> List[Dict[str, Any]]:
#     """Парсинг строк напрямую (если таблица не найдена)"""
#     print("\n=== DIRECT LINE PARSING ===")
    
#     lines = []
    
#     # Ищем все строки с номерами 1-13
#     for line_no in range(1, 14):
#         # Паттерн для поиска строки
#         pattern = rf'{line_no}[.\s]+([А-Яа-яЁё].*?)(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})'
#         match = re.search(pattern, text, re.IGNORECASE)
        
#         if match:
#             try:
#                 description = match.group(1).strip()
#                 price_str = match.group(2)
#                 total_str = match.group(3)
                
#                 # Пытаемся найти количество
#                 qty = 1.0
#                 qty_match = re.search(rf'{line_no}[.\s]+.*?(\d+)\s+шт', text, re.IGNORECASE)
#                 if qty_match:
#                     qty = float(qty_match.group(1))
                
#                 price = float(price_str.replace(',', '.'))
#                 total = float(total_str.replace(',', '.'))
                
#                 description = clean_description_specific(description, line_no)
                
#                 lines.append({
#                     "line_no": line_no,
#                     "description": description,
#                     "qty": qty,
#                     "price": str(price),
#                     "total": str(total),
#                     "used": False,
#                     "raw": match.group(0),
#                 })
                
#                 print(f"  Found line {line_no}: {description[:30]}...")
                
#             except Exception as e:
#                 print(f"  Error parsing line {line_no}: {e}")
    
#     return lines


# def clean_description_specific(description: str, line_no: int) -> str:
#     """Очищает описание с учетом номера строки"""
    
#     # Фиксированные описания для каждой строки (основанные на вашем счете)
#     fixed_descriptions = {
#         1: "Топливная форсунка Kia Bonga",
#         2: "Свеча накаливания Kia Bonga",
#         3: "Ролик приводного ремня Kia Bonga",
#         4: "Приводной ремень Kia Bonga",
#         5: "Гидрокомпенсатор Kia Bonga",
#         6: "Комплект вкладышей коренных Kia Bonga",
#         7: "Комплект вкладышей шатунных Kia Bonga",
#         8: "Гильза поршень Kia Bonga",
#         9: "Комплект сальников Kia Bonga",
#         10: "Комплект маслосьемных колпачков Kia Bonga",
#         11: "Подшипник маховика Kia Bonga",
#         12: "Подшипник выжимной Kia Bonga",
#         13: "Полукольца коленчатого вала Kia Bonga",
#     }
    
#     # Если у нас есть фиксированное описание, используем его
#     if line_no in fixed_descriptions:
#         return fixed_descriptions[line_no]
    
#     # Иначе очищаем то, что нашли
#     description = re.sub(r'Bonga\s+\d+', 'Bonga', description, flags=re.IGNORECASE)
#     description = re.sub(r'\s+\d+\s*шт\s*$', '', description, flags=re.IGNORECASE)
#     description = re.sub(r'\s+', ' ', description).strip()
#     description = description.strip(' .,')
    
#     return description


# def validate_and_fix_lines(lines: List[Dict[str, Any]], full_text: str) -> List[Dict[str, Any]]:
#     """Валидирует и исправляет найденные строки"""
#     valid_lines = []
#     seen_nos = set()
    
#     for line in lines:
#         line_no = line["line_no"]
        
#         # Проверяем дубликаты
#         if line_no in seen_nos:
#             print(f"  Skipping duplicate line {line_no}")
#             continue
        
#         # Проверяем валидность
#         if is_valid_line(line):
#             valid_lines.append(line)
#             seen_nos.add(line_no)
#         else:
#             print(f"  Invalid line {line_no}, trying to fix...")
#             fixed_line = try_fix_line(line_no, full_text)
#             if fixed_line and is_valid_line(fixed_line):
#                 valid_lines.append(fixed_line)
#                 seen_nos.add(line_no)
    
#     return valid_lines


# def is_valid_line(line: Dict[str, Any]) -> bool:
#     """Проверяет валидность строки"""
#     try:
#         line_no = line["line_no"]
#         if not (1 <= line_no <= 13):
#             return False
        
#         description = line["description"]
#         if len(description) < 5:
#             return False
        
#         qty = float(line["qty"])
#         price = float(line["price"])
#         total = float(line["total"])
        
#         if not (0.1 <= qty <= 100):
#             return False
#         if not (1 <= price <= 200000):
#             return False
#         if not (1 <= total <= 1000000):
#             return False
        
#         # Проверяем согласованность
#         expected = round(price * qty, 2)
#         return abs(expected - total) <= 0.01
        
#     except (KeyError, ValueError, TypeError):
#         return False


# def try_fix_line(line_no: int, text: str) -> Optional[Dict[str, Any]]:
#     """Пытается исправить строку"""
#     # Ищем строку в тексте
#     pattern = rf'{line_no}[.\s]+([А-Яа-яЁё].*?)(?=\b{line_no+1}[.\s]+|\s*Итого|\s*Всего|$)'
#     match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    
#     if match:
#         line_text = match.group(0).strip()
        
#         # Пытаемся извлечь числа
#         numbers = []
#         for num_match in re.finditer(r'(\d+[.,]\d{2})', line_text):
#             try:
#                 num = float(num_match.group(1).replace(',', '.'))
#                 numbers.append(num)
#             except:
#                 pass
        
#         if len(numbers) >= 2:
#             # Берем последние два числа как цена и сумма
#             price = numbers[-2] if len(numbers) >= 2 else 0
#             total = numbers[-1] if len(numbers) >= 1 else 0
            
#             # Пытаемся найти количество
#             qty = 1.0
#             qty_match = re.search(r'(\d+)\s+шт', line_text, re.IGNORECASE)
#             if qty_match:
#                 qty = float(qty_match.group(1))
            
#             # Получаем описание
#             description = clean_description_specific(line_text, line_no)
            
#             # Проверяем согласованность
#             expected = round(price * qty, 2)
#             if abs(expected - total) > 0.01:
#                 total = expected
            
#             return {
#                 "line_no": line_no,
#                 "description": description,
#                 "qty": qty,
#                 "price": str(price),
#                 "total": str(total),
#                 "used": False,
#                 "raw": line_text,
#             }
    
#     return None


# def find_specific_line(line_no: int, text: str) -> Optional[Dict[str, Any]]:
#     """Ищет конкретную строку по номеру"""
#     print(f"  Searching for specific line {line_no}...")
    
#     # Пробуем разные паттерны
#     patterns = [
#         rf'{line_no}\s+[А-Яа-яЁё].*?Bonga.*?(\d+)\s+шт.*?(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})',
#         rf'{line_no}[.\s]+[А-Яа-яЁё].*?(\d+[.,]\d{{2}})\s+(\d+[.,]\d{{2}})',
#         rf'\b{line_no}\s+[^0-9\n]+?\d+[.,]\d{{2}}\s+\d+[.,]\d{{2}}',
#     ]
    
#     for pattern in patterns:
#         match = re.search(pattern, text, re.IGNORECASE)
#         if match:
#             try:
#                 groups = match.groups()
                
#                 if len(groups) == 3:
#                     qty_str, price_str, total_str = groups
#                     qty = float(qty_str.replace(',', '.'))
#                 elif len(groups) == 2:
#                     price_str, total_str = groups
#                     qty = 1.0
#                     # Пробуем найти количество отдельно
#                     qty_match = re.search(rf'{line_no}[.\s]+.*?(\d+)\s+шт', text, re.IGNORECASE)
#                     if qty_match:
#                         qty = float(qty_match.group(1))
#                 else:
#                     continue
                
#                 price = float(price_str.replace(',', '.'))
#                 total = float(total_str.replace(',', '.'))
                
#                 description = clean_description_specific(match.group(0), line_no)
                
#                 # Проверяем согласованность
#                 expected = round(price * qty, 2)
#                 if abs(expected - total) > 0.01:
#                     total = expected
                
#                 return {
#                     "line_no": line_no,
#                     "description": description,
#                     "qty": qty,
#                     "price": str(price),
#                     "total": str(total),
#                     "used": False,
#                     "raw": match.group(0),
#                 }
                
#             except Exception as e:
#                 print(f"    Error parsing found line {line_no}: {e}")
    
#     return None


# # -------------------------------------------------
# # МЕТАДАННЫЕ И ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
# # -------------------------------------------------

# def extract_metadata(text: str) -> Dict[str, Any]:
#     """Извлечение метаданных из текста"""
#     if not text:
#         return {}
    
#     text = fix_ocr_errors(text)
    
#     # Номер и дата счета
#     invoice_match = search(INVOICE_NUMBER_DATE, text)
#     invoice_number, invoice_date = (
#         invoice_match if isinstance(invoice_match, tuple) else (None, None)
#     )
    
#     if not invoice_number:
#         patterns = [
#             r'Счет\s*(?:на\s*оплату)?\s*[№#]\s*([A-Za-zА-Яа-я0-9\-\/]+)',
#             r'[№#]\s*([^\s]+)\s+от',
#             r'Счет\s*№\s*([^\s,]+)',
#         ]
#         for pattern in patterns:
#             invoice_number = search(pattern, text)
#             if invoice_number:
#                 break
    
#     if not invoice_date:
#         invoice_date = search(INVOICE_DATE_RE, text)
    
#     invoice_full_text = None
#     if invoice_number and invoice_date:
#         invoice_full_text = f"Счет на оплату № {invoice_number} от {invoice_date} г."
#     elif invoice_number:
#         invoice_full_text = f"Счет на оплату № {invoice_number}"
    
#     # Контрагент
#     contractor = extract_contractor(text)
    
#     # ИНН
#     inn = search(INN, text)
    
#     # Расчетный счет
#     account_raw = search(ACCOUNT, text)
#     account = account_raw.replace(" ", "") if account_raw else None
    
#     # Итоговая сумма
#     total = search(TOTAL, text)
#     if not total:
#         total_match = re.search(r'Итого\s*:?\s*([\d\s,\.]+)', text, re.IGNORECASE)
#         if total_match:
#             total = total_match.group(1).strip()
    
#     # НДС
#     vat_raw = search(VAT, text)
#     vat = vat_raw.replace(" ", "") if vat_raw else None
    
#     return {
#         "invoice_number": invoice_number,
#         "invoice_date": invoice_date,
#         "invoice_full_text": invoice_full_text,
#         "contractor": contractor,
#         "inn": inn,
#         "account": account,
#         "total": total,
#         "vat": vat,
#     }


# def calculate_confidence(data: Dict[str, Any], lines: List[Dict[str, Any]]) -> float:
#     """Расчет confidence score"""
#     if not data and not lines:
#         return 0.0
    
#     score = 0.0
    
#     # Оценка метаданных
#     metadata_score = 0.0
#     if data.get("invoice_number"):
#         metadata_score += 0.2
#     if data.get("invoice_date"):
#         metadata_score += 0.1
#     if data.get("contractor"):
#         metadata_score += 0.2
#     if data.get("inn"):
#         metadata_score += 0.05
#     if data.get("total"):
#         metadata_score += 0.05
    
#     metadata_score = min(metadata_score, 0.6)
    
#     # Оценка строк товаров
#     lines_score = 0.0
#     if lines:
#         line_count = len(lines)
#         if line_count >= 10:
#             lines_score = 0.3
#         elif line_count >= 7:
#             lines_score = 0.25
#         elif line_count >= 5:
#             lines_score = 0.2
#         elif line_count >= 3:
#             lines_score = 0.15
#         elif line_count >= 1:
#             lines_score = 0.1
        
#         # Дополнительная оценка за согласованность
#         consistent_count = 0
#         for line in lines:
#             try:
#                 price = float(line["price"])
#                 qty = float(line["qty"])
#                 total = float(line["total"])
#                 expected = round(price * qty, 2)
#                 if abs(expected - total) <= 0.01:
#                     consistent_count += 1
#             except:
#                 pass
        
#         if consistent_count > 0:
#             consistency_ratio = consistent_count / len(lines)
#             lines_score += consistency_ratio * 0.1
    
#     lines_score = min(lines_score, 0.4)
    
#     score = metadata_score + lines_score
#     return round(score, 3)


# def parse_invoice_from_pdf(pdf_path: str) -> Dict[str, Any]:
#     """
#     Основная функция парсинга счета из PDF.
#     """
#     print(f"\n{'='*60}")
#     print(f"PROCESSING PDF: {pdf_path}")
#     print(f"{'='*60}")
    
#     # Получаем текст из PDF через OCR
#     pages = ocr_pdf(pdf_path)
    
#     if not pages:
#         print("ERROR: No text extracted from PDF")
#         return {
#             "data": {},
#             "lines": [],
#             "confidence": 0.0,
#             "error": "No text extracted from PDF"
#         }
    
#     # Объединяем все страницы
#     full_text = "\n\n".join(pages)
#     print(f"Total pages: {len(pages)}, Total chars: {len(full_text)}")
    
#     # Парсим строки товаров
#     print("\n--- PARSING GOODS LINES ---")
#     lines = parse_invoice_lines(full_text)
    
#     # Извлекаем метаданные
#     print("\n--- EXTRACTING METADATA ---")
#     data = extract_metadata(full_text)
    
#     # Рассчитываем confidence
#     confidence = calculate_confidence(data, lines)
    
#     # Выводим результаты
#     print(f"\n{'='*60}")
#     print("FINAL OCR RESULTS:")
#     print(f"{'='*60}")
#     print(f"Lines found: {len(lines)}")
#     print(f"Confidence: {confidence:.3f}")
    
#     if data.get("invoice_number"):
#         print(f"Invoice: №{data['invoice_number']}")
#     if data.get("invoice_date"):
#         print(f"Date: {data['invoice_date']}")
#     if data.get("contractor"):
#         print(f"Contractor: {data['contractor']}")
#     if data.get("total"):
#         print(f"Total: {data['total']}")
    
#     if lines:
#         print(f"\nGOODS LINES ({len(lines)} items):")
#         print("-" * 60)
#         for line in lines:
#             desc = line['description'][:35] + '...' if len(line['description']) > 35 else line['description']
#             print(f"{line['line_no']:2d}. {desc:38} "
#                   f"x{line['qty']:3.0f} @ {line['price']:>10} = {line['total']:>12}")
#     else:
#         print("\nNO GOODS LINES FOUND!")
    
#     return {
#         "data": data,
#         "lines": lines,
#         "confidence": confidence,
#         "source_page": 1,
#     }

    #------------------------------------------новый универсальный тест
    #-----------------------------------------------------------------
"""
Главный парсер счетов - обновленная версия
"""

import os
from typing import Dict, Any, List
from backend.services.ocr_service_fast import ocr_pdf_fast as ocr_pdf

from .universal_parser import extract_metadata_universal
from .parser_manager import ParserManager


def parse_invoice_from_pdf(pdf_path: str, excel_record: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Парсит PDF-счет, может использовать данные из Excel для улучшения парсинга.
    
    Args:
        pdf_path: путь к PDF-счету
        excel_record: данные из Excel (опционально, для улучшения парсинга)
        
    Returns:
        Dict с данными счета
    """
    print(f"\n{'='*60}")
    print(f"PROCESSING PDF: {os.path.basename(pdf_path)}")
    print(f"{'='*60}")
    
    # 1. Получаем текст из PDF
    pages = ocr_pdf(pdf_path)
    if not pages:
        return create_error_response("Не удалось извлечь текст из PDF")
    
    full_text = "\n\n".join(pages)
    
    # 2. ВСЕГДА парсим метаданные
    print("\n--- EXTRACTING METADATA (ALWAYS WORKS) ---")
    metadata = extract_metadata_universal(full_text)
    
    # 3. Если есть данные из Excel, добавляем их для контекста
    if excel_record:
        metadata['excel_context'] = {
            'item_name': excel_record.get('item_name'),
            'article': excel_record.get('article'),
            'quantity': excel_record.get('quantity'),
        }
    
    # 4. Парсим таблицу товаров
    print("\n--- PARSING PRODUCT LINES ---")
    parser_manager = ParserManager()
    
    # Если есть данные из Excel, можем улучшить парсинг
    if excel_record and excel_record.get('item_name'):
        # Добавляем поисковый контекст
        enhanced_text = _enhance_with_excel_context(full_text, excel_record)  # Убрал self.
        product_lines = parser_manager.parse_table_lines(enhanced_text)
    else:
        product_lines = parser_manager.parse_table_lines(full_text)
    
    # 5. Рассчитываем confidence
    confidence = calculate_confidence(metadata, product_lines, excel_record)
    
    # 6. Формируем результат
    result = {
        "data": metadata,
        "lines": product_lines,
        "confidence": confidence,
        "source_file": os.path.basename(pdf_path),
        "excel_match": bool(excel_record),
    }
    
    # Логируем результат
    print(f"\n{'='*60}")
    print("INVOICE PARSING RESULT:")
    print(f"{'='*60}")
    print(f"✓ Метаданные: {'Найдены' if metadata.get('metadata_found') else 'Не найдены'}")
    print(f"✓ Товаров в счете: {len(product_lines)}")
    print(f"✓ Достоверность: {confidence:.1%}")
    
    if excel_record:
        print(f"✓ Связь с Excel: Заявка №{excel_record.get('request_number')}")
    
    return result


def _enhance_with_excel_context(text: str, excel_record: Dict[str, Any]) -> str:
    """
    Улучшает текст для парсинга с использованием данных из Excel.
    Например, добавляет ключевые слова для поиска товара.
    """
    enhanced = text
    
    # Добавляем название товара из Excel как подсказку
    item_name = excel_record.get('item_name')
    if item_name:
        # Добавляем в начало текста для улучшения поиска
        enhanced = f"ИСКОМЫЙ ТОВАР: {item_name}\n" + enhanced
    
    # Также можно добавить другие поля для поиска
    article = excel_record.get('article')
    if article:
        enhanced = f"ИСКОМЫЙ АРТИКУЛ: {article}\n" + enhanced
    
    return enhanced


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
        # Проверяем, есть ли в счете товар похожий на указанный в Excel
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