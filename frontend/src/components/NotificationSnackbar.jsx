// frontend/src/components/NotificationSnackbar.jsx
import React, { useState, useEffect } from "react";
import {
  Snackbar,
  Alert,
  Box,
  Typography,
  Button,
  IconButton,
  Slide,
  Collapse,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

// Анимация появления
const SlideTransition = (props) => {
  return <Slide {...props} direction="left" />;
};

// Компонент отдельного уведомления
const NotificationItem = ({ notification, onClose, onView }) => {
  const { type, sheet_id, message, comment, approved_by, approved_at, status } =
    notification;

  const getIcon = () => {
    switch (type) {
      case "approval_approved":
        return <CheckIcon sx={{ fontSize: 32, color: "#4caf50" }} />;
      case "approval_rejected":
        return <CancelIcon sx={{ fontSize: 32, color: "#f44336" }} />;
      case "approval_request":
        return <ScheduleIcon sx={{ fontSize: 32, color: "#ff9800" }} />;
      default:
        return <InfoIcon sx={{ fontSize: 32, color: "#2196f3" }} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "approval_approved":
        return "#e8f5e9";
      case "approval_rejected":
        return "#ffebee";
      case "approval_request":
        return "#fff3e0";
      case "submitted_for_approval": 
        return "#e3f2fd";
      case "defect_sheet_ready": 
        return "#e8f5e9";
      default:
        return "#e3f2fd";
    }
  };

  const getTitle = () => {
    switch (type) {
      case "approval_approved":
        return "✅ Ведомость согласована";
      case "approval_rejected":
        return "❌ Ведомость отклонена";
      case "approval_request":
        return "📬 Новая ведомость на согласование";
      case "submitted_for_approval": 
        return "📤 Отправлено на согласование";
      case "defect_sheet_ready": 
        return "📄 Ведомость обработана";
      default:
        return "📢 Уведомление";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card
      sx={{
        mb: 1.5,
        width: 380,
        bgcolor: getBgColor(),
        boxShadow: 3,
        borderRadius: 2,
        borderLeft: `4px solid ${
          type === "approval_approved"
            ? "#4caf50"
            : type === "approval_rejected"
              ? "#f44336"
              : type === "approval_request"
                ? "#ff9800"
                : "#2196f3"
        }`,
        position: "relative",
        animation: "fadeIn 0.3s ease-in-out",
        "@keyframes fadeIn": {
          from: { opacity: 0, transform: "translateX(100%)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2 }}>
        <Box display="flex" alignItems="flex-start" gap={1.5}>
          <Box flexShrink={0}>{getIcon()}</Box>
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {getTitle()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {message}
            </Typography>

            {comment && (
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  bgcolor: "rgba(0,0,0,0.05)",
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Комментарий:
                </Typography>
                <Typography variant="body2" fontStyle="italic">
                  "{comment}"
                </Typography>
              </Box>
            )}

            {approved_by && (
              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                <Chip
                  label={approved_by}
                  size="small"
                  variant="outlined"
                  icon={
                    type === "approval_approved" ? (
                      <CheckIcon />
                    ) : (
                      <CancelIcon />
                    )
                  }
                  color={type === "approval_approved" ? "success" : "error"}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(approved_at)}
                </Typography>
              </Box>
            )}

            {status && (
              <Chip
                label={
                  status === "approved"
                    ? "Согласовано"
                    : status === "rejected"
                      ? "Отклонено"
                      : status
                }
                size="small"
                color={
                  status === "approved"
                    ? "success"
                    : status === "rejected"
                      ? "error"
                      : "warning"
                }
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => onClose(notification.id)}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </CardContent>
      <Divider />
      <CardActions sx={{ px: 2, py: 1, justifyContent: "flex-end" }}>
        <Button
          size="small"
          startIcon={<ViewIcon />}
          onClick={() => onView(sheet_id)}
          variant="text"
        >
          Просмотреть ведомость
        </Button>
      </CardActions>
    </Card>
  );
};

const NotificationSnackbar = () => {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  // Подписка на WebSocket сообщения
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      const data = event.detail;
      console.log("📨 New notification received:", data);

      // Обрабатываем только уведомления о согласовании
      const notificationTypes = [
        "approval_approved",
        "approval_rejected",
        "approval_request",
        "defect_sheet_ready",
        "submitted_for_approval",
      ];

      if (notificationTypes.includes(data.type)) {
        const newNotification = {
          id: Date.now() + Math.random(),
          type: data.type,
          sheet_id: data.sheet_id,
          message: data.message,
          comment: data.comment,
          approved_by: data.approved_by,
          approved_at: data.approved_at,
          status: data.status,
          timestamp: Date.now(),
        };

        setNotifications((prev) => [newNotification, ...prev]);

        // Автоматически скрываем через 8 секунд
        setTimeout(() => {
          removeNotification(newNotification.id);
        }, 8000);
      }
    };

    window.addEventListener("websocket-message", handleWebSocketMessage);
    return () =>
      window.removeEventListener("websocket-message", handleWebSocketMessage);
  }, []);

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleViewSheet = (sheetId) => {
    navigate(`/defect-sheet/${sheetId}`);
    // Закрываем все уведомления после перехода
    setNotifications([]);
  };

  const handleClose = (id) => {
    removeNotification(id);
  };

  // Если нет уведомлений, ничего не показываем
  if (notifications.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        maxWidth: "100%",
        pointerEvents: "none",
      }}
    >
      {notifications.map((notification) => (
        <Box
          key={notification.id}
          sx={{
            pointerEvents: "auto",
            mb: 1,
            transition: "all 0.3s ease",
          }}
        >
          <NotificationItem
            notification={notification}
            onClose={handleClose}
            onView={handleViewSheet}
          />
        </Box>
      ))}
    </Box>
  );
};

export default NotificationSnackbar;
