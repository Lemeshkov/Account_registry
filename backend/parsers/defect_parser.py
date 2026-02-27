# """
# Парсер для дефектных ведомостей (акты списания металлопроката)
# Формат Excel: специфическая структура с требованиями и позициями
# """
# import pandas as pd
# import re
# from datetime import datetime
# from pathlib import Path
# from typing import List, Dict, Any, Tuple, Optional
# import logging
# import tempfile
# import os
# import xlsx2csv 

# logger = logging.getLogger(__name__)

# class DefectSheetParser:
#     """
#     Парсер для Excel файлов дефектных ведомостей.
#     Извлекает поля: Марка (-> address), Наименование зап.части (-> material_name),
#     Затреб (-> requested_quantity) в тоннах.
#     """
    
#     # Регулярное выражение для поиска требования
#     REQUIREMENT_PATTERN = re.compile(r'Требование:\s*(\d+)')
#     DATE_PATTERN = re.compile(r'\d{2}\.\d{2}\.\d{4}')
    
#     def __init__(self):
#         self.period_start = None
#         self.period_end = None
        
#     def parse_file(self, file_path: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
#         """
#         Основной метод парсинга с защитой от ошибок чтения Excel.
#         Возвращает: (список строк, метаданные документа)
#         """
#         logger.info(f"Parsing defect sheet: {file_path}")
    
#     # Добавляем fallback чтение Excel
#         df = self._safe_read_excel(file_path)
    
#     # Извлекаем период из первой строки
#         self._extract_period(df)
    
#     # Парсим строки
#         items = self._parse_rows(df)
    
#         metadata = {
#             "period_start": self.period_start,
#             "period_end": self.period_end,
#             "file_name": file_path.name,
#             "total_rows": len(items),
#             "parsing_date": datetime.now().isoformat()
#         }
    
#         logger.info(f"Parsed {len(items)} items from defect sheet")
#         return items, metadata

#     def _safe_read_excel(self, file_path: Path) -> pd.DataFrame:
#         """
#         Безопасное чтение Excel с несколькими попытками и fallback методами
#         """
#         import tempfile
#         import os
#         import xlsx2csv
    
#     # Попытка 1: стандартный pandas
#         try:
#             logger.debug("Attempting to read with pandas/openpyxl...")
#             return pd.read_excel(file_path, header=None, dtype=str)
#         except Exception as e:
#             logger.warning(f"Pandas/openpyxl failed: {e}")
    
#     # Попытка 2: pandas с engine='xlrd' для старых .xls
#         try:
#             if str(file_path).endswith('.xls'):
#                 logger.debug("Attempting to read with xlrd engine...")
#                 return pd.read_excel(file_path, header=None, dtype=str, engine='xlrd')
#         except Exception as e:
#             logger.warning(f"xlrd engine failed: {e}")
    
#     # Попытка 3: xlsx2csv конвертация (для проблемных .xlsx)
#         try:
#             logger.debug("Attempting to read via xlsx2csv conversion...")
#             with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
#                csv_path = f.name
        
#         # Конвертируем Excel в CSV
#             xlsx2csv.Xlsx2csv(str(file_path)).convert(csv_path)
        
#         # Читаем CSV
#             df = pd.read_csv(csv_path, header=None, dtype=str, encoding='utf-8')
        
#         # Удаляем временный файл
#             os.unlink(csv_path)
        
#             logger.info("Successfully read via xlsx2csv fallback")
#             return df
        
#         except Exception as e:
#             logger.error(f"xlsx2csv fallback also failed: {e}")
        
#         # Если ничего не помогло, создаем пустой DataFrame с заглушкой
#             logger.warning("Creating empty DataFrame as last resort")
#             return pd.DataFrame()
    
#     def _extract_period(self, df: pd.DataFrame):
#         """Извлекает период из первой строки"""
#         try:
#             first_row = df.iloc[0, 0] if not df.empty else ""
#             if isinstance(first_row, str):
#                 # Ищем даты в формате ДД.ММ.ГГГГ
#                 dates = self.DATE_PATTERN.findall(first_row)
#                 if len(dates) >= 2:
#                     self.period_start = datetime.strptime(dates[0], "%d.%m.%Y")
#                     self.period_end = datetime.strptime(dates[1], "%d.%m.%Y")
#                     logger.info(f"Found period: {self.period_start} - {self.period_end}")
#         except Exception as e:
#             logger.warning(f"Could not extract period: {e}")
    
