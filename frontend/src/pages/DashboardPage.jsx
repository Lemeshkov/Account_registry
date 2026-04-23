
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Paper,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  PendingActions as PendingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DashboardPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState({
    defectSheets: {
      total: 0,
      pending: 0,
      approved: 0,
      draft: 0,
      rejected: 0,
    },
    paymentRegistries: {
      total: 0,
      pending: 0,
      processed: 0,
    },
    recentSheets: [],
  });

  // Загружаем данные только после того, как авторизация завершена
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated && user) {
        loadDashboardData();
      } else {
        setDataLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, user]);

  const loadDashboardData = async () => {
    setDataLoading(true);
    try {
      console.log('📊 Loading dashboard data for user:', user?.username);
      
      // Проверяем наличие токена перед запросом
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, skipping data load');
        setDataLoading(false);
        return;
      }
      
      const mySheets = await api.getMySheets();
      
      console.log('📊 My sheets response:', mySheets);
      
      // Обрабатываем ответ
      let sheetsArray = [];
      if (Array.isArray(mySheets)) {
        sheetsArray = mySheets;
      } else if (mySheets && mySheets.data && Array.isArray(mySheets.data)) {
        sheetsArray = mySheets.data;
      } else if (mySheets && typeof mySheets === 'object') {
        sheetsArray = Object.values(mySheets).find(v => Array.isArray(v)) || [];
      }
      
      const defectStats = {
        total: sheetsArray.length,
        pending: sheetsArray.filter(s => s.status === 'pending').length,
        approved: sheetsArray.filter(s => s.status === 'approved').length,
        draft: sheetsArray.filter(s => s.status === 'draft').length,
        rejected: sheetsArray.filter(s => s.status === 'rejected').length,
      };

      const recentSheets = sheetsArray.slice(0, 5);

      setStats({
        defectSheets: defectStats,
        paymentRegistries: {
          total: 0,
          pending: 0,
          processed: 0,
        },
        recentSheets,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Не показываем ошибку пользователю для 401
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.log('Unauthorized, user not logged in');
      }
    } finally {
      setDataLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Согласована';
      case 'pending': return 'На согласовании';
      case 'rejected': return 'Отклонена';
      case 'draft': return 'Черновик';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Показываем скелетон во время загрузки авторизации или данных
  if (authLoading || dataLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Skeleton variant="text" width={300} height={50} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="600">
          Добро пожаловать, {user?.full_name || user?.username || 'Гость'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Выберите тип документа для работы или продолжайте работу с последними документами
        </Typography>
      </Box>

      <Grid container spacing={4} sx={{ mb: 5 }}>
        {/* Дефектная ведомость */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
                borderColor: theme.palette.primary.main,
              },
              border: `2px solid transparent`,
              height: '100%',
            }}
            onClick={() => navigate('/defect-sheets')}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    width: 56,
                    height: 56,
                    mr: 2,
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="600">
                    Дефектная ведомость
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Металлопрокат, трубы, арматура
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Создание, редактирование и согласование дефектных ведомостей.
                Калькулятор пересчета тонн в метры.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Chip size="small" label={`Всего: ${stats.defectSheets.total}`} variant="outlined" />
                {stats.defectSheets.pending > 0 && (
                  <Chip size="small" label={`На согласовании: ${stats.defectSheets.pending}`} color="warning" />
                )}
                {stats.defectSheets.draft > 0 && (
                  <Chip size="small" label={`Черновики: ${stats.defectSheets.draft}`} variant="outlined" />
                )}
                {stats.defectSheets.approved > 0 && (
                  <Chip size="small" label={`Согласовано: ${stats.defectSheets.approved}`} color="success" variant="outlined" />
                )}
              </Stack>

              <CardActions sx={{ p: 0 }}>
                <Button variant="contained" startIcon={<UploadIcon />} fullWidth>
                  Создать / Загрузить
                </Button>
              </CardActions>
            </CardContent>
          </Card>
        </Grid>

        {/* Реестр счетов */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
                borderColor: theme.palette.secondary.main,
              },
              border: `2px solid transparent`,
              height: '100%',
            }}
            onClick={() => navigate('/payment-registry')}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                    width: 56,
                    height: 56,
                    mr: 2,
                  }}
                >
                  <ReceiptIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="600">
                    Реестр счетов
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Платежный реестр, счета
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Управление платежным реестром, привязка счетов, 
                экспорт в Excel, согласование.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip size="small" label="Excel импорт" variant="outlined" />
                <Chip size="small" label="PDF счета" variant="outlined" />
                <Chip size="small" label="Согласование" variant="outlined" />
              </Stack>

              <CardActions sx={{ p: 0 }}>
                <Button variant="outlined" color="secondary" startIcon={<ReceiptIcon />} fullWidth>
                  Перейти к реестру
                </Button>
              </CardActions>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Последние документы */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="600">
            📄 Последние документы
          </Typography>
          <Button size="small" onClick={() => navigate('/my-sheets')}>
            Все ведомости →
          </Button>
        </Box>

        {stats.recentSheets.length > 0 ? (
          <Stack divider={<Divider />} spacing={2}>
            {stats.recentSheets.map((sheet) => (
              <Box
                key={sheet.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  px: 2,
                  borderRadius: 1,
                }}
                onClick={() => navigate(`/defect-sheet/${sheet.id}`)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <DescriptionIcon color="action" />
                  <Box>
                    <Typography variant="body1" fontWeight="500">
                      {sheet.file_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {sheet.id} • Создан: {formatDate(sheet.created_at)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip label={getStatusText(sheet.status)} color={getStatusColor(sheet.status)} size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {sheet.total_items || 0} позиций
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              У вас пока нет созданных ведомостей
            </Typography>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/defect-sheets')}>
              Создать ведомость
            </Button>
          </Box>
        )}
      </Paper>

      {/* Статистика */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <TrendingUpIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight="600">
              {stats.defectSheets.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Всего ведомостей
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <PendingIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight="600" color="warning.main">
              {stats.defectSheets.pending}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              На согласовании
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight="600" color="success.main">
              {stats.defectSheets.approved}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Согласовано
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CancelIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight="600" color="error.main">
              {stats.defectSheets.draft}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Черновики
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;