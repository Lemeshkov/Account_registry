
// // frontend/src/components/Layout.jsx
// import React, { useEffect } from 'react';
// import { Outlet, useNavigate, useLocation } from 'react-router-dom';
// import {
//   AppBar,
//   Box,
//   Toolbar,
//   Typography,
//   Button,
//   Tabs,
//   Tab,
//   Badge,
// } from '@mui/material';
// import {
//   Description as DescriptionIcon,
//   CheckCircle as CheckCircleIcon,
//   Assignment as AssignmentIcon,
//   Logout as LogoutIcon,
// } from '@mui/icons-material';
// import { useAuth } from '../context/AuthContext';
// import ApprovalNotifications from './ApprovalNotifications';
// import NotificationSnackbar from './NotificationSnackbar';

// const Layout = () => {
//   const { user, logout, lastWebSocketMessage, wsConnected } = useAuth(); // <-- Добавили wsConnected
//   const navigate = useNavigate();
//   const location = useLocation();

//   // Обработка уведомлений
//   useEffect(() => {
//     if (lastWebSocketMessage) {
//       console.log('📨 Layout received notification:', lastWebSocketMessage);
      
//       // Показываем всплывающее уведомление
//       if (lastWebSocketMessage.type === 'approval_request') {
//         showBrowserNotification('📬 Новая ведомость на согласование', lastWebSocketMessage.message);
//       } else if (lastWebSocketMessage.type === 'approval_approved') {
//         showBrowserNotification('✅ Ведомость согласована', lastWebSocketMessage.message);
//       } else if (lastWebSocketMessage.type === 'approval_rejected') {
//         showBrowserNotification('❌ Ведомость отклонена', lastWebSocketMessage.message);
//       } else if (lastWebSocketMessage.type === 'defect_sheet_ready') {
//         showBrowserNotification('📄 Ведомость обработана', lastWebSocketMessage.message);
//       } else if (lastWebSocketMessage.type === 'submitted_for_approval') {
//         showBrowserNotification('📤 Отправлено на согласование', lastWebSocketMessage.message);
//       }
//     }
//   }, [lastWebSocketMessage]);

//   const showBrowserNotification = (title, body) => {
//     if ('Notification' in window && Notification.permission === 'granted') {
//       new Notification(title, { body, icon: '/favicon.ico' });
//     } else if ('Notification' in window && Notification.permission !== 'denied') {
//       Notification.requestPermission();
//     }
//   };

//   // Запрос разрешения на уведомления при монтировании
//   useEffect(() => {
//     if ('Notification' in window && Notification.permission === 'default') {
//       Notification.requestPermission();
//     }
//   }, []);

//   const getCurrentTab = () => {
//     if (location.pathname.includes('/my-sheets')) return 0;
//     if (location.pathname.includes('/defect-sheets')) return 1;
//     if (location.pathname.includes('/approvals')) return 2;
//     return 0;
//   };

//   const handleTabChange = (event, newValue) => {
//     switch (newValue) {
//       case 0:
//         navigate('/my-sheets');
//         break;
//       case 1:
//         navigate('/defect-sheets');
//         break;
//       case 2:
//         navigate('/approvals');
//         break;
//       default:
//         navigate('/my-sheets');
//     }
//   };

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
//       {/* Верхняя панель */}
//       <AppBar position="static">
//         <Toolbar>
//           <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
//             Дефектные ведомости
//           </Typography>
          
//           {/* Статус WebSocket */}
//           <Badge 
//             color={wsConnected ? 'success' : 'error'} 
//             variant="dot" 
//             sx={{ mr: 2 }}
//             title={wsConnected ? 'Соединение установлено' : 'Нет соединения'}
//           />
          
//           {/* Информация о пользователе */}
//           <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
//             <Typography variant="body2" sx={{ mr: 1 }}>
//               {user?.full_name || user?.username}
//             </Typography>
//             <Badge 
//               color={user?.role === 'approver' ? 'success' : 'info'} 
//               variant="dot" 
//               sx={{ mr: 1 }}
//               title={user?.role === 'approver' ? 'Согласователь' : 'Пользователь'}
//             />
//           </Box>
          
//           {/* Уведомления (только для согласователей) */}
//           {(user?.role === 'approver' || user?.role === 'admin') && (
//             <ApprovalNotifications userId={user?.id} />
//           )}
          
//           {/* Кнопка выхода */}
//           <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
//             Выйти
//           </Button>
//         </Toolbar>
//       </AppBar>

