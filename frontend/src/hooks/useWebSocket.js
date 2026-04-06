
import { useEffect, useRef, useState } from "react";

export const useWebSocket = (batchId = null) => {
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const wsRef = useRef(null);
  const batchIdRef = useRef(batchId);
  const pendingSubscriptionRef = useRef(null);

  // Обновляем ref при изменении batchId
  useEffect(() => {
    batchIdRef.current = batchId;
  }, [batchId]);

  // Функция для подписки на batch
  const subscribeToBatch = (newBatchId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Если WebSocket еще не готов, сохраняем запрос на подписку
      console.log(`⏳ WebSocket not ready, saving pending subscription for batch: ${newBatchId}`);
      pendingSubscriptionRef.current = newBatchId;
      return;
    }
    
    if (newBatchId) {
      console.log(`📡 Subscribing to batch: ${newBatchId}`);
      const subscribeMsg = {
        type: "subscribe",
        batch_id: newBatchId,
      };
      wsRef.current.send(JSON.stringify(subscribeMsg));
      setIsSubscribed(true);
    }
  };

  // Отдельный useEffect для логирования сообщений
  useEffect(() => {
    if (lastMessage) {
      console.log('🔥 WebSocket message received:', lastMessage);
      console.log('🔥 Message type:', lastMessage.type);
    }
  }, [lastMessage]);

  // Основной useEffect для подключения (создаем соединение один раз)
  useEffect(() => {
    // Генерируем уникальный ID для клиента
    const clientId = `client_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔌 Connecting WebSocket with clientId: ${clientId}`);

    // Создаем WebSocket соединение сразу (без batchId)
    const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected successfully");
      setConnectionStatus("connected");
      
      // Если есть ожидающая подписка, выполняем её
      if (pendingSubscriptionRef.current) {
        console.log(`📡 Executing pending subscription for batch: ${pendingSubscriptionRef.current}`);
        subscribeToBatch(pendingSubscriptionRef.current);
        pendingSubscriptionRef.current = null;
      }
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
      setIsSubscribed(false);
    };

    // Очистка при размонтировании
    return () => {
      console.log("🧹 Cleaning up WebSocket connection");
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); // Пустой массив зависимостей - создаем соединение один раз

  // Подписываемся при изменении batchId (если он передан через пропс)
  useEffect(() => {
    if (batchId && connectionStatus === "connected") {
      subscribeToBatch(batchId);
    }
  }, [batchId, connectionStatus]);

  // Функция для отправки сообщений
  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 Sending message:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("⚠️ WebSocket not connected, cannot send message");
    }
  };

  return { 
    lastMessage, 
    connectionStatus, 
    sendMessage, 
    isSubscribed, 
    subscribeToBatch 
  };
};