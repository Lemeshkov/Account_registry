// import React, { useState, useEffect } from "react";
// import FileUpload from "./components/FileUpload";
// import RegistryPreview from "./components/RegistryPreview";
// import DefectSheetPage from './pages/DefectSheetPage';
// import "./index.css";

// function App() {
//   const [registry, setRegistry] = useState([]);
//   const [batchId, setBatchId] = useState(null);
//   const [pending, setPending] = useState(0);
//   const [loading, setLoading] = useState(false);

//   const handleFileUpload = async (file) => {
//     setLoading(true);
//     const formData = new FormData();
//     formData.append("file", file);

//     if (batchId) {
//       formData.append("batch_id", batchId);
//     }

//     try {
//       const res = await fetch("http://localhost:8000/upload", {
//         method: "POST",
//         body: formData,
//       });

//       if (!res.ok) {
//         const err = await res.json();
//         alert("Ошибка загрузки файла: " + (err.detail || res.statusText));
//         setLoading(false);
//         return;
//       }

//       const data = await res.json();

//       // Excel — сразу показываем preview
//       if (data.registry_preview) {
//         setRegistry(data.registry_preview);
//       }

//       // Если есть batch_id (и PDF), сохраняем для опроса
//       if (data.batch_id) {
//         setBatchId(data.batch_id);
//         pollPreview(data.batch_id);
//       } else {
//         setLoading(false);
//       }

//       alert(data.message || "Файл обработан!");
//     } catch (err) {
//       alert("Ошибка: " + err.message);
//       setLoading(false);
//     }
//   };

//   // Функция периодического опроса preview
//   const pollPreview = async (batchId) => {
//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(
//           `http://localhost:8000/invoice/${batchId}/preview`
//         );
//         if (!res.ok) return;
//         const data = await res.json();

//         setRegistry(data.registry_preview || []);
//         setPending(data.pending_invoices || 0);

//         // Если все счета применены — останавливаем опрос
//         if ((data.pending_invoices || 0) === 0) {
//           clearInterval(interval);
//           setLoading(false);
//         }
//       } catch (err) {
//         console.error(err);
//         clearInterval(interval);
//         setLoading(false);
//       }
//     }, 2000); // опрашиваем каждые 2 секунды
//     return () => clearInterval(interval);
//   };

//   return (
//     <div className="container">
//       <div className="header">
//         <h1>📁 Загрузчик заявок и счетов</h1>
//         <p>Система автоматически объединяет заявки и счета</p>
//       </div>

//       <FileUpload onFileUpload={handleFileUpload} />

//       {loading && (
//         <div style={{ margin: "20px 0", fontSize: "16px", color: "#007bff" }}>
//           ⏳ Обработка файла...{" "}
//           {pending > 0 ? `Ожидает OCR ${pending} счет(ов)` : ""}
//         </div>
//       )}

//       <RegistryPreview data={registry} onReload={() => pollPreview(batchId)}/>
//     </div>
//   );
// }

// export default App;

import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from "react-router-dom";
import FileUpload from "./components/FileUpload";
import RegistryPreview from "./components/RegistryPreview";
import DefectSheetPage from './pages/DefectSheetPage';
import "./index.css";

// Компонент для главной страницы (реестр)
function RegistryPage() {
  const [registry, setRegistry] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    if (batchId) {
      formData.append("batch_id", batchId);
    }

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Ошибка загрузки файла: " + (err.detail || res.statusText));
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Excel — сразу показываем preview
      if (data.registry_preview) {
        setRegistry(data.registry_preview);
      }

      // Если есть batch_id (и PDF), сохраняем для опроса
      if (data.batch_id) {
        setBatchId(data.batch_id);
        pollPreview(data.batch_id);
      } else {
        setLoading(false);
      }

      alert(data.message || "Файл обработан!");
    } catch (err) {
      alert("Ошибка: " + err.message);
      setLoading(false);
    }
  };

  // Функция периодического опроса preview
  const pollPreview = async (batchId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/invoice/${batchId}/preview`
        );
        if (!res.ok) return;
        const data = await res.json();

        setRegistry(data.registry_preview || []);
        setPending(data.pending_invoices || 0);

        // Если все счета применены — останавливаем опрос
        if ((data.pending_invoices || 0) === 0) {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        clearInterval(interval);
        setLoading(false);
      }
    }, 2000); // опрашиваем каждые 2 секунды
    return () => clearInterval(interval);
  };

  return (
    <>
      <FileUpload onFileUpload={handleFileUpload} />

      {loading && (
        <div style={{ margin: "20px 0", fontSize: "16px", color: "#007bff" }}>
          ⏳ Обработка файла...{" "}
          {pending > 0 ? `Ожидает OCR ${pending} счет(ов)` : ""}
        </div>
      )}

      <RegistryPreview data={registry} onReload={() => pollPreview(batchId)}/>
    </>
  );
}

// Основной компонент App с роутингом
function App() {
  return (
    <Router>
      <div className="container">
        <div className="header">
          <h1>📁 Загрузчик заявок и счетов</h1>
          <p>Система автоматически объединяет заявки и счета</p>
          
          {/* Навигация */}
          <nav style={{ marginTop: "20px", marginBottom: "20px" }}>
            <NavLink 
              to="/" 
              style={({ isActive }) => ({
                marginRight: "20px",
                padding: "10px 20px",
                textDecoration: "none",
                borderRadius: "5px",
                backgroundColor: isActive ? "#007bff" : "#f0f0f0",
                color: isActive ? "white" : "#333",
                fontWeight: isActive ? "bold" : "normal"
              })}
              end
            >
              📋 Реестр платежей
            </NavLink>
            <NavLink 
              to="/defect" 
              style={({ isActive }) => ({
                padding: "10px 20px",
                textDecoration: "none",
                borderRadius: "5px",
                backgroundColor: isActive ? "#28a745" : "#f0f0f0",
                color: isActive ? "white" : "#333",
                fontWeight: isActive ? "bold" : "normal"
              })}
            >
              📝 Дефектная ведомость
            </NavLink>
          </nav>
        </div>

        {/* Маршруты */}
        <Routes>
          <Route path="/" element={<RegistryPage />} />
          <Route path="/defect" element={<DefectSheetPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;