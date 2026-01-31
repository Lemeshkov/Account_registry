// import React, { useEffect, useState } from "react";
// import "../index.css";

// const InvoiceMatchModal = ({
//   invoice,
//   registryRows,
//   onClose,
//   onApplied,
// }) => {
//   const [invoiceLines, setInvoiceLines] = useState([]);
//   const [selectedLine, setSelectedLine] = useState(null);
//   const [selectedRegistry, setSelectedRegistry] = useState(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     fetch(`http://localhost:8000/invoice/${invoice.id}/lines`)
//       .then((r) => r.json())
//       .then(setInvoiceLines);
//   }, [invoice.id]);

//   const apply = async () => {
//     if (!selectedLine || !selectedRegistry) {
//       alert("Выберите строку счета и строку реестра");
//       return;
//     }

//     setLoading(true);

//     const res = await fetch("http://localhost:8000/invoice/apply-line", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         invoice_id: invoice.id,
//         line_no: selectedLine.line_no,
//         registry_id: selectedRegistry.id,
//       }),
//     });

//     setLoading(false);

//     if (!res.ok) {
//       alert("Ошибка применения строки");
//       return;
//     }

//     onApplied();
//     onClose();
//   };

//  return (
//   <div className="modal-backdrop">
//     <div className="modal">

//       {/* ===== HEADER (прибитый) ===== */}
//       <div className="modal-header">
//         <h3>🧾 Сопоставление счета</h3>

//         <div className="modal-header-actions">
//           <button onClick={onClose} className="btn-secondary">
//             Отмена
//           </button>
//           <button
//             onClick={apply}
//             disabled={loading || !selectedLine || !selectedRegistry}
//           >
//             {loading ? "Применение..." : "Применить"}
//           </button>
//         </div>
//       </div>

//       {/* ===== BODY (скролл) ===== */}
//       <div className="modal-body">
//         <div className="modal-grid">

//           {/* ЛЕВАЯ ЧАСТЬ — СЧЕТ */}
//           <div>
//             <h4>Строки счета</h4>

//             {invoiceLines.map((l) => (
//               <div
//                 key={l.line_no}
//                 className={`
//                   select-row
//                   ${selectedLine?.line_no === l.line_no ? "active" : ""}
//                   ${l.used ? "used" : ""}
//                 `}
//                 onClick={() => !l.used && setSelectedLine(l)}
//               >
//                 <b>{l.line_no}</b> {l.description}

//                 <div className="muted">
//                   {l.quantity} × {l.price} = {l.total}
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* ПРАВАЯ ЧАСТЬ — РЕЕСТР */}
//           <div>
//             <h4>Строки реестра</h4>

//             {registryRows.map((r) => (
//               <div
//                 key={r.id}
//                 className={`
//                   select-row
//                   ${selectedRegistry?.id === r.id ? "active" : ""}
//                 `}
//                 onClick={() => setSelectedRegistry(r)}
//               >
//                 <b>ID {r.id}</b> {r.vehicle} ({r.license_plate})

//                 <div className="muted">
//                   Сумма: {r.amount}
//                 </div>
//               </div>
//             ))}
//           </div>

//         </div>
//       </div>

//     </div>
//   </div>
// );

// };

// export default InvoiceMatchModal;

import React, { useEffect, useState } from "react";
import "../index.css";

