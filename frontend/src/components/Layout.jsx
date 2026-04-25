import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Receipt as ReceiptIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import ApprovalNotifications from "./ApprovalNotifications";
import NotificationSnackbar from "./NotificationSnackbar";

const Layout = () => {
  const { user, logout, lastWebSocketMessage, wsConnected } = useAuth();
  const {
    pendingApprovalsCount,
    mySheetsNotificationsCount,
    resetPendingApprovalsCount,
    resetMySheetsNotificationsCount,
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Обработка уведомлений
  useEffect(() => {
    if (lastWebSocketMessage) {
      console.log("📨 Layout received notification:", lastWebSocketMessage);

      if (lastWebSocketMessage.type === "approval_request") {
        showBrowserNotification(
          "📬 Новая ведомость на согласование",
          lastWebSocketMessage.message,
        );
      } else if (lastWebSocketMessage.type === "approval_approved") {
        showBrowserNotification(
          "✅ Ведомость согласована",
          lastWebSocketMessage.message,
        );
      } else if (lastWebSocketMessage.type === "approval_rejected") {
        showBrowserNotification(
          "❌ Ведомость отклонена",
          lastWebSocketMessage.message,
        );
      } else if (lastWebSocketMessage.type === "defect_sheet_ready") {
        showBrowserNotification(
          "📄 Ведомость обработана",
          lastWebSocketMessage.message,
        );
      } else if (lastWebSocketMessage.type === "submitted_for_approval") {
        showBrowserNotification(
          "📤 Отправлено на согласование",
          lastWebSocketMessage.message,
        );
      }
    }
  }, [lastWebSocketMessage]);

  const showBrowserNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    } else if (
      "Notification" in window &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const getCurrentTab = () => {
    if (location.pathname.includes("/dashboard")) return 0;
    if (location.pathname.includes("/my-sheets")) return 1;
    if (location.pathname.includes("/defect-sheets")) return 2;
    if (location.pathname.includes("/payment-registry")) return 3;
    if (location.pathname.includes("/approvals")) return 4;
    if (location.pathname.includes("/admin")) return 5;
    return 0;
  };

  const handleTabChange = (event, newValue) => {
    if (newValue === 1) resetMySheetsNotificationsCount();
    if (newValue === 4) resetPendingApprovalsCount();

    switch (newValue) {
      case 0:
        navigate("/dashboard");
        break;
      case 1:
        navigate("/my-sheets");
        break;
      case 2:
        navigate("/defect-sheets");
        break;
      case 3:
        navigate("/payment-registry");
        break;
      case 4:
        navigate("/approvals");
        break;
      case 5:
        navigate("/admin/users");
        break;
      default:
        navigate("/dashboard");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Конструктор документов
          </Typography>

          <Badge
            color={wsConnected ? "success" : "error"}
            variant="dot"
            sx={{ mr: 2 }}
            title={wsConnected ? "Соединение установлено" : "Нет соединения"}
          />

          <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {user?.full_name || user?.username}
            </Typography>
            <Badge
              color={user?.role === "approver" ? "success" : "info"}
              variant="dot"
              sx={{ mr: 1 }}
              title={
                user?.role === "approver" ? "Согласователь" : "Пользователь"
              }
            />
          </Box>

          {(user?.role === "approver" || user?.role === "admin") && (
            <ApprovalNotifications userId={user?.id} />
          )}

          <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Tabs value={getCurrentTab()} onChange={handleTabChange} sx={{ px: 3 }}>
          <Tab icon={<DashboardIcon />} label="Главная" iconPosition="start" />

          <Tab
            icon={
              <Badge
                badgeContent={mySheetsNotificationsCount}
                color="error"
                sx={{ "& .MuiBadge-badge": { top: -8, right: -8 } }}
              >
                <AssignmentIcon />
              </Badge>
            }
            label="Мои ведомости"
            iconPosition="start"
          />

          <Tab
            icon={<DescriptionIcon />}
            label="Дефектная ведомость"
            iconPosition="start"
          />

          <Tab
            icon={<ReceiptIcon />}
            label="Реестр счетов"
            iconPosition="start"
          />

          {(user?.role === "approver" || user?.role === "admin") && (
            <Tab
              icon={
                <Badge
                  badgeContent={pendingApprovalsCount}
                  color="error"
                  sx={{ "& .MuiBadge-badge": { top: -8, right: -8 } }}
                >
                  <CheckCircleIcon />
                </Badge>
              }
              label="Согласование"
              iconPosition="start"
            />
          )}

          {/*  блок для администратора */}
          {user?.role === "admin" && (
            <Tab
              icon={<AdminPanelSettingsIcon />}
              label="Администрирование"
              iconPosition="start"
            />
          )}
        </Tabs>
      </Box>

      <Box sx={{ flexGrow: 1, p: 3, bgcolor: "#f5f5f5" }}>
        <Outlet />
      </Box>

      <NotificationSnackbar />
    </Box>
  );
};

export default Layout;