//       {/* Вкладки навигации */}
//       <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
//         <Tabs 
//           value={getCurrentTab()} 
//           onChange={handleTabChange}
//           sx={{ px: 3 }}
//         >
//           <Tab 
//             icon={<AssignmentIcon />} 
//             label="Мои ведомости" 
//             iconPosition="start"
//           />
//           <Tab 
//             icon={<DescriptionIcon />} 
//             label="Новая ведомость" 
//             iconPosition="start"
//           />
//           {(user?.role === 'approver' || user?.role === 'admin') && (
//             <Tab 
//               icon={<CheckCircleIcon />} 
//               label="Согласование" 
//               iconPosition="start"
//             />
//           )}
//         </Tabs>
//       </Box>

//       {/* Основной контент */}
//       <Box sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5' }}>
//         <Outlet />
//       </Box>
      
//       {/* Компонент для всплывающих уведомлений */}
//       <NotificationSnackbar />
//     </Box>
//   );
// };

// export default Layout;

// frontend/src/components/Layout.jsx
import React, { useEffect } from 'react';
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
import { useNotifications } from '../context/NotificationContext'; // Добавляем импорт
import ApprovalNotifications from './ApprovalNotifications';
import NotificationSnackbar from './NotificationSnackbar';

const Layout = () => {
  const { user, logout, lastWebSocketMessage, wsConnected } = useAuth();
  const { 
    pendingApprovalsCount, 
    mySheetsNotificationsCount,
    resetPendingApprovalsCount,
    resetMySheetsNotificationsCount,
  } = useNotifications(); // Используем контекст уведомлений
  const navigate = useNavigate();
  const location = useLocation();

  // Обработка уведомлений
  useEffect(() => {
    if (lastWebSocketMessage) {
      console.log('📨 Layout received notification:', lastWebSocketMessage);
      
      // Показываем всплывающее уведомление
      if (lastWebSocketMessage.type === 'approval_request') {
        showBrowserNotification('📬 Новая ведомость на согласование', lastWebSocketMessage.message);
      } else if (lastWebSocketMessage.type === 'approval_approved') {
        showBrowserNotification('✅ Ведомость согласована', lastWebSocketMessage.message);
      } else if (lastWebSocketMessage.type === 'approval_rejected') {
        showBrowserNotification('❌ Ведомость отклонена', lastWebSocketMessage.message);
      } else if (lastWebSocketMessage.type === 'defect_sheet_ready') {
        showBrowserNotification('📄 Ведомость обработана', lastWebSocketMessage.message);
      } else if (lastWebSocketMessage.type === 'submitted_for_approval') {
        showBrowserNotification('📤 Отправлено на согласование', lastWebSocketMessage.message);
      }
    }
  }, [lastWebSocketMessage]);

  const showBrowserNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  // Запрос разрешения на уведомления при монтировании
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getCurrentTab = () => {
    if (location.pathname.includes('/my-sheets')) return 0;
    if (location.pathname.includes('/defect-sheets')) return 1;
    if (location.pathname.includes('/approvals')) return 2;
    return 0;
  };

  const handleTabChange = (event, newValue) => {
    // Сбрасываем счетчики при переходе на соответствующие вкладки
    if (newValue === 0) {
      resetMySheetsNotificationsCount();
    }
    if (newValue === 2) {
      resetPendingApprovalsCount();
    }
    
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
          
          {/* Статус WebSocket */}
          <Badge 
            color={wsConnected ? 'success' : 'error'} 
            variant="dot" 
            sx={{ mr: 2 }}
            title={wsConnected ? 'Соединение установлено' : 'Нет соединения'}
          />
          
          {/* Информация о пользователе */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {user?.full_name || user?.username}
            </Typography>
            <Badge 
              color={user?.role === 'approver' ? 'success' : 'info'} 
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
          {/* Вкладка "Мои ведомости" с счетчиком */}
          <Tab 
            icon={
              <Badge 
                badgeContent={mySheetsNotificationsCount} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    top: -8,
                    right: -8,
                  }
                }}
              >
                <AssignmentIcon />
              </Badge>
            } 
            label="Мои ведомости" 
            iconPosition="start"
          />
          
          {/* Вкладка "Новая ведомость" без счетчика */}
          <Tab 
            icon={<DescriptionIcon />} 
            label="Новая ведомость" 
            iconPosition="start"
          />
          
          {/* Вкладка "Согласование" с счетчиком (только для approver/admin) */}
          {(user?.role === 'approver' || user?.role === 'admin') && (
            <Tab 
              icon={
                <Badge 
                  badgeContent={pendingApprovalsCount} 
                  color="error"
                  sx={{
                    '& .MuiBadge-badge': {
                      top: -8,
                      right: -8,
                    }
                  }}
                >
                  <CheckCircleIcon />
                </Badge>
              } 
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
      
      {/* Компонент для всплывающих уведомлений */}
      <NotificationSnackbar />
    </Box>
  );
};

export default Layout;