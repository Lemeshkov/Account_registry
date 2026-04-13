
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Badge,
  Alert,
  Snackbar,
  LinearProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

// Компонент для отображения статуса
const StatusChip = ({ status }) => {
  const config = {
    draft: { label: 'Черновик', color: 'default' },
    pending: { label: 'Ожидает', color: 'warning' },
    approved: { label: 'Согласовано', color: 'success' },
    rejected: { label: 'Отклонено', color: 'error' },
  };
  
  const { label, color } = config[status] || { label: status, color: 'default' };
  return <Chip label={label} color={color} size="small" />;
};

// Компонент для карточки статистики
const StatCard = ({ title, value, color, icon }) => (
  <Card sx={{ minWidth: 200, bgcolor: `${color}.50` }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div" color={`${color}.main`}>
            {value}
          </Typography>
        </Box>
        <Box color={`${color}.main`}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ApprovalsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [loadingRef, setLoadingRef] = useState(false);
  
  // Данные
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvedSheets, setApprovedSheets] = useState([]);
  const [rejectedSheets, setRejectedSheets] = useState([]);
  const [allSheets, setAllSheets] = useState([]);
  
  // UI состояния
  const [tabValue, setTabValue] = useState(0);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, type: null });
  const [comment, setComment] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [filterDialog, setFilterDialog] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    creator: '',
  });
  
  // Пагинация
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // WebSocket для real-time уведомлений
  const { lastMessage } = useWebSocket('approver');

   const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Загрузка данных
  const loadData = async () => {
    if (!isMountedRef.current) return;
    try {
      setLoading(true);
      const pendingData = await api.get('/api/defect/pending-approvals');
      if (isMountedRef.current) {
        setPendingApprovals(pendingData.approvals || []);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Загрузка при монтировании и интервал
  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Обработка WebSocket сообщений
  // useEffect(() => {
  //   if (lastMessage) {
  //     console.log('📨 WebSocket message:', lastMessage);
      
  //     if (lastMessage.type === 'approval_request' || lastMessage.type === 'approval_processed') {
  //       loadData();
  //     }
  //   }
  // }, [lastMessage]);

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleApprove = async () => {
    try {
      setProcessing(true);
      
      await api.post('/api/defect/approve', {
        sheet_id: selectedSheet.sheet_id,
        approved: true,
        comment: comment
      });
      
      setPendingApprovals(prev => prev.filter(a => a.sheet_id !== selectedSheet.sheet_id));
      setApprovedSheets(prev => [{
        ...selectedSheet,
        approved_at: new Date().toISOString(),
        approved_by: 'Вы',
        comment: comment
      }, ...prev]);
      
      showNotification('✅ Ведомость успешно согласована', 'success');
      setApprovalDialog({ open: false, type: null });
      setComment('');
      
    } catch (error) {
      showNotification(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      showNotification('Укажите причину отклонения', 'warning');
      return;
    }
    
    try {
      setProcessing(true);
      
      await api.post('/api/defect/approve', {
        sheet_id: selectedSheet.sheet_id,
        approved: false,
        comment: comment
      });
      
      setPendingApprovals(prev => prev.filter(a => a.sheet_id !== selectedSheet.sheet_id));
      setRejectedSheets(prev => [{
        ...selectedSheet,
        rejected_at: new Date().toISOString(),
        rejected_by: 'Вы',
        reason: comment
      }, ...prev]);
      
      showNotification('❌ Ведомость отклонена', 'warning');
      setApprovalDialog({ open: false, type: null });
      setComment('');
      
    } catch (error) {
      showNotification(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openApprovalDialog = (sheet, type) => {
    setSelectedSheet(sheet);
    setApprovalDialog({ open: true, type });
    setComment('');
  };

  const viewSheet = (sheetId) => {
    navigate(`/defect-sheet/${sheetId}`);
  };

  const exportToExcel = async (sheetId) => {
    try {
      const response = await api.exportDefectSheetFormatted(sheetId);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `defect_sheet_${sheetId}.xlsx`;
      link.click();
      showNotification('✅ Файл экспортирован', 'success');
    } catch (error) {
      showNotification(`❌ Ошибка экспорта: ${error.message}`, 'error');
    }
  };

  const pendingColumns = [
    { field: 'sheet_id', headerName: 'ID', width: 70 },
    { field: 'file_name', headerName: 'Файл', width: 200 },
    { field: 'submitted_by', headerName: 'Отправитель', width: 150 },
    { 
      field: 'submitted_at', 
      headerName: 'Дата отправки', 
      width: 180,
      valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU')
    },
    { field: 'total_items', headerName: 'Строк', width: 80, type: 'number' },
    { 
      field: 'message', 
      headerName: 'Комментарий', 
      width: 250,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography variant="body2" noWrap>{params.value}</Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Просмотр">
            <IconButton size="small" onClick={() => viewSheet(params.row.sheet_id)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Согласовать">
            <IconButton size="small" color="success" onClick={() => openApprovalDialog(params.row, 'approve')}>
              <ApproveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Отклонить">
            <IconButton size="small" color="error" onClick={() => openApprovalDialog(params.row, 'reject')}>
              <RejectIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  const historyColumns = [
    { field: 'sheet_id', headerName: 'ID', width: 70 },
    { field: 'file_name', headerName: 'Файл', width: 200 },
    { field: 'submitted_by', headerName: 'Отправитель', width: 150 },
    { field: 'submitted_at', headerName: 'Дата отправки', width: 180, valueFormatter: (params) => new Date(params.value).toLocaleString('ru-RU') },
    { field: 'status', headerName: 'Статус', width: 120, renderCell: (params) => <StatusChip status={params.value} /> },
    { field: 'approved_by', headerName: 'Согласовал', width: 150 },
    { field: 'approved_at', headerName: 'Дата решения', width: 180, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString('ru-RU') : '-' },
    { field: 'comment', headerName: 'Комментарий', width: 200, renderCell: (params) => <Typography variant="body2" noWrap>{params.value || '-'}</Typography> },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 100,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Просмотр">
            <IconButton size="small" onClick={() => viewSheet(params.row.sheet_id)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Скачать">
            <IconButton size="small" onClick={() => exportToExcel(params.row.sheet_id)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Согласование дефектных ведомостей</Typography>
        <Box>
          <Tooltip title="Обновить">
            <IconButton onClick={loadData} disabled={loading}><RefreshIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Фильтр"><IconButton onClick={() => setFilterDialog(true)}><FilterIcon /></IconButton></Tooltip>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Ожидают" value={pendingApprovals.length} color="warning" icon={<HistoryIcon fontSize="large" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Согласовано сегодня" value={approvedSheets.filter(s => new Date(s.approved_at).toDateString() === new Date().toDateString()).length} color="success" icon={<ApproveIcon fontSize="large" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Отклонено" value={rejectedSheets.length} color="error" icon={<RejectIcon fontSize="large" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Всего обработано" value={approvedSheets.length + rejectedSheets.length} color="info" icon={<ViewIcon fontSize="large" />} />
        </Grid>
      </Grid>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab label={<Badge badgeContent={pendingApprovals.length} color="error">Ожидают</Badge>} />
        <Tab label="Согласовано" />
        <Tab label="Отклонено" />
        <Tab label="Вся история" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper sx={{ height: 600, width: '100%' }}>
        {tabValue === 0 && (
          <DataGrid
            rows={pendingApprovals}
            columns={pendingColumns}
            getRowId={(row) => row.sheet_id}
            pageSize={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            onPageSizeChange={(newSize) => setRowsPerPage(newSize)}
            onPageChange={(newPage) => setPage(newPage)}
            disableSelectionOnClick
            loading={loading}
          />
        )}
        {tabValue === 1 && (
          <DataGrid rows={approvedSheets} columns={historyColumns} getRowId={(row) => row.sheet_id} pageSize={rowsPerPage} rowsPerPageOptions={[10, 25, 50]} loading={loading} />
        )}
        {tabValue === 2 && (
          <DataGrid rows={rejectedSheets} columns={historyColumns} getRowId={(row) => row.sheet_id} pageSize={rowsPerPage} rowsPerPageOptions={[10, 25, 50]} loading={loading} />
        )}
        {tabValue === 3 && (
          <DataGrid rows={allSheets} columns={historyColumns} getRowId={(row) => row.sheet_id} pageSize={rowsPerPage} rowsPerPageOptions={[10, 25, 50]} loading={loading} />
        )}
      </Paper>

      <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, type: null })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {approvalDialog.type === 'approve' ? <ApproveIcon color="success" /> : <RejectIcon color="error" />}
            <Typography variant="h6">{approvalDialog.type === 'approve' ? 'Согласование ведомости' : 'Отклонение ведомости'}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedSheet && (
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">Ведомость №{selectedSheet.sheet_id} от {selectedSheet.submitted_by}</Typography>
              <Typography variant="body2">Файл: {selectedSheet.file_name}</Typography>
              <Typography variant="body2">Всего позиций: {selectedSheet.total_items}</Typography>
            </Box>
          )}
          <TextField
            autoFocus
            margin="dense"
            label={approvalDialog.type === 'approve' ? 'Комментарий (необязательно)' : 'Причина отклонения *'}
            fullWidth
            multiline
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required={approvalDialog.type === 'reject'}
            error={approvalDialog.type === 'reject' && !comment.trim()}
            helperText={approvalDialog.type === 'reject' && !comment.trim() ? 'Укажите причину отклонения' : ''}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setApprovalDialog({ open: false, type: null })} disabled={processing}>Отмена</Button>
          <Button onClick={approvalDialog.type === 'approve' ? handleApprove : handleReject} variant="contained" color={approvalDialog.type === 'approve' ? 'success' : 'error'} disabled={processing || (approvalDialog.type === 'reject' && !comment.trim())} startIcon={approvalDialog.type === 'approve' ? <ApproveIcon /> : <RejectIcon />}>
            {processing ? 'Обработка...' : (approvalDialog.type === 'approve' ? 'Согласовать' : 'Отклонить')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={filterDialog} onClose={() => setFilterDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Фильтры</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Дата с" type="date" fullWidth value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField label="Дата по" type="date" fullWidth value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField label="Отправитель" fullWidth value={filters.creator} onChange={(e) => setFilters({...filters, creator: e.target.value})} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilters({ dateFrom: '', dateTo: '', creator: '' })}>Сбросить</Button>
          <Button onClick={() => setFilterDialog(false)} variant="contained">Применить</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notification.open} autoHideDuration={6000} onClose={() => setNotification({ ...notification, open: false })}>
        <Alert severity={notification.severity}>{notification.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ApprovalsPage;