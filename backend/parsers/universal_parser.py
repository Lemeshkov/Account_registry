

#-----------------------------новая компонента 

"""
УНИВЕРСАЛЬНЫЙ ПАРСЕР МЕТАДАННЫХ СЧЕТА
Всегда извлекает контрагента и реквизиты счета
Объединяет лучшее из старого и нового парсеров
"""

import re
from typing import Optional, Dict, Any, Tuple
from datetime import datetime


def extract_metadata_universal(text: str) -> Dict[str, Any]:
    """
    Основная функция извлечения метаданных.
    Всегда возвращает контрагента и реквизиты счета если они есть.
    """
    if not text:
        return {"metadata_found": False}
    
    print("\n=== EXTRACTING METADATA (UNIVERSAL) ===")
    
    # Нормализуем текст с исправлением OCR ошибок
    original_text = text
    text = normalize_text(text)
    
    print(f"[DEBUG] Длина текста: {len(text)} символов")
    
    # Покажем начало текста для диагностики
    print(f"[DEBUG] Первые 300 символов текста:")
    print(text[:300])
    
    # Проверяем есть ли ключевые слова
    keywords = ['Счет', '№', 'No', 'от', 'ИП', 'ООО', 'ИНН', 'Итого']
    for keyword in keywords:
        if keyword in text:
            print(f"[DEBUG] Ключевое слово '{keyword}' найдено")
    
    # Извлекаем все метаданные
    contractor = extract_contractor_fixed(text)  # Используем исправленную версию
    invoice_number, invoice_date = extract_invoice_info_improved(text)
    total = extract_total_amount_improved(text)
    inn = extract_inn_improved(text)
    account = extract_account_improved(text)
    
    # Форматируем данные
    formatted_date = None
    if invoice_date:
        formatted_date = normalize_date(invoice_date)
        print(f"[DEBUG] Форматированная дата: {formatted_date}")
    
    formatted_number = None
    if invoice_number:
        formatted_number = clean_invoice_number(invoice_number)
        print(f"[DEBUG] Форматированный номер: {formatted_number}")
    
    formatted_total = None
    if total:
        formatted_total = clean_total_amount(total)
        print(f"[DEBUG] Форматированная сумма: {formatted_total}")
    
    # СОЗДАЕМ invoice_full_text для фронтенда
    invoice_full_text = ""
    if formatted_number and formatted_date:
        invoice_full_text = f"Счет на оплату № {formatted_number} от {formatted_date}"
    elif formatted_number:
        invoice_full_text = f"Счет на оплату № {formatted_number}"
    elif formatted_date:
        invoice_full_text = f"Счет от {formatted_date}"
    elif contractor:  # Если есть только контрагент
        invoice_full_text = f"Счет {contractor[:50]}"
    
    if invoice_full_text:
        print(f"[DEBUG] Создан invoice_full_text: {invoice_full_text}")
    else:
        print(f"[DEBUG] Не удалось создать invoice_full_text")
        print(f"  formatted_number: {formatted_number}")
        print(f"  formatted_date: {formatted_date}")
        print(f"  contractor: {contractor}")
    
    # Формируем результат
    result = {
        "contractor": contractor,
        "invoice_number": formatted_number,
        "invoice_date": formatted_date,
        "total": formatted_total,
        "inn": inn,
        "account": account,
        "metadata_found": bool(contractor or invoice_number or total),
        "invoice_full_text": invoice_full_text,
        "raw": {
            "original_number": invoice_number,
            "original_date": invoice_date,
            "original_total": total
        }
    }
    
    # Логируем что нашли
    print_metadata_results(result)
    
    return result