#     def _parse_rows(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
#         """
#         Парсит строки документа.
#         Структура:
#         - Строки с "Требование:" обозначают начало нового требования
#         - Далее идут позиции с данными
#         - Нас интересуют поля: Марка (col 2), Наименование зап.части (col 7), Затреб (col 8)
#         """
#         items = []
#         current_requirement = None
#         current_date = None
        
#         for idx, row in df.iterrows():
#             if idx < 3:  # Пропускаем заголовки
#                 continue
                
#             # Проверяем, не пустая ли строка
#             if pd.isna(row[0]) or str(row[0]).strip() == '':
#                 continue
            
#             first_cell = str(row[0]) if pd.notna(row[0]) else ""
            
#             # Ищем строку с требованием
#             req_match = self.REQUIREMENT_PATTERN.search(first_cell)
#             if req_match:
#                 current_requirement = req_match.group(1)
#                 # Дата может быть в следующей строке или в этом же требовании
#                 current_date = self._parse_date(row[1]) if pd.notna(row[1]) else None
#                 continue
            
#             # Парсим позицию (должна начинаться с числа)
#             if first_cell.strip().isdigit():
#                 item = self._parse_item_row(row, current_requirement, current_date)
#                 if item:
#                     items.append(item)
        
#         return items
    
#     def _parse_date(self, date_str) -> Optional[datetime]:
#         """Парсит дату из строки"""
#         try:
#             if pd.notna(date_str):
#                 # Пробуем разные форматы
#                 if isinstance(date_str, datetime):
#                     return date_str
#                 str_date = str(date_str).strip()
#                 for fmt in ["%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"]:
#                     try:
#                         return datetime.strptime(str_date, fmt)
#                     except ValueError:
#                         continue
#         except Exception as e:
#             logger.debug(f"Date parse error: {e}")
#         return None
    
#     def _parse_item_row(self, row: pd.Series, requirement: Optional[str], req_date: Optional[datetime]) -> Optional[Dict[str, Any]]:
#         """
#         Парсит строку с позицией.
#         Ожидаемые колонки:
#         - col 0: № п/п
#         - col 1: Дата требования
#         - col 2: Марка (-> address)
#         - col 3: Гос.номер (не используется)
#         - col 4: Гос.номер (дубль)
#         - col 5: Получатель
#         - col 6: Номенкл. номер
#         - col 7: Наименование зап.части (-> material_name)
#         - col 8: Затреб (-> requested_quantity, в тоннах)
#         - остальные: не используются
#         """
#         try:
#             # Проверяем наличие необходимых полей
#             if pd.isna(row[7]) or pd.isna(row[8]):  # Нет наименования или количества
#                 return None
            
#             # Извлекаем количество (в тоннах)
#             quantity_str = str(row[8]).strip().replace(',', '.')
#             try:
#                 quantity = float(quantity_str)
#             except ValueError:
#                 quantity = None
            
#             # Создаем запись
#             item = {
#                 "position": int(row[0]) if pd.notna(row[0]) and str(row[0]).strip().isdigit() else None,
#                 "requirement_number": requirement,
#                 "requirement_date": req_date or self._parse_date(row[1]),
#                 "address": str(row[2]).strip() if pd.notna(row[2]) else None,  # Марка
#                 "license_plate": str(row[3]).strip() if pd.notna(row[3]) else None,
#                 "recipient": str(row[5]).strip() if pd.notna(row[5]) else None,
#                 "article": str(row[6]).strip() if pd.notna(row[6]) else None,  # Номенкл. номер
#                 "material_name": str(row[7]).strip() if pd.notna(row[7]) else None,  # Наименование зап.части
#                 "requested_quantity": quantity,  # Затреб (в тоннах)
#                 "weight_tons": quantity,  # Дублируем для калькулятора
#             }
            
#             # Пытаемся определить тип профиля из наименования
#             if item["material_name"]:
#                 item["profile_type"] = self._detect_profile_type(item["material_name"])
#                 item["profile_params"] = self._extract_profile_params(item["material_name"])
            
#             return item
            
#         except Exception as e:
#             logger.error(f"Error parsing row: {e}")
#             return None
    
#     def _detect_profile_type(self, material_name: str) -> str:
#         """Определяет тип профиля из наименования"""
#         name_lower = material_name.lower()
        
