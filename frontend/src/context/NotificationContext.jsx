import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user, lastWebSocketMessage } = useAuth();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [mySheetsNotificationsCount, setMySheetsNotificationsCount] =
    useState(0);
  const [lastChecked, setLastChecked] = useState(Date.now());

  // Загрузка количества ожидающих согласования (для approver)
  const loadPendingApprovalsCount = async () => {
    if (!user || (user.role !== "approver" && user.role !== "admin")) return;

    try {
      const response = await api.get("/api/defect/pending-approvals");
      const count = response.pending_count || 0;
      setPendingApprovalsCount(count);
    } catch (error) {
      console.error("Error loading pending approvals count:", error);
    }
  };

  // Загрузка количества уведомлений для моих ведомостей
  const loadMySheetsNotificationsCount = async () => {
    if (!user) return;

    try {
      // Получаем ведомости, где статус изменился (были согласованы или отклонены)
      const response = await api.get("/api/defect/my-sheets");
      const sheets = response || [];

      // Считаем количество ведомостей, которые были обработаны после последней проверки
      const lastCheckedTime = localStorage.getItem("lastCheckedNotifications");
      const checkTime = lastCheckedTime
        ? parseInt(lastCheckedTime)
        : lastChecked;

      const newNotifications = sheets.filter((sheet) => {
        if (sheet.status === "approved" || sheet.status === "rejected") {
          const actionTime = sheet.approved_at || sheet.rejected_at;
          if (actionTime && new Date(actionTime).getTime() > checkTime) {
            return true;
          }
        }
        return false;
      });

      setMySheetsNotificationsCount(newNotifications.length);
    } catch (error) {
      console.error("Error loading my sheets notifications:", error);
    }
  };

  // Обработка WebSocket сообщений
  useEffect(() => {
    if (lastWebSocketMessage) {
      const { type, sheet_id } = lastWebSocketMessage;

      if (type === "approval_request") {
        // Новый запрос на согласование
        setPendingApprovalsCount((prev) => prev + 1);
      }

      if (type === "approval_approved" || type === "approval_rejected") {
        // Ведомость согласована/отклонена - уведомление для создателя
        setMySheetsNotificationsCount((prev) => prev + 1);
      }
    }
  }, [lastWebSocketMessage]);

  // Периодическая проверка (каждые 30 секунд)
  useEffect(() => {
    if (!user) return;

    loadPendingApprovalsCount();
    loadMySheetsNotificationsCount();

    const interval = setInterval(() => {
      loadPendingApprovalsCount();
      loadMySheetsNotificationsCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Функция для сброса счетчика при переходе на вкладку
  const resetPendingApprovalsCount = () => {
    setPendingApprovalsCount(0);
  };

  const resetMySheetsNotificationsCount = () => {
    setMySheetsNotificationsCount(0);
    localStorage.setItem("lastCheckedNotifications", Date.now().toString());
  };

  return (
    <NotificationContext.Provider
      value={{
        pendingApprovalsCount,
        mySheetsNotificationsCount,
        resetPendingApprovalsCount,
        resetMySheetsNotificationsCount,
        loadPendingApprovalsCount,
        loadMySheetsNotificationsCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