def normalize_text(text: str) -> str:
    """Нормализация текста с исправлением OCR ошибок"""
    text = text.replace("\u00A0", " ")  # Неразрывный пробел
    
    print(f"[DEBUG NORMALIZE] Исходный текст (первые 200 символов): {text[:200]}")
    
    # КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Исправляем вашу конкретную проблему
    # ООО "Ф"ирма СибАвтозапчасть → ООО "Фирма СибАвтозапчасть"
    
    # 1. Исправляем разорванные кавычки: "Ф"ирма → "Фирма"
    text = re.sub(
        r'(?<=["«][А-Яа-яЁё])["»](?=[а-яё][а-яё]+)',
        '',
        text
    )
    
    # 2. Исправляем: ООО "Ф → ООО "Фирма (если кавычка стоит перед словом)
    text = re.sub(
        r'(ООО\s+["«])([А-Яа-яЁё])\s*["»]?([а-яё][а-яё]+)',
        r'\1\2\3',
        text,
        flags=re.IGNORECASE
    )
    
    # 3. Общие OCR исправления для номеров счетов
    replacements = [
        (r'№[gG]\s*(\d+)', r'№ \1'),
        (r'[№#]g\s*(\d+)', r'№ \1'),
        (r'No[gG]\s*(\d+)', r'№ \1'),
        (r'Ng\s*(\d+)', r'№ \1'),
        (r'Счет\s+на\s+оплату\s+[№#]?[gG]?\s*(\d+)', r'Счет на оплату № \1'),
        (r'Счет\s+[№#]?[gG]?\s*(\d+)', r'Счет № \1'),
        (r'\bN[oO]\.?\s*(\d+)', r'№ \1'),
        # Исправляем незакрытые кавычки
        (r'(ООО\s+["«][^»"]+?)\'(?=\s)', r'\1"'),
    ]
    
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
    # Дополнительная очистка
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    print(f"[DEBUG NORMALIZE] После исправления (первые 200 символов): {text[:200]}")
    
    return text.strip()


