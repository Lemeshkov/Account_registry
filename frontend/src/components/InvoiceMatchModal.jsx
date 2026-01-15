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

  useEffect(() => {
    fetch(`http://localhost:8000/invoice/${invoice.id}/lines`)
      .then((r) => r.json())
      .then(setInvoiceLines);
  }, [invoice.id]);

  const apply = async () => {
    if (!selectedLine || !selectedRegistry) {
      alert("Выберите строку счета и строку реестра");
      return;
    }

    setLoading(true);

    const res = await fetch("http://localhost:8000/invoice/apply-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoice.id,
        line_no: selectedLine.line_no,
        registry_id: selectedRegistry.id,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      alert("Ошибка применения строки");
      return;
    }

    onApplied();
    onClose();
  };

 return (
  <div className="modal-backdrop">
    <div className="modal">

      {/* ===== HEADER (прибитый) ===== */}
      <div className="modal-header">
        <h3>🧾 Сопоставление счета</h3>

        <div className="modal-header-actions">
          <button onClick={onClose} className="btn-secondary">
            Отмена
          </button>
          <button
            onClick={apply}
            disabled={loading || !selectedLine || !selectedRegistry}
          >
            {loading ? "Применение..." : "Применить"}
          </button>
        </div>
      </div>

      {/* ===== BODY (скролл) ===== */}
      <div className="modal-body">
        <div className="modal-grid">

          {/* ЛЕВАЯ ЧАСТЬ — СЧЕТ */}
          <div>
            <h4>Строки счета</h4>

            {invoiceLines.map((l) => (
              <div
                key={l.line_no}
                className={`
                  select-row
                  ${selectedLine?.line_no === l.line_no ? "active" : ""}
                  ${l.used ? "used" : ""}
                `}
                onClick={() => !l.used && setSelectedLine(l)}
              >
                <b>{l.line_no}</b> {l.description}

                <div className="muted">
                  {l.quantity} × {l.price} = {l.total}
                </div>
              </div>
            ))}
          </div>

          {/* ПРАВАЯ ЧАСТЬ — РЕЕСТР */}
          <div>
            <h4>Строки реестра</h4>

            {registryRows.map((r) => (
              <div
                key={r.id}
                className={`
                  select-row
                  ${selectedRegistry?.id === r.id ? "active" : ""}
                `}
                onClick={() => setSelectedRegistry(r)}
              >
                <b>ID {r.id}</b> {r.vehicle} ({r.license_plate})

                <div className="muted">
                  Сумма: {r.amount}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  </div>
);

};

export default InvoiceMatchModal;
