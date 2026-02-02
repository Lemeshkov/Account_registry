
// import React, { useEffect, useState, useCallback } from "react";
// import InvoiceMatchModal from "./InvoiceMatchModal";
// import "../styles.css";

// const PAYERS = ["Сибуглеснаб", "ООО Ромашка", "ИП Иванов"];
// const PAYMENT_SYSTEMS = ["Предоплата", "Постоплата"];

// const RegistryPreview = ({ data, onReload }) => {
//   const [rows, setRows] = useState([]);
//   const [matchInvoice, setMatchInvoice] = useState(null);
//   const [availableInvoices, setAvailableInvoices] = useState([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [debugInfo, setDebugInfo] = useState("");
//   const [batchId, setBatchId] = useState("");
//   const [selectedRowIndex, setSelectedRowIndex] = useState(null);

//   // Инициализация строк - СОВМЕСТИМЫЙ ФОРМАТ
//   useEffect(() => {
//     console.log("📊 Data received in RegistryPreview:", data);
    
//     // Определяем формат данных
//     let registryData = [];
//     let extractedBatchId = "";
    
//     if (Array.isArray(data)) {
//       // Старый формат: data - это массив
//       console.log("✅ Old format: data is array");
//       registryData = data;
//     } else if (data && typeof data === 'object') {
//       // Новый формат: data - это объект
//       console.log("✅ New format: data is object, keys:", Object.keys(data));
      
//       if (data.registry_preview && Array.isArray(data.registry_preview)) {
//         // Формат с registry_preview
//         registryData = data.registry_preview;
//       } else if (Array.isArray(data)) {
//         // На случай если data уже массив
//         registryData = data;
//       } else {
//         // Ищем любой массив в объекте
//         for (const key in data) {
//           if (Array.isArray(data[key]) && data[key].length > 0) {
//             console.log(`✅ Found array in key: ${key}`);
//             registryData = data[key];
//             break;
//           }
//         }
//       }
//     }
    
//     if (registryData.length > 0) {
//       console.log(`✅ Using ${registryData.length} registry items`);
//       setDebugInfo(`Получено ${registryData.length} строк реестра`);
      
//       const formattedRows = registryData.map((r) => ({
//         ...r,
//         payer: r.payer || "Сибуглеснаб",
//         payment_system: r.payment_system || "Предоплата",
//         included_in_plan: true,
//       }));
      
//       setRows(formattedRows);
      
//       // Извлекаем batch_id из данных
//       if (formattedRows.length > 0) {
//         // Пробуем разные возможные источники batch_id
//         const possibleBatchId = 
//           formattedRows[0].batch_id || 
//           formattedRows[0].imported_batch ||
//           (data && data.batch_id);
        
//         if (possibleBatchId) {
//           setBatchId(possibleBatchId);
//           extractedBatchId = possibleBatchId;
//           console.log(`✅ Extracted batch_id: ${possibleBatchId}`);
//         }
//       }
      
//       // Логируем информацию о счетах
//       const rowsWithInvoice = formattedRows.filter(r => r.invoice_id).length;
//       console.log(`📊 Строк с привязанными счетами: ${rowsWithInvoice}/${formattedRows.length}`);
//     } else {
//       console.log("⚠️ No registry data found");
//       setDebugInfo("Нет данных реестра");
//       setRows([]);
//     }
    
//   }, [data]);

//   // Функция для загрузки счетов
//   const loadInvoices = useCallback((batchId) => {
//     if (!batchId) {
//       console.log("⚠️ No batch_id provided for loading invoices");
//       setDebugInfo("Ошибка: batch_id не найден для загрузки счетов");
//       return;
//     }
    
//     setIsLoading(true);
//     setDebugInfo(`Загрузка счетов для batch: ${batchId}`);
//     console.log(`🔄 Загрузка счетов для batch: ${batchId}`);
    
//     fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
//       .then(res => {
//         console.log(`✅ Response status: ${res.status}`);
//         if (!res.ok) {
//           throw new Error(`HTTP ${res.status}`);
//         }
//         return res.json();
//       })
//       .then(result => {
//         console.log("📦 API Response for invoices:", result);
        
//         if (result && Array.isArray(result.invoices)) {
//           console.log(`✅ Найдено ${result.invoices.length} счетов в буфере`);
//           setAvailableInvoices(result.invoices);
//           setDebugInfo(`Найдено счетов: ${result.invoices.length}`);
//         } else if (result && Array.isArray(result)) {
//           // На случай если endpoint возвращает сразу массив
//           console.log(`✅ Найдено ${result.length} счетов (direct array)`);
//           setAvailableInvoices(result);
//           setDebugInfo(`Найдено счетов: ${result.length}`);
//         } else {
//           console.log("⚠️ Нет счетов в буфере или неверный формат ответа:", result);
//           setDebugInfo("Нет счетов в буфере");
//           setAvailableInvoices([]);
//         }
//       })
//       .catch(err => {
//         console.error("❌ Ошибка загрузки счетов:", err);
//         setDebugInfo(`Ошибка: ${err.message}`);
//         setAvailableInvoices([]);
//       })
//       .finally(() => {
//         setIsLoading(false);
//       });
//   }, []);

//   // Загружаем доступные счета из буфера при наличии batchId
//   useEffect(() => {
//     if (batchId) {
//       loadInvoices(batchId);
//     }
//   }, [batchId, loadInvoices]);

//   const updateRow = (index, field, value) => {
//     setRows((prev) =>
//       prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
//     );
//   };

//   const handleRowSelect = (index) => {
//     setSelectedRowIndex(index);
//   };

