// import React, { useState, useEffect } from 'react';
// import {
//   Box,
//   Button,
//   Paper,
//   Typography,
//   Alert,
//   Snackbar,
//   LinearProgress,
//   Chip,
//   IconButton,
//   Tooltip
// } from '@mui/material';
// import {
//   CloudUpload as UploadIcon,
//   Calculate as CalculateIcon,
//   Save as SaveIcon,
//   Download as DownloadIcon,
//   Refresh as RefreshIcon
// } from '@mui/icons-material';
// import { DataGrid } from '@mui/x-data-grid';
// import { useWebSocket } from '../hooks/useWebSocket';
// import DefectSheetUploader from '../components/DefectSheetUploader';
// import MetalCalculator from '../components/MetalCalculator';
// import api from '../services/api';

// const DefectSheetPage = () => {
//   const [batchId, setBatchId] = useState(null);
//   const [sheetId, setSheetId] = useState(null);
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [processing, setProcessing] = useState(false);
//   const [selectedItems, setSelectedItems] = useState([]);
//   const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
//   const [formulas, setFormulas] = useState([]);

//   const { lastMessage, connectionStatus } = useWebSocket(batchId);

//   // Обработка WebSocket сообщений
//   useEffect(() => {
//     if (lastMessage) {
//       const data = lastMessage;
//       switch (data.type) {
//         case 'defect_sheet_processed':
//           setProcessing(false);
//           loadSheetData(data.sheet_id);
//           showNotification('Файл успешно обработан', 'success');
//           break;
//         case 'defect_calculation_complete':
//           loadSheetData(data.sheet_id);
//           showNotification(`Пересчитано ${data.calculated_items} строк`, 'success');
//           break;
//         case 'defect_sheet_error':
//           setProcessing(false);
//           showNotification(`Ошибка: ${data.error}`, 'error');
//           break;
//         default:
//           break;
//       }
//     }
//   }, [lastMessage]);

//   // Загрузка данных ведомости
//   const loadSheetData = async (id) => {
//     if (!id && !sheetId) return;
//     try {
//       setLoading(true);
//       const response = await api.get(`/api/defect/${id || sheetId}/items`);
//       setItems(response.data.items || []);
//     } catch (error) {
//       showNotification('Ошибка загрузки данных', 'error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Загрузка формул
//   const loadFormulas = async () => {
//     try {
//       const response = await api.get('/api/defect/formulas');
//       setFormulas(response.data.formulas || []);
//     } catch (error) {
//       console.error('Error loading formulas:', error);
//     }
//   };

//   useEffect(() => {
//     loadFormulas();
//   }, []);

//   const showNotification = (message, severity = 'info') => {
//     setNotification({ open: true, message, severity });
//   };

//   const handleUploadSuccess = (newBatchId, newSheetId) => {
//     setBatchId(newBatchId);
//     setSheetId(newSheetId);
//     setProcessing(true);
//     showNotification('Файл загружен, начинается обработка...', 'info');
//   };

//   const handleCalculate = async (profileType, profileParams) => {
//     if (!sheetId || selectedItems.length === 0) {
//       showNotification('Выберите строки для пересчета', 'warning');
//       return;
//     }

//     try {
//       setProcessing(true);
//       await api.post('/api/defect/calculate', {
//         sheet_id: sheetId,
//         item_ids: selectedItems,
//         profile_type: profileType,
//         profile_params: profileParams
//       });
//     } catch (error) {
//       showNotification('Ошибка при пересчете', 'error');
//       setProcessing(false);
//     }
//   };

//   const handleSave = async () => {
//     try {
//       await api.post('/api/defect/save', { sheet_id: sheetId });
//       showNotification('Ведомость сохранена', 'success');
//       loadSheetData();
//     } catch (error) {
//       showNotification('Ошибка при сохранении', 'error');
//     }
//   };

//   const handleExport = async () => {
//     try {
//       const response = await api.post('/api/defect/export', { 
//         sheet_id: sheetId,
//         format: 'excel'
//       }, { responseType: 'blob' });
      
//       const url = window.URL.createObjectURL(new Blob([response.data]));
//       const link = document.createElement('a');
//       link.href = url;
//       link.setAttribute('download', `defect_sheet_${batchId}.xlsx`);
//       document.body.appendChild(link);
//       link.click();
//       link.remove();
//     } catch (error) {
//       showNotification('Ошибка при экспорте', 'error');
//     }
//   };

