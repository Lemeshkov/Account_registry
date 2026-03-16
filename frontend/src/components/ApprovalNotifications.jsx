// frontend/src/components/ApprovalNotifications.jsx
import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  Chip,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import api from '../services/api';

const ApprovalNotifications = ({ userId }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  
  const { lastMessage } = useWebSocket(userId);

  // Обработка входящих WebSocket сообщений
  useEffect(() => {
    if (lastMessage) {
      console.log("📨 Notification received:", lastMessage);
      
      if (lastMessage.type === 'approval_request') {
        // Добавляем новое уведомление
        setNotifications(prev => [{
          id: Date.now(),
          type: 'approval_request',
          sheet_id: lastMessage.sheet_id,
          message: lastMessage.message,
          time: new Date().toLocaleString(),
          read: false
        }, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
      
      if (lastMessage.type === 'approval_approved' || lastMessage.type === 'approval_rejected') {
        // Уведомление для создателя
        setNotifications(prev => [{
          id: Date.now(),
          type: lastMessage.type,
          sheet_id: lastMessage.sheet_id,
          message: lastMessage.message,
          comment: lastMessage.comment,
          approved_by: lastMessage.approved_by,
          time: new Date().toLocaleString(),
          read: false
        }, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [lastMessage]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    // Отмечаем как прочитанные при открытии
    setUnreadCount(0);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification) => {
    // Переходим к ведомости
    navigate(`/defect-sheet/${notification.sheet_id}`);
    handleClose();
  };

  const handleViewAll = () => {
    navigate('/approvals');
    handleClose();
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'approval_request':
        return <NotificationsIcon color="warning" />;
      case 'approval_approved':
        return <CheckIcon color="success" />;
      case 'approval_rejected':
        return <CancelIcon color="error" />;
      default:
        return <NotificationsIcon />;
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
          sx: { width: 360, maxHeight: 500 }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6">Уведомления</Typography>
        </Box>
        
        <Divider />
        
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="textSecondary">
              Нет новых уведомлений
            </Typography>
          </MenuItem>
        ) : (
          notifications.slice(0, 5).map((notif) => (
            <MenuItem 
              key={notif.id} 
              onClick={() => handleNotificationClick(notif)}
              sx={{ 
                whiteSpace: 'normal',
                borderLeft: notif.read ? 'none' : '3px solid #1976d2'
              }}
            >
              <ListItemIcon>
                {getNotificationIcon(notif.type)}
              </ListItemIcon>
              <ListItemText
                primary={notif.message}
                secondary={
                  <Box>
                    <Typography variant="caption" color="textSecondary" component="div">
                      {notif.time}
                    </Typography>
                    {notif.comment && (
                      <Typography variant="caption" color="textSecondary" component="div">
                        Комментарий: {notif.comment}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </MenuItem>
          ))
        )}
        
        <Divider />
        
        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={handleViewAll}>
            Все уведомления
          </Button>
        </Box>
      </Menu>
    </>
  );
};

export default ApprovalNotifications;