//   const handleMatchClick = () => {
//     if (selectedRowIndex === null) {
//       alert("Пожалуйста, выберите строку реестра для сопоставления");
//       return;
//     }
    
//     const row = rows[selectedRowIndex];
//     console.log("🎯 Match click on selected row:", row);
    
//     // Открываем модалку
//     setMatchInvoice({
//       id: row.invoice_id || null,
//       details: row.invoice_details || {},
//       filename: row.invoice_details?.file || `Счет из буфера`,
//       registryRow: row,
//       registryRowIndex: selectedRowIndex,
//       batchId: batchId || row.batch_id || rows[0]?.batch_id
//     });
//   };

//   const handleManualApply = (invoiceId, registryId, applyType, lineNo) => {
//     setIsLoading(true);
//     setDebugInfo(`Применение счета ${invoiceId.slice(0,8)}...`);
    
//     let endpoint, requestBody;
    
//     if (applyType === "full" && lineNo !== undefined) {
//       endpoint = "http://localhost:8000/invoice/apply-line";
//       requestBody = {
//         invoice_id: invoiceId,
//         line_no: lineNo,
//         registry_id: registryId,
//       };
//     } else {
//       endpoint = "http://localhost:8000/invoice/manual-match";
//       const currentBatchId = batchId || rows[0]?.batch_id;
//       requestBody = {
//         batch_id: currentBatchId,
//         registry_id: registryId,
//         invoice_id: invoiceId,
//         apply_type: applyType
//       };
//     }
    
//     console.log(`📤 Sending to ${endpoint}:`, requestBody);
    
//     fetch(endpoint, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(requestBody),
//     })
//     .then(res => {
//       if (!res.ok) {
//         throw new Error(`HTTP ${res.status}`);
//       }
//       return res.json();
//     })
//     .then(result => {
//       console.log("✅ Apply response:", result);
//       if (result.status === "ok") {
//         alert("✅ Счет успешно применен!");
//         if (onReload) onReload();
//       } else {
//         throw new Error(result.message || "Ошибка применения");
//       }
//     })
//     .catch(err => {
//       console.error("❌ Ошибка применения счета:", err);
//       alert(`❌ Ошибка: ${err.message}`);
//     })
//     .finally(() => {
//       setIsLoading(false);
//       setMatchInvoice(null);
//       setDebugInfo("Готово");
//     });
//   };

//   // Отладочная функция для тестирования endpoint
//   const testEndpoint = () => {
//     if (batchId) {
//       console.log(`🔍 Testing endpoint for batch: ${batchId}`);
      
//       fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
//         .then(res => res.json())
//         .then(data => {
//           console.log("Test response:", data);
//           alert(`Test: Found ${data.invoices?.length || data.length || 0} invoices`);
//         })
//         .catch(err => {
//           console.error("Test error:", err);
//           alert("Test error: " + err.message);
//         });
//     } else {
//       alert("Нет batch_id для теста");
//     }
//   };

//   // Отладочная функция для проверки формата данных
//   const checkDataFormat = () => {
//     console.log("=== DATA FORMAT CHECK ===");
//     console.log("Data:", data);
//     console.log("Rows:", rows);
//     console.log("Batch ID:", batchId);
//     console.log("Available invoices:", availableInvoices.length);
    
//     if (data) {
//       console.log("Data type:", typeof data);
//       console.log("Is array?", Array.isArray(data));
//       if (typeof data === 'object') {
//         console.log("Data keys:", Object.keys(data));
//       }
//     }
//   };

//   if (!rows.length) {
//     return (
//       <div className="requests-table" style={{ textAlign: "center", padding: "40px" }}>
//         <h3>📑 Реестр не сформирован</h3>
//         <p>Загрузите документ, чтобы увидеть предпросмотр</p>
//         {data && (
//           <div style={{ marginTop: "20px", fontSize: "12px", color: "#666" }}>
//             <button 
//               onClick={checkDataFormat}
//               style={{ padding: "5px 10px", marginBottom: "10px" }}
//             >
//               Проверить формат данных
//             </button>
//             <div>Данные получены, но нет строк для отображения</div>
//             <div>Тип данных: {typeof data}</div>
//             {Array.isArray(data) && <div>Массив с {data.length} элементами</div>}
//             {typeof data === 'object' && <div>Объект с ключами: {Object.keys(data).join(", ")}</div>}
//           </div>
//         )}
//       </div>
//     );
//   }

//   return (
//     <div className="registry-container">
//       {/* Фиксированный заголовок */}
//       <div className="registry-header">
//         <div className="header-content">
//           <div className="header-left">
//             <h3>📑 Предпросмотр реестра</h3>
//             <p className="header-stats">
//               Всего строк: <strong>{rows.length}</strong> | 
//               Доступно счетов: <strong style={{ color: availableInvoices.length > 0 ? "#28a745" : "#dc3545" }}>
//                 {availableInvoices.length}
//               </strong>
//               {batchId && ` | Batch: ${batchId.slice(0, 8)}...`}
//               {selectedRowIndex !== null && ` | Выбрана строка: ${selectedRowIndex + 1}`}
//             </p>
//           </div>
//           <div className="header-right">
//             {/* Отладочная информация */}
//             <div className="debug-info">
//               <div>{debugInfo}</div>
//               <div>Формат: {Array.isArray(data) ? "массив" : "объект"}</div>
//             </div>
            
//             {/* Кнопка Сопоставить */}
//             <button 
//               onClick={handleMatchClick}
//               className="header-btn match-btn"
//               disabled={selectedRowIndex === null || !availableInvoices.length || isLoading}
//               title={selectedRowIndex === null ? "Выберите строку реестра" : "Сопоставить счет с выбранной строкой"}
//             >
//                Сопоставить
//             </button>
            
//             {/* Кнопка обновления */}
//             <button 
//               onClick={() => batchId && loadInvoices(batchId)}
//               className="header-btn refresh-btn"
//               title="Обновить список счетов"
//             >
//               🔄 Обновить
//             </button>
            
//             {/* Тестовая кнопка */}
//             <button 
//               onClick={testEndpoint}
//               className="header-btn test-btn"
//               title="Тест endpoint"
//             >
//               🧪 Тест
//             </button>
            
//             {isLoading && <div className="loading-spinner">🔄 Загрузка...</div>}
//           </div>
//         </div>
//       </div>

//       {/* Скроллируемая таблица */}
//       <div className="registry-table-container">
//         <div className="registry-table-wrapper">
//           <table className="registry-table">
//             <thead>
//               <tr>
//                 <th style={{ width: "40px" }}>Выбор</th>
//                 <th>№</th>
//                 <th>Поставщик</th>
//                 <th style={{ minWidth: "300px", width: "350px" }}>Реквизиты счета</th>
//                 <th>Контрагент</th>
//                 <th>Плательщик</th>
//                 <th>Сумма</th>
//                 <th>в т.ч НДС</th>
//                 <th>Учтено</th>
//                 <th>Система расчетов</th>
//                 <th>Комментарий</th>
//                 <th>Техника</th>
//                 <th>г.н</th>
//               </tr>
//             </thead>

//             <tbody>
//               {rows.map((r, i) => {
//                 const d = r.invoice_details || {};
                
//                 // Формируем текст счета для отображения
//                 let invoiceText = "";
//                 let hasInvoiceText = false;
                
//                 if (d.invoice_full_text) {
//                   invoiceText = d.invoice_full_text;
//                   hasInvoiceText = true;
//                 } else if (d.invoice_number && d.invoice_date) {
//                   invoiceText = `Счет на оплату № ${d.invoice_number} от ${d.invoice_date}`;
//                   hasInvoiceText = true;
//                 } else if (d.invoice_number) {
//                   invoiceText = `Счет № ${d.invoice_number}`;
//                   hasInvoiceText = true;
//                 } else if (d.invoice_date) {
//                   invoiceText = `Счет от ${d.invoice_date}`;
//                   hasInvoiceText = true;
//                 }

//                 const hasInvoice = !!r.invoice_id;
//                 const isSelected = selectedRowIndex === i;
                
//                 return (
//                   <tr 
//                     key={i} 
//                     className={`${hasInvoice ? "has-invoice-row" : ""} ${isSelected ? "selected-row" : ""}`}
//                     onClick={() => handleRowSelect(i)}
//                   >
//                     <td>
//                       <div className="selection-cell">
//                         <input
//                           type="radio"
//                           name="selected-row"
//                           checked={isSelected}
//                           onChange={() => handleRowSelect(i)}
//                           title="Выбрать эту строку для сопоставления"
//                         />
//                       </div>
//                     </td>

//                     <td>{r.id}</td>

//                     <td>
//                       <input
//                         className="cell-input"
//                         value={r.supplier || ""}
//                         onChange={(e) => updateRow(i, "supplier", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                         placeholder="Введите поставщика"
//                       />
//                     </td>

//                     <td className="invoice-details-cell">
//                       {hasInvoiceText ? (
//                         <div>
//                           <div className="invoice-title">
//                             {invoiceText}
//                           </div>
//                           {d.total && (
//                             <div className="invoice-amount">
//                               Сумма: {d.total}
//                             </div>
//                           )}
//                           {hasInvoice && (
//                             <div className="invoice-id">
//                               ID: {r.invoice_id?.slice(0, 8)}...
//                             </div>
//                           )}
//                         </div>
//                       ) : (
//                         <span className="no-invoice-text">
//                           Счет не привязан
//                         </span>
//                       )}
//                     </td>

//                     <td>
//                       <div className="contractor-cell">
//                         {r.contractor ? (
//                           <span className="contractor-name">{r.contractor}</span>
//                         ) : (
//                           <span className="empty-field">—</span>
//                         )}
//                       </div>
//                     </td>

//                     <td>
//                       <select
//                         className="payer-select"
//                         value={r.payer}
//                         onChange={(e) => updateRow(i, "payer", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                       >
//                         {PAYERS.map((p) => (
//                           <option key={p} value={p}>
//                             {p}
//                           </option>
//                         ))}
//                       </select>
//                     </td>

//                     <td className="amount-cell">
//                       {r.amount ? (
//                         <span className="amount-value">
//                           {r.amount}
//                         </span>
//                       ) : (
//                         <span className="empty-field">—</span>
//                       )}
//                     </td>

//                     <td>{r.vat_amount || <span className="empty-field">—</span>}</td>

//                     <td className="included-cell">
//                       <span className="included-badge">Да</span>
//                     </td>

//                     <td>
//                       <select
//                         className="payment-system-select"
//                         value={r.payment_system}
//                         onChange={(e) => updateRow(i, "payment_system", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                       >
//                         {PAYMENT_SYSTEMS.map((p) => (
//                           <option key={p} value={p}>
//                             {p}
//                           </option>
//                         ))}
//                       </select>
//                     </td>

//                     <td>
//                       <input
//                         className="cell-input comment-input"
//                         value={r.comment || ""}
//                         onChange={(e) => updateRow(i, "comment", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                         placeholder="Комментарий"
//                       />
//                     </td>