//   // Колонки для таблицы
//   const columns = [
//     { field: 'position', headerName: '№', width: 70 },
//     { field: 'address', headerName: 'Адрес (Марка)', width: 200 },
//     { field: 'material_name', headerName: 'Наименование материала', width: 300 },
//     { field: 'requested_quantity', headerName: 'Затреб (тонн)', width: 120, type: 'number' },
//     { field: 'weight_tons', headerName: 'Вес (тонн)', width: 120, type: 'number' },
//     { 
//       field: 'calculated_meters', 
//       headerName: 'Пересчитано (метров)', 
//       width: 150,
//       type: 'number',
//       renderCell: (params) => (
//         <Box>
//           {params.value ? (
//             <Chip 
//               label={params.value.toFixed(2)} 
//               color="success" 
//               size="small"
//               variant="outlined"
//             />
//           ) : '-'}
//         </Box>
//       )
//     },
//     { field: 'profile_type', headerName: 'Тип', width: 100 },
//     { 
//       field: 'is_calculated', 
//       headerName: 'Статус', 
//       width: 100,
//       renderCell: (params) => (
//         <Chip 
//           label={params.value ? '✓' : 'Ожидает'} 
//           color={params.value ? 'success' : 'default'}
//           size="small"
//         />
//       )
//     }
//   ];

//   return (
//     <Box sx={{ p: 3 }}>
//       <Typography variant="h4" gutterBottom>
//         Дефектная ведомость
//         {connectionStatus && (
//           <Chip 
//             label="WebSocket подключен" 
//             color="success" 
//             size="small" 
//             sx={{ ml: 2 }}
//           />
//         )}
//       </Typography>

//       {!batchId ? (
//         <DefectSheetUploader onUploadSuccess={handleUploadSuccess} />
//       ) : (
//         <Box>
//           <Paper sx={{ p: 2, mb: 2 }}>
//             <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
//               <Typography variant="subtitle1">
//                 Batch ID: {batchId}
//               </Typography>
//               <Chip 
//                 label={processing ? 'Обработка...' : 'Готово'} 
//                 color={processing ? 'warning' : 'success'}
//               />
//               <Box sx={{ flexGrow: 1 }} />
//               <Tooltip title="Обновить">
//                 <IconButton onClick={() => loadSheetData()} disabled={loading}>
//                   <RefreshIcon />
//                 </IconButton>
//               </Tooltip>
//               <Button
//                 variant="contained"
//                 color="primary"
//                 startIcon={<CalculateIcon />}
//                 onClick={() => document.getElementById('calculator-dialog').showModal()}
//                 disabled={selectedItems.length === 0 || processing}
//               >
//                 Пересчитать ({selectedItems.length})
//               </Button>
//               <Button
//                 variant="outlined"
//                 color="primary"
//                 startIcon={<SaveIcon />}
//                 onClick={handleSave}
//                 disabled={processing}
//               >
//                 Сохранить
//               </Button>
//               <Button
//                 variant="outlined"
//                 color="secondary"
//                 startIcon={<DownloadIcon />}
//                 onClick={handleExport}
//               >
//                 Экспорт
//               </Button>
//             </Box>
//           </Paper>

//           {processing && <LinearProgress sx={{ mb: 2 }} />}

//           <Paper sx={{ height: 600, width: '100%' }}>
//             <DataGrid
//               rows={items}
//               columns={columns}
//               pageSize={10}
//               rowsPerPageOptions={[10, 25, 50]}
//               checkboxSelection
//               loading={loading}
//               onSelectionModelChange={(newSelection) => setSelectedItems(newSelection)}
//               selectionModel={selectedItems}
//               getRowId={(row) => row.id}
//               disableSelectionOnClick
//             />
//           </Paper>
//         </Box>
//       )}

//       <MetalCalculator
//         open={false} // Управляется через dialog
//         formulas={formulas}
//         onCalculate={handleCalculate}
//         onClose={() => document.getElementById('calculator-dialog')?.close()}
//       />

//       <Snackbar
//         open={notification.open}
//         autoHideDuration={6000}
//         onClose={() => setNotification({ ...notification, open: false })}
//       >
//         <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })}>
//           {notification.message}
//         </Alert>
//       </Snackbar>
//     </Box>
//   );
// };

