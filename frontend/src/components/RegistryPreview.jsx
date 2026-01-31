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

//   const handleMatchClick = (row) => {
//     console.log("🎯 Match click on row:", row);
    
//     // Всегда открываем модалку
//     setMatchInvoice({
//       id: row.invoice_id || null,
//       details: row.invoice_details || {},
//       filename: row.invoice_details?.file || `Счет из буфера`,
//       registryRow: row,
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
//     <div className="requests-table registry-table">
//       {/* Заголовок с отладкой */}
//       <div style={{ padding: "20px", borderBottom: "1px solid #eee", background: "#f8f9fa" }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
//           <div>
//             <h3>📑 Предпросмотр реестра</h3>
//             <p style={{ color: "#666", fontSize: "14px" }}>
//               Всего строк: <strong>{rows.length}</strong> | 
//               Доступно счетов: <strong style={{ color: availableInvoices.length > 0 ? "#28a745" : "#dc3545" }}>
//                 {availableInvoices.length}
//               </strong>
//               {batchId && ` | Batch: ${batchId.slice(0, 8)}...`}
//             </p>
//           </div>
//           <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
//             {/* Отладочная информация */}
//             <div style={{ fontSize: "12px", color: "#6c757d", textAlign: "right" }}>
//               <div>{debugInfo}</div>
//               <div>Формат: {Array.isArray(data) ? "массив" : "объект"}</div>
//             </div>
            
//             {/* Отладочная кнопка */}
//             <button 
//               onClick={testEndpoint}
//               style={{ 
//                 background: "#ffc107", 
//                 color: "#212529", 
//                 padding: "5px 10px", 
//                 border: "none", 
//                 borderRadius: "4px",
//                 fontSize: "12px",
//                 cursor: "pointer"
//               }}
//               title="Тест endpoint"
//             >
//               🧪 Тест
//             </button>
            
//             {/* Кнопка перезагрузки */}
//             <button 
//               onClick={() => batchId && loadInvoices(batchId)}
//               style={{ 
//                 background: "#007bff", 
//                 color: "white", 
//                 padding: "5px 10px", 
//                 border: "none", 
//                 borderRadius: "4px",
//                 fontSize: "12px",
//                 cursor: "pointer"
//               }}
//               title="Обновить список счетов"
//             >
//               🔄 Обновить
//             </button>
            
//             {/* Кнопка проверки формата */}
//             <button 
//               onClick={checkDataFormat}
//               style={{ 
//                 background: "#6c757d", 
//                 color: "white", 
//                 padding: "5px 10px", 
//                 border: "none", 
//                 borderRadius: "4px",
//                 fontSize: "12px",
//                 cursor: "pointer"
//               }}
//               title="Проверить формат данных"
//             >
//               🔍 Формат
//             </button>
            
//             {isLoading && <div className="loading-spinner">🔄 Загрузка...</div>}
//           </div>
//         </div>
//       </div>

//       <div style={{ overflowX: "auto" }}>
//         <table style={{ tableLayout: "auto", width: "100%" }}>
//           <thead>
//             <tr>
//               <th style={{ width: "140px" }}>Сопоставление</th>
//               <th>№</th>
//               <th>Поставщик</th>
//               <th style={{ minWidth: "300px", width: "350px" }}>Реквизиты счета</th>
//               <th>Контрагент</th>
//               <th>Плательщик</th>
//               <th>Сумма</th>
//               <th>в т.ч НДС</th>
//               <th>Учтено</th>
//               <th>Система расчетов</th>
//               <th>Комментарий</th>
//               <th>Техника</th>
//               <th>г.н</th>
//             </tr>
//           </thead>

//           <tbody>
//             {rows.map((r, i) => {
//               const d = r.invoice_details || {};
              
//               // Формируем текст счета для отображения
//               let invoiceText = "";
//               let hasInvoiceText = false;
              
//               if (d.invoice_full_text) {
//                 invoiceText = d.invoice_full_text;
//                 hasInvoiceText = true;
//               } else if (d.invoice_number && d.invoice_date) {
//                 invoiceText = `Счет на оплату № ${d.invoice_number} от ${d.invoice_date}`;
//                 hasInvoiceText = true;
//               } else if (d.invoice_number) {
//                 invoiceText = `Счет № ${d.invoice_number}`;
//                 hasInvoiceText = true;
//               } else if (d.invoice_date) {
//                 invoiceText = `Счет от ${d.invoice_date}`;
//                 hasInvoiceText = true;
//               }

//               // Всегда показываем кнопку если есть доступные счета
//               const canMatch = availableInvoices.length > 0;
//               const hasInvoice = !!r.invoice_id;
              
//               return (
//                 <tr key={i} className={hasInvoice ? "has-invoice-row" : ""}>
//                   <td>
//                     <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
//                       <button
//                         onClick={() => handleMatchClick(r)}
//                         className={`match-btn ${hasInvoice ? "has-invoice" : "no-invoice"}`}
//                         disabled={!canMatch || isLoading}
//                         title={!canMatch ? "Нет доступных счетов" : hasInvoice ? "Изменить привязку счета" : "Сопоставить счет"}
//                         style={{
//                           opacity: (!canMatch || isLoading) ? 0.5 : 1,
//                           cursor: (!canMatch || isLoading) ? 'not-allowed' : 'pointer'
//                         }}
//                       >
//                         {hasInvoice ? (
//                           <>
//                             <span className="invoice-status">✓</span>
//                             Изменить
//                           </>
//                         ) : canMatch ? (
//                           "Сопоставить"
//                         ) : (
//                           "Нет счетов"
//                         )}
//                       </button>
                      
//                       {/* Отладочная информация под кнопкой */}
//                       <div style={{ 
//                         fontSize: '10px', 
//                         color: hasInvoice ? '#28a745' : '#6c757d',
//                         padding: '2px 4px',
//                         background: hasInvoice ? '#d4edda' : '#f8f9fa',
//                         borderRadius: '3px',
//                         textAlign: 'center'
//                       }}>
//                         {hasInvoice ? (
//                           <>ID: {r.invoice_id?.slice(0, 8)}...</>
//                         ) : (
//                           <>Нет счета</>
//                         )}
//                       </div>
//                     </div>
//                   </td>

//                   <td>{r.id}</td>

//                   <td>
//                     <input
//                       className="cell-input"
//                       value={r.supplier || ""}
//                       onChange={(e) => updateRow(i, "supplier", e.target.value)}
//                       placeholder="Введите поставщика"
//                     />
//                   </td>

//                   <td style={{ 
//                     minWidth: "300px", 
//                     width: "350px",
//                     maxWidth: "400px"
//                   }}>
//                     <div style={{ 
//                       whiteSpace: 'normal', 
//                       wordBreak: 'normal',
//                       wordWrap: 'break-word',
//                       overflowWrap: 'break-word',
//                       overflow: 'visible',
//                       lineHeight: '1.4',
//                       padding: '4px 0'
//                     }}>
//                       {hasInvoiceText ? (
//                         <div>
//                           <div style={{ 
//                             fontWeight: '500', 
//                             color: '#2c3e50'
//                           }}>
//                             {invoiceText}
//                           </div>
//                           {d.total && (
//                             <div style={{ 
//                               fontSize: '12px', 
//                               color: '#28a745', 
//                               marginTop: '2px',
//                               fontWeight: '500'
//                             }}>
//                               Сумма: {d.total}
//                             </div>
//                           )}
//                         </div>
//                       ) : (
//                         <span style={{ 
//                           fontStyle: 'italic', 
//                           color: '#6c757d',
//                           fontSize: '0.9em'
//                         }}>
//                           Счет не привязан
//                         </span>
//                       )}
//                     </div>
//                   </td>

//                   <td>
//                     <div className="contractor-cell">
//                       {r.contractor ? (
//                         <span style={{ fontWeight: '500' }}>{r.contractor}</span>
//                       ) : (
//                         <span style={{ color: '#6c757d' }}>—</span>
//                       )}
//                     </div>
//                   </td>

