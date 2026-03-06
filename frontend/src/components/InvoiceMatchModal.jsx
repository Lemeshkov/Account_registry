
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
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [selectedRegistry, setSelectedRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applyType, setApplyType] = useState("full");
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoice?.id || "");
  const [isValid, setIsValid] = useState(false);
  const [totalSelectedAmount, setTotalSelectedAmount] = useState(0);

  // Устанавливаем выбранную строку реестра
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

  // Загружаем строки счета при изменении выбранного счета
  useEffect(() => {
    const loadLines = async () => {
      console.log("🔄 [InvoiceMatchModal] Загрузка строк...");
      
      const invoiceIdToUse = selectedInvoiceId || invoice?.id;
      
      if (!invoiceIdToUse) {
        console.log("⚠️ Нет invoiceId для загрузки строк");
        setInvoiceLines([]);
        setSelectedLines(new Set());
        return;
      }
      
      console.log(`📥 Загружаем строки для invoice: ${invoiceIdToUse}`);
      
      try {
        const response = await fetch(`http://localhost:8000/invoice/${invoiceIdToUse}/lines`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        console.log(`✅ Получено ${data.length} строк`);
        
        const filteredData = data.filter(line => !line.used);
        console.log(`✅ Доступно для выбора: ${filteredData.length} строк`);
        
        setInvoiceLines(filteredData);
        setSelectedLines(new Set());
        
      } catch (error) {
        console.error("❌ Ошибка загрузки строк:", error);
        setInvoiceLines([]);
        setSelectedLines(new Set());
      }
    };
    
    loadLines();
  }, [selectedInvoiceId, invoice?.id]);

  // Обновляем общую сумму выбранных строк
  useEffect(() => {
    let total = 0;
    selectedLines.forEach(lineNo => {
      const line = invoiceLines.find(l => l.line_no === lineNo);
      if (line && line.total) {
        total += parseFloat(line.total) || 0;
      }
    });
    setTotalSelectedAmount(total);
  }, [selectedLines, invoiceLines]);

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
    const hasInvoice = !!selectedInvoiceId;
    const hasRegistry = !!selectedRegistry;
    const hasSelectedLines = applyType !== "full" || selectedLines.size > 0;
    
    setIsValid(hasInvoice && hasRegistry && hasSelectedLines);
  }, [selectedInvoiceId, selectedRegistry, applyType, selectedLines]);

  // Функция для выбора/отмены выбора строки
  const toggleLineSelection = (lineNo) => {
    const newSelectedLines = new Set(selectedLines);
    if (newSelectedLines.has(lineNo)) {
      newSelectedLines.delete(lineNo);
    } else {
      newSelectedLines.add(lineNo);
    }
    setSelectedLines(newSelectedLines);
  };

  // Функция для применения выбранных строк
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
      let endpoint, requestBody;
      const currentBatchId = selectedRegistry.batch_id;
      
      if (applyType === "full" && selectedLines.size > 0) {
        endpoint = "http://localhost:8000/invoice/apply-multiple-lines";
        requestBody = {
          invoice_id: invoiceIdToApply,
          line_nos: Array.from(selectedLines),
          registry_id: selectedRegistry.id,
          batch_id: currentBatchId
        };
      } else if (applyType === "full" && selectedLines.size === 0) {
        endpoint = "http://localhost:8000/invoice/apply-all-lines";
        requestBody = {
          invoice_id: invoiceIdToApply,
          registry_id: selectedRegistry.id,
          batch_id: currentBatchId
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
        await onManualApply(
          invoiceIdToApply, 
          selectedRegistry.id, 
          applyType, 
          selectedLines.size > 0 ? Array.from(selectedLines) : null
        );
        
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

  // Получаем выбранный счет
  const selectedInvoice = availableInvoices.find(i => i.id === selectedInvoiceId) || invoice;

  // Функция для выбора всех строк
  const selectAllLines = () => {
    const allLineNos = invoiceLines.map(line => line.line_no);
    setSelectedLines(new Set(allLineNos));
  };

  // Функция для отмены выбора всех строк
  const deselectAllLines = () => {
    setSelectedLines(new Set());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal invoice-match-modal" style={{ width: "900px", maxHeight: "90vh" }}>
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

        <div className="modal-body" style={{ overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}>
          
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
                  <span className="registry-info-label">Текущая сумма:</span>
                  <span className="registry-info-value amount">
                    {selectedRegistry?.amount || "0,00"}
                  </span>
                </div>
                <div className="registry-info-item">
                  <span className="registry-info-label">Новая сумма:</span>
                  <span className="registry-info-value amount highlight">
                    {totalSelectedAmount > 0 ? totalSelectedAmount.toFixed(2) : selectedRegistry?.amount || "0,00"}
                  </span>
                </div>
              </div>
              
              <div className="registry-note">
                <span className="note-icon">ℹ️</span>
                <span className="note-text">
                  Эта строка была выбрана в таблице реестра. При нажатии "Привязать счет" выбранный ниже счет будет привязан именно к этой строке.
                  {selectedLines.size > 0 && ` Выбрано ${selectedLines.size} строк счета на сумму ${totalSelectedAmount.toFixed(2)}.`}
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
                    <span className="info-label">Общая сумма счета:</span>
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
                      Реквизиты счета (номер, дата, контрагент) + выбранные строки счета
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
                      Только сумма из выбранных строк. Реквизиты останутся прежними.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="apply-type-description">
              <div className="description-content">
                <strong>Будет обновлено:</strong>
                <ul>
                  {applyType === "full" && (
                    <>
                      <li>Номер и дата счета</li>
                      <li>Контрагент</li>
                      <li>Сумма выбранных строк: {totalSelectedAmount.toFixed(2)}</li>
                      <li>Выбрано строк: {selectedLines.size}</li>
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
                      <li>Сумма выбранных строк: {totalSelectedAmount.toFixed(2)}</li>
                      <li>Реквизиты останутся прежними</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* СЕКЦИЯ 4: ВЫБОР СТРОК СЧЕТА */}
          {applyType === "full" && invoiceLines.length > 0 && (
            <div className="section">
              <h4 className="section-title">
                <span className="section-icon">📝</span>
                Выберите строки счета для привязки
                <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                  <button 
                    onClick={selectAllLines}
                    className="btn-small btn-secondary"
                  >
                    Выбрать все
                  </button>
                  <button 
                    onClick={deselectAllLines}
                    className="btn-small btn-secondary"
                  >
                    Снять выбор
                  </button>
                </div>
              </h4>
              
              <div className="invoice-lines-container">
                <div className="lines-header">
                  <span>
                    Доступно строк: {invoiceLines.length} | 
                    Выбрано: {selectedLines.size} | 
                    Сумма выбранных: {totalSelectedAmount.toFixed(2)}
                  </span>
                  <span className="hint-text">Вы можете выбрать несколько строк — их суммы будут суммированы</span>
                </div>
                
                <div className="lines-list">
                  {invoiceLines.map((line) => (
                    <div
                      key={line.line_no}
                      className={`invoice-line ${selectedLines.has(line.line_no) ? "selected" : ""}`}
                      onClick={() => toggleLineSelection(line.line_no)}
                    >
                      <div className="line-header">
                        <div className="line-number">
                          <input
                            type="checkbox"
                            checked={selectedLines.has(line.line_no)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleLineSelection(line.line_no);
                            }}
                            style={{ marginRight: "8px" }}
                          />
                          <span className="number">Строка {line.line_no}</span>
                        </div>
                        <div className="line-amount">{line.total}</div>
                      </div>
                      <div className="line-description">{line.description || "Без описания"}</div>
                      {line.quantity && line.price && (
                        <div className="line-details">
                          {line.quantity} × {line.price} = {line.total}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {selectedLines.size === 0 && (
                  <div className="selection-hint">
                    <div className="hint-icon">👆</div>
                    <div className="hint-text">
                      <strong>Выберите строки счета для привязки</strong><br />
                      Нажмите на строку, чтобы выбрать ее. Можно выбрать несколько строк — их суммы будут суммированы.
                    </div>
                  </div>
                )}
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
                    {applyType === "full" ? `📋 Полная (${selectedLines.size} строк)` : 
                     applyType === "metadata_only" ? "📄 Только реквизиты" : 
                     `💰 Только сумма (${selectedLines.size} строк)`}
                  </span>
                </div>
              </div>
              
              <div className="summary-row">
                <div className="summary-label">Итоговая сумма:</div>
                <div className="summary-value">
                  <span className="final-amount">
                    {applyType === "metadata_only" 
                      ? (selectedRegistry?.amount || "0,00")
                      : selectedLines.size > 0 
                        ? `${totalSelectedAmount.toFixed(2)} (${selectedLines.size} строк)`
                        : (selectedInvoice?.total || selectedInvoice?.details?.total || "0,00")
                    }
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
                    `✅ Привязать ${selectedLines.size > 0 ? `${selectedLines.size} строк ` : ''}к строке ID ${selectedRegistry?.id}`
                  )}
                </button>
                
                {!isValid && (
                  <div className="validation-hint">
                    {!selectedInvoiceId 
                      ? "⚠️ Для привязки необходимо выбрать счет из списка"
                      : applyType === "full" && selectedLines.size === 0
                      ? "⚠️ Для полной привязки необходимо выбрать хотя бы одну строку счета"
                      : "⚠️ Заполните все обязательные поля"
                    }
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