
// import React, { useState, useEffect , useRef} from 'react';
// import {
//   IconButton,
//   Badge,
//   Menu,
//   MenuItem,
//   Typography,
//   Box,
//   Divider,
//   List,
//   ListItem,
//   ListItemText,
//   ListItemIcon,
//   Chip,
//   Button,
// } from '@mui/material';
// import {
//   Notifications as NotificationsIcon,
//   CheckCircle as CheckIcon,
//   Cancel as CancelIcon,
//   Visibility as ViewIcon,
//   Info as InfoIcon,
// } from '@mui/icons-material';
// import { useWebSocket } from '../hooks/useWebSocket';
// import { useAuth } from '../context/AuthContext';
// import { useNavigate } from 'react-router-dom';
// import api from '../services/api';

// const NotificationBell = () => {
//   const [anchorEl, setAnchorEl] = useState(null);
//   const [notifications, setNotifications] = useState([]);
//   const [unreadCount, setUnreadCount] = useState(0);
//    const { user, lastWebSocketMessage } = useAuth();
//   const navigate = useNavigate();
//   const notificationsLoaded = useRef(false);
  
//   // Подключаемся к WebSocket для уведомлений
//   const { lastMessage } = useWebSocket('notifications');

//   // Загрузка непрочитанных уведомлений при монтировании
//     useEffect(() => {
//     if (user && !notificationsLoaded.current) { // <-- Проверяем, загружали ли уже
//       notificationsLoaded.current = true; // <-- Устанавливаем флаг
//       loadUnreadNotifications();
//     }
//   }, [user]);

//   // Обработка WebSocket сообщений
//   useEffect(() => {
//     if (lastWebSocketMessage) {
//       console.log('📨 Notification received in Bell:', lastWebSocketMessage);
      
//       const { type, sheet_id, message, sheet_status } = lastWebSocketMessage;
      
//       if (type === 'approval_request' || type === 'approval_approved' || type === 'approval_rejected') {
//         // Создаем уведомление
//         const newNotification = {
//           id: Date.now(),
//           type: type,
//           sheet_id: sheet_id,
//           message: message,
//           status: 'unread',
//           created_at: new Date().toISOString(),
//         };
//         setNotifications(prev => [newNotification, ...prev]);
//         setUnreadCount(prev => prev + 1);
//         showBrowserNotification(
//           type === 'approval_request' ? 'Новая ведомость на согласование' : 
//           type === 'approval_approved' ? '✅ Ведомость согласована' : '❌ Ведомость отклонена',
//           message
//         );
//       }
//     }
//   }, [lastWebSocketMessage]);
      
//       if (type === 'approval_approved') {
//         // Ведомость согласована
//         const newNotification = {
//           id: Date.now(),
//           type: 'approval_approved',
//           sheet_id: sheet_id,
//           message: message,
//           status: 'unread',
//           created_at: new Date().toISOString(),
//         };
//         setNotifications(prev => [newNotification, ...prev]);
//         setUnreadCount(prev => prev + 1);
//         showBrowserNotification('✅ Ведомость согласована', message);
//       }
      
//       if (type === 'approval_rejected') {
//         // Ведомость отклонена
//         const newNotification = {
//           id: Date.now(),
//           type: 'approval_rejected',
//           sheet_id: sheet_id,
//           message: message,
//           status: 'unread',
//           created_at: new Date().toISOString(),
//         };
//         setNotifications(prev => [newNotification, ...prev]);
//         setUnreadCount(prev => prev + 1);
//         showBrowserNotification('❌ Ведомость отклонена', message);
//       }
//     }
//   }, [lastMessage]);

//   // Загрузка непрочитанных уведомлений
//   const loadUnreadNotifications = async () => {
//     try {
//       // Получаем ожидающие согласования (для approver)
//       if (user?.role === 'approver' || user?.role === 'admin') {
//         const pending = await api.get('/api/defect/pending-approvals');
//         if (pending.approvals && pending.approvals.length > 0) {
//           const pendingNotifications = pending.approvals.map(approval => ({
//             id: approval.notification_id,
//             type: 'approval_request',
//             sheet_id: approval.sheet_id,
//             message: approval.message,
//             status: 'unread',
//             created_at: approval.submitted_at,
//           }));
//           setNotifications(prev => [...pendingNotifications, ...prev]);
//           setUnreadCount(pendingNotifications.length);
//         }
//       }
//     } catch (error) {
//       console.error('Error loading notifications:', error);
//     }
//   };

