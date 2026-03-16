// frontend/src/components/Layout.jsx
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import ApprovalNotifications from './ApprovalNotifications';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Определяем текущую вкладку по пути
  const getCurrentTab = () => {
    if (location.pathname.includes('/my-sheets')) return 0;
    if (location.pathname.includes('/defect-sheets')) return 1;
    if (location.pathname.includes('/approvals')) return 2;
    return 0;
  };

  const handleTabChange = (event, newValue) => {
    switch (newValue) {
      case 0:
        navigate('/my-sheets');
        break;
      case 1:
        navigate('/defect-sheets');
        break;
      case 2:
        navigate('/approvals');
        break;
      default:
        navigate('/my-sheets');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Верхняя панель */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Дефектные ведомости
          </Typography>
          
          {/* Информация о пользователе */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {user?.full_name || user?.username}
            </Typography>
            <Badge 
              color="success" 
              variant="dot" 
              sx={{ mr: 1 }}
              title={user?.role === 'approver' ? 'Согласователь' : 'Пользователь'}
            />
          </Box>
          
          {/* Уведомления (только для согласователей) */}
          {(user?.role === 'approver' || user?.role === 'admin') && (
            <ApprovalNotifications userId={user?.id} />
          )}
          
          {/* Кнопка выхода */}
          <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      {/* Вкладки навигации */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs 
          value={getCurrentTab()} 
          onChange={handleTabChange}
          sx={{ px: 3 }}
        >
          <Tab 
            icon={<AssignmentIcon />} 
            label="Мои ведомости" 
            iconPosition="start"
          />
          <Tab 
            icon={<DescriptionIcon />} 
            label="Новая ведомость" 
            iconPosition="start"
          />
          {(user?.role === 'approver' || user?.role === 'admin') && (
            <Tab 
              icon={<CheckCircleIcon />} 
              label="Согласование" 
              iconPosition="start"
            />
          )}
        </Tabs>
      </Box>

      {/* Основной контент */}
      <Box sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;