def extract_contractor_fixed(text: str) -> Optional[str]:
    """Извлекает контрагента - ОСНОВНАЯ РАБОЧАЯ ФУНКЦИЯ"""
    
    print(f"\n[DEBUG CONTRACTOR] === ПОИСК КОНТРАГЕНТА ===")
    
    # 1. Специальный поиск для вашего формата:
    # "от 21 января 2026 г ООО "Ф"ирма СибАвтозапчасть"
    # Паттерн для поиска в контексте даты
    pattern = r'от\s+\d+\s+[а-я]+\s+\d+\s*г\.?\s*(ООО\s+["«]?[^»"\n]+)'
    
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        contractor_raw = match.group(1).strip()
        print(f"[DEBUG CONTRACTOR] Нашли по формату даты: '{contractor_raw}'")
        
        # Очищаем и исправляем
        cleaned = clean_contractor_special(contractor_raw)
        if cleaned:
            print(f"[DEBUG CONTRACTOR] Результат: {cleaned}")
            return cleaned
    
    # 2. Ищем ООО с названием в кавычках (исправленный паттерн)
    ooo_patterns = [
        # Паттерн для: ООО "Название" (всё что в кавычках)
        r'(ООО)\s+["«]([^»"]{3,50}?)["»](?![а-яё])',  # Не если сразу после буква
        # Паттерн для: ООО "Ф"ирма СибАвтозапчасть
        r'(ООО)\s+["«]([А-Яа-яЁё])["»]?([а-яё][а-яё]+\s+[А-Яа-яЁё]+)',
        # Без кавычек: ООО Название
        r'(ООО)\s+([А-Я][а-яё]+(?:\s+[А-Я][а-яё]+){1,3})',
    ]
    
    for i, pattern in enumerate(ooo_patterns, 1):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            print(f"[DEBUG CONTRACTOR] Паттерн {i} нашел: '{match.group(0)}'")
            
            if len(match.groups()) >= 3:
                # Для паттерна с разорванным названием
                ooo = match.group(1)
                first_part = match.group(2)
                rest = match.group(3)
                full_name = f"{first_part}{rest}"
                result = f'{ooo} "{full_name}"'
                print(f"[DEBUG CONTRACTOR] Собрали из частей: {result}")
                return result
            elif len(match.groups()) >= 2:
                # Для обычных паттернов
                ooo = match.group(1)
                name = match.group(2).strip()
                if name and len(name) > 1:
                    result = f'{ooo} "{name}"'
                    print(f"[DEBUG CONTRACTOR] Результат: {result}")
                    return result
    
    # 3. Ищем в контексте "Счет на оплату"
    invoice_context = re.search(
        r'Счет\s+на\s+оплату[^"]*?(ООО\s+["«]?[^»"\n]+)',
        text,
        re.IGNORECASE
    )
    
    if invoice_context:
        name_part = invoice_context.group(1).strip()
        print(f"[DEBUG CONTRACTOR] Нашли в контексте счета: '{name_part}'")
        
        # Очищаем имя
        cleaned_name = clean_contractor_name(name_part)
        if cleaned_name:
            result = f'ООО "{cleaned_name}"'
            print(f"[DEBUG CONTRACTOR] Результат: {result}")
            return result
    
    # 4. Ищем "Поставщик:", "Исполнитель:"
    supplier_patterns = [
        r'Поставщик[:\s]+([^,\n\[\(]{5,50}?)(?=\s*(?:ИНН|,|\[|\n|\(|$))',
        r'Исполнитель[:\s]+([^,\n\[\(]{5,50}?)(?=\s*(?:ИНН|,|\[|\n|\(|$))',
        r'Получатель[:\s]+([^,\n\[\(]{5,50}?)(?=\s*(?:ИНН|,|\[|\n|\(|$))',
    ]
    
    for pattern in supplier_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            print(f"[DEBUG CONTRACTOR] Нашли в поле поставщика: '{name}'")
            cleaned_name = clean_contractor_name(name)
            if cleaned_name:
                result = f'ООО "{cleaned_name}"'
                print(f"[DEBUG CONTRACTOR] Результат: {result}")
                return result
    
    # 5. Запасной вариант: поиск по ИНН
    inn_pattern = r'ИНН\s*:?\s*(\d{10,12})'
    inn_match = re.search(inn_pattern, text, re.IGNORECASE)
    if inn_match:
        inn_pos = inn_match.start()
        # Ищем текст перед ИНН (100 символов)
        before_inn = text[max(0, inn_pos-100):inn_pos]
        
        # Ищем ООО перед ИНН
        ooo_before = re.search(r'(ООО\s+["«]?[^»"\n]{3,30})', before_inn, re.IGNORECASE)
        if ooo_before:
            name_part = ooo_before.group(1).strip()
            cleaned_name = clean_contractor_name(name_part)
            if cleaned_name:
                result = f'ООО "{cleaned_name}"'
                print(f"[DEBUG CONTRACTOR] Нашли по ИНН: {result}")
                return result
    
    print(f"[DEBUG CONTRACTOR] Контрагент не найден")
    return None


def clean_contractor_special(raw_name: str) -> str:
    """Специальная очистка для вашего случая"""
    if not raw_name:
        return ""
    
    print(f"[DEBUG CLEAN SPECIAL] Очищаем: '{raw_name}'")
    
    # 1. Убираем лишние пробелы
    name = re.sub(r'\s+', ' ', raw_name).strip()
    
    # 2. Исправляем: ООО "Ф"ирма СибАвтозапчасть → ООО "Фирма СибАвтозапчасть"
    name = re.sub(r'(["«])([А-Яа-яЁё])(["»])([а-яё])', r'\1\2\4', name)
    
    # 3. Удаляем реквизиты после названия
    # Находим позиции разделителей
    separators = ['[', 'ИНН', 'КПП', 'Вид оп', 'Срок', 'Наз пл', 'Очер:', 'Код', 'Рез', 
                  'Получатель', 'Оплата по', 'Назначение', 'Счет на оплату']
    
    for sep in separators:
        pos = name.find(sep)
        if pos > 5:  # Если разделитель найден и не в начале
            name = name[:pos].strip()
            print(f"[DEBUG CLEAN SPECIAL] Обрезали по '{sep}': '{name}'")
            break
    
    # 4. Удаляем лишние символы
    name = re.sub(r'^[\s,\[\(\.;:]+', '', name)
    name = re.sub(r'[\s,\]\)\.;:]+$', '', name)
    
    # 5. Проверяем наличие кавычек и ООО
    if '"' not in name and '«' not in name:
        # Добавляем кавычки если их нет
        name = f'"{name}"'
    
    if not name.upper().startswith('ООО'):
        name = f'ООО {name}'
    
    result = name.strip()
    print(f"[DEBUG CLEAN SPECIAL] Результат: '{result}'")
    return result