//                     <td>
//                       <input
//                         className="cell-input"
//                         value={r.vehicle || ""}
//                         onChange={(e) => updateRow(i, "vehicle", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                         placeholder="Модель"
//                       />
//                     </td>

//                     <td>
//                       <input
//                         className="cell-input license-plate-input"
//                         value={r.license_plate || ""}
//                         onChange={(e) => updateRow(i, "license_plate", e.target.value)}
//                         onClick={(e) => e.stopPropagation()}
//                         placeholder="A000AA"
//                       />
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {matchInvoice && (
//         <InvoiceMatchModal
//           invoice={matchInvoice}
//           registryRows={rows}
//           availableInvoices={availableInvoices}
//           onClose={() => setMatchInvoice(null)}
//           onApplied={onReload}
//           onManualApply={handleManualApply}
//         />
//       )}

//       {/* Отладочная панель */}
//       <div className="debug-panel">
//         <div className="debug-content">
//           <div>
//             <strong>Отладка:</strong> {debugInfo}
//           </div>
//           <div>
//             <button 
//               onClick={() => {
//                 console.log("=== DEBUG INFO ===");
//                 console.log("Data:", data);
//                 console.log("Rows:", rows);
//                 console.log("Available invoices:", availableInvoices);
//                 console.log("Match invoice:", matchInvoice);
//                 console.log("Batch ID:", batchId);
//               }}
//               className="console-log-btn"
//             >
//               Логи в консоль
//             </button>
//           </div>
//         </div>
//       </div>

//       <style jsx>{`
//         .registry-container {
//           display: flex;
//           flex-direction: column;
//           height: 100vh;
//           max-height: 100vh;
//           overflow: hidden;
//         }
        
//         .registry-header {
//           flex-shrink: 0;
//           padding: 15px 20px;
//           border-bottom: 1px solid #eee;
//           background: #f8f9fa;
//           box-shadow: 0 2px 4px rgba(0,0,0,0.05);
//         }
        
//         .header-content {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           gap: 20px;
//         }
        
//         .header-left {
//           flex: 1;
//         }
        
//         .header-right {
//           display: flex;
//           gap: 10px;
//           align-items: center;
//         }
        
//         .header-stats {
//           color: #666;
//           font-size: 14px;
//           margin: 5px 0 0 0;
//         }
        
//         .debug-info {
//           font-size: 12px;
//           color: #6c757d;
//           text-align: right;
//           margin-right: 10px;
//         }
        
//         .header-btn {
//           padding: 8px 16px;
//           border: none;
//           border-radius: 4px;
//           font-size: 13px;
//           font-weight: 500;
//           cursor: pointer;
//           transition: all 0.2s;
//           display: flex;
//           align-items: center;
//           gap: 6px;
//           white-space: nowrap;
//         }
        
//         .header-btn:disabled {
//           opacity: 0.5;
//           cursor: not-allowed;
//         }
        
//         .match-btn {
//           background-color: #007bff;
//           color: white;
//         }
        
//         .match-btn:hover:not(:disabled) {
//           background-color: #0056b3;
//           transform: translateY(-1px);
//         }
        
//         .refresh-btn {
//           background-color: #6c757d;
//           color: white;
//         }
        
//         .refresh-btn:hover {
//           background-color: #545b62;
//           transform: translateY(-1px);
//         }
        
//         .test-btn {
//           background-color: #ffc107;
//           color: #212529;
//         }
        
//         .test-btn:hover {
//           background-color: #e0a800;
//           transform: translateY(-1px);
//         }
        
//         .registry-table-container {
//           flex: 1;
//           overflow: auto;
//           position: relative;
//         }
        
//         .registry-table-wrapper {
//           overflow-x: auto;
//           overflow-y: auto;
//           height: 100%;
//         }
        
//         .registry-table {
//           width: 100%;
//           min-width: 1400px;
//           table-layout: auto;
//           border-collapse: collapse;
//         }
        
//         .registry-table th,
//         .registry-table td {
//           padding: 8px 10px;
//           vertical-align: top;
//           white-space: normal;
//           overflow: visible;
//           text-overflow: clip;
//         }
        
//         .registry-table th:nth-child(4),
//         .registry-table td:nth-child(4) {
//           min-width: 300px;
//           max-width: 400px;
//           word-wrap: break-word;
//           word-break: normal;
//           overflow-wrap: break-word;
//         }
        
//         .has-invoice-row {
//           background-color: #f8fff8 !important;
//         }
        
//         .selected-row {
//           background-color: #e3f2fd !important;
//           box-shadow: inset 0 0 0 2px #2196f3;
//         }
        
//         .selection-cell {
//           text-align: center;
//         }
        
//         .selection-cell input[type="radio"] {
//           cursor: pointer;
//           transform: scale(1.2);
//         }
        
//         .invoice-details-cell {
//           line-height: 1.4;
//           padding: 8px 0;
//         }
        
//         .invoice-title {
//           font-weight: 500;
//           color: #2c3e50;
//           margin-bottom: 4px;
//         }
        
//         .invoice-amount {
//           font-size: 12px;
//           color: #28a745;
//           font-weight: 500;
//         }
        
//         .invoice-id {
//           font-size: 11px;
//           color: #6c757d;
//           margin-top: 2px;
//           font-family: monospace;
//         }
        
//         .no-invoice-text {
//           font-style: italic;
//           color: #6c757d;
//           font-size: 0.9em;
//         }
        
//         .contractor-name {
//           font-weight: 500;
//         }
        
//         .empty-field {
//           color: #6c757d;
//         }
        
//         .amount-value {
//           font-weight: 600;
//           color: #28a745;
//         }
        
//         .included-badge {
//           display: inline-block;
//           padding: 2px 8px;
//           background-color: #d4edda;
//           color: #155724;
//           border-radius: 12px;
//           font-size: 12px;
//           font-weight: 500;
//         }
        
//         .cell-input {
//           width: 100%;
//           padding: 6px 8px;
//           border: 1px solid #ddd;
//           border-radius: 4px;
//           font-size: 13px;
//           box-sizing: border-box;
//         }
        
//         .cell-input:focus {
//           outline: none;
//           border-color: #2196f3;
//           box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
//         }
        
//         .payer-select,
//         .payment-system-select {
//           width: 100%;
//           padding: 6px 8px;
//           border: 1px solid #ddd;
//           border-radius: 4px;
//           font-size: 13px;
//           background-color: white;
//           box-sizing: border-box;
//         }
        
//         .comment-input {
//           min-width: 150px;
//         }
        
//         .license-plate-input {
//           text-transform: uppercase;
//         }
        
//         .loading-spinner {
//           padding: 8px 16px;
//           background-color: #e3f2fd;
//           color: #1565c0;
//           border-radius: 4px;
//           font-size: 14px;
//         }
        
//         .debug-panel {
//           flex-shrink: 0;
//           padding: 10px;
//           background: #f8f9fa;
//           border-top: 1px solid #dee2e6;
//           font-size: 12px;
//           color: #6c757d;
//         }
        
//         .debug-content {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//         }
        
//         .console-log-btn {
//           background: none;
//           border: 1px solid #6c757d;
//           color: #6c757d;
//           padding: 2px 8px;
//           border-radius: 3px;
//           font-size: 11px;
//           cursor: pointer;
//         }
        
//         .console-log-btn:hover {
//           background-color: #6c757d;
//           color: white;
//         }
        
//         .registry-table tbody tr {
//           cursor: pointer;
//           transition: background-color 0.1s;
//         }
        
//         .registry-table tbody tr:hover {
//           background-color: #f8f9fa;
//         }
//       `}</style>
//     </div>
//   );
// };

import React, { useEffect, useState, useCallback } from "react";
import InvoiceMatchModal from "./InvoiceMatchModal";
import "../styles.css";

const PAYERS = ["Сибуглеснаб", "ООО Ромашка", "ИП Иванов"];
const PAYMENT_SYSTEMS = ["Предоплата", "Постоплата"];

const RegistryPreview = ({ data, onReload }) => {
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]); // Сохраняем оригинальный порядок
  const [matchInvoice, setMatchInvoice] = useState(null);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [batchId, setBatchId] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [lastUpdatedRowId, setLastUpdatedRowId] = useState(null); // Для подсветки обновленной строки

  // Инициализация строк - сохраняем оригинальный порядок
  useEffect(() => {
    console.log("📊 Data received in RegistryPreview:", data);
    
    // Определяем формат данных
    let registryData = [];
    let extractedBatchId = "";
    
    if (Array.isArray(data)) {
      registryData = data;
    } else if (data && typeof data === 'object') {
      if (data.registry_preview && Array.isArray(data.registry_preview)) {
        registryData = data.registry_preview;
      } else if (Array.isArray(data)) {
        registryData = data;
      } else {
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            registryData = data[key];
            break;
          }
        }
      }
    }
    
    if (registryData.length > 0) {
      console.log(`✅ Using ${registryData.length} registry items`);
      setDebugInfo(`Получено ${registryData.length} строк реестра`);
      
      // Добавляем поле для сохранения порядка
      const rowsWithOrder = registryData.map((r, index) => ({
        ...r,
        payer: r.payer || "Сибуглеснаб",
        payment_system: r.payment_system || "Предоплата",
        included_in_plan: true,
        displayOrder: r.position || index, // Используем position из бэкенда
        hasInvoice: !!r.invoice_id,
        originalId: r.id // Сохраняем оригинальный ID
      }));
      
      // Сортируем по position (если бэкенд уже отсортировал, это для надежности)
      rowsWithOrder.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      setOriginalRows(rowsWithOrder);
      setRows(rowsWithOrder);
      
      // Извлекаем batch_id из данных
      if (rowsWithOrder.length > 0) {
        const possibleBatchId = 
          rowsWithOrder[0].batch_id || 
          rowsWithOrder[0].imported_batch ||
          (data && data.batch_id);
        
        if (possibleBatchId) {
          setBatchId(possibleBatchId);
          console.log(`✅ Extracted batch_id: ${possibleBatchId}`);
        }
      }
      
      const rowsWithInvoice = rowsWithOrder.filter(r => r.invoice_id).length;
      console.log(`📊 Строк с привязанными счетами: ${rowsWithInvoice}/${rowsWithOrder.length}`);
    } else {
      console.log(" No registry data found");
      setDebugInfo("Нет данных реестра");
      setRows([]);
      setOriginalRows([]);
    }
    
  }, [data]);

  // Функция для загрузки счетов
  const loadInvoices = useCallback((batchId) => {
    if (!batchId) {
      console.log(" No batch_id provided for loading invoices");
      setDebugInfo("Ошибка: batch_id не найден для загрузки счетов");
      return;
    }
    
    setIsLoading(true);
    setDebugInfo(`Загрузка счетов для batch: ${batchId}`);
    
    fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(result => {
        if (result && Array.isArray(result.invoices)) {
          setAvailableInvoices(result.invoices);
          setDebugInfo(`Найдено счетов: ${result.invoices.length}`);
        } else if (result && Array.isArray(result)) {
          setAvailableInvoices(result);
          setDebugInfo(`Найдено счетов: ${result.length}`);
        } else {
          setDebugInfo("Нет счетов в буфере");
          setAvailableInvoices([]);
        }
      })
      .catch(err => {
        console.error(" Ошибка загрузки счетов:", err);
        setDebugInfo(`Ошибка: ${err.message}`);
        setAvailableInvoices([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Загружаем доступные счета из буфера при наличии batchId
  useEffect(() => {
    if (batchId) loadInvoices(batchId);
  }, [batchId, loadInvoices]);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleRowSelect = (index) => {
    setSelectedRowIndex(index);
    setLastUpdatedRowId(null); // Сбрасываем подсветку при выборе новой строки
  };

  const handleMatchClick = () => {
    if (selectedRowIndex === null) {
      alert("Пожалуйста, выберите строку реестра для сопоставления");
      return;
    }
    
    const row = rows[selectedRowIndex];
    console.log(" Match click on selected row:", row);
    
    setMatchInvoice({
      id: row.invoice_id || null,
      details: row.invoice_details || {},
      filename: row.invoice_details?.file || `Счет из буфера`,
      registryRow: row,
      registryRowIndex: selectedRowIndex,
      registryRowId: row.id,
      batchId: batchId || row.batch_id || rows[0]?.batch_id
    });
  };

  const handleManualApply = (invoiceId, registryId, applyType, lineNo) => {
    setIsLoading(true);
    setDebugInfo(`Применение счета ${invoiceId?.slice(0,8) || 'unknown'}...`);
    
    let endpoint, requestBody;
    
    if (applyType === "full" && lineNo !== undefined) {
      endpoint = "http://localhost:8000/invoice/apply-line";
      requestBody = {
        invoice_id: invoiceId,
        line_no: lineNo,
        registry_id: registryId,
      };
    } else {
      endpoint = "http://localhost:8000/invoice/manual-match";
      const currentBatchId = batchId || rows[0]?.batch_id;
      requestBody = {
        batch_id: currentBatchId,
        registry_id: registryId,
        invoice_id: invoiceId,
        apply_type: applyType
      };
    }
    
    console.log(`📤 Sending to ${endpoint}:`, requestBody);
    
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(result => {
      console.log("✅ Apply response:", result);
      if (result.status === "ok") {
        // Обновляем строку локально ДО полной перезагрузки
        updateRowLocally(registryId, invoiceId, result);
        
        // Показываем сообщение
        alert("✅ Счет успешно применен!");
        
        // Устанавливаем ID обновленной строки для подсветки
        setLastUpdatedRowId(registryId);
        
        // Закрываем модалку
        setMatchInvoice(null);
        
        // Обновляем данные через родительский компонент с небольшой задержкой
        if (onReload) {
          setTimeout(() => {
            onReload();
          }, 1000); // Даем время увидеть обновленную строку
        }
      } else {
        throw new Error(result.message || "Ошибка применения");
      }
    })
    .catch(err => {
      console.error(" Ошибка применения счета:", err);
      alert(` Ошибка: ${err.message}`);
    })
    .finally(() => {
      setIsLoading(false);
      setDebugInfo("Готово");
    });
  };

  // Локальное обновление строки после привязки счета
  const updateRowLocally = (registryId, invoiceId, result) => {
    console.log("🔄 Локальное обновление строки:", registryId);
    
    setRows(prevRows => {
      return prevRows.map(row => {
        if (row.id === registryId) {
          // Создаем обновленную строку с сохранением порядка
          const updatedRow = {
            ...row,
            invoice_id: invoiceId,
            hasInvoice: true
          };
          
          // Обновляем invoice_details если они есть в ответе
          if (result.invoice_details) {
            updatedRow.invoice_details = result.invoice_details;
          }
          
          // Сохраняем временную метку обновления для анимации
          updatedRow.lastUpdated = Date.now();
          
          return updatedRow;
        }
        return row;
      });
    });
    
    // Сбрасываем выделение
    setSelectedRowIndex(null);
  };

  // Обработка успешного применения из модального окна
  const handleInvoiceApplied = () => {
    console.log("🔄 Информация о привязке обновлена локально");
    setSelectedRowIndex(null);
    
    // Обновляем данные через родительский компонент
    if (onReload) {
      setTimeout(() => onReload(), 500);
    }
  };

  // Восстановление порядка после перезагрузки данных
  useEffect(() => {
    if (rows.length > 0 && originalRows.length > 0) {
      // Создаем маппинг ID строк на их порядок из originalRows
      const orderMap = new Map();
      originalRows.forEach((row, index) => {
        orderMap.set(row.id, index);
      });
      
      // Сортируем текущие строки по сохраненному порядку
      const sortedRows = [...rows].sort((a, b) => {
        const orderA = orderMap.get(a.id) || a.displayOrder || 0;
        const orderB = orderMap.get(b.id) || b.displayOrder || 0;
        return orderA - orderB;
      });
      
      // Обновляем только если порядок изменился
      const needsSorting = sortedRows.some((row, index) => row.id !== rows[index]?.id);
      if (needsSorting) {
        console.log("🔄 Восстановление порядка строк");
        setRows(sortedRows);
      }
    }
  }, [rows, originalRows]);

  if (!rows.length) {
    return (
      <div className="requests-table" style={{ textAlign: "center", padding: "40px" }}>
        <h3> Реестр не сформирован</h3>
        <p>Загрузите документ, чтобы увидеть предпросмотр</p>
      </div>
    );
  }

  // Подсчитываем статистику
  const rowsWithInvoice = rows.filter(r => r.invoice_id).length;

  return (
    <div className="registry-container">
      {/* Фиксированный заголовок */}
      <div className="registry-header">
        <div className="header-content">
          <div className="header-left">
            <h3> Предпросмотр реестра</h3>
            <p className="header-stats">
              Всего строк: <strong>{rows.length}</strong> | 
              С привязанными счетами: <strong style={{ color: rowsWithInvoice > 0 ? "#28a745" : "#dc3545" }}>
                {rowsWithInvoice}
              </strong> | 
              Доступно счетов: <strong style={{ color: availableInvoices.length > 0 ? "#28a745" : "#dc3545" }}>
                {availableInvoices.length}
              </strong>
              {batchId && ` | Batch: ${batchId.slice(0, 8)}...`}
              {selectedRowIndex !== null && ` | Выбрана строка: ${selectedRowIndex + 1}`}
              {lastUpdatedRowId && ` | Обновлена строка: ID ${lastUpdatedRowId}`}
            </p>
          </div>
          <div className="header-right">
            <div className="debug-info">
              <div>{debugInfo}</div>
            </div>
            
            <button 
              onClick={handleMatchClick}
              className="header-btn match-btn"
              disabled={selectedRowIndex === null || !availableInvoices.length || isLoading}
              title={selectedRowIndex === null ? "Выберите строку реестра" : "Сопоставить счет с выбранной строкой"}
            >
               Сопоставить
            </button>
            
            <button 
              onClick={() => batchId && loadInvoices(batchId)}
              className="header-btn refresh-btn"
              title="Обновить список счетов"
            >
               Обновить
            </button>
            
            {isLoading && <div className="loading-spinner">🔄 Загрузка...</div>}
          </div>
        </div>
      </div>

      {/* Скроллируемая таблица */}
      <div className="registry-table-container">
        <div className="registry-table-wrapper">
          <table className="registry-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Выбор</th>
                <th style={{ width: "70px" }}>№</th>
                <th style={{ minWidth: "180px" }}>Поставщик</th>
                <th style={{ minWidth: "350px" }}>Реквизиты счета</th>
                <th style={{ minWidth: "200px" }}>Контрагент</th>
                <th style={{ width: "140px" }}>Плательщик</th>
                <th style={{ width: "120px" }}>Сумма</th>
                <th style={{ width: "100px" }}>в т.ч НДС</th>
                <th style={{ width: "90px" }}>Учтено</th>
                <th style={{ width: "150px" }}>Система расчетов</th>
                <th style={{ minWidth: "200px" }}>Комментарий</th>
                <th style={{ minWidth: "150px" }}>Техника</th>
                <th style={{ width: "120px" }}>г.н</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => {
                const d = r.invoice_details || {};
                
                let invoiceText = "";
                let hasInvoiceText = false;
                
                if (d.invoice_full_text) {
                  invoiceText = d.invoice_full_text;
                  hasInvoiceText = true;
                } else if (d.invoice_number && d.invoice_date) {
                  invoiceText = `Счет на оплату № ${d.invoice_number} от ${d.invoice_date}`;
                  hasInvoiceText = true;
                } else if (d.invoice_number) {
                  invoiceText = `Счет № ${d.invoice_number}`;
                  hasInvoiceText = true;
                } else if (d.invoice_date) {
                  invoiceText = `Счет от ${d.invoice_date}`;
                  hasInvoiceText = true;
                }

                const hasInvoice = !!r.invoice_id;
                const isSelected = selectedRowIndex === i;
                const isRecentlyUpdated = lastUpdatedRowId === r.id;
                
                return (
                  <tr 
                    key={`${r.id}-${r.lastUpdated || ''}`}
                    className={`
                      ${hasInvoice ? "has-invoice-row" : ""} 
                      ${isSelected ? "selected-row" : ""}
                      ${isRecentlyUpdated ? "recently-updated-row" : ""}
                    `}
                    onClick={() => handleRowSelect(i)}
                  >
                    <td>
                      <div className="selection-cell">
                        <input
                          type="radio"
                          name="selected-row"
                          checked={isSelected}
                          onChange={() => handleRowSelect(i)}
                          title="Выбрать эту строку для сопоставления"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </td>

                    <td className="row-id">{r.id}</td>

                    <td>
                      <input
                        className="cell-input"
                        value={r.supplier || ""}
                        onChange={(e) => updateRow(i, "supplier", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Введите поставщика"
                      />
                    </td>

                    <td className="invoice-details-cell">
                      {hasInvoiceText ? (
                        <div>
                          <div className="invoice-title">
                            {invoiceText}
                            {isRecentlyUpdated && <span className="update-badge">НОВОЕ</span>}
                          </div>
                          {/* УБРАНО: информация о сумме и статусе привязки */}
                        </div>
                      ) : (
                        <span className="no-invoice-text">
                          {isSelected ? "⬅ Выбрано для сопоставления" : "Счет не привязан"}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="contractor-cell">
                        {r.contractor ? (
                          <span className="contractor-name">{r.contractor}</span>
                        ) : (
                          <span className="empty-field">—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <select
                        className="payer-select"
                        value={r.payer}
                        onChange={(e) => updateRow(i, "payer", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {PAYERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="amount-cell">
                      {r.amount ? (
                        <span className="amount-value">
                          {r.amount}
                        </span>
                      ) : (
                        <span className="empty-field">—</span>
                      )}
                    </td>

                    <td>{r.vat_amount || <span className="empty-field">—</span>}</td>

                    <td className="included-cell">
                      <span className="included-badge">Да</span>
                    </td>

                    <td>
                      <select
                        className="payment-system-select"
                        value={r.payment_system}
                        onChange={(e) => updateRow(i, "payment_system", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {PAYMENT_SYSTEMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        className="cell-input comment-input"
                        value={r.comment || ""}
                        onChange={(e) => updateRow(i, "comment", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Комментарий"
                      />
                    </td>

                    <td>
                      <input
                        className="cell-input"
                        value={r.vehicle || ""}
                        onChange={(e) => updateRow(i, "vehicle", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Модель"
                      />
                    </td>

                    <td>
                      <input
                        className="cell-input license-plate-input"
                        value={r.license_plate || ""}
                        onChange={(e) => updateRow(i, "license_plate", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="A000AA"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {matchInvoice && (
        <InvoiceMatchModal
          invoice={matchInvoice}
          registryRows={[rows[selectedRowIndex]]}
          selectedRegistryRowId={matchInvoice.registryRowId}
          availableInvoices={availableInvoices}
          onClose={() => {
            setMatchInvoice(null);
            setSelectedRowIndex(null);
          }}
          onApplied={handleInvoiceApplied}
          onManualApply={handleManualApply}
        />
      )}

      <style jsx>{`
        .registry-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-height: 100vh;
          overflow: hidden;
        }
        
        .registry-header {
          flex-shrink: 0;
          padding: 12px 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f5f7fa;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }
        
        .header-left {
          flex: 1;
        }
        
        .header-left h3 {
          margin: 0;
          font-size: 18px;
          color: #2c3e50;
        }
        
        .header-right {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .header-stats {
          color: #546e7a;
          font-size: 13px;
          margin: 6px 0 0 0;
        }
        
        .debug-info {
          font-size: 12px;
          color: #78909c;
          text-align: right;
          margin-right: 10px;
          min-width: 150px;
        }
        
        .header-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        
        .header-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }
        
        .match-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
        }
        
        .match-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #5a6fd8 0%, #6b3f8f 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
        }
        
        .refresh-btn {
          background: #4caf50;
          color: white;
          box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
        }
        
        .refresh-btn:hover {
          background: #43a047;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
        }
        
        .registry-table-container {
          flex: 1;
          overflow: auto;
          position: relative;
          background: #fff;
        }
        
        .registry-table-wrapper {
          overflow-x: auto;
          overflow-y: auto;
          height: 100%;
        }
        
        .registry-table {
          width: 100%;
          min-width: 1400px;
          border-collapse: separate;
          border-spacing: 0;
        }
        
        .registry-table th {
          background: #f8f9fa;
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 2px solid #e0e0e0;
          font-weight: 600;
          color: #37474f;
          padding: 12px 10px;
          text-align: left;
          font-size: 13px;
        }
        
        .registry-table td {
          padding: 10px 10px;
          vertical-align: middle;
          white-space: normal;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
          transition: background-color 0.3s ease;
        }
        
        .row-id {
          font-weight: 600;
          color: #37474f;
          font-family: monospace;
        }
        
        .registry-table tbody tr {
          cursor: pointer;
        }
        
        .registry-table tbody tr:hover {
          background-color: #f8fafc !important;
        }
        
        .has-invoice-row {
          background-color: #f0f9f0 !important;
        }
        
        .has-invoice-row:hover {
          background-color: #e8f5e9 !important;
        }
        
        .selected-row {
          background-color: #e3f2fd !important;
          position: relative;
        }
        
        .selected-row::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        }
        
        .recently-updated-row {
          animation: highlight-pulse 2s ease-in-out;
          background-color: #fff8e1 !important;
        }
        
        @keyframes highlight-pulse {
          0% { background-color: #fff8e1; }
          50% { background-color: #fff3e0; }
          100% { background-color: #fff8e1; }
        }
        
        .selection-cell {
          text-align: center;
        }
        
        .selection-cell input[type="radio"] {
          cursor: pointer;
          transform: scale(1.2);
          accent-color: #667eea;
        }
        
        .invoice-details-cell {
          line-height: 1.4;
        }
        
        .invoice-title {
          font-weight: 500;
          color: #2c3e50;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .update-badge {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        /* УБРАНЫ СТИЛИ ДЛЯ invoice-amount, invoice-status, status-badge, invoice-id */
        
        .no-invoice-text {
          font-style: italic;
          color: #90a4ae;
          font-size: 13px;
        }
        
        .contractor-name {
          font-weight: 500;
        }
        
        .empty-field {
          color: #b0bec5;
          font-style: italic;
        }
        
        .amount-value {
          font-weight: 600;
          color: #4caf50;
        }
        
        .included-badge {
          display: inline-block;
          padding: 4px 10px;
          background: linear-gradient(135deg, #81c784 0%, #66bb6a 100%);
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
          min-width: 40px;
        }
        
        .cell-input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          box-sizing: border-box;
          transition: all 0.2s;
          background: white;
        }
        
        .cell-input:focus {
          outline: none;
          border-color: #2196f3;
          box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
        }
        
        .payer-select,
        .payment-system-select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          background-color: white;
          box-sizing: border-box;
          cursor: pointer;
        }
        
        .comment-input {
          min-width: 150px;
        }
        
        .license-plate-input {
          text-transform: uppercase;
        }
        
        .loading-spinner {
          padding: 8px 16px;
          background-color: #e3f2fd;
          color: #1565c0;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .registry-table tbody tr {
          transition: background-color 0.1s;
        }
      `}</style>
    </div>
  );
};

export default RegistryPreview;