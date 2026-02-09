// frontend/src/utils/excelExport.js
import * as XLSX from 'xlsx';

/**
 * Экспорт реестра в XLS (старый формат Excel)
 */
export const exportRegistryToExcel = (rows, batchId) => {
  if (!rows || !rows.length) {
    alert("Нет данных для экспорта");
    return false;
  }

  try {
    // Подготавливаем данные (только те поля, которые видны в таблице)
    const exportData = rows.map((row) => {
      const invoiceDetails = row.invoice_details || {};
      
      // Формируем текст счета
      let invoiceText = "";
      if (invoiceDetails.invoice_full_text) {
        invoiceText = invoiceDetails.invoice_full_text;
      } else if (invoiceDetails.invoice_number && invoiceDetails.invoice_date) {
        invoiceText = `Счет на оплату № ${invoiceDetails.invoice_number} от ${invoiceDetails.invoice_date}`;
      }

      // ТОЛЬКО ПОЛЯ ИЗ ТАБЛИЦЫ (без № и технических полей)
      return {
        "Поставщик": row.supplier || "",
        "Реквизиты счета": invoiceText,
        "Контрагент": row.contractor || "",
        "Плательщик": row.payer || "Сибуглеснаб",
        "Сумма": row.amount || 0,
        "в т.ч НДС": row.vat_amount || 0,
        "Учтено": row.included_in_plan ? "Да" : "Нет",
        "Система расчетов": row.payment_system || "Предоплата",
        "Комментарий": row.comment || "",
        "Техника": row.vehicle || "",
        "г.н": row.license_plate || "",
      };
    });

    // Создаем рабочую книгу
    const workbook = XLSX.utils.book_new();
    
    // Основной лист с данными
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Настраиваем ширину колонок
    const colWidths = [
      { wch: 20 }, // Поставщик
      { wch: 40 }, // Реквизиты счета
      { wch: 25 }, // Контрагент
      { wch: 15 }, // Плательщик
      { wch: 12 }, // Сумма
      { wch: 10 }, // в т.ч НДС
      { wch: 8 },  // Учтено
      { wch: 15 }, // Система расчетов
      { wch: 30 }, // Комментарий
      { wch: 20 }, // Техника
      { wch: 10 }, // г.н
    ];
    worksheet['!cols'] = colWidths;
    
    // Добавляем заголовок и метаданные
    const titleData = [
      ["Реестр платежей"],
      [`Дата экспорта: ${new Date().toLocaleString('ru-RU')}`],
      [`Всего строк: ${rows.length}`],
      [`С привязанными счетами: ${rows.filter(r => r.invoice_id).length}`],
      [`Batch ID: ${batchId || 'не указан'}`],
      [], // пустая строка
    ];
    
    XLSX.utils.sheet_add_aoa(worksheet, titleData, { origin: 'A1' });
    
    // Сдвигаем данные под заголовок
    const dataStartRow = titleData.length;
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    range.s.r = dataStartRow;
    worksheet['!ref'] = XLSX.utils.encode_range(range);
    
    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(workbook, worksheet, "Реестр");

    // Генерируем файл в старом формате XLS
    const fileName = `реестр_${batchId ? batchId.slice(0, 8) : "без_batch"}_${new Date().toISOString().slice(0, 10)}.xls`;
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xls', // Старый формат для совместимости
      type: 'array'
    });
    
    // Скачиваем файл
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.ms-excel'
    });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
    
  } catch (error) {
    console.error("Ошибка при экспорте в Excel:", error);
    alert(`Ошибка при экспорте: ${error.message}`);
    return false;
  }
};