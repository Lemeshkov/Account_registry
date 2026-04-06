
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
//   Notifications as NotificationsIcon,
// } from '@mui/icons-material';
// import { useAuth } from '../context/AuthContext';
// import ApprovalNotifications from './ApprovalNotifications';
// import { useWebSocket } from '../hooks/useWebSocket';
// import NotificationSnackbar from './NotificationSnackbar';

// const Layout = () => {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const { lastMessage, connectionStatus, sendMessage } = useWebSocket('layout');
  
//   // WebSocket аутентификация при загрузке пользователя
//   useEffect(() => {
//     if (user && user.id && sendMessage) {
//       sendMessage({
//         type: 'authenticate',
//         user_id: String(user.id)
//       });
//     }
//   }, [user, sendMessage]);

//   // Обработка уведомлений
//   useEffect(() => {
//     if (lastMessage) {
//       console.log('📨 Layout received notification:', lastMessage);
      
//       // Показываем всплывающее уведомление
//       if (lastMessage.type === 'approval_request') {
//         showBrowserNotification('📬 Новая ведомость на согласование', lastMessage.message);
//       } else if (lastMessage.type === 'approval_approved') {
//         showBrowserNotification('✅ Ведомость согласована', lastMessage.message);
//       } else if (lastMessage.type === 'approval_rejected') {
//         showBrowserNotification('❌ Ведомость отклонена', lastMessage.message);
//       } else if (lastMessage.type === 'defect_sheet_ready') {
//         showBrowserNotification('📄 Ведомость обработана', lastMessage.message);
//       }
//     }
//   }, [lastMessage]);

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
//             color={connectionStatus === 'connected' ? 'success' : 'error'} 
//             variant="dot" 
//             sx={{ mr: 2 }}
//             title={connectionStatus === 'connected' ? 'Соединение установлено' : 'Нет соединения'}
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
//     </Box>
//   );
// };

// export default Layout;

// frontend/src/components/Layout.jsx
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
import ApprovalNotifications from './ApprovalNotifications';
import NotificationSnackbar from './NotificationSnackbar';

const Layout = () => {
  const { user, logout, lastWebSocketMessage, wsConnected } = useAuth(); // <-- Добавили wsConnected
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
      
      {/* Компонент для всплывающих уведомлений */}
      <NotificationSnackbar />
    </Box>
  );
};

export default Layout;