// export default DefectSheetPage;

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Snackbar,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useWebSocket } from '../hooks/useWebSocket';
import DefectSheetUploader from '../components/DefectSheetUploader';
import MetalCalculator from '../components/MetalCalculator';
import api from '../services/api';

const DefectSheetPage = () => {
  const [batchId, setBatchId] = useState(null);
  const [sheetId, setSheetId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [formulas, setFormulas] = useState([]);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const { lastMessage, connectionStatus } = useWebSocket(batchId);

  // Обработка WebSocket сообщений
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received:', lastMessage);
      const data = lastMessage;
      switch (data.type) {
        case 'defect_sheet_processed':
          console.log('Sheet processed, loading data for sheet_id:', data.sheet_id);
          setProcessing(false);
          if (data.sheet_id) {
            loadSheetData(data.sheet_id);
          }
          showNotification('Файл успешно обработан', 'success');
          break;
        case 'defect_calculation_complete':
          console.log('Calculation complete, reloading data');
          if (data.sheet_id) {
            loadSheetData(data.sheet_id);
          }
          showNotification(`Пересчитано ${data.calculated_items || 0} строк`, 'success');
          break;
        case 'defect_sheet_error':
          setProcessing(false);
          showNotification(`Ошибка: ${data.error}`, 'error');
          break;
        default:
          console.log('Unknown message type:', data.type);
          break;
      }
    }
  }, [lastMessage]);

  // Загрузка данных ведомости
 // Загрузка данных ведомости
