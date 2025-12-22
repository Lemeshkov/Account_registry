import React, { useRef } from 'react'

const FileUpload = ({ onFileUpload }) => {
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (file && (file.type.includes('excel') || file.type.includes('sheet') || file.type === 'application/pdf')) {
      onFileUpload(file)
    } else {
      alert('Пожалуйста, выберите Excel или PDF файл')
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div className="upload-section">
      <h3>📤 Загрузите файл с заявками</h3>
      <p>Выберите Excel или PDF файл для загрузки</p>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept=".xlsx,.xls,.pdf"
        style={{ display: 'none' }}
      />
      
      <button 
        className="upload-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        Выбрать файл
      </button>
      
      <div style={{ marginTop: '10px', fontSize: '14px', color: '#6c757d' }}>
        Поддерживаемые форматы: .xlsx, .xls, .pdf
      </div>
    </div>
  )
}

export default FileUpload
