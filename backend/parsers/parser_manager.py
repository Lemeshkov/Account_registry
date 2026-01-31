"""
Менеджер парсеров - выбирает подходящий парсер таблицы
"""

from typing import List, Dict, Any
from .table_parsers import ALL_PARSERS

class ParserManager:
    """Управляет выбором и выполнением парсеров таблиц"""
    
    def __init__(self):
        self.parsers = ALL_PARSERS
    
    def parse_table_lines(self, text: str) -> List[Dict[str, Any]]:
        """
        Пытается распарсить таблицу товаров.
        Пробует парсеры по очереди пока не найдет валидные строки.
        """
        print("\n=== TRYING TABLE PARSERS ===")
        
        # Пробуем каждый парсер
        for parser in self.parsers:
            if parser.can_parse(text):
                print(f"  Trying {parser.name}...")
                lines = parser.parse(text)
                
                # Валидируем результат
                valid_lines = self._validate_lines(lines)
                
                if valid_lines:
                    print(f"  ✓ {parser.name} found {len(valid_lines)} valid lines")
                    return valid_lines
                else:
                    print(f"  ✗ {parser.name} found 0 valid lines")
        
        print("  ✗ No parser found valid product lines")
        return []
    
    def _validate_lines(self, lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Валидирует найденные строки"""
        valid_lines = []
        seen_nos = set()
        
        for line in lines:
            if self._is_valid_line(line) and line["line_no"] not in seen_nos:
                valid_lines.append(line)
                seen_nos.add(line["line_no"])
        
        # Сортируем по номеру
        valid_lines.sort(key=lambda x: x["line_no"])
        return valid_lines
    
    def _is_valid_line(self, line: Dict[str, Any]) -> bool:
        """Проверяет валидность строки"""
        try:
            required_fields = ["line_no", "description", "qty", "price", "total"]
            if not all(field in line for field in required_fields):
                return False
            
            line_no = line["line_no"]
            description = line["description"]
            qty = float(line["qty"])
            price = float(line["price"])
            total = float(line["total"])
            
            # Базовые проверки
            if not (1 <= line_no <= 1000):
                return False
            
            if not description or len(description) < 2:
                return False
            
            if qty <= 0 or qty > 10000:
                return False
            
            if price <= 0 or price > 1000000:
                return False
            
            if total <= 0 or total > 10000000:
                return False
            
            # Проверяем согласованность
            expected = round(price * qty, 2)
            return abs(expected - total) <= 0.01
            
        except (KeyError, ValueError, TypeError):
            return False