def clean_contractor_name(name_part: str) -> str:
    """Очищает часть имени контрагента"""
    if not name_part:
        return ""
    
    print(f"[DEBUG CLEAN NAME] Очищаем: '{name_part}'")
    
    # Удаляем всё после разделителей
    for sep in ['[', 'ИНН', 'КПП', 'Вид', 'Срок', 'Наз', 'Очер', 'Код', 'Рез', 
                'Получатель', 'Оплата', 'Назначение', 'Счет на оплату']:
        parts = name_part.split(sep, 1)
        if len(parts) > 1 and len(parts[0]) > 2:
            name_part = parts[0].strip()
            print(f"[DEBUG CLEAN NAME] Обрезали по '{sep}': '{name_part}'")
            break
    
    # Убираем лишние символы но сохраняем буквы и пробелы
    name_part = re.sub(r'[^\w\s\-«»"]', '', name_part)
    name_part = re.sub(r'\s+', ' ', name_part).strip()
    
    # Удаляем ООО если оно уже есть
    name_part = re.sub(r'^ООО\s+', '', name_part, flags=re.IGNORECASE)
    
    print(f"[DEBUG CLEAN NAME] Результат: '{name_part}'")
    return name_part


def extract_invoice_info_improved(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Извлекает номер и дату счета"""
    
    print(f"\n[DEBUG] Поиск номера счета в тексте...")
    
    # Пробуем разные паттерны для номера счета
    invoice_number = None
    patterns_number = [
        # Основной паттерн: "Счет на оплату № 141"
        r'Счет\s+на\s+оплату\s+[№#]\s*(\d{1,6})',
        # "Счет № 141" 
        r'Счет\s+[№#]\s*(\d{1,6})',
        # "№ 141" отдельно (но не банковский счет)
        r'(?<!Сч\.\s)(?<!р/с\s)(?<!счет\s)[№#]\s*(\d{1,6})(?=\s+от)',  # Только если после "от"
        # "Invoice № 141"
        r'Invoice\s+[№#]\s*(\d{1,6})',
        # В тексте "Счет на оплату № 141 от"
        r'Счет[^\d]*(\d{1,6})\s+от',
        # Более общий паттерн
        r'\bСчет\b[^\d]{0,20}?(\d{1,6})(?=\D|$)',
    ]
    
    for i, pattern in enumerate(patterns_number, 1):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice_number = match.group(1).strip()
            # Проверяем что это не слишком длинный номер
            if len(invoice_number) <= 6:
                print(f"[DEBUG] Паттерн {i} НАЙДЕНО: '{pattern}' → '{invoice_number}'")
                # Найдем контекст для отладки
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 50)
                context = text[start:end].replace('\n', ' ')
                print(f"[DEBUG] Контекст: ...{context}...")
                break
            else:
                print(f"[DEBUG] Паттерн {i} найден, но номер слишком длинный, пропускаем")
    
    # Ищем дату счета
    invoice_date = None
    patterns_date = [
        # "от 21 января 2026 г."
        r'от\s*(\d{1,2}\s+[а-яё]+\s+\d{4})\s*г?\.?',
        # "от 21.01.2026"
        r'от\s*(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})',
        # "от 21.01.26"
        r'от\s*(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2})',
        # "21 января 2026 г."
        r'(\d{1,2}\s+[а-яё]+\s+\d{4})\s*г\.',
    ]
    
    for i, pattern in enumerate(patterns_date, 1):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            invoice_date = match.group(1).strip()
            print(f"[DEBUG] Дата найдена паттерном {i}: '{invoice_date}'")
            break
    
    # Если не нашли дату в основном тексте, посмотрим в начале
    if not invoice_date:
        first_part = text[:500]
        for pattern in patterns_date:
            match = re.search(pattern, first_part, re.IGNORECASE)
            if match:
                invoice_date = match.group(1).strip()
                print(f"[DEBUG] Дата найдена в начале текста: '{invoice_date}'")
                break
    
    print(f"[DEBUG] ИТОГ: номер='{invoice_number}', дата='{invoice_date}'")
    
    return invoice_number, invoice_date


def clean_invoice_number(number: str) -> str:
    """Очищает номер счета"""
    if not number:
        return None
    
    print(f"[DEBUG] Очистка номера счета: '{number}'")
    
    # Удаляем "№", "#", "No", "no" и т.д.
    number = re.sub(r'[№#]', '', number)
    number = re.sub(r'\bNo\b', '', number, flags=re.IGNORECASE)
    number = re.sub(r'\s+', '', number)
    
    result = number.strip()
    print(f"[DEBUG] Очищенный номер: '{result}'")
    return result


def extract_total_amount_improved(text: str) -> Optional[str]:
    """Извлекает итоговую сумму"""
    
    # Ищем разные варианты написания итоговой суммы
    patterns = [
        r'Итого\s*:?\s*([\d\s]+(?:[.,]\d{2})?)\s*руб',
        r'Всего\s+к\s+оплате\s*:?\s*([\d\s]+(?:[.,]\d{2})?)\s*руб',
        r'Сумма\s+к\s+оплате\s*:?\s*([\d\s]+(?:[.,]\d{2})?)\s*руб',
        r'Всего\s+на\s+сумму\s*:?\s*([\d\s]+(?:[.,]\d{2})?)\s*руб',
        r'Общая\s+сумма\s*:?\s*([\d\s]+(?:[.,]\d{2})?)\s*руб',
        r'Итого\s*:?\s*([\d\s]+(?:[.,]\d{2})?)',
        r'Всего\s+к\s+оплате\s*:?\s*([\d\s]+(?:[.,]\d{2})?)',
        r'Сумма\s+к\s+оплате\s*:?\s*([\d\s]+(?:[.,]\d{2})?)',
        r'Всего\s*:?\s*([\d\s]+(?:[.,]\d{2})?)',
    ]
    
    all_totals = []
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if match:
                total = clean_total_string(match)
                if total and is_valid_amount(total):
                    all_totals.append(total)
    
    if all_totals:
        # Берем максимальную сумму (обычно это итог)
        try:
            totals_numeric = [float(t.replace(',', '.')) for t in all_totals]
            max_total = str(max(totals_numeric))
            return max_total
        except:
            # Возвращаем первую найденную сумму
            return all_totals[0]
    
    return None


def clean_total_string(total_str: str) -> str:
    """Очищает строку с суммой"""
    # Удаляем все пробелы
    total = total_str.replace(' ', '')
    # Заменяем запятую на точку
    total = total.replace(',', '.')
    # Удаляем все нецифровые символы кроме точки
    total = re.sub(r'[^\d\.]', '', total)
    return total


def is_valid_amount(amount_str: str) -> bool:
    """Проверяет валидность суммы"""
    try:
        amount = float(amount_str)
        return 0.01 <= amount <= 10000000  # Разумные пределы для счета
    except:
        return False


def clean_total_amount(total: str) -> str:
    """Форматирует сумму"""
    try:
        # Пробуем привести к числу и обратно к строке
        num = float(total)
        # Округляем до 2 знаков
        return format(num, '.2f').replace('.', ',')
    except:
        return total


def extract_inn_improved(text: str) -> Optional[str]:
    """Извлекает ИНН"""
    patterns = [
        r'ИНН\s*:?\s*(\d{10,12})',
        r'ИНН[\s\.]*(\d{10,12})',
        r'\bИНН\/КПП[:\s]*(\d{10})',
        r'\b(\d{10})\s*\(?ИНН\)?',
        r'\b(\d{12})\s*\(?ИНН\)?',
    ]
    
    for pattern in patterns:
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        if matches:
            # Берем первый ИНН в тексте
            for match in matches:
                inn = match.group(1).strip()
                if len(inn) in [10, 12]:  # ИНН может быть 10 или 12 цифр
                    return inn
    
    return None


def extract_account_improved(text: str) -> Optional[str]:
    """Извлекает расчетный счет"""
    patterns = [
        r'Сч[\.\s]*№?\s*(\d{20})',
        r'Расчетный\s+счет\s*:?\s*(\d{20})',
        r'р/с\s*:?\s*(\d{20})',
        r'р\/сч[:\s]*(\d{20})',
        r'Расч[\.]\s*счет[:\s]*(\d{20})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            account = match.group(1).strip()
            account = re.sub(r'\s+', '', account)
            if len(account) == 20:
                return account
    
    return None


def normalize_date(date_str: str) -> str:
    """Приводит дату к стандартному формату DD.MM.YYYY"""
    try:
        # Если дата в формате "24 декабря 2025"
        month_map = {
            'января': '01', 'февраля': '02', 'марта': '03',
            'апреля': '04', 'мая': '05', 'июня': '06',
            'июля': '07', 'августа': '08', 'сентября': '09',
            'октября': '10', 'ноября': '11', 'декабря': '12',
            'янв': '01', 'фев': '02', 'мар': '03',
            'апр': '04', 'мая': '05', 'июн': '06',
            'июл': '07', 'авг': '08', 'сен': '09',
            'окт': '10', 'ноя': '11', 'дек': '12'
        }
        
        # Пробуем парсить русскую дату
        date_lower = date_str.lower()
        for rus_month, num_month in month_map.items():
            if rus_month in date_lower:
                pattern = r'(\d{1,2})\s+' + rus_month + r'\s+(\d{4})'
                match = re.search(pattern, date_lower)
                if match:
                    day = match.group(1).zfill(2)
                    year = match.group(2)
                    return f"{day}.{num_month}.{year}"
        
        # Пробуем парсить числовую дату
        numeric_patterns = [
            r'(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})',
            r'(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2})',
            r'(\d{1,2})-(\d{1,2})-(\d{4})',
        ]
        
        for pattern in numeric_patterns:
            match = re.search(pattern, date_str)
            if match:
                day = match.group(1).zfill(2)
                month = match.group(2).zfill(2)
                year = match.group(3)
                if len(year) == 2:
                    year = '20' + year
                return f"{day}.{month}.{year}"
        
        return date_str  # Возвращаем как есть если не удалось распарсить
        
    except Exception:
        return date_str


def print_metadata_results(data: Dict[str, Any]) -> None:
    """Выводит найденные метаданные"""
    if data.get("metadata_found"):
        print("✓ METADATA FOUND:")
        if data.get("contractor"):
            print(f"  Контрагент: {data['contractor'][:50]}..." if len(data['contractor']) > 50 else f"  Контрагент: {data['contractor']}")
        if data.get("invoice_number"):
            print(f"  Номер счета: {data['invoice_number']}")
        if data.get("invoice_date"):
            print(f"  Дата счета: {data['invoice_date']}")
        if data.get("total"):
            print(f"  Сумма: {data['total']}")
        if data.get("inn"):
            print(f"  ИНН: {data['inn']}")
        if data.get("account"):
            print(f"  Счет: {data['account']}")
    else:
        print("✗ NO METADATA FOUND")


# Функция для отладки
def debug_contractor_extraction(text: str):
    """Функция для отладки извлечения контрагента"""
    print("\n=== DEBUG CONTRACTOR EXTRACTION ===")
    
    # Ищем все вхождения ООО в тексте
    ooo_matches = list(re.finditer(r'ООО\s+[«"][^»"]+[»"]', text, re.IGNORECASE))
    print(f"Найдено {len(ooo_matches)} вхождений ООО в кавычках:")
    
    for i, match in enumerate(ooo_matches, 1):
        found = match.group(0)
        start = max(0, match.start() - 50)
        end = min(len(text), match.end() + 50)
        context = text[start:end].replace('\n', ' ')
        print(f"  {i}. '{found}'")
        print(f"     Контекст: ...{context}...")
    
    return extract_contractor_fixed(text)