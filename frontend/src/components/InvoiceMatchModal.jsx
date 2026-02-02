
import React, { useEffect, useState } from "react";
import "../index.css";

const InvoiceMatchModal = ({
  invoice,
  registryRows,
  selectedRegistryRowId,
  onClose,
  onApplied,
  onManualApply
}) => {
  const [invoiceLines, setInvoiceLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedRegistry, setSelectedRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applyType, setApplyType] = useState("full");
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoice?.id || "");
  const [isValid, setIsValid] = useState(false);

  // Устанавливаем выбранную строку реестра (только переданную)
  useEffect(() => {
    if (registryRows && registryRows.length > 0) {
      const targetRow = selectedRegistryRowId 
        ? registryRows.find(r => r.id === selectedRegistryRowId)
        : registryRows[0];
      
      if (targetRow) {
        setSelectedRegistry(targetRow);
        console.log("✅ Установлена целевая строка реестра:", targetRow.id);
      }
    }
  }, [registryRows, selectedRegistryRowId]);

  // Загружаем строки счета
  useEffect(() => {
    if (invoice?.id) {
      fetch(`http://localhost:8000/invoice/${invoice.id}/lines`)
        .then((r) => r.json())
        .then(setInvoiceLines);
    }
  }, [invoice?.id]);

  // Загружаем доступные счета
  useEffect(() => {
    if (registryRows && registryRows.length > 0) {
      const batchId = registryRows[0].batch_id;
      if (batchId) {
        fetch(`http://localhost:8000/registry/${batchId}/invoices-from-buffer`)
          .then(r => r.json())
          .then(data => {
            setAvailableInvoices(data.invoices || []);
          })
          .catch(err => console.error("Ошибка загрузки счетов:", err));
      }
    }
  }, [registryRows]);

  // Автоматически выбираем первый счет если не выбран
  useEffect(() => {
    if (availableInvoices.length > 0 && !selectedInvoiceId) {
      setSelectedInvoiceId(availableInvoices[0].id);
    }
  }, [availableInvoices, selectedInvoiceId]);

  // Проверяем валидность формы
  useEffect(() => {
    // Для применения нужен счет и должна быть выбрана строка реестра
    const hasInvoice = !!selectedInvoiceId;
    const hasRegistry = !!selectedRegistry;
    
    setIsValid(hasInvoice && hasRegistry);
  }, [selectedInvoiceId, selectedRegistry, applyType]);

  // В функции apply в InvoiceMatchModal.jsx добавьте:
const apply = async () => {
  if (!isValid) {
    alert("Пожалуйста, выберите счет для привязки");
    return;
  }

  const invoiceIdToApply = selectedInvoiceId;
  if (!invoiceIdToApply) {
    alert("Не выбран счет для применения");
    return;
  }

  setLoading(true);

  try {
    // Создаем запрос
    let endpoint, requestBody;
    const currentBatchId = selectedRegistry.batch_id;
    
    if (applyType === "full" && selectedLine) {
      endpoint = "http://localhost:8000/invoice/apply-line";
      requestBody = {
        invoice_id: invoiceIdToApply,
        line_no: selectedLine.line_no,
        registry_id: selectedRegistry.id,
      };
    } else {
      endpoint = "http://localhost:8000/invoice/manual-match";
      requestBody = {
        batch_id: currentBatchId,
        registry_id: selectedRegistry.id,
        invoice_id: invoiceIdToApply,
        apply_type: applyType
      };
    }

    console.log("📤 Отправка запроса:", { endpoint, requestBody });

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
      // Вызываем onManualApply для локального обновления
      await onManualApply(invoiceIdToApply, selectedRegistry.id, applyType, selectedLine?.line_no);
      
      // Закрываем модалку
      onClose();
    } else {
      alert("❌ Ошибка: " + (result.message || "Неизвестная ошибка"));
    }
  } catch (error) {
    console.error("❌ Ошибка применения счета:", error);
    alert(`❌ Ошибка привязки счета: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  // const apply = async () => {
  //   if (!isValid) {
  //     alert("Пожалуйста, выберите счет для привязки");
  //     return;
  //   }

  //   const invoiceIdToApply = selectedInvoiceId;
  //   if (!invoiceIdToApply) {
  //     alert("Не выбран счет для применения");
  //     return;
  //   }

  //   setLoading(true);

  //   try {
  //     // Создаем запрос
  //     let endpoint, requestBody;
  //     const currentBatchId = selectedRegistry.batch_id;
      
  //     if (applyType === "full" && selectedLine) {
  //       // Полное применение с конкретной строкой счета
  //       endpoint = "http://localhost:8000/invoice/apply-line";
  //       requestBody = {
  //         invoice_id: invoiceIdToApply,
  //         line_no: selectedLine.line_no,
  //         registry_id: selectedRegistry.id,
  //       };
  //     } else {
  //       // Применение через новый endpoint для разных типов
  //       endpoint = "http://localhost:8000/invoice/manual-match";
  //       requestBody = {
  //         batch_id: currentBatchId,
  //         registry_id: selectedRegistry.id,
  //         invoice_id: invoiceIdToApply,
  //         apply_type: applyType
  //       };
  //     }

  //     console.log("📤 Отправка запроса:", { endpoint, requestBody });

  //     const res = await fetch(endpoint, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(requestBody),
  //     });

  //     if (!res.ok) {
  //       const errorText = await res.text();
  //       throw new Error(`HTTP ${res.status}: ${errorText}`);
  //     }

  //     const result = await res.json();
      
  //     if (result.status === "ok") {
  //       alert(`✅ Счет успешно привязан к строке ID ${selectedRegistry.id}!`);
  //       onApplied();
  //       onClose();
  //     } else {
  //       alert("❌ Ошибка: " + (result.message || "Неизвестная ошибка"));
  //     }
  //   } catch (error) {
  //     console.error("❌ Ошибка применения счета:", error);
  //     alert(`❌ Ошибка привязки счета: ${error.message}`);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Получаем выбранный счет
  const selectedInvoice = availableInvoices.find(i => i.id === selectedInvoiceId) || invoice;

  return (
    <div className="modal-backdrop">
      <div className="modal invoice-match-modal">
        {/* ===== HEADER ===== */}
        <div className="modal-header">
          <div className="modal-header-left">
            <h3>🎯 Привязка счета к строке реестра</h3>
            <div className="modal-subtitle">
              Выбрана строка реестра: <strong>ID {selectedRegistry?.id}</strong>
              {selectedRegistry?.vehicle && ` (${selectedRegistry.vehicle})`}
            </div>
          </div>
          <div className="modal-header-actions">
            <button onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button
              onClick={apply}
              disabled={loading || !isValid}
              className="btn-primary"
            >
              {loading ? "⏳ Привязка..." : "✅ Привязать счет"}
            </button>
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className="modal-body">
          
          {/* СЕКЦИЯ 1: ИНФОРМАЦИЯ О ВЫБРАННОЙ СТРОКЕ РЕЕСТРА */}
          <div className="section">
            <h4 className="section-title">
              <span className="section-icon">📋</span>
              Целевая строка реестра
              <span className="selection-badge">Предварительно выбрана</span>
            </h4>
            
            <div className="selected-registry-info">
              <div className="registry-info-grid">
                <div className="registry-info-item">
                  <span className="registry-info-label">ID строки:</span>
                  <span className="registry-info-value id">{selectedRegistry?.id}</span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Техника:</span>
                  <span className="registry-info-value">{selectedRegistry?.vehicle || "Не указана"}</span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Госномер:</span>
                  <span className="registry-info-value">{selectedRegistry?.license_plate || "Не указан"}</span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Контрагент:</span>
                  <span className="registry-info-value">{selectedRegistry?.contractor || "Не указан"}</span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Сумма:</span>
                  <span className="registry-info-value amount">
                    {selectedRegistry?.amount || "0,00"}
                  </span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Привязанный счет:</span>
                  <span className="registry-info-value">
                    {selectedRegistry?.invoice_id ? `Да (ID: ${selectedRegistry.invoice_id.slice(0, 8)}...)` : "Нет"}
                  </span>
                </div>
              </div>
              
              <div className="registry-note">
                <span className="note-icon">ℹ️</span>
                <span className="note-text">
                  Эта строка была выбрана в таблице реестра. При нажатии "Привязать счет" выбранный ниже счет будет привязан именно к этой строке.
                </span>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 2: ВЫБОР СЧЕТА */}
          <div className="section">
            <h4 className="section-title">
              <span className="section-icon">📄</span>
              Выберите счет для привязки
              <span className="required-badge">Обязательно</span>
            </h4>
            
            <div className="invoice-selector-container">
              <div className="selector-header">
                <span>Доступные счета из буфера:</span>
                <span className="count-badge">{availableInvoices.length} шт.</span>
              </div>
              
              {availableInvoices.length > 0 ? (
                <>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="invoice-select"
                    required
                  >
                    <option value="">-- Выберите счет --</option>
                    {availableInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_full_text || inv.file || `Счет ${inv.id.slice(0, 8)}`}
                        {inv.contractor ? ` — ${inv.contractor}` : ''}
                      </option>
                    ))}
                  </select>
                  
                  {/* Валидация */}
                  {!selectedInvoiceId && (
                    <div className="validation-error">
                      ⚠️ Пожалуйста, выберите счет для привязки
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-invoices">
                  <div className="empty-icon">📭</div>
                  <div className="empty-text">
                    <p>Нет доступных счетов в буфере</p>
                    <small>Загрузите PDF-счета, чтобы они появились в этом списке</small>
                  </div>
                </div>
              )}
            </div>
            
            {/* Информация о выбранном счете */}
            {selectedInvoice && selectedInvoiceId && (
              <div className="selected-invoice-info">
                <h5>Информация о выбранном счете:</h5>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Реквизиты:</span>
                    <span className="info-value">
                      {selectedInvoice.invoice_full_text || 
                       selectedInvoice.details?.invoice_full_text || 
                       "Реквизиты не указаны"}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Контрагент:</span>
                    <span className="info-value">
                      {selectedInvoice.contractor || selectedInvoice.details?.contractor || "Не указан"}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Сумма:</span>
                    <span className="info-value amount">
                      {selectedInvoice.total || selectedInvoice.details?.total || "Не указана"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* СЕКЦИЯ 3: ТИП ПРИВЯЗКИ */}
          <div className="section">
            <h4 className="section-title">
              <span className="section-icon">⚙️</span>
              Настройки привязки
            </h4>
            
            <div className="apply-type-selector">
              <div className="apply-type-options">
                <label className={`apply-type-option ${applyType === "full" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="applyType"
                    value="full"
                    checked={applyType === "full"}
                    onChange={(e) => setApplyType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">
                      <span className="option-icon">📋</span>
                      Полная привязка
                    </div>
                    <div className="option-description">
                      Реквизиты счета (номер, дата, контрагент) + общая сумма счета
                    </div>
                  </div>
                </label>
                
                <label className={`apply-type-option ${applyType === "metadata_only" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="applyType"
                    value="metadata_only"
                    checked={applyType === "metadata_only"}
                    onChange={(e) => setApplyType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">
                      <span className="option-icon">📄</span>
                      Только реквизиты
                    </div>
                    <div className="option-description">
                      Только реквизиты счета (номер, дата, контрагент). Сумма останется прежней.
                    </div>
                  </div>
                </label>
                
                <label className={`apply-type-option ${applyType === "amount_only" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="applyType"
                    value="amount_only"
                    checked={applyType === "amount_only"}
                    onChange={(e) => setApplyType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">
                      <span className="option-icon">💰</span>
                      Только сумма
                    </div>
                    <div className="option-description">
                      Только общая сумма из счета. Реквизиты останутся прежними.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Описание выбранного типа */}
            <div className="apply-type-description">
              <div className="description-content">
                <strong>Будет обновлено:</strong>
                <ul>
                  {applyType === "full" && (
                    <>
                      <li>Номер и дата счета</li>
                      <li>Контрагент</li>
                      <li>Общая сумма счета</li>
                    </>
                  )}
                  {applyType === "metadata_only" && (
                    <>
                      <li>Номер и дата счета</li>
                      <li>Контрагент</li>
                      <li>Сумма останется: {selectedRegistry?.amount || "0,00"}</li>
                    </>
                  )}
                  {applyType === "amount_only" && (
                    <>
                      <li>Общая сумма счета</li>
                      <li>Реквизиты останутся прежними</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 4: СТРОКИ СЧЕТА (только для информации) */}
          {applyType === "full" && invoiceLines.length > 0 && (
            <div className="section">
              <h4 className="section-title">
                <span className="section-icon">📝</span>
                Строки выбранного счета
                <span className="section-subtitle">Для информации</span>
              </h4>
              
              <div className="invoice-lines-container">
                <div className="lines-header">
                  <span>Найдено строк: {invoiceLines.length}</span>
                  <span className="hint-text">При полной привязке используется общая сумма счета</span>
                </div>
                
                <div className="lines-list">
                  {invoiceLines.map((l) => (
                    <div
                      key={l.line_no}
                      className={`invoice-line ${selectedLine?.line_no === l.line_no ? "selected" : ""} ${l.used ? "used" : ""}`}
                      onClick={() => !l.used && setSelectedLine(l)}
                    >
                      <div className="line-header">
                        <div className="line-number">
                          <span className="number">Строка {l.line_no}</span>
                          {l.used && <span className="used-badge">Использована</span>}
                        </div>
                        <div className="line-amount">{l.total}</div>
                      </div>
                      <div className="line-description">{l.description || "Без описания"}</div>
                      {l.quantity && l.price && (
                        <div className="line-details">
                          {l.quantity} × {l.price} = {l.total}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* СЕКЦИЯ 5: ИТОГОВАЯ ИНФОРМАЦИЯ */}
          <div className="section summary-section">
            <h4 className="section-title">
              <span className="section-icon">✅</span>
              Итог привязки
            </h4>
            
            <div className="summary-card">
              <div className="summary-row">
                <div className="summary-label">Строка реестра:</div>
                <div className="summary-value">
                  <strong className="registry-id">ID {selectedRegistry?.id}</strong>
                  <span className="registry-details">
                    {selectedRegistry?.vehicle || "Без названия"}
                    {selectedRegistry?.license_plate && ` (${selectedRegistry.license_plate})`}
                  </span>
                </div>
              </div>
              
              <div className="summary-row">
                <div className="summary-label">Счет:</div>
                <div className="summary-value">
                  {selectedInvoice && selectedInvoiceId ? (
                    <>
                      <strong>{selectedInvoice.invoice_full_text || "Счет без реквизитов"}</strong>
                      <span className="invoice-contractor">
                        {selectedInvoice.contractor || selectedInvoice.details?.contractor}
                      </span>
                      <span className="invoice-amount">
                        {selectedInvoice.total || selectedInvoice.details?.total}
                      </span>
                    </>
                  ) : (
                    <span className="no-selection">Не выбран</span>
                  )}
                </div>
              </div>
              
              <div className="summary-row">
                <div className="summary-label">Тип привязки:</div>
                <div className="summary-value">
                  <span className="type-badge">
                    {applyType === "full" ? "📋 Полная" : 
                     applyType === "metadata_only" ? "📄 Только реквизиты" : 
                     "💰 Только сумма"}
                  </span>
                </div>
              </div>
              
              <div className="summary-action">
                <button
                  onClick={apply}
                  disabled={loading || !isValid}
                  className="apply-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Привязка...
                    </>
                  ) : (
                    `✅ Привязать счет к строке ID ${selectedRegistry?.id}`
                  )}
                </button>
                
                {!isValid && (
                  <div className="validation-hint">
                    ⚠️ Для привязки необходимо выбрать счет из списка
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceMatchModal;