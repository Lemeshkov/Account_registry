import { useEffect, useRef, useState } from "react";

export const useWebSocket = (batchId) => {
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const wsRef = useRef(null);

  // Отдельный useEffect для логирования сообщений
  useEffect(() => {
    if (lastMessage) {
      console.log('🔥 WebSocket message received:', lastMessage);
      console.log('🔥 Message type:', lastMessage.type);
    }
  }, [lastMessage]);

  // Основной useEffect для подключения
  useEffect(() => {
    if (!batchId) {
      console.log('⚠️ No batchId provided, skipping WebSocket connection');
      return;
    }

    // Генерируем уникальный ID для клиента
    const clientId = `client_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔌 Connecting WebSocket with clientId: ${clientId}, batchId: ${batchId}`);

    // Создаем WebSocket соединение
    const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected successfully");
      setConnectionStatus("connected");

      // Подписываемся на batch
      const subscribeMsg = {
        type: "subscribe",
        batch_id: batchId,
      };
      console.log("📤 Sending subscribe message:", subscribeMsg);
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      try {
        console.log("📨 Raw WebSocket message:", event.data);
        const data = JSON.parse(event.data);
        console.log("📨 Parsed WebSocket message:", data);
        console.log("📨 Message type:", data.type);
        
        // Специальное логирование для defect_sheet_processed
        if (data.type === 'defect_sheet_processed') {
          console.log('🎯🎯🎯 GOT DEFECT_SHEET_PROCESSED!', data);
          console.log('🎯 Sheet ID:', data.sheet_id);
          console.log('🎯 Total items:', data.total_items);
        }
        
        setLastMessage(data);
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error, "Raw data:", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setConnectionStatus("error");
    };

    ws.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setConnectionStatus("disconnected");
    };

    // Очистка при размонтировании
    return () => {
      console.log("🧹 Cleaning up WebSocket connection");
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [batchId]);

  // Функция для отправки сообщений
  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 Sending message:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("⚠️ WebSocket not connected, cannot send message");
    }
  };

  return { lastMessage, connectionStatus, sendMessage };
};