import React, { useEffect, useState } from 'react'
import '../styles.css'

const PAYERS = [
  'Сибуглеснаб',
  'ООО Ромашка',
  'ИП Иванов'
]

const PAYMENT_SYSTEMS = [
  'Предоплата',
  'Постоплата'
]

const RegistryPreview = ({ data }) => {
  const [rows, setRows] = useState([])

  // инициализация строк + дефолтные значения
  useEffect(() => {
    if (data && data.length) {
      setRows(
        data.map(r => ({
          ...r,
          payer: r.payer || 'Сибуглеснаб',
          payment_system: r.payment_system || 'Предоплата',
          included_in_plan: true
        }))
      )
    }
  }, [data])

  const updateRow = (index, field, value) => {
    setRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    )
  }

  if (!rows.length) {
    return (
      <div className="requests-table" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>📑 Реестр не сформирован</h3>
        <p>Загрузите документ, чтобы увидеть предпросмотр</p>
      </div>
    )
  }

  return (
    <div className="requests-table">
      <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
        <h3>📑 Предпросмотр реестра</h3>
        <p>Всего строк: {rows.length}</p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Поставщик</th>
              <th>Реквизиты счета</th>
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
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.id}</td>
                <td>{r.supplier}</td>
                <td>{r.invoice_details}</td>
                <td>{r.contractor}</td>

                {/* Плательщик */}
                <td>
                  <select
                    className="payer-select"
                    value={r.payer}
                    onChange={e => updateRow(i, 'payer', e.target.value)}
                  >
                    {PAYERS.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>

                <td>{r.amount}</td>
                <td>{r.vat_amount}</td>

                {/* Учтено — всегда Да */}
                <td>Да</td>

                {/* Система расчетов */}
                <td>
                  <select
                    className="payer-select"
                    value={r.payment_system}
                    onChange={e =>
                      updateRow(i, 'payment_system', e.target.value)
                    }
                  >
                    {PAYMENT_SYSTEMS.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>

                <td>{r.comment}</td>
                <td>{r.vehicle}</td>
                <td>{r.license_plate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RegistryPreview