const InvoiceMatchModal = ({
  invoice,
  registryRows,
  onClose,
  onApplied,
}) => {
  const [invoiceLines, setInvoiceLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedRegistry, setSelectedRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applyType, setApplyType] = useState("full"); // "full", "metadata_only", "amount_only"
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoice?.id || "");

  // Загружаем строки счета при монтировании
  useEffect(() => {
    if (invoice?.id) {
      fetch(`http://localhost:8000/invoice/${invoice.id}/lines`)
        .then((r) => r.json())
        .then(setInvoiceLines);
    }
  }, [invoice?.id]);

  // Загружаем все доступные счета для batch
  useEffect(() => {
    if (registryRows && registryRows.length > 0) {
      const batchId = registryRows[0].batch_id;
      if (batchId) {
        fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
          .then(r => r.json())
          .then(data => {
            setAvailableInvoices(data.invoices || []);
            // Если у нас уже выбран счет, проверяем что он в списке
            if (invoice?.id && !data.invoices?.some(i => i.id === invoice.id)) {
              // Если счета нет в списке, добавляем его из пропсов
              setAvailableInvoices(prev => {
                if (prev.some(i => i.id === invoice.id)) return prev;
                return [...prev, {
                  id: invoice.id,
                  file: invoice.filename || "Текущий счет",
                  invoice_full_text: invoice.details?.invoice_full_text || 
                    (invoice.details?.invoice_number && invoice.details?.invoice_date ? 
                      `Счет на оплату № ${invoice.details.invoice_number} от ${invoice.details.invoice_date}` : 
                      "Счет без реквизитов"),
                  contractor: invoice.details?.contractor,
                  total: invoice.details?.total,
                  lines_count: invoiceLines.length
                }];
              });
            }
          })
          .catch(err => console.error("Ошибка загрузки счетов:", err));
      }
    }
  }, [registryRows, invoice, invoiceLines.length]);

  // Автоматически выбираем первый счет если не выбран
  useEffect(() => {
    if (availableInvoices.length > 0 && !selectedInvoiceId) {
      setSelectedInvoiceId(availableInvoices[0].id);
    }
  }, [availableInvoices, selectedInvoiceId]);

  const apply = async () => {
    if (!selectedRegistry) {
      alert("Выберите строку реестра для применения счета");
      return;
    }

    const invoiceIdToApply = selectedInvoiceId || invoice?.id;
    if (!invoiceIdToApply) {
      alert("Не выбран счет для применения");
      return;
    }

    setLoading(true);

    try {
      // Определяем тип применения
      let endpoint;
      let requestBody;

      if (applyType === "full" && selectedLine) {
        // Полное применение с конкретной строкой счета
        endpoint = "http://localhost:8000/invoice/apply-line";
        requestBody = {
          invoice_id: invoiceIdToApply,
          line_no: selectedLine.line_no,
          registry_id: selectedRegistry.id,
        };
      } else {
        // Применение через новый endpoint для разных типов
        endpoint = "http://localhost:8000/invoice/manual-match";
        requestBody = {
          batch_id: selectedRegistry.batch_id || registryRows[0]?.batch_id,
          registry_id: selectedRegistry.id,
          invoice_id: invoiceIdToApply,
          apply_type: applyType
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const result = await res.json();
      
      if (result.status === "ok") {
        alert(`Счет успешно применен!`);
        onApplied();
        onClose();
      } else {
        alert("Ошибка: " + (result.message || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Ошибка применения счета:", error);
      alert(`Ошибка применения счета: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Получаем выбранный счет
  const selectedInvoice = availableInvoices.find(i => i.id === selectedInvoiceId) || invoice;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        {/* ===== HEADER ===== */}
        <div className="modal-header">
          <h3>🧾 Сопоставление счета</h3>
          <div className="modal-header-actions">
            <button onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button
              onClick={apply}
              disabled={loading || !selectedRegistry}
              className="btn-primary"
            >
              {loading ? "Применение..." : "Применить"}
            </button>
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className="modal-body">
          
          {/* ВЫБОР СЧЕТА */}
          <div className="section">
            <h4>Выберите счет</h4>
            <div className="invoice-selector">
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="full-width-select"
              >
                {availableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.file} - {inv.invoice_full_text || "Счет без реквизитов"}
                    {inv.contractor ? ` (${inv.contractor})` : ""}
                  </option>
                ))}
              </select>
            </div>
            
            {/* ИНФОРМАЦИЯ О ВЫБРАННОМ СЧЕТЕ */}
            {selectedInvoice && (
              <div className="invoice-info-card">
                <div className="info-row">
                  <span className="info-label">Реквизиты:</span>
                  <span className="info-value">
                    {selectedInvoice.invoice_full_text || 
                      (selectedInvoice.details?.invoice_number && selectedInvoice.details?.invoice_date ?
                        `Счет на оплату № ${selectedInvoice.details.invoice_number} от ${selectedInvoice.details.invoice_date}` :
                        "Реквизиты не указаны")}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Контрагент:</span>
                  <span className="info-value">
                    {selectedInvoice.contractor || selectedInvoice.details?.contractor || "Не указан"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Сумма:</span>
                  <span className="info-value">
                    {selectedInvoice.total || selectedInvoice.details?.total || "Не указана"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ВЫБОР ТИПА ПРИМЕНЕНИЯ */}
          <div className="section">
            <h4>Тип применения</h4>
            <div className="apply-type-selector">
              <label className="apply-type-option">
                <input
                  type="radio"
                  name="applyType"
                  value="full"
                  checked={applyType === "full"}
                  onChange={(e) => setApplyType(e.target.value)}
                />
                <div className="option-content">
                  <strong>Полное применение</strong>
                  <small>Реквизиты + сумма из выбранной строки счета</small>
                </div>
              </label>
              
              <label className="apply-type-option">
                <input
                  type="radio"
                  name="applyType"
                  value="metadata_only"
                  checked={applyType === "metadata_only"}
                  onChange={(e) => setApplyType(e.target.value)}
                />
                <div className="option-content">
                  <strong>Только реквизиты</strong>
                  <small>Номер, дата, контрагент (сумма не изменится)</small>
                </div>
              </label>
              
              <label className="apply-type-option">
                <input
                  type="radio"
                  name="applyType"
                  value="amount_only"
                  checked={applyType === "amount_only"}
                  onChange={(e) => setApplyType(e.target.value)}
                />
                <div className="option-content">
                  <strong>Только сумма</strong>
                  <small>Только сумма из счета (реквизиты не изменятся)</small>
                </div>
              </label>
            </div>
          </div>

          <div className="modal-grid">
            {/* ЛЕВАЯ ЧАСТЬ — СТРОКИ СЧЕТА (только для полного применения) */}
            {applyType === "full" && (
              <div className="section">
                <h4>Строки счета</h4>
                <div className="scrollable-list">
                  {invoiceLines.length > 0 ? (
                    invoiceLines.map((l) => (
                      <div
                        key={l.line_no}
                        className={`
                          select-row
                          ${selectedLine?.line_no === l.line_no ? "active" : ""}
                          ${l.used ? "used" : ""}
                        `}
                        onClick={() => !l.used && setSelectedLine(l)}
                      >
                        <div className="row-header">
                          <b>Строка {l.line_no}</b>
                          {l.used && <span className="used-badge">Использована</span>}
                        </div>
                        <div className="row-description">{l.description}</div>
                        <div className="row-details">
                          {l.quantity} × {l.price} = <strong>{l.total}</strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p>Строки счета не найдены</p>
                      <small>При полном применении будет использована общая сумма счета</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ПРАВАЯ ЧАСТЬ — СТРОКИ РЕЕСТРА */}
            <div className="section">
              <h4>Строки реестра</h4>
              <div className="scrollable-list">
                {registryRows.map((r) => (
                  <div
                    key={r.id}
                    className={`
                      select-row
                      ${selectedRegistry?.id === r.id ? "active" : ""}
                      ${r.invoice_id ? "has-invoice" : ""}
                    `}
                    onClick={() => setSelectedRegistry(r)}
                  >
                    <div className="row-header">
                      <b>ID {r.id}</b>
                      {r.invoice_id && <span className="invoice-badge">Счет привязан</span>}
                    </div>
                    <div className="row-description">
                      {r.vehicle || "Без названия"} ({r.license_plate || "без номера"})
                    </div>
                    <div className="row-details">
                      {r.contractor && <div>Контрагент: {r.contractor}</div>}
                      {r.amount && <div>Сумма: <strong>{r.amount}</strong></div>}
                      {r.invoice_details?.invoice_number && (
                        <div>Счет: № {r.invoice_details.invoice_number}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ИНФОРМАЦИЯ О ВЫБРАННЫХ ЭЛЕМЕНТАХ */}
          {(selectedRegistry || selectedLine) && (
            <div className="selection-summary">
              <h4>Будет применено:</h4>
              <div className="summary-grid">
                {selectedRegistry && (
                  <div className="summary-item">
                    <div className="summary-label">К строке реестра:</div>
                    <div className="summary-value">
                      ID {selectedRegistry.id} - {selectedRegistry.vehicle} ({selectedRegistry.license_plate})
                    </div>
                  </div>
                )}
                
                {applyType === "full" && selectedLine && (
                  <div className="summary-item">
                    <div className="summary-label">Строка счета:</div>
                    <div className="summary-value">
                      Строка {selectedLine.line_no}: {selectedLine.description} ({selectedLine.total})
                    </div>
                  </div>
                )}
                
                <div className="summary-item">
                  <div className="summary-label">Тип применения:</div>
                  <div className="summary-value">
                    {applyType === "full" ? "Полное (реквизиты + сумма)" : 
                     applyType === "metadata_only" ? "Только реквизиты" : 
                     "Только сумма"}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default InvoiceMatchModal;