#         if any(word in name_lower for word in ['труб', 'тр.', 'tr.']):
#             return 'pipe'
#         elif any(word in name_lower for word in ['арматур', 'armature']):
#             return 'rebar'
#         elif any(word in name_lower for word in ['балк', 'balc']):
#             return 'beam'
#         elif any(word in name_lower for word in ['лист', 'list']):
#             return 'sheet'
#         elif any(word in name_lower for word in ['угол', 'ugol']):
#             return 'angle'
#         else:
#             return 'other'
    
#     def _extract_profile_params(self, material_name: str) -> Dict[str, Any]:
#         """
#         Пытается извлечь параметры профиля из наименования.
#         Например: "Труба 100х5" -> {"d": 100, "t": 5}
#         """
#         params = {}
#         name_lower = material_name.lower()
        
#         # Ищем паттерны для трубы: диаметр и толщина стенки
#         if 'труб' in name_lower:
#             # Паттерны: 100х5, 100*5, 100 x 5, 100/5
#             pipe_pattern = r'(\d+)[\sхx*\/]+(\d+)'
#             match = re.search(pipe_pattern, name_lower)
#             if match:
#                 params['d'] = float(match.group(1))
#                 params['t'] = float(match.group(2))
        
#         return params


# # Функция для удобного импорта
# def parse_defect_sheet(file_path: Path) -> Tuple[List[Dict], Dict]:
#     """Удобная обертка для парсинга"""
#     parser = DefectSheetParser()
#     return parser.parse_file(file_path)

"""
Парсер для дефектных ведомостей (акты списания металлопроката)
Исправленная версия с гарантией уникальности position
"""
import pandas as pd
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import logging
import tempfile
import os
from io import StringIO
from xlsx2csv import Xlsx2csv

logger = logging.getLogger(__name__)

