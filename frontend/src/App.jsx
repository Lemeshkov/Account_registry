import React, { useState, useEffect } from 'react'
import FileUpload from './components/FileUpload'
import RegistryPreview from './components/RegistryPreview'
import './index.css'

function App() {
  const [registry, setRegistry] = useState([])
  const [batchId, setBatchId] = useState(null)
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (file) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    if (batchId) {
   formData.append('batch_id', batchId)
}

    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const err = await res.json()
        alert('Ошибка загрузки файла: ' + (err.detail || res.statusText))
        setLoading(false)
        return
      }

      const data = await res.json()

      // Excel — сразу показываем preview
      if (data.registry_preview) {
        setRegistry(data.registry_preview)
      }

      // Если есть batch_id (и PDF), сохраняем для опроса
      if (data.batch_id) {
        setBatchId(data.batch_id)
        pollPreview(data.batch_id)
      } else {
        setLoading(false)
      }

      alert(data.message || 'Файл обработан!')

    } catch (err) {
      alert('Ошибка: ' + err.message)
      setLoading(false)
    }
  }

  // Функция периодического опроса preview
  const pollPreview = async (batchId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/invoice/${batchId}/preview`)
        if (!res.ok) return
        const data = await res.json()

        setRegistry(data.registry_preview || [])
        setPending(data.pending_invoices || 0)

        // Если все счета применены — останавливаем опрос
        if ((data.pending_invoices || 0) === 0) {
          clearInterval(interval)
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        clearInterval(interval)
        setLoading(false)
      }
    }, 2000) // опрашиваем каждые 2 секунды
  }

  return (
    <div className="container">
      <div className="header">
        <h1>📁 Загрузчик заявок и счетов</h1>
        <p>Система автоматически объединяет заявки и счета</p>
      </div>

      <FileUpload onFileUpload={handleFileUpload} />

      {loading && (
        <div style={{ margin: '20px 0', fontSize: '16px', color: '#007bff' }}>
          ⏳ Обработка файла... {pending > 0 ? `Ожидает OCR ${pending} счет(ов)` : ''}
        </div>
      )}

      <RegistryPreview data={registry} />
    </div>
  )
}

export default App
