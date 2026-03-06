
"""
Парсер для дефектных ведомостей (акты списания металлопроката)
Точная версия под ваш файл поТипуТреб.xlsx
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
    Точная версия под структуру поТипуТреб.xlsx
    """
    
    # Регулярные выражения
    REQUIREMENT_PATTERN = re.compile(r'Требование:\s*(\d+)')
    DATE_PATTERN = re.compile(r'(\d{2})\.(\d{2})\.(\d{4})')
    
    def __init__(self):
        self.period_start = None
        self.period_end = None
        
    def parse_file_with_positions(self, file_path: Path) -> List[Tuple[Dict[str, Any], int]]:
        """
        Основной метод парсинга, возвращающий данные с уникальными позициями.
        """
        logger.info(f"Parsing defect sheet with positions: {file_path}")
        
        df = self._safe_read_excel(file_path)
        self._extract_period(df)
        
        results = self._parse_rows_with_positions(df)
        
        logger.info(f"Parsed {len(results)} items from defect sheet")
        return results
    
    def parse_file(self, file_path: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Совместимый метод
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
        # Попытка 1: стандартный pandas
        try:
            logger.debug("Attempting to read with pandas/openpyxl...")
            return pd.read_excel(file_path, header=None, dtype=str)
        except Exception as e:
            logger.warning(f"Pandas/openpyxl failed: {e}")
        
        # Попытка 2: xlsx2csv конвертация
        try:
            logger.debug("Attempting to read via xlsx2csv conversion...")
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
                csv_path = f.name
            
            Xlsx2csv(str(file_path)).convert(csv_path)
            df = pd.read_csv(csv_path, header=None, dtype=str, encoding='utf-8')
            os.unlink(csv_path)
            
            logger.info("Successfully read via xlsx2csv fallback")
            return df
            
        except Exception as e:
            logger.error(f"xlsx2csv fallback also failed: {e}")
            logger.warning("Creating empty DataFrame as last resort")
            return pd.DataFrame()
    
    def _extract_period(self, df: pd.DataFrame):
        """Извлекает период из первой строки"""
        try:
            if df.empty:
                return
            
            # Первая строка, первая колонка содержит период
            first_cell = df.iloc[0, 0] if not df.empty else ""
            if isinstance(first_cell, str):
                # Ищем даты в формате ДД.ММ.ГГГГ
                dates = self.DATE_PATTERN.findall(first_cell)
                if len(dates) >= 2:
                    # dates[0] = ('01', '03', '2026')
                    # dates[1] = ('31', '03', '2026')
                    start_day, start_month, start_year = dates[0]
                    end_day, end_month, end_year = dates[1]
                    
                    self.period_start = datetime.strptime(f"{start_day}.{start_month}.{start_year}", "%d.%m.%Y")
                    self.period_end = datetime.strptime(f"{end_day}.{end_month}.{end_year}", "%d.%m.%Y")
                    
                    logger.info(f"Found period: {self.period_start} - {self.period_end}")
                    
        except Exception as e:
            logger.warning(f"Could not extract period: {e}")
    
    def _parse_rows_with_positions(self, df: pd.DataFrame) -> List[Tuple[Dict[str, Any], int]]:
        """
        Парсит строки документа согласно точной структуре файла.
        
        Структура файла:
        - Строка 0: заголовок с периодом
        - Строка 1: пустая
        - Строка 2: заголовки колонок
        - Строка 3: пустая
        - Строка 4: Требование: XXX
        - Строки 5+: данные
        """
        results = []
        current_requirement = None
        current_date = None
        
        # Счетчик для уникальных позиций
        unique_position_counter = 0
        # Для отслеживания уже обработанных строк
        seen_rows = set()
        
        # Начинаем с 4 строки (индекс 4), где первое требование
        for idx in range(4, len(df)):
            row = df.iloc[idx]
            
            # Проверяем, не пустая ли строка
            if pd.isna(row[0]) or str(row[0]).strip() == '':
                # Проверяем, может это строка с требованием?
                first_cell = str(row[0]) if pd.notna(row[0]) else ""
                if first_cell and 'Требование:' in first_cell:
                    req_match = self.REQUIREMENT_PATTERN.search(first_cell)
                    if req_match:
                        current_requirement = req_match.group(1)
                        logger.debug(f"Found requirement: {current_requirement}")
                continue
            
            first_cell = str(row[0]).strip() if pd.notna(row[0]) else ""
            
            # Если это требование в первой колонке
            if 'Требование:' in first_cell:
                req_match = self.REQUIREMENT_PATTERN.search(first_cell)
                if req_match:
                    current_requirement = req_match.group(1)
                    logger.debug(f"Found requirement: {current_requirement}")
                continue
            
            # Проверяем, является ли строка данными (№ п/п - число)
            if first_cell and first_cell.replace('.', '').replace(',', '').isdigit():
                try:
                    excel_position = int(float(first_cell))
                except ValueError:
                    excel_position = int(first_cell) if first_cell.isdigit() else None
                
                # Парсим строку данных
                item = self._parse_data_row(
                    row=row,
                    requirement=current_requirement,
                    excel_position=excel_position
                )
                
                if item:
                    # Создаем ключ для проверки дубликатов
                    row_key = (
                        item['requirement_number'],
                        item['excel_position'],
                        item['material_name'],
                        item['requested_quantity']
                    )
                    
                    # Проверяем, не дубликат ли это
                    if row_key not in seen_rows:
                        seen_rows.add(row_key)
                        results.append((item, unique_position_counter))
                        unique_position_counter += 1
                    else:
                        logger.debug(f"Skipping duplicate row at index {idx}")
        
        logger.info(f"Generated {unique_position_counter} unique positions")
        return results
    
    def _parse_data_row(self, row: pd.Series, requirement: Optional[str], 
                       excel_position: Optional[int]) -> Optional[Dict[str, Any]]:
        """
        Парсит строку с данными.
        
        Индексы колонок в файле:
        col 0: № п/п
        col 1: Дата требования
        col 2: Марка
        col 3: Гос.номер
        col 4: (пустая колонка) - пропускаем
        col 5: Получатель
        col 6: Номенкл. номер
        col 7: Наименование зап.части
        col 8: Затреб (в тоннах)
        col 9: Кол-во (не используется)
        col 10: Провед (не используется)
        col 11: Напечат. (не используется)
        """
        try:
            # Проверяем наличие обязательных полей
            if len(row) <= 8:
                logger.warning(f"Row has insufficient columns: {len(row)}")
                return None
            
            # Извлекаем дату (col 1)
            date_value = row[1] if len(row) > 1 and pd.notna(row[1]) else None
            requirement_date = self._parse_date(date_value) if date_value else None
            
            # Извлекаем марку/адрес (col 2)
            address = str(row[2]).strip() if len(row) > 2 and pd.notna(row[2]) else None
            if address in ('', 'nan', 'None'):
                address = None
            
            # Извлекаем госномер (col 3)
            license_plate = str(row[3]).strip() if len(row) > 3 and pd.notna(row[3]) else None
            if license_plate in ('', 'nan', 'None', 'нет'):
                license_plate = None
            
            # Извлекаем получателя (col 5)
            recipient = str(row[5]).strip() if len(row) > 5 and pd.notna(row[5]) else None
            if recipient in ('', 'nan', 'None'):
                recipient = None
            
            # Извлекаем номенклатурный номер/артикул (col 6)
            article = str(row[6]).strip() if len(row) > 6 and pd.notna(row[6]) else None
            if article in ('', 'nan', 'None'):
                article = None
            
            # Извлекаем наименование материала (col 7) - обязательное поле
            material_name = str(row[7]).strip() if len(row) > 7 and pd.notna(row[7]) else None
            if not material_name or material_name in ('', 'nan', 'None'):
                logger.debug(f"Skipping row without material name at position {excel_position}")
                return None
            
            # Извлекаем количество (col 8) - обязательное поле
            quantity_str = str(row[8]).strip() if len(row) > 8 and pd.notna(row[8]) else None
            quantity = None
            if quantity_str and quantity_str not in ('', 'nan', 'None'):
                # Заменяем запятую на точку и убираем лишние символы
                quantity_str = quantity_str.replace(',', '.').strip()
                quantity_str = re.sub(r'[^\d\.\-]', '', quantity_str)
                try:
                    quantity = float(quantity_str) if quantity_str else None
                except ValueError:
                    logger.debug(f"Could not parse quantity: {quantity_str}")
            
            # Создаем запись
            item = {
                "excel_position": excel_position,
                "subposition": 1,
                "requirement_number": requirement,
                "requirement_date": requirement_date,
                "address": address,
                "license_plate": license_plate,
                "recipient": recipient,
                "article": article,
                "material_name": material_name,
                "requested_quantity": quantity,
                "weight_tons": quantity,
            }
            
            # Определяем тип профиля
            if item["material_name"]:
                item["profile_type"] = self._detect_profile_type(item["material_name"])
                item["profile_params"] = self._extract_profile_params(item["material_name"])
            
            return item
            
        except Exception as e:
            logger.error(f"Error parsing data row: {e}")
            return None
    
    def _parse_date(self, date_str) -> Optional[datetime]:
        """Парсит дату из строки"""
        try:
            if pd.isna(date_str):
                return None
            
            if isinstance(date_str, datetime):
                return date_str
            
            str_date = str(date_str).strip()
            # Очищаем от лишних символов
            str_date = re.sub(r'[^\d\.]', '', str_date)
            
            # Пробуем разные форматы
            for fmt in ["%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"]:
                try:
                    return datetime.strptime(str_date, fmt)
                except ValueError:
                    continue
        except Exception as e:
            logger.debug(f"Date parse error: {e}")
        return None
    
    def _detect_profile_type(self, material_name: str) -> str:
        """Определяет тип профиля из наименования"""
        name_lower = material_name.lower()
        
        if any(word in name_lower for word in ['труб', 'тр.', 'tr.', 'ду']):
            return 'pipe'
        elif any(word in name_lower for word in ['вентиль', 'задвижк', 'клапан', 'кран']):
            return 'valve'
        elif any(word in name_lower for word in ['арматур', 'armature', 'а400', 'а500']):
            return 'rebar'
        elif any(word in name_lower for word in ['балк', 'balc', 'двутавр', 'швеллер']):
            return 'beam'
        elif any(word in name_lower for word in ['лист', 'list', 'лст']):
            return 'sheet'
        elif any(word in name_lower for word in ['угол', 'ugol', 'уголок']):
            return 'angle'
        else:
            return 'other'
    
    def _extract_profile_params(self, material_name: str) -> Dict[str, Any]:
        """Извлекает параметры профиля из наименования"""
        params = {}
        name_lower = material_name.lower()
        
        # Для труб: ищем диаметр х толщина
        if 'труб' in name_lower or 'ду' in name_lower:
            # Паттерны: 32*3,2 ; 100х5 ; 159*6
            pipe_patterns = [
                r'(\d+)[\s*]?[\*хx][\s*]?(\d+(?:[.,]\d+)?)',  # 32*3,2 или 100х5
                r'ду\s*(\d+)[\s*]?[\*хx][\s*]?(\d+(?:[.,]\d+)?)',  # ду 32*3,2
                r'dn\s*(\d+)[\s*]?[\*хx][\s*]?(\d+(?:[.,]\d+)?)',  # dn 32*3,2
            ]
            
            for pattern in pipe_patterns:
                match = re.search(pattern, name_lower)
                if match:
                    try:
                        params['d'] = float(match.group(1))
                        t_str = match.group(2).replace(',', '.')
                        params['t'] = float(t_str)
                        break
                    except ValueError:
                        continue
        
        # Для вентилей: ищем Ду (диаметр условный)
        elif 'вентиль' in name_lower:
            du_patterns = [
                r'ду\s*(\d+)',
                r'dn\s*(\d+)',
                r'(\d+)\s*[бb][пp]',  # 15б1п -> диаметр 15
            ]
            
            for pattern in du_patterns:
                match = re.search(pattern, name_lower)
                if match:
                    try:
                        params['dn'] = float(match.group(1))
                        break
                    except ValueError:
                        continue
        
        return params


# Функция для удобного импорта
def parse_defect_sheet(file_path: Path) -> Tuple[List[Dict], Dict]:
    """Удобная обертка для парсинга"""
    parser = DefectSheetParser()
    return parser.parse_file(file_path)
# Добавляем поля, которые ожидает фронтенд
    for i, item in enumerate(items):
        # Убеждаемся, что есть поле id
        if 'id' not in item:
            item['id'] = i + 1  # временный id, будет заменен БД
        # Убеждаемся, что есть поле position
        if 'position' not in item:
            item['position'] = item.get('excel_position', i + 1)
        # Убеждаемся, что все числовые поля - float
        if item.get('requested_quantity'):
            item['requested_quantity'] = float(item['requested_quantity'])
        if item.get('weight_tons'):
            item['weight_tons'] = float(item['weight_tons'])
    
    return items, metadata