//   // Показ уведомления в браузере
//   const showBrowserNotification = (title, body) => {
//     if ('Notification' in window && Notification.permission === 'granted') {
//       new Notification(title, { body, icon: '/favicon.ico' });
//     } else if ('Notification' in window && Notification.permission !== 'denied') {
//       Notification.requestPermission();
//     }
//   };

//   // Запрос разрешения на уведомления
//   useEffect(() => {
//     if ('Notification' in window && Notification.permission === 'default') {
//       Notification.requestPermission();
//     }
//   }, []);

//   const handleClick = (event) => {
//     setAnchorEl(event.currentTarget);
//   };

//   const handleClose = () => {
//     setAnchorEl(null);
//   };

//   const handleNotificationClick = (notification) => {
//     // Отмечаем как прочитанное
//     setNotifications(prev => 
//       prev.map(n => n.id === notification.id ? { ...n, status: 'read' } : n)
//     );
//     setUnreadCount(prev => Math.max(0, prev - 1));
    
//     // Переходим к ведомости
//     navigate(`/defect-sheet/${notification.sheet_id}`);
//     handleClose();
//   };

//   const handleMarkAllAsRead = () => {
//     setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
//     setUnreadCount(0);
//   };

//   const getNotificationIcon = (type) => {
//     switch (type) {
//       case 'approval_request':
//         return <InfoIcon color="warning" />;
//       case 'approval_approved':
//         return <CheckIcon color="success" />;
//       case 'approval_rejected':
//         return <CancelIcon color="error" />;
//       default:
//         return <NotificationsIcon />;
//     }
//   };

//   const getNotificationColor = (type) => {
//     switch (type) {
//       case 'approval_request':
//         return 'warning';
//       case 'approval_approved':
//         return 'success';
//       case 'approval_rejected':
//         return 'error';
//       default:
//         return 'info';
//     }
//   };

//   return (
//     <>
//       <IconButton color="inherit" onClick={handleClick}>
//         <Badge badgeContent={unreadCount} color="error">
//           <NotificationsIcon />
//         </Badge>
//       </IconButton>
      
//       <Menu
//         anchorEl={anchorEl}
//         open={Boolean(anchorEl)}
//         onClose={handleClose}
//         PaperProps={{
//           sx: { width: 380, maxHeight: 500 },
//         }}
//       >
//         <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//           <Typography variant="h6">Уведомления</Typography>
//           {unreadCount > 0 && (
//             <Button size="small" onClick={handleMarkAllAsRead}>
//               Отметить все прочитанными
//             </Button>
//           )}
//         </Box>
//         <Divider />
        
//         {notifications.length === 0 ? (
//           <Box sx={{ p: 3, textAlign: 'center' }}>
//             <Typography color="textSecondary">Нет уведомлений</Typography>
//           </Box>
//         ) : (
//           <List sx={{ p: 0 }}>
//             {notifications.map((notification) => (
//               <ListItem
//                 key={notification.id}
//                 button
//                 onClick={() => handleNotificationClick(notification)}
//                 sx={{
//                   bgcolor: notification.status === 'unread' ? 'action.hover' : 'transparent',
//                   '&:hover': { bgcolor: 'action.selected' },
//                 }}
//               >
//                 <ListItemIcon>
//                   {getNotificationIcon(notification.type)}
//                 </ListItemIcon>
//                 <ListItemText
//                   primary={notification.message}
//                   secondary={
//                     <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
//                       <Typography variant="caption" color="textSecondary">
//                         {new Date(notification.created_at).toLocaleString('ru-RU')}
//                       </Typography>
//                       <Chip
//                         label={
//                           notification.type === 'approval_request' ? 'Ожидает' :
//                           notification.type === 'approval_approved' ? 'Согласовано' :
//                           notification.type === 'approval_rejected' ? 'Отклонено' : ''
//                         }
//                         size="small"
//                         color={getNotificationColor(notification.type)}
//                         variant="outlined"
//                       />
//                     </Box>
//                   }
//                   secondaryTypographyProps={{ component: 'div' }}
//                 />
//                 <IconButton edge="end" size="small" onClick={(e) => {
//                   e.stopPropagation();
//                   handleNotificationClick(notification);
//                 }}>
//                   <ViewIcon fontSize="small" />
//                 </IconButton>
//               </ListItem>
//             ))}
//           </List>
//         )}
//       </Menu>
//     </>
//   );
// };

// export default NotificationBell;

// frontend/src/components/NotificationBell.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const NotificationBell = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, lastWebSocketMessage } = useAuth(); // Используем глобальное WebSocket из контекста
  const navigate = useNavigate();
  const notificationsLoaded = useRef(false);

  // Загрузка непрочитанных уведомлений при монтировании (только один раз)
  useEffect(() => {
    if (user && !notificationsLoaded.current) {
      notificationsLoaded.current = true;
      loadUnreadNotifications();
    }
  }, [user]);

  // Обработка WebSocket сообщений из глобального контекста
  useEffect(() => {
    if (lastWebSocketMessage) {
      console.log('📨 Notification received in Bell:', lastWebSocketMessage);
      
      const { type, sheet_id, message } = lastWebSocketMessage;
      
      if (type === 'approval_request' || type === 'approval_approved' || type === 'approval_rejected') {
        // Создаем уведомление
        const newNotification = {
          id: Date.now(),
          type: type,
          sheet_id: sheet_id,
          message: message,
          status: 'unread',
          created_at: new Date().toISOString(),
        };
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
        showBrowserNotification(
          type === 'approval_request' ? 'Новая ведомость на согласование' : 
          type === 'approval_approved' ? '✅ Ведомость согласована' : '❌ Ведомость отклонена',
          message
        );
      }
    }
  }, [lastWebSocketMessage]);

  // Загрузка непрочитанных уведомлений
  const loadUnreadNotifications = async () => {
    try {
      // Получаем ожидающие согласования (для approver)
      if (user?.role === 'approver' || user?.role === 'admin') {
        const pending = await api.get('/api/defect/pending-approvals');
        if (pending.approvals && pending.approvals.length > 0) {
          const pendingNotifications = pending.approvals.map(approval => ({
            id: approval.notification_id,
            type: 'approval_request',
            sheet_id: approval.sheet_id,
            message: approval.message,
            status: 'unread',
            created_at: approval.submitted_at,
          }));
          setNotifications(prev => [...pendingNotifications, ...prev]);
          setUnreadCount(pendingNotifications.length);
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Показ уведомления в браузере
  const showBrowserNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  // Запрос разрешения на уведомления
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    // Отмечаем как прочитанное
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, status: 'read' } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Переходим к ведомости
    navigate(`/defect-sheet/${notification.sheet_id}`);
    handleClose();
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    setUnreadCount(0);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval_request':
        return <InfoIcon color="warning" />;
      case 'approval_approved':
        return <CheckIcon color="success" />;
      case 'approval_rejected':
        return <CancelIcon color="error" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'approval_request':
        return 'warning';
      case 'approval_approved':
        return 'success';
      case 'approval_rejected':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 380, maxHeight: 500 },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Уведомления</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Отметить все прочитанными
            </Button>
          )}
        </Box>
        <Divider />
        
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">Нет уведомлений</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                button
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  bgcolor: notification.status === 'unread' ? 'action.hover' : 'transparent',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
              >
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={notification.message}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(notification.created_at).toLocaleString('ru-RU')}
                      </Typography>
                      <Chip
                        label={
                          notification.type === 'approval_request' ? 'Ожидает' :
                          notification.type === 'approval_approved' ? 'Согласовано' :
                          notification.type === 'approval_rejected' ? 'Отклонено' : ''
                        }
                        size="small"
                        color={getNotificationColor(notification.type)}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
                <IconButton edge="end" size="small" onClick={(e) => {
                  e.stopPropagation();
                  handleNotificationClick(notification);
                }}>
                  <ViewIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;