//                   <td>
//                     <select
//                       className="payer-select"
//                       value={r.payer}
//                       onChange={(e) => updateRow(i, "payer", e.target.value)}
//                     >
//                       {PAYERS.map((p) => (
//                         <option key={p} value={p}>
//                           {p}
//                         </option>
//                       ))}
//                     </select>
//                   </td>

//                   <td className="amount-cell">
//                     {r.amount ? (
//                       <span className="amount-value" style={{ fontWeight: '600', color: '#28a745' }}>
//                         {r.amount}
//                       </span>
//                     ) : (
//                       <span style={{ color: '#6c757d' }}>—</span>
//                     )}
//                   </td>

//                   <td>{r.vat_amount || "—"}</td>

//                   <td className="included-cell">
//                     <span style={{ 
//                       display: 'inline-block',
//                       padding: '2px 8px',
//                       backgroundColor: '#d4edda', 
//                       color: '#155724',
//                       borderRadius: '12px',
//                       fontSize: '12px',
//                       fontWeight: '500'
//                     }}>
//                       Да
//                     </span>
//                   </td>

//                   <td>
//                     <select
//                       className="payment-system-select"
//                       value={r.payment_system}
//                       onChange={(e) => updateRow(i, "payment_system", e.target.value)}
//                     >
//                       {PAYMENT_SYSTEMS.map((p) => (
//                         <option key={p} value={p}>
//                           {p}
//                         </option>
//                       ))}
//                     </select>
//                   </td>

//                   <td>
//                     <input
//                       className="cell-input comment-input"
//                       value={r.comment || ""}
//                       onChange={(e) => updateRow(i, "comment", e.target.value)}
//                       placeholder="Комментарий"
//                     />
//                   </td>

//                   <td>
//                     <input
//                       className="cell-input"
//                       value={r.vehicle || ""}
//                       onChange={(e) => updateRow(i, "vehicle", e.target.value)}
//                       placeholder="Модель"
//                     />
//                   </td>

//                   <td>
//                     <input
//                       className="cell-input license-plate-input"
//                       value={r.license_plate || ""}
//                       onChange={(e) => updateRow(i, "license_plate", e.target.value)}
//                       placeholder="A000AA"
//                     />
//                   </td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>

//         {matchInvoice && (
//           <InvoiceMatchModal
//             invoice={matchInvoice}
//             registryRows={rows}
//             availableInvoices={availableInvoices}
//             onClose={() => setMatchInvoice(null)}
//             onApplied={onReload}
//             onManualApply={handleManualApply}
//           />
//         )}
//       </div>

//       {/* Отладочная панель внизу */}
//       <div style={{
//         padding: "10px",
//         background: "#f8f9fa",
//         borderTop: "1px solid #dee2e6",
//         fontSize: "12px",
//         color: "#6c757d"
//       }}>
//         <div style={{ display: "flex", justifyContent: "space-between" }}>
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
//               style={{
//                 background: "none",
//                 border: "1px solid #6c757d",
//                 color: "#6c757d",
//                 padding: "2px 8px",
//                 borderRadius: "3px",
//                 fontSize: "11px"
//               }}
//             >
//               Логи в консоль
//             </button>
//           </div>
//         </div>
//       </div>

//       <style jsx>{`
//         .has-invoice-row {
//           background-color: #f8fff8;
//         }
        
//         .match-btn {
//           padding: 6px 12px;
//           border-radius: 4px;
//           font-size: 12px;
//           font-weight: 500;
//           cursor: pointer;
//           border: none;
//           transition: all 0.2s;
//           display: flex;
//           align-items: center;
//           gap: 4px;
//           width: 100%;
//           justify-content: center;
//         }
        
//         .match-btn.has-invoice {
//           background-color: #e8f5e9;
//           color: #2e7d32;
//           border: 1px solid #c8e6c9;
//         }
        
//         .match-btn.no-invoice {
//           background-color: #e3f2fd;
//           color: #1565c0;
//           border: 1px solid #bbdefb;
//         }
        
