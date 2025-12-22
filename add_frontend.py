import os
import shutil

def add_frontend():
    """Добавляет фронтенд к существующему проекту"""
    
    # Переименовываем существующую папку app в backend
    if os.path.exists("app") and not os.path.exists("backend"):
        os.rename("app", "backend")
        print("✅ Переименовано app → backend")
    
    # Создаем структуру фронтенда
    frontend_dirs = [
        "frontend/src",
        "frontend/src/components", 
        "frontend/public"
    ]
    
    for directory in frontend_dirs:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Создана папка: {directory}")
    
    # Файлы фронтенда
    frontend_files = {
        "frontend/package.json": """{
  "name": "uploader-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.1.0",
    "vite": "^4.4.0"
  }
}""",

        "frontend/vite.config.js": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
""",

        "frontend/index.html": """<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Uploader App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
""",

        "frontend/src/main.jsx": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
""",

        "frontend/src/index.css": """* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.upload-section {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
  text-align: center;
  border: 2px dashed #ddd;
}

.upload-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.upload-btn:hover {
  background: #0056b3;
}

.requests-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f8f9fa;
  font-weight: 600;
}
""",

        "frontend/src/App.jsx": """import React, { useState } from 'react'
import FileUpload from './components/FileUpload'
import RequestsTable from './components/RequestsTable'
import './index.css'

function App() {
  const [requests, setRequests] = useState([])

  const handleFileUpload = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Файл обработан! Загружено ${result.imported_count} записей`)
        // Здесь можно обновить список заявок
      } else {
        alert('Ошибка загрузки файла')
      }
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>📁 Загрузчик заявок</h1>
        <p>Загружайте Excel и PDF файлы с заявками на запчасти</p>
      </div>

      <FileUpload onFileUpload={handleFileUpload} />

      <RequestsTable requests={requests} />
    </div>
  )
}

export default App
""",

        "frontend/src/components/FileUpload.jsx": """import React, { useRef } from 'react'

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
""",

        "frontend/src/components/RequestsTable.jsx": """import React from 'react'

const RequestsTable = ({ requests }) => {
  if (requests.length === 0) {
    return (
      <div className="requests-table" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>📝 Нет загруженных заявок</h3>
        <p>Загрузите файл, чтобы увидеть данные</p>
      </div>
    )
  }

  return (
    <div className="requests-table">
      <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
        <h3>📋 Загруженные заявки</h3>
        <p>Всего записей: {requests.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Дата заявки</th>
            <th>Марка</th>
            <th>Гос.номер</th>
            <th>Наименование</th>
            <th>Артикул</th>
            <th>Кол-во</th>
            <th>Согласовано</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request, index) => (
            <tr key={index}>
              <td>{request.request_number}</td>
              <td>{request.request_date}</td>
              <td>{request.car_brand}</td>
              <td>{request.license_plate}</td>
              <td>{request.item_name}</td>
              <td>{request.article}</td>
              <td>{request.quantity}</td>
              <td>{request.approved ? 'Да' : 'Нет'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RequestsTable
""",
    }
    
    # Создаем файлы фронтенда
    for file_path, content in frontend_files.items():
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Создан файл: {file_path}")
    
    print("\\n🎉 Фронтенд успешно добавлен!")
    print("\\n📋 Запуск:")
    print("1. Бэкенд (уже работает): uvicorn app.main:app --reload")
    print("2. Фронтенд:")
    print("   cd frontend")
    print("   npm install")
    print("   npm run dev")
    print("3. Открыть: http://localhost:3000")

if __name__ == "__main__":
    add_frontend()