"""
Парсер для таблиц с штрих-кодами и стандартных таблиц
"""

import re
from typing import List, Dict, Any, Optional


def fix_ocr_errors(text: str) -> str:
    """Исправляет типичные ошибки OCR (из старого парсера)"""
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


class BarcodeTableParser:
    """Парсер для таблиц товаров"""
    
    def __init__(self):
        self.name = "Barcode Table Parser"
        self.priority = 20
    
    def can_parse(self, text: str) -> bool:
        """Определяет, есть ли в тексте табличная структура"""
        # Проверяем на наличие табличных паттернов
        table_indicators = [
            '№', 'наименование', 'товар', 'количество', 'цена', 'сумма',
            'артикул', 'ед.', 'изм.', 'шт', 'кол-во'
        ]
        
        text_lower = text.lower()
        lines = text.split('\n')
        
        # Считаем строки, похожие на табличные
        table_lines = 0
        for line in lines[:50]:  # Проверяем первые 50 строк
            line_lower = line.lower().strip()
            if len(line_lower) < 5:
                continue
            
            # Проверяем на наличие номера в начале (типа "1 ", "2 ", и т.д.)
            if re.match(r'^\d+[\.\)\s]+', line_lower):
                table_lines += 1
            
            # Проверяем на наличие цен
            if re.search(r'\d+[.,]\d{2}\s*(?:руб|р|₽)?', line_lower):
                table_lines += 1
        
        return table_lines >= 3
    
    def parse(self, text: str) -> List[Dict[str, Any]]:
        """Парсит таблицу товаров"""
         # Исправляем ошибки OCR
        text = fix_ocr_errors(text)
        lines = []
        text_lines = text.split('\n')
        
        for i, line in enumerate(text_lines):
            line = line.strip()
            if len(line) < 5:
                continue
            
            # Пропускаем строки с банковскими реквизитами
            if self._is_bank_line(line):
                continue
            
            # Пропускаем заголовки таблицы
            if self._is_table_header(line):
                continue
            
            # Ищем строки товаров
            item = self._parse_item_line(line, text_lines, i)
            if item:
                lines.append(item)
        
        return lines
    
    def _is_bank_line(self, line: str) -> bool:
        """Проверяет, является ли строка банковскими реквизитами"""
        bank_keywords = [
            'банк', 'банка', 'банке', 'счет', 'расчетный', 'корр.счет',
            'корреспондентский', 'бик', 'кпп', 'инн', 'иин', 'огрн',
            'получатель', 'плательщик'
        ]
        
        line_lower = line.lower()
        return any(keyword in line_lower for keyword in bank_keywords)
    
    def _is_table_header(self, line: str) -> bool:
        """Проверяет, является ли строка заголовком таблицы"""
        header_keywords = ['№', 'наименование', 'товар', 'количество', 'цена', 'сумма']
        line_lower = line.lower()
        
        # Если в строке много заголовочных слов
        header_count = sum(1 for keyword in header_keywords if keyword in line_lower)
        return header_count >= 2
    
    def _parse_item_line(self, line: str, all_lines: List[str], line_index: int) -> Optional[Dict[str, Any]]:
        """Парсит строку с товаром"""
        try:
            # Пытаемся найти паттерн: "1 Топливная форсунка Kia Bonga 3 4 шт 28420,00 113680,00"
            pattern = r'^(\d+)[\.\)\s]+\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:шт|ш|ед|кг|л|м|см)?\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$'
            match = re.match(pattern, line)
            
            if match:
                return {
                    'line_number': match.group(1),
                    'description': match.group(2).strip(),
                    'qty': match.group(3).replace(',', '.'),
                    'price': match.group(4).replace(',', '.'),
                    'total': match.group(5).replace(',', '.'),
                    'parser': self.name
                }
            
            # Альтернативный паттерн (без указания единиц измерения)
            pattern2 = r'^(\d+)[\.\)\s]+\s*(.+?)\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$'
            match2 = re.match(pattern2, line)
            
            if match2:
                return {
                    'line_number': match2.group(1),
                    'description': match2.group(2).strip(),
                    'qty': match2.group(3),
                    'price': match2.group(4).replace(',', '.'),
                    'total': match2.group(5).replace(',', '.'),
                    'parser': self.name
                }
            
            # Если не нашли полный паттерн, пытаемся извлечь данные по частям
            parts = re.split(r'\s{2,}', line)  # Разделяем по двум и более пробелам
            
            if len(parts) >= 4:
                # Проверяем, начинается ли с номера
                if re.match(r'^\d+[\.\)]?$', parts[0].strip()):
                    qty = parts[-3] if len(parts) >= 3 else '1'
                    price = parts[-2].replace(',', '.')
                    total = parts[-1].replace(',', '.')
                    
                    # Описание - все что между номером и количеством
                    description = ' '.join(parts[1:-3]) if len(parts) > 4 else parts[1]
                    
                    return {
                        'line_number': parts[0].strip(' .)'),
                        'description': description.strip(),
                        'qty': qty,
                        'price': price,
                        'total': total,
                        'parser': self.name
                    }
            
            return None
            
        except Exception as e:
            print(f"Error parsing line: {line} - {e}")
            return None