class DefectSheetParser:
    """
    Парсер для Excel файлов дефектных ведомостей.
    Генерирует уникальный position для каждой записи.
    """
    
    # Регулярное выражение для поиска требования
    REQUIREMENT_PATTERN = re.compile(r'Требование:\s*(\d+)')
    DATE_PATTERN = re.compile(r'\d{2}\d{2}\d{4}|\d{2}\.\d{2}\.\d{4}')
    
    def __init__(self):
        self.period_start = None
        self.period_end = None
        
    def parse_file_with_positions(self, file_path: Path) -> List[Tuple[Dict[str, Any], int]]:
        """
        Основной метод парсинга, возвращающий данные с уникальными позициями.
        Возвращает: список кортежей (данные_строки, уникальная_позиция)
        """
        logger.info(f"Parsing defect sheet with positions: {file_path}")
        
        df = self._safe_read_excel(file_path)
        self._extract_period(df)
        
        results = self._parse_rows_with_positions(df)
        
        logger.info(f"Parsed {len(results)} items from defect sheet")
        return results
    
    def parse_file(self, file_path: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Совместимый метод для обратной совместимости
        Возвращает: (список строк, метаданные документа)
        """
        items_with_positions = self.parse_file_with_positions(file_path)
        items = [item for item, _ in items_with_positions]
        
        metadata = {
            "period_start": self.period_start,
            "period_end": self.period_end,
            "file_name": file_path.name,
            "total_rows": len(items),
            "parsing_date": datetime.now().isoformat()
        }
        
        return items, metadata

    def _safe_read_excel(self, file_path: Path) -> pd.DataFrame:
        """
        Безопасное чтение Excel с несколькими попытками
        """
        df = None
        
        # Попытка 1: стандартный pandas
        try:
            logger.debug("Attempting to read with pandas/openpyxl...")
            df = pd.read_excel(file_path, header=None, dtype=str)
        except Exception as e:
            logger.warning(f"Pandas/openpyxl failed: {e}")
        
        # Попытка 2: xlsx2csv через StringIO
        if df is None:
            try:
                logger.debug("Attempting to read via xlsx2csv fallback...")
                output = StringIO()
                Xlsx2csv(str(file_path), outputencoding="utf-8").convert(output)
                output.seek(0)
                df = pd.read_csv(output, header=None, dtype=str)
                logger.info("Successfully read via xlsx2csv fallback")
            except Exception as e:
                logger.error(f"xlsx2csv fallback failed: {e}")
        
        # Попытка 3: если файл .xls, пробуем xlrd
        if df is None and str(file_path).endswith('.xls'):
            try:
                logger.debug("Attempting to read with xlrd engine...")
                df = pd.read_excel(file_path, header=None, dtype=str, engine='xlrd')
                logger.info("Successfully read with xlrd")
            except Exception as e:
                logger.warning(f"xlrd engine failed: {e}")
        
        if df is None:
            logger.warning("Creating empty DataFrame as last resort")
            df = pd.DataFrame()
        
        return df
    
    def _extract_period(self, df: pd.DataFrame):
        """Извлекает период из первой строки"""
        try:
            if df.empty:
                return
            first_row = df.iloc[0, 0] if not df.empty else ""
            if isinstance(first_row, str):
                # Ищем даты в формате ДД.ММ.ГГГГ
                dates = self.DATE_PATTERN.findall(first_row)
                if len(dates) >= 2:
                    # Очищаем даты от точек
                    clean_dates = []
                    for d in dates:
                        d_clean = d.replace('.', '')
                        clean_dates.append(d_clean)
                    
                    if len(clean_dates) >= 2:
                        self.period_start = datetime.strptime(clean_dates[0], "%d%m%Y")
                        self.period_end = datetime.strptime(clean_dates[1], "%d%m%Y")
                        logger.info(f"Found period: {self.period_start} - {self.period_end}")
        except Exception as e:
            logger.warning(f"Could not extract period: {e}")
    
    def _parse_rows_with_positions(self, df: pd.DataFrame) -> List[Tuple[Dict[str, Any], int]]:
        """
        Парсит строки документа и возвращает данные с уникальными позициями.
        Генерирует уникальный position для КАЖДОЙ созданной записи.
        """
        results = []
        current_requirement = None
        current_date = None
        
        # Счетчик для гарантии уникальности position
        unique_position_counter = 0
        
        for idx, row in df.iterrows():
            if idx < 3:  # Пропускаем заголовки
                continue
                
            # Проверяем, не пустая ли строка
            if pd.isna(row[0]) or str(row[0]).strip() == '':
                continue
            
            first_cell = str(row[0]) if pd.notna(row[0]) else ""
            
            # Ищем строку с требованием
            req_match = self.REQUIREMENT_PATTERN.search(first_cell)
            if req_match:
                current_requirement = req_match.group(1)
                current_date = self._parse_date(row[1]) if pd.notna(row[1]) else None
                continue
            
            # Парсим позицию (должна начинаться с числа)
            if first_cell.strip().isdigit():
                # Сохраняем оригинальный номер строки из Excel для отображения
                excel_position = int(first_cell)
                
                # Парсим строку
                items_from_row = self._parse_item_row(
                    row, 
                    current_requirement, 
                    current_date,
                    excel_position=excel_position
                )
                
                if items_from_row:
                    for item in items_from_row:
                        # Используем счетчик для ГАРАНТИРОВАННОЙ уникальности
                        results.append((item, unique_position_counter))
                        unique_position_counter += 1
        
        # Пост-обработка для уникальности requirement + material
        results = self._ensure_unique_requirement_material(results)
        
        logger.info(f"Generated {unique_position_counter} unique positions from {len(df)} rows")
        return results
    
    def _split_materials(self, material_name: str) -> List[str]:
        """
        Разделяет строку с несколькими наименованиями запчастей.
        """
        if not material_name:
            return []
        
        # Разделители: /, ;, ,, \n
        separators = ['/', ';', ',', '\n']
        
        for sep in separators:
            if sep in material_name:
                parts = [p.strip() for p in material_name.split(sep) if p.strip()]
                if len(parts) > 1:
                    return parts
        
        return [material_name]
    
    def _parse_item_row(self, row: pd.Series, requirement: Optional[str], 
                       req_date: Optional[datetime], excel_position: int) -> Optional[List[Dict[str, Any]]]:
        """
        Парсит строку с позицией.
        """
        try:
            # Проверяем наличие необходимых полей
            if len(row) <= 8 or pd.isna(row[7]) or pd.isna(row[8]):  # Нет наименования или количества
                return None
            
            # Извлекаем количество (в тоннах)
            quantity_str = str(row[8]).strip().replace(',', '.')
            try:
                quantity = float(quantity_str)
            except ValueError:
                quantity = None
            
            # Получаем наименование запчасти
            material_name_raw = str(row[7]).strip() if pd.notna(row[7]) else ""
            
            # Проверяем, не содержит ли material_name несколько запчастей
            material_names = self._split_materials(material_name_raw)
            
            items = []
            
            # Если material_name содержит несколько запчастей, создаем несколько записей
            if len(material_names) > 1:
                for sub_idx, material in enumerate(material_names, start=1):
                    item = self._create_item(
                        row=row,
                        requirement=requirement,
                        req_date=req_date,
                        excel_position=excel_position,
                        material_name=material,
                        quantity=quantity / len(material_names) if quantity else None,  # Делим поровну
                        subposition=sub_idx
                    )
                    if item:
                        items.append(item)
            else:
                # Обычная запись
                item = self._create_item(
                    row=row,
                    requirement=requirement,
                    req_date=req_date,
                    excel_position=excel_position,
                    material_name=material_names[0] if material_names else None,
                    quantity=quantity,
                    subposition=1
                )
                if item:
                    items.append(item)
            
            return items
            
        except Exception as e:
            logger.error(f"Error parsing row at excel position {excel_position}: {e}")
            return None
    
    def _create_item(self, row: pd.Series, requirement: Optional[str], 
                    req_date: Optional[datetime], excel_position: Optional[int],
                    material_name: Optional[str], quantity: Optional[float], 
                    subposition: int) -> Optional[Dict[str, Any]]:
        """Создает элемент - position будет добавлен позже"""
        
        if not material_name:
            return None
        
        # Базовая запись - БЕЗ position!
        item = {
            "excel_position": excel_position,  # Оригинальный номер из Excel
            "subposition": subposition,
            "requirement_number": requirement,
            "requirement_date": req_date or self._parse_date(row[1]) if len(row) > 1 else None,
            "address": self._safe(row[2]) if len(row) > 2 else None,
            "license_plate": self._safe(row[3]) if len(row) > 3 else None,
            "recipient": self._safe(row[5]) if len(row) > 5 else None,
            "article": self._safe(row[6]) if len(row) > 6 else None,
            "material_name": material_name,
            "requested_quantity": quantity,
            "weight_tons": quantity,
        }
        
        # Определяем тип профиля
        if item["material_name"]:
            item["profile_type"] = self._detect_profile_type(item["material_name"])
            item["profile_params"] = self._extract_profile_params(item["material_name"])
        
        return item
    
    def _safe(self, value) -> Optional[str]:
        """Безопасное преобразование в строку"""
        if pd.isna(value):
            return None
        return str(value).strip() if value not in (None, "", "nan") else None
    
    def _parse_date(self, date_str) -> Optional[datetime]:
        """Парсит дату из строки"""
        if isinstance(date_str, datetime):
            return date_str
        try:
            if pd.notna(date_str):
                str_date = str(date_str).strip()
                for fmt in ["%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"]:
                    try:
                        return datetime.strptime(str_date, fmt)
                    except ValueError:
                        continue
        except Exception as e:
            logger.debug(f"Date parse error: {e}")
        return None
    
    def _ensure_unique_requirement_material(self, items_with_positions: List[Tuple[Dict, int]]) -> List[Tuple[Dict, int]]:
        """
        Обеспечивает уникальность requirement + material_name
        Добавляет суффиксы к дубликатам
        """
        seen = {}
        result = []
        
        for item, pos in items_with_positions:
            req_num = item.get('requirement_number', '')
            material = item.get('material_name', '')
            key = f"{req_num}_{material}"
            
            if key in seen:
                seen[key] += 1
                item['material_name'] = f"{material} ({seen[key]})"
                logger.debug(f"Renamed duplicate at pos {pos}: {material} -> {item['material_name']}")
            else:
                seen[key] = 1
            
            result.append((item, pos))
        
        return result
    
    def _detect_profile_type(self, material_name: str) -> str:
        """Определяет тип профиля"""
        name_lower = material_name.lower()
        
        if any(word in name_lower for word in ['труб', 'тр.', 'tr.']):
            return 'pipe'
        elif any(word in name_lower for word in ['арматур', 'armature']):
            return 'rebar'
        elif any(word in name_lower for word in ['балк', 'balc']):
            return 'beam'
        elif any(word in name_lower for word in ['лист', 'list']):
            return 'sheet'
        elif any(word in name_lower for word in ['угол', 'ugol']):
            return 'angle'
        else:
            return 'other'
    
    def _extract_profile_params(self, material_name: str) -> Dict[str, Any]:
        """Извлекает параметры профиля"""
        params = {}
        name_lower = material_name.lower()
        
        if 'труб' in name_lower:
            pipe_pattern = r'(\d+)[\sхx*\/]+(\d+)'
            match = re.search(pipe_pattern, name_lower)
            if match:
                params['d'] = float(match.group(1))
                params['t'] = float(match.group(2))
        
        return params


# Функция для удобного импорта
def parse_defect_sheet(file_path: Path) -> Tuple[List[Dict], Dict]:
    """Удобная обертка для парсинга"""
    parser = DefectSheetParser()
    return parser.parse_file(file_path)