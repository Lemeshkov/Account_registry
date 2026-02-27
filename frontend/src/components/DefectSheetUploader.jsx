// import React, { useState, useCallback } from "react";
// import { useDropzone } from "react-dropzone";
// import {
//   Box,
//   Paper,
//   Typography,
//   Button,
//   LinearProgress,
//   Alert,
//   TextField,
// } from "@mui/material";
// import { CloudUpload as CloudUploadIcon } from "@mui/icons-material";
// import api from "../services/api";

// const DefectSheetUploader = ({ onUploadSuccess }) => {
//   const [uploading, setUploading] = useState(false);
//   const [error, setError] = useState(null);
//   const [batchId, setBatchId] = useState("");

//   const onDrop = useCallback(
//     async (acceptedFiles) => {
//       const file = acceptedFiles[0];
//       if (!file) return;

//       // Проверка расширения
//       const ext = file.name.split(".").pop().toLowerCase();
//       if (!["xlsx", "xls"].includes(ext)) {
//         setError("Поддерживаются только Excel файлы (.xlsx, .xls)");
//         return;
//       }

//       setUploading(true);
//       setError(null);

//       const formData = new FormData();
//       formData.append("file", file);
//       if (batchId.trim()) {
//         formData.append("batch_id", batchId.trim());
//       }

//       try {
//         const response = await api.post("/api/defect/upload", formData, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });

//         onUploadSuccess(response.data.batch_id, response.data.sheet_id);
//       } catch (err) {
//         setError(err.response?.data?.detail || "Ошибка при загрузке файла");
//       } finally {
//         setUploading(false);
//       }
//     },
//     [batchId, onUploadSuccess],
//   );

//   const { getRootProps, getInputProps, isDragActive } = useDropzone({
//     onDrop,
//     accept: {
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
//         ".xlsx",
//       ],
//       "application/vnd.ms-excel": [".xls"],
//     },
//     maxFiles: 1,
//   });

//   return (
//     <Paper sx={{ p: 3, maxWidth: 600, mx: "auto", mt: 4 }}>
//       <Typography variant="h5" gutterBottom align="center">
//         Загрузка дефектной ведомости
//       </Typography>

//       <Typography
//         variant="body2"
//         color="text.secondary"
//         paragraph
//         align="center"
//       >
//         Поддерживаются файлы Excel (.xlsx, .xls) с актами списания
//         металлопроката
//       </Typography>

//       <TextField
//         fullWidth
//         label="Batch ID (необязательно)"
//         value={batchId}
//         onChange={(e) => setBatchId(e.target.value)}
//         disabled={uploading}
//         sx={{ mb: 2 }}
//         helperText="Оставьте пустым для автоматической генерации"
//       />

//       <Box
//         {...getRootProps()}
//         sx={{
//           border: "2px dashed",
//           borderColor: isDragActive ? "primary.main" : "grey.300",
//           borderRadius: 2,
//           p: 4,
//           textAlign: "center",
//           cursor: uploading ? "default" : "pointer",
//           bgcolor: isDragActive ? "action.hover" : "background.paper",
//           "&:hover": {
//             bgcolor: uploading ? "background.paper" : "action.hover",
//           },
//         }}
//       >
//         <input {...getInputProps()} disabled={uploading} />
//         <CloudUploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />

//         {uploading ? (
//           <Box>
//             <Typography>Загрузка...</Typography>
//             <LinearProgress sx={{ mt: 2 }} />
//           </Box>
//         ) : isDragActive ? (
//           <Typography>Перетащите файл сюда...</Typography>
//         ) : (
//           <Typography>Перетащите файл или нажмите для выбора</Typography>
//         )}
//       </Box>

//       {error && (
//         <Alert severity="error" sx={{ mt: 2 }}>
//           {error}
//         </Alert>
//       )}

//       <Box sx={{ mt: 2 }}>
//         <Typography variant="subtitle2" gutterBottom>
//           Ожидаемый формат файла:
//         </Typography>
//         <Typography variant="body2" component="div" color="text.secondary">
//           <ul>
//             <li>Первая строка - период</li>
//             <li>Далее требования и позиции</li>
//             <li>Поля: Марка (→ Адрес)</li>
//             <li>Наименование зап.части (→ Наименование материала)</li>
//             <li>Затреб (→ Количество в тоннах)</li>
//           </ul>
//         </Typography>
//       </Box>
//     </Paper>
//   );
// };

// export default DefectSheetUploader;

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  TextField,
} from "@mui/material";
import { CloudUpload as CloudUploadIcon } from "@mui/icons-material";
import api from "../services/api";

const DefectSheetUploader = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [batchId, setBatchId] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Проверка расширения
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["xlsx", "xls"].includes(ext)) {
        setError("Поддерживаются только Excel файлы (.xlsx, .xls)");
        return;
      }

      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      if (batchId.trim()) {
        formData.append("batch_id", batchId.trim());
      }

      try {
        console.log('📤 Uploading file:', file.name);
        console.log('📤 To endpoint:', '/api/defect/upload');
        
        // Используем правильный путь
        const response = await api.post('/api/defect/upload', formData, {
          // Не указываем headers - FormData сам установит правильный Content-Type
        });
        
        console.log('✅ Upload response:', response);
        
        // Проверяем структуру ответа
        if (response && response.batch_id) {
          onUploadSuccess(response.batch_id, response.sheet_id);
        } else {
          console.error('Unexpected response structure:', response);
          setError('Неверный формат ответа от сервера');
        }
      } catch (err) {
        console.error('❌ Upload error:', err);
        setError(err.message || "Ошибка при загрузке файла");
      } finally {
        setUploading(false);
      }
    },
    [batchId, onUploadSuccess],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom align="center">
        Загрузка дефектной ведомости
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        paragraph
        align="center"
      >
        Поддерживаются файлы Excel (.xlsx, .xls) с актами списания металлопроката
      </Typography>

      <TextField
        fullWidth
        label="Batch ID (необязательно)"
        value={batchId}
        onChange={(e) => setBatchId(e.target.value)}
        disabled={uploading}
        sx={{ mb: 2 }}
        helperText="Оставьте пустым для автоматической генерации"
      />

      <Box
        {...getRootProps()}
        sx={{
          border: "2px dashed",
          borderColor: isDragActive ? "primary.main" : "grey.300",
          borderRadius: 2,
          p: 4,
          textAlign: "center",
          cursor: uploading ? "default" : "pointer",
          bgcolor: isDragActive ? "action.hover" : "background.paper",
          "&:hover": {
            bgcolor: uploading ? "background.paper" : "action.hover",
          },
        }}
      >
        <input {...getInputProps()} disabled={uploading} />
        <CloudUploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />

        {uploading ? (
          <Box>
            <Typography>Загрузка...</Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </Box>
        ) : isDragActive ? (
          <Typography>Перетащите файл сюда...</Typography>
        ) : (
          <Typography>Перетащите файл или нажмите для выбора</Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Ожидаемый формат файла:
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          <ul>
            <li>Первая строка - период</li>
            <li>Далее требования и позиции</li>
            <li>Поля: Марка (→ Адрес)</li>
            <li>Наименование зап.части (→ Наименование материала)</li>
            <li>Затреб (→ Количество в тоннах)</li>
          </ul>
        </Typography>
      </Box>
    </Paper>
  );
};

export default DefectSheetUploader;