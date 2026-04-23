// frontend/src/pages/RegistryPage.jsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import RegistryPreview from '../components/RegistryPreview';
import api from '../services/api';

const RegistryPage = () => {
  const { user } = useAuth();
  const [batchId, setBatchId] = useState(null);
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const loadRegistryData = useCallback(async (id) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/invoice/${id}/preview`);
      setRegistryData(response);
    } catch (error) {
      console.error('Error loading registry:', error);
      showNotification(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
      showNotification('Поддерживаются только Excel (.xlsx, .xls) и PDF файлы', 'warning');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setUploading(true);
      const response = await api.post('/upload', formData);
      
      if (response.batch_id) {
        setBatchId(response.batch_id);
        await loadRegistryData(response.batch_id);
        showNotification('Файл успешно загружен', 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleReload = async () => {
    if (batchId) {
      await loadRegistryData(batchId);
    }
  };

  const handleNewUpload = () => {
    setBatchId(null);
    setRegistryData(null);
  };

  const canEdit = () => {
    // Пользователь может редактировать черновики
    // Согласователь может редактировать только на этапе согласования
    return true; // Или реализуйте логику на основе статуса
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Реестр счетов
        {batchId && (
          <Chip 
            label={`Batch: ${batchId.slice(0, 8)}...`} 
            color="primary" 
            size="small" 
            sx={{ ml: 2 }}
          />
        )}
      </Typography>

      {!batchId ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Загрузите файл для создания реестра
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Поддерживаются Excel (.xlsx, .xls) для реестра и PDF для счетов
          </Typography>
          
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadIcon />}
            disabled={uploading}
            size="large"
          >
            {uploading ? 'Загрузка...' : 'Выбрать файл'}
            <input
              type="file"
              hidden
              accept=".xlsx,.xls,.pdf"
              onChange={handleFileUpload}
            />
          </Button>
          
          {uploading && <LinearProgress sx={{ mt: 3, width: '100%', maxWidth: 400, mx: 'auto' }} />}
        </Paper>
      ) : (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleReload}
                disabled={loading}
                size="small"
              >
                Обновить
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<UploadIcon />}
                onClick={handleNewUpload}
                size="small"
              >
                Новый реестр
              </Button>
              
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                size="small"
              >
                Добавить счета
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>
          </Paper>
          
          {loading ? (
            <LinearProgress />
          ) : (
            <RegistryPreview 
              data={registryData} 
              onReload={handleReload}
              batchId={batchId}
              canEdit={canEdit()}
            />
          )}
        </Box>
      )}
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity}>{notification.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default RegistryPage;