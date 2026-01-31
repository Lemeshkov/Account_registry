"""
Парсер для стандартных таблиц с заголовками
"""

import re
from typing import List, Dict, Any, Optional

class StandardTableParser:
    """Парсит таблицы вида: Наименование | Количество | Цена | Сумма"""
    
    name = "Standard Table Parser"
    
    def can_parse(self, text: str) -> bool:
        """Может ли парсить этот текст?"""
        patterns = [
            r'Товары\s*\(.*?\)\s+Кол-во.*?Цена.*?Сумма',
            r'Наименование.*?Количество.*?Цена.*?Сумма',
            r'№\s+Товары\s*\(.*?\)\s+Кол-во',
        ]
        
        return any(re.search(p, text, re.IGNORECASE) for p in patterns)
    
    def parse(self, text: str) -> List[Dict[str, Any]]:
        """Парсит таблицу"""
        print(f"\n=== USING {self.name} ===")
        
        # Находим таблицу
        table_text = self._extract_table(text)
        if not table_text:
            return []
        
        # Парсим строки
        return self._parse_table_rows(table_text)
    
    def _extract_table(self, text: str) -> str:
        """Извлекает таблицу из текста"""
        patterns = [
            r'(?:Товары\s*\(.*?\)|Наименование).*?Кол-во.*?Цена.*?Сумма.*?\n(.*?)(?=\s*Итого\s*:|ИТОГО\s*:|Всего\s+к\s+оплате)',
            r'Кол-во\s+Цена\s+Сумма.*?\n(.*?)(?=\s*Итого\s*:)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def _parse_table_rows(self, table_text: str) -> List[Dict[str, Any]]:
        """Парсит строки таблицы"""
        lines = []
        rows = [row.strip() for row in table_text.split('\n') if row.strip()]
        
        for row in rows:
            line_data = self._parse_row(row)
            if line_data:
                lines.append(line_data)
        
        return lines
    
    def _parse_row(self, row_text: str) -> Optional[Dict[str, Any]]:
        """Парсит одну строку"""
        try:
            # Ищем номер строки
            match = re.match(r'^(\d{1,3})[.\s]+(.+)$', row_text)
            if not match:
                return None
            
            line_no = int(match.group(1))
            content = match.group(2).strip()
            
            # Ищем цены
            numbers = []
            for num_match in re.finditer(r'(\d[ \d]*[.,]\d{2})', content):
                try:
                    num = float(num_match.group(1).replace(' ', '').replace(',', '.'))
                    numbers.append(num)
                except:
                    continue
            
            if len(numbers) < 2:
                return None
            
            price = numbers[-2]
            total = numbers[-1]
            
            # Ищем количество
            qty = self._extract_quantity(content)
            
            # Получаем описание
            description = self._extract_description(content)
            
            if not description:
                return None
            
            # Проверяем согласованность
            expected = round(price * qty, 2)
            if abs(expected - total) > 0.01:
                total = expected
            
            print(f"  Line {line_no}: '{description[:30]}...' x{qty} @ {price} = {total}")
            
            return {
                "line_no": line_no,
                "description": description,
                "qty": qty,
                "price": str(price),
                "total": str(total),
                "used": False,
                "raw": row_text,
            }
            
        except Exception as e:
            print(f"  Error: {e}")
            return None
    
    def _extract_quantity(self, text: str) -> float:
        """Извлекает количество"""
        qty_match = re.search(r'(\d+)\s+(?:шт|штук|ш\.)', text, re.IGNORECASE)
        if qty_match:
            return float(qty_match.group(1))
        return 1.0
    
    def _extract_description(self, text: str) -> str:
        """Извлекает описание"""
        # Удаляем числа и единицы измерения
        description = re.sub(r'\d[ \d]*[.,]\d{2}', '', text)
        description = re.sub(r'\d+\s*(?:шт|штук|ш\.)', '', description, flags=re.IGNORECASE)
        description = re.sub(r'\s+', ' ', description).strip()
        return description