const loadSheetData = async (id) => {
  const targetId = id || sheetId;
  if (!targetId) {
    console.log('No sheet ID available');
    return;
  }
  
  try {
    setLoading(true);
    console.log('📥 Loading data for sheet:', targetId);
    
    // api.get() уже возвращает данные, а не response!
    const data = await api.get(`/api/defect/${targetId}/items`);
    console.log('📦 Received data:', data);
    
    // Проверяем структуру данных
    if (data && data.items && Array.isArray(data.items)) {
      console.log(`✅ Setting ${data.items.length} items from data.items`);
      setItems(data.items);
    } else if (Array.isArray(data)) {
      console.log(`✅ Setting ${data.length} items from array`);
      setItems(data);
    } else {
      console.warn('⚠️ Unexpected data structure:', data);
      setItems([]);
    }
  } catch (error) {
    console.error('❌ Error loading sheet data:', error);
    showNotification(`Ошибка загрузки данных: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
};

  // const loadSheetData = async (id) => {
  //   const targetId = id || sheetId;
  //   if (!targetId) {
  //     console.log('No sheet ID available');
  //     return;
  //   }
    
  //   try {
  //     setLoading(true);
  //     console.log('Loading data for sheet:', targetId);
  //     const response = await api.get(`/api/defect/${targetId}/items`);
  //     console.log('Load response:', response.data);
      
  //     // Проверяем структуру ответа
  //     if (response.data && response.data.items) {
  //       console.log(`Setting ${response.data.items.length} items from response.data.items`);
  //       setItems(response.data.items);
  //     } else if (Array.isArray(response.data)) {
  //       console.log(`Setting ${response.data.length} items from array response`);
  //       setItems(response.data);
  //     } else {
  //       console.warn('Unexpected response structure:', response.data);
  //       setItems([]);
  //     }
  //   } catch (error) {
  //     console.error('Error loading sheet data:', error);
  //     showNotification('Ошибка загрузки данных', 'error');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Загрузка формул
  const loadFormulas = async () => {
    try {
      console.log('Loading formulas...');
      const response = await api.get('/api/defect/formulas');
      console.log('Formulas response:', response.data);
      
      if (response.data && response.data.formulas) {
        console.log(`Setting ${response.data.formulas.length} formulas from response.data.formulas`);
        setFormulas(response.data.formulas);
      } else if (Array.isArray(response.data)) {
        console.log(`Setting ${response.data.length} formulas from array`);
        setFormulas(response.data);
      } else {
        console.warn('Unexpected formulas response:', response.data);
        setFormulas([]);
      }
    } catch (error) {
      console.error('Error loading formulas:', error);
      showNotification('Ошибка загрузки формул', 'error');
    }
  };

  useEffect(() => {
    loadFormulas();
  }, []);

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleUploadSuccess = (newBatchId, newSheetId) => {
    console.log('Upload success:', { newBatchId, newSheetId });
    setBatchId(newBatchId);
    setSheetId(newSheetId);
    setProcessing(true);
    showNotification('Файл загружен, начинается обработка...', 'info');
    
    // Пробуем загрузить данные сразу (на случай если они уже есть)
    setTimeout(() => {
      if (newSheetId) {
        console.log('Attempting immediate load for sheet:', newSheetId);
        loadSheetData(newSheetId);
      }
    }, 2000);
  };

  const handleCalculate = async (profileType, profileParams) => {
    if (!sheetId || selectedItems.length === 0) {
      showNotification('Выберите строки для пересчета', 'warning');
      return;
    }

    try {
      setProcessing(true);
      console.log('Calculating:', { sheetId, selectedItems, profileType, profileParams });
      await api.post('/api/defect/calculate', {
        sheet_id: sheetId,
        item_ids: selectedItems,
        profile_type: profileType,
        profile_params: profileParams
      });
      // Не убираем processing - ждем WebSocket
    } catch (error) {
      console.error('Calculation error:', error);
      showNotification('Ошибка при пересчете', 'error');
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    try {
      console.log('Saving sheet:', sheetId);
      await api.post('/api/defect/save', { sheet_id: sheetId });
      showNotification('Ведомость сохранена', 'success');
      loadSheetData();
    } catch (error) {
      console.error('Save error:', error);
      showNotification('Ошибка при сохранении', 'error');
    }
  };

  const handleExport = async () => {
    try {
      console.log('Exporting sheet:', sheetId);
      const response = await api.post('/api/defect/export', { 
        sheet_id: sheetId,
        format: 'excel'
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `defect_sheet_${batchId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotification('Файл экспортирован', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Ошибка при экспорте', 'error');
    }
  };

  const handleRefresh = () => {
    console.log('Manual refresh');
    loadSheetData();
  };

  // Колонки для таблицы
  const columns = [
    { field: 'position', headerName: '№', width: 70 },
    { field: 'address', headerName: 'Адрес (Марка)', width: 200 },
    { field: 'material_name', headerName: 'Наименование материала', width: 300 },
    { field: 'requested_quantity', headerName: 'Затреб (тонн)', width: 120, type: 'number' },
    { field: 'weight_tons', headerName: 'Вес (тонн)', width: 120, type: 'number' },
    { 
      field: 'calculated_meters', 
      headerName: 'Пересчитано (метров)', 
      width: 150,
      type: 'number',
      renderCell: (params) => (
        <Box>
          {params.value ? (
            <Chip 
              label={Number(params.value).toFixed(2)} 
              color="success" 
              size="small"
              variant="outlined"
            />
          ) : '-'}
        </Box>
      )
    },
    { field: 'profile_type', headerName: 'Тип', width: 100 },
    { 
      field: 'is_calculated', 
      headerName: 'Статус', 
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value ? '✓' : 'Ожидает'} 
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Дефектная ведомость
        {connectionStatus && (
          <Chip 
            label="WebSocket подключен" 
            color="success" 
            size="small" 
            sx={{ ml: 2 }}
          />
        )}
      </Typography>

      {!batchId ? (
        <DefectSheetUploader onUploadSuccess={handleUploadSuccess} />
      ) : (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1">
                Batch ID: {batchId}
              </Typography>
              <Chip 
                label={processing ? 'Обработка...' : 'Готово'} 
                color={processing ? 'warning' : 'success'}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Обновить">
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CalculateIcon />}
                onClick={() => setCalculatorOpen(true)}
                disabled={selectedItems.length === 0 || processing}
              >
                Пересчитать ({selectedItems.length})
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={processing}
              >
                Сохранить
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
              >
                Экспорт
              </Button>
            </Box>
          </Paper>

          {processing && <LinearProgress sx={{ mb: 2 }} />}

          <Paper sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={items}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              checkboxSelection
              loading={loading}
              onSelectionModelChange={(newSelection) => {
                console.log('Selection changed:', newSelection);
                setSelectedItems(newSelection);
              }}
              selectionModel={selectedItems}
              getRowId={(row) => row.id}
              disableSelectionOnClick
            />
          </Paper>
        </Box>
      )}

      <MetalCalculator
        open={calculatorOpen}
        formulas={formulas}
        onCalculate={handleCalculate}
        onClose={() => setCalculatorOpen(false)}
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert 
          severity={notification.severity} 
          onClose={() => setNotification({ ...notification, open: false })}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DefectSheetPage;