//         .match-btn:disabled {
//           background-color: #f5f5f5;
//           color: #9e9e9e;
//           cursor: not-allowed;
//           border: 1px solid #e0e0e0;
//         }
        
//         .match-btn:hover:not(:disabled) {
//           transform: translateY(-1px);
//           box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//         }
        
//         .invoice-status {
//           font-weight: bold;
//           font-size: 14px;
//         }
        
//         .cell-input {
//           width: 100%;
//           padding: 6px 8px;
//           border: 1px solid #ddd;
//           border-radius: 4px;
//           font-size: 13px;
//         }
        
//         .cell-input:focus {
//           outline: none;
//           border-color: #2196f3;
//           box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
//         }
        
//         .payer-select, .payment-system-select {
//           width: 100%;
//           padding: 6px 8px;
//           border: 1px solid #ddd;
//           border-radius: 4px;
//           font-size: 13px;
//           background-color: white;
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
//       `}</style>
//     </div>
//   );
// };

// export default RegistryPreview;

import React, { useEffect, useState, useCallback } from "react";
import InvoiceMatchModal from "./InvoiceMatchModal";
import "../styles.css";

const PAYERS = ["Сибуглеснаб", "ООО Ромашка", "ИП Иванов"];
const PAYMENT_SYSTEMS = ["Предоплата", "Постоплата"];

