import React, { useState } from 'react'
import FileUpload from './components/FileUpload'
import RegistryPreview from './components/RegistryPreview'
import './index.css'

function App() {
  const [registry, setRegistry] = useState([])

  const handleFileUpload = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Файл обработан! ${data.count} строк добавлено в реестр`)
        setRegistry(data.registry_preview)
      } else {
        alert('Ошибка загрузки файла')
      }
    } catch (err) {
      alert('Ошибка: ' + err.message)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>📁 Загрузчик заявок и счетов</h1>
        <p>Система автоматически объединяет заявки и счета</p>
      </div>

      <FileUpload onFileUpload={handleFileUpload} />

      <RegistryPreview data={registry} />
    </div>
  )
}

export default App
