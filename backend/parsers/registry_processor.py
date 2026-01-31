"""
Главный процессор реестра:
1. Парсит Excel-файл с заявками
2. Для каждой заявки парсит соответствующий PDF-счет
3. Сопоставляет данные из Excel с данными из PDF
"""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from .excel_parser import ExcelParser
from .invoice_parser import parse_invoice_from_pdf
from .universal_parser import extract_metadata_universal

log = logging.getLogger(__name__)


class RegistryProcessor:
    """
    Основной класс для обработки реестра.
    Связывает данные из Excel с данными из PDF счетов.
    """
    
    def __init__(self):
        self.excel_parser = ExcelParser()
        self.processed_invoices = {}  # Кэш распарсенных счетов
    
    def process_registry(self, excel_path: str, invoices_dir: str) -> List[Dict[str, Any]]:
        """
        Основной метод обработки реестра.
        
        Args:
            excel_path: путь к Excel-файлу с заявками
            invoices_dir: директория с PDF-счетами
            
        Returns:
            List[Dict]: объединенные данные для реестра
        """
        log.info(f"Processing registry: {excel_path}")
        
        # 1. Парсим Excel с заявками
        excel_data = self.excel_parser.parse_file(excel_path)
        log.info(f"Parsed {len(excel_data)} records from Excel")
        
        # 2. Для каждой заявки ищем соответствующий PDF-счет
        registry_data = []
        
        for record in excel_data:
            try:
                # Ищем PDF-счет для этой заявки
                pdf_path = self._find_invoice_for_record(record, invoices_dir)
                
                if pdf_path:
                    # Парсим PDF-счет
                    invoice_data = self._parse_invoice(pdf_path)
                    
                    # Объединяем данные
                    combined = self._combine_data(record, invoice_data)
                    registry_data.append(combined)
                    
                    log.info(f"✓ Processed: {record.get('request_number')} -> {os.path.basename(pdf_path)}")
                else:
                    # Если счет не найден, используем только данные из Excel
                    record['invoice_found'] = False
                    record['invoice_parsed'] = False
                    record['invoice_error'] = "PDF счет не найден"
                    registry_data.append(record)
                    log.warning(f"✗ Invoice not found for record: {record.get('request_number')}")
                    
            except Exception as e:
                log.error(f"Error processing record {record.get('request_number')}: {e}")
                # Сохраняем данные из Excel даже при ошибке
                record['invoice_error'] = str(e)
                registry_data.append(record)
        
        log.info(f"Registry processing complete: {len(registry_data)} records")
        return registry_data
    
    def _find_invoice_for_record(self, record: Dict[str, Any], invoices_dir: str) -> Optional[str]:
        """
        Ищет PDF-счет для записи реестра.
        
        Логика поиска:
        1. По номеру заявки в названии файла
        2. По артикулу/названию товара
        3. По номеру счета из Excel (если есть)
        """
        if not os.path.exists(invoices_dir):
            return None
        
        # Ключевые слова для поиска
        search_terms = []
        
        # 1. Номер заявки
        request_number = record.get('request_number')
        if request_number:
            search_terms.append(str(request_number))
        
        # 2. Артикул
        article = record.get('article')
        if article:
            search_terms.append(str(article))
        
        # 3. Название товара (первые слова)
        item_name = record.get('item_name')
        if item_name:
            # Берем первые 2-3 слова из названия
            words = str(item_name).split()[:3]
            search_terms.extend(words)
        
        # 4. Номер счета (если есть в данных Excel)
        # (может быть отдельное поле в вашем Excel)
        
        # Ищем файлы в директории
        for filename in os.listdir(invoices_dir):
            if filename.lower().endswith('.pdf'):
                # Проверяем все поисковые термины
                for term in search_terms:
                    if term and term.lower() in filename.lower():
                        return os.path.join(invoices_dir, filename)
        
        return None
    
    def _parse_invoice(self, pdf_path: str) -> Dict[str, Any]:
        """
        Парсит PDF-счет с кэшированием.
        """
        # Используем кэш для ускорения
        if pdf_path in self.processed_invoices:
            return self.processed_invoices[pdf_path]
        
        try:
            # Используем наш парсер PDF
            invoice_data = parse_invoice_from_pdf(pdf_path)
            self.processed_invoices[pdf_path] = invoice_data
            return invoice_data
            
        except Exception as e:
            log.error(f"Error parsing invoice {pdf_path}: {e}")
            return {
                'data': {'error': str(e), 'metadata_found': False},
                'lines': [],
                'confidence': 0.0
            }
    
    def _combine_data(self, excel_record: Dict[str, Any], invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Объединяет данные из Excel с данными из PDF.
        """
        combined = excel_record.copy()
        
        # Флаги о наличии счета
        combined['invoice_found'] = True
        combined['invoice_parsed'] = invoice_data.get('confidence', 0) > 0.3
        combined['invoice_confidence'] = invoice_data.get('confidence', 0)
        
        # Метаданные из PDF (всегда есть если парсер отработал)
        metadata = invoice_data.get('data', {})
        
        # 1. КОНТРАГЕНТ (самое важное для реестра!)
        if metadata.get('contractor'):
            combined['contractor'] = metadata['contractor']
        else:
            combined['contractor'] = None
            combined['contractor_error'] = "Не найден в счете"
        
        # 2. РЕКВИЗИТЫ СЧЕТА
        if metadata.get('invoice_number'):
            combined['invoice_number'] = metadata['invoice_number']
        
        if metadata.get('invoice_date'):
            invoice_date = metadata['invoice_date']
            if isinstance(invoice_date, str):
                combined['invoice_date'] = invoice_date
            else:
                combined['invoice_date'] = invoice_date.strftime('%d.%m.%Y') if hasattr(invoice_date, 'strftime') else str(invoice_date)
        
        # 3. СУММА СЧЕТА
        if metadata.get('total'):
            combined['invoice_total'] = metadata['total']
        
        # 4. ТОВАРЫ ИЗ СЧЕТА
        invoice_lines = invoice_data.get('lines', [])
        if invoice_lines:
            combined['invoice_items'] = invoice_lines
            combined['invoice_items_count'] = len(invoice_lines)
            
            # Проверяем соответствие товара из Excel с товарами из счета
            item_match = self._find_item_match(excel_record, invoice_lines)
            if item_match:
                combined['item_match_found'] = True
                combined['matched_item_price'] = item_match.get('price')
                combined['matched_item_total'] = item_match.get('total')
                combined['matched_item_qty'] = item_match.get('qty')
            else:
                combined['item_match_found'] = False
        else:
            combined['invoice_items'] = []
            combined['invoice_items_count'] = 0
            combined['item_match_found'] = False
        
        # 5. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
        if metadata.get('inn'):
            combined['supplier_inn'] = metadata['inn']
        
        if metadata.get('account'):
            combined['supplier_account'] = metadata['account']
        
        # 6. ОШИБКИ (если есть)
        if metadata.get('error'):
            combined['invoice_error'] = metadata['error']
        
        return combined
    
    def _find_item_match(self, excel_record: Dict[str, Any], invoice_items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Ищет соответствие товара из Excel в товарах из счета.
        """
        excel_item_name = excel_record.get('item_name', '').lower()
        excel_article = excel_record.get('article', '').lower()
        
        for item in invoice_items:
            item_description = item.get('description', '').lower()
            
            # Проверяем совпадение по названию
            if excel_item_name and any(word in item_description for word in excel_item_name.split()[:3]):
                return item
            
            # Проверяем совпадение по артикулу
            if excel_article and excel_article in item_description:
                return item
        
        return None


# -------------------------------------------------
# УТИЛИТЫ ДЛЯ ВЫВОДА РЕЗУЛЬТАТОВ
# -------------------------------------------------

def print_registry_summary(registry_data: List[Dict[str, Any]]) -> None:
    """Выводит сводку по обработанному реестру"""
    print("\n" + "="*80)
    print("РЕЕСТР: СВОДКА ОБРАБОТКИ")
    print("="*80)
    
    total_records = len(registry_data)
    invoices_found = sum(1 for r in registry_data if r.get('invoice_found'))
    invoices_parsed = sum(1 for r in registry_data if r.get('invoice_parsed'))
    contractors_found = sum(1 for r in registry_data if r.get('contractor'))
    items_matched = sum(1 for r in registry_data if r.get('item_match_found'))
    
    print(f"Всего записей в реестре: {total_records}")
    print(f"Найдено счетов PDF: {invoices_found} ({invoices_found/total_records*100:.1f}%)")
    print(f"Успешно распарсено счетов: {invoices_parsed} ({invoices_parsed/total_records*100:.1f}%)")
    print(f"Найдено контрагентов: {contractors_found} ({contractors_found/total_records*100:.1f}%)")
    print(f"Совпадений товаров: {items_matched} ({items_matched/total_records*100:.1f}%)")
    
    print("\nДЕТАЛИ ПО ЗАПИСЯМ:")
    print("-" * 80)
    
    for i, record in enumerate(registry_data, 1):
        status = "✓" if record.get('invoice_parsed') else "✗"
        contractor = record.get('contractor', 'НЕ НАЙДЕН')
        invoice_num = record.get('invoice_number', 'НЕТ')
        match = "✓" if record.get('item_match_found') else "✗"
        
        print(f"{i:3d}. [{status}] Заявка {record.get('request_number')} -> "
              f"Счет: {invoice_num}, Контрагент: {contractor[:30]}, "
              f"Товар: {match}")
    
    print("="*80)


def export_to_excel(registry_data: List[Dict[str, Any]], output_path: str) -> None:
    """Экспортирует реестр в Excel"""
    import pandas as pd
    
    # Подготавливаем данные для экспорта
    export_data = []
    
    for record in registry_data:
        # Базовые поля из Excel
        export_record = {
            'Номер заявки': record.get('request_number'),
            'Дата заявки': record.get('request_date'),
            'Марка авто': record.get('car_brand'),
            'Госномер': record.get('license_plate'),
            'Наименование': record.get('item_name'),
            'Артикул': record.get('article'),
            'Количество': record.get('quantity'),
            'Согласовано': 'Да' if record.get('approved') else 'Нет',
            'Дата выполнения': record.get('completion_date'),
        }
        
        # Данные из счета
        export_record.update({
            'Найден счет': 'Да' if record.get('invoice_found') else 'Нет',
            'Распарсен счет': 'Да' if record.get('invoice_parsed') else 'Нет',
            'Достоверность': f"{record.get('invoice_confidence', 0)*100:.1f}%",
            'Контрагент': record.get('contractor', ''),
            'Номер счета': record.get('invoice_number', ''),
            'Дата счета': record.get('invoice_date', ''),
            'Сумма счета': record.get('invoice_total', ''),
            'ИНН поставщика': record.get('supplier_inn', ''),
            'Счет поставщика': record.get('supplier_account', ''),
            'Совпадение товара': 'Да' if record.get('item_match_found') else 'Нет',
            'Цена (из счета)': record.get('matched_item_price', ''),
            'Кол-во (из счета)': record.get('matched_item_qty', ''),
            'Сумма (из счета)': record.get('matched_item_total', ''),
        })
        
        export_data.append(export_record)
    
    # Создаем DataFrame и экспортируем
    df = pd.DataFrame(export_data)
    df.to_excel(output_path, index=False)
    
    print(f"\n✓ Реестр экспортирован в: {output_path}")
    print(f"  Всего записей: {len(export_data)}")


# -------------------------------------------------
# ГЛАВНАЯ ФУНКЦИЯ
# -------------------------------------------------

def process_registry(excel_path: str, invoices_dir: str, 
                     output_excel: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Главная функция для обработки всего реестра.
    
    Args:
        excel_path: путь к Excel-файлу заявок
        invoices_dir: директория с PDF-счетами
        output_excel: путь для экспорта результата (опционально)
        
    Returns:
        List[Dict]: обработанные данные реестра
    """
    processor = RegistryProcessor()
    
    # Обрабатываем реестр
    registry_data = processor.process_registry(excel_path, invoices_dir)
    
    # Выводим сводку
    print_registry_summary(registry_data)
    
    # Экспортируем в Excel если нужно
    if output_excel:
        export_to_excel(registry_data, output_excel)
    
    return registry_data