const RegistryPreview = ({ data, onReload }) => {
  const [rows, setRows] = useState([]);
  const [matchInvoice, setMatchInvoice] = useState(null);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [batchId, setBatchId] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);

  // Инициализация строк - СОВМЕСТИМЫЙ ФОРМАТ
  useEffect(() => {
    console.log("📊 Data received in RegistryPreview:", data);
    
    // Определяем формат данных
    let registryData = [];
    let extractedBatchId = "";
    
    if (Array.isArray(data)) {
      // Старый формат: data - это массив
      console.log("✅ Old format: data is array");
      registryData = data;
    } else if (data && typeof data === 'object') {
      // Новый формат: data - это объект
      console.log("✅ New format: data is object, keys:", Object.keys(data));
      
      if (data.registry_preview && Array.isArray(data.registry_preview)) {
        // Формат с registry_preview
        registryData = data.registry_preview;
      } else if (Array.isArray(data)) {
        // На случай если data уже массив
        registryData = data;
      } else {
        // Ищем любой массив в объекте
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            console.log(`✅ Found array in key: ${key}`);
            registryData = data[key];
            break;
          }
        }
      }
    }
    
    if (registryData.length > 0) {
      console.log(`✅ Using ${registryData.length} registry items`);
      setDebugInfo(`Получено ${registryData.length} строк реестра`);
      
      const formattedRows = registryData.map((r) => ({
        ...r,
        payer: r.payer || "Сибуглеснаб",
        payment_system: r.payment_system || "Предоплата",
        included_in_plan: true,
      }));
      
      setRows(formattedRows);
      
      // Извлекаем batch_id из данных
      if (formattedRows.length > 0) {
        // Пробуем разные возможные источники batch_id
        const possibleBatchId = 
          formattedRows[0].batch_id || 
          formattedRows[0].imported_batch ||
          (data && data.batch_id);
        
        if (possibleBatchId) {
          setBatchId(possibleBatchId);
          extractedBatchId = possibleBatchId;
          console.log(`✅ Extracted batch_id: ${possibleBatchId}`);
        }
      }
      
      // Логируем информацию о счетах
      const rowsWithInvoice = formattedRows.filter(r => r.invoice_id).length;
      console.log(`📊 Строк с привязанными счетами: ${rowsWithInvoice}/${formattedRows.length}`);
    } else {
      console.log("⚠️ No registry data found");
      setDebugInfo("Нет данных реестра");
      setRows([]);
    }
    
  }, [data]);

  // Функция для загрузки счетов
  const loadInvoices = useCallback((batchId) => {
    if (!batchId) {
      console.log("⚠️ No batch_id provided for loading invoices");
      setDebugInfo("Ошибка: batch_id не найден для загрузки счетов");
      return;
    }
    
    setIsLoading(true);
    setDebugInfo(`Загрузка счетов для batch: ${batchId}`);
    console.log(`🔄 Загрузка счетов для batch: ${batchId}`);
    
    fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
      .then(res => {
        console.log(`✅ Response status: ${res.status}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(result => {
        console.log("📦 API Response for invoices:", result);
        
        if (result && Array.isArray(result.invoices)) {
          console.log(`✅ Найдено ${result.invoices.length} счетов в буфере`);
          setAvailableInvoices(result.invoices);
          setDebugInfo(`Найдено счетов: ${result.invoices.length}`);
        } else if (result && Array.isArray(result)) {
          // На случай если endpoint возвращает сразу массив
          console.log(`✅ Найдено ${result.length} счетов (direct array)`);
          setAvailableInvoices(result);
          setDebugInfo(`Найдено счетов: ${result.length}`);
        } else {
          console.log("⚠️ Нет счетов в буфере или неверный формат ответа:", result);
          setDebugInfo("Нет счетов в буфере");
          setAvailableInvoices([]);
        }
      })
      .catch(err => {
        console.error("❌ Ошибка загрузки счетов:", err);
        setDebugInfo(`Ошибка: ${err.message}`);
        setAvailableInvoices([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Загружаем доступные счета из буфера при наличии batchId
  useEffect(() => {
    if (batchId) {
      loadInvoices(batchId);
    }
  }, [batchId, loadInvoices]);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleRowSelect = (index) => {
    setSelectedRowIndex(index);
  };

  const handleMatchClick = () => {
    if (selectedRowIndex === null) {
      alert("Пожалуйста, выберите строку реестра для сопоставления");
      return;
    }
    
    const row = rows[selectedRowIndex];
    console.log("🎯 Match click on selected row:", row);
    
    // Открываем модалку
    setMatchInvoice({
      id: row.invoice_id || null,
      details: row.invoice_details || {},
      filename: row.invoice_details?.file || `Счет из буфера`,
      registryRow: row,
      registryRowIndex: selectedRowIndex,
      batchId: batchId || row.batch_id || rows[0]?.batch_id
    });
  };

  const handleManualApply = (invoiceId, registryId, applyType, lineNo) => {
    setIsLoading(true);
    setDebugInfo(`Применение счета ${invoiceId.slice(0,8)}...`);
    
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
        alert("✅ Счет успешно применен!");
        if (onReload) onReload();
      } else {
        throw new Error(result.message || "Ошибка применения");
      }
    })
    .catch(err => {
      console.error("❌ Ошибка применения счета:", err);
      alert(`❌ Ошибка: ${err.message}`);
    })
    .finally(() => {
      setIsLoading(false);
      setMatchInvoice(null);
      setDebugInfo("Готово");
    });
  };

  // Отладочная функция для тестирования endpoint
  const testEndpoint = () => {
    if (batchId) {
      console.log(`🔍 Testing endpoint for batch: ${batchId}`);
      
      fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
        .then(res => res.json())
        .then(data => {
          console.log("Test response:", data);
          alert(`Test: Found ${data.invoices?.length || data.length || 0} invoices`);
        })
        .catch(err => {
          console.error("Test error:", err);
          alert("Test error: " + err.message);
        });
    } else {
      alert("Нет batch_id для теста");
    }
  };

  // Отладочная функция для проверки формата данных
  const checkDataFormat = () => {
    console.log("=== DATA FORMAT CHECK ===");
    console.log("Data:", data);
    console.log("Rows:", rows);
    console.log("Batch ID:", batchId);
    console.log("Available invoices:", availableInvoices.length);
    
    if (data) {
      console.log("Data type:", typeof data);
      console.log("Is array?", Array.isArray(data));
      if (typeof data === 'object') {
        console.log("Data keys:", Object.keys(data));
      }
    }
  };

  if (!rows.length) {
    return (
      <div className="requests-table" style={{ textAlign: "center", padding: "40px" }}>
        <h3>📑 Реестр не сформирован</h3>
        <p>Загрузите документ, чтобы увидеть предпросмотр</p>
        {data && (
          <div style={{ marginTop: "20px", fontSize: "12px", color: "#666" }}>
            <button 
              onClick={checkDataFormat}
              style={{ padding: "5px 10px", marginBottom: "10px" }}
            >
              Проверить формат данных
            </button>
            <div>Данные получены, но нет строк для отображения</div>
            <div>Тип данных: {typeof data}</div>
            {Array.isArray(data) && <div>Массив с {data.length} элементами</div>}
            {typeof data === 'object' && <div>Объект с ключами: {Object.keys(data).join(", ")}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="registry-container">
      {/* Фиксированный заголовок */}
      <div className="registry-header">
        <div className="header-content">
          <div className="header-left">
            <h3>📑 Предпросмотр реестра</h3>
            <p className="header-stats">
              Всего строк: <strong>{rows.length}</strong> | 
              Доступно счетов: <strong style={{ color: availableInvoices.length > 0 ? "#28a745" : "#dc3545" }}>
                {availableInvoices.length}
              </strong>
              {batchId && ` | Batch: ${batchId.slice(0, 8)}...`}
              {selectedRowIndex !== null && ` | Выбрана строка: ${selectedRowIndex + 1}`}
            </p>
          </div>
          <div className="header-right">
            {/* Отладочная информация */}
            <div className="debug-info">
              <div>{debugInfo}</div>
              <div>Формат: {Array.isArray(data) ? "массив" : "объект"}</div>
            </div>
            
            {/* Кнопка Сопоставить */}
            <button 
              onClick={handleMatchClick}
              className="header-btn match-btn"
              disabled={selectedRowIndex === null || !availableInvoices.length || isLoading}
              title={selectedRowIndex === null ? "Выберите строку реестра" : "Сопоставить счет с выбранной строкой"}
            >
               Сопоставить
            </button>
            
            {/* Кнопка обновления */}
            <button 
              onClick={() => batchId && loadInvoices(batchId)}
              className="header-btn refresh-btn"
              title="Обновить список счетов"
            >
              🔄 Обновить
            </button>
            
            {/* Тестовая кнопка */}
            <button 
              onClick={testEndpoint}
              className="header-btn test-btn"
              title="Тест endpoint"
            >
              🧪 Тест
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
                <th style={{ width: "40px" }}>Выбор</th>
                <th>№</th>
                <th>Поставщик</th>
                <th style={{ minWidth: "300px", width: "350px" }}>Реквизиты счета</th>
                <th>Контрагент</th>
                <th>Плательщик</th>
                <th>Сумма</th>
                <th>в т.ч НДС</th>
                <th>Учтено</th>
                <th>Система расчетов</th>
                <th>Комментарий</th>
                <th>Техника</th>
                <th>г.н</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => {
                const d = r.invoice_details || {};
                
                // Формируем текст счета для отображения
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
                
                return (
                  <tr 
                    key={i} 
                    className={`${hasInvoice ? "has-invoice-row" : ""} ${isSelected ? "selected-row" : ""}`}
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
                        />
                      </div>
                    </td>

                    <td>{r.id}</td>

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
                          </div>
                          {d.total && (
                            <div className="invoice-amount">
                              Сумма: {d.total}
                            </div>
                          )}
                          {hasInvoice && (
                            <div className="invoice-id">
                              ID: {r.invoice_id?.slice(0, 8)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="no-invoice-text">
                          Счет не привязан
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
          registryRows={rows}
          availableInvoices={availableInvoices}
          onClose={() => setMatchInvoice(null)}
          onApplied={onReload}
          onManualApply={handleManualApply}
        />
      )}

      {/* Отладочная панель */}
      <div className="debug-panel">
        <div className="debug-content">
          <div>
            <strong>Отладка:</strong> {debugInfo}
          </div>
          <div>
            <button 
              onClick={() => {
                console.log("=== DEBUG INFO ===");
                console.log("Data:", data);
                console.log("Rows:", rows);
                console.log("Available invoices:", availableInvoices);
                console.log("Match invoice:", matchInvoice);
                console.log("Batch ID:", batchId);
              }}
              className="console-log-btn"
            >
              Логи в консоль
            </button>
          </div>
        </div>
      </div>

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
          padding: 15px 20px;
          border-bottom: 1px solid #eee;
          background: #f8f9fa;
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
        
        .header-right {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .header-stats {
          color: #666;
          font-size: 14px;
          margin: 5px 0 0 0;
        }
        
        .debug-info {
          font-size: 12px;
          color: #6c757d;
          text-align: right;
          margin-right: 10px;
        }
        
        .header-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
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
        }
        
        .match-btn {
          background-color: #007bff;
          color: white;
        }
        
        .match-btn:hover:not(:disabled) {
          background-color: #0056b3;
          transform: translateY(-1px);
        }
        
        .refresh-btn {
          background-color: #6c757d;
          color: white;
        }
        
        .refresh-btn:hover {
          background-color: #545b62;
          transform: translateY(-1px);
        }
        
        .test-btn {
          background-color: #ffc107;
          color: #212529;
        }
        
        .test-btn:hover {
          background-color: #e0a800;
          transform: translateY(-1px);
        }
        
        .registry-table-container {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        
        .registry-table-wrapper {
          overflow-x: auto;
          overflow-y: auto;
          height: 100%;
        }
        
        .registry-table {
          width: 100%;
          min-width: 1400px;
          table-layout: auto;
          border-collapse: collapse;
        }
        
        .registry-table th,
        .registry-table td {
          padding: 8px 10px;
          vertical-align: top;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
        }
        
        .registry-table th:nth-child(4),
        .registry-table td:nth-child(4) {
          min-width: 300px;
          max-width: 400px;
          word-wrap: break-word;
          word-break: normal;
          overflow-wrap: break-word;
        }
        
        .has-invoice-row {
          background-color: #f8fff8 !important;
        }
        
        .selected-row {
          background-color: #e3f2fd !important;
          box-shadow: inset 0 0 0 2px #2196f3;
        }
        
        .selection-cell {
          text-align: center;
        }
        
        .selection-cell input[type="radio"] {
          cursor: pointer;
          transform: scale(1.2);
        }
        
        .invoice-details-cell {
          line-height: 1.4;
          padding: 8px 0;
        }
        
        .invoice-title {
          font-weight: 500;
          color: #2c3e50;
          margin-bottom: 4px;
        }
        
        .invoice-amount {
          font-size: 12px;
          color: #28a745;
          font-weight: 500;
        }
        
        .invoice-id {
          font-size: 11px;
          color: #6c757d;
          margin-top: 2px;
          font-family: monospace;
        }
        
        .no-invoice-text {
          font-style: italic;
          color: #6c757d;
          font-size: 0.9em;
        }
        
        .contractor-name {
          font-weight: 500;
        }
        
        .empty-field {
          color: #6c757d;
        }
        
        .amount-value {
          font-weight: 600;
          color: #28a745;
        }
        
        .included-badge {
          display: inline-block;
          padding: 2px 8px;
          background-color: #d4edda;
          color: #155724;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .cell-input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          box-sizing: border-box;
        }
        
        .cell-input:focus {
          outline: none;
          border-color: #2196f3;
          box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
        }
        
        .payer-select,
        .payment-system-select {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          background-color: white;
          box-sizing: border-box;
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
        
        .debug-panel {
          flex-shrink: 0;
          padding: 10px;
          background: #f8f9fa;
          border-top: 1px solid #dee2e6;
          font-size: 12px;
          color: #6c757d;
        }
        
        .debug-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .console-log-btn {
          background: none;
          border: 1px solid #6c757d;
          color: #6c757d;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
        }
        
        .console-log-btn:hover {
          background-color: #6c757d;
          color: white;
        }
        
        .registry-table tbody tr {
          cursor: pointer;
          transition: background-color 0.1s;
        }
        
        .registry-table tbody tr:hover {
          background-color: #f8f9fa;
        }
      `}</style>
    </div>
  );
};

export default RegistryPreview;