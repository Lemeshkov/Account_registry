# backend/websocket_manager.py
"""
Минимальный WebSocket менеджер для уведомлений
"""
import logging
from typing import Dict, List
from fastapi import WebSocket
import asyncio

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Простой менеджер WebSocket соединений"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.batch_subscriptions: Dict[str, List[str]] = {}  # batch_id -> list of client_ids
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Подключение клиента"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket connected: {client_id}")
    
    def disconnect(self, client_id: str):
        """Отключение клиента"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            # Удаляем из всех подписок
            for batch_id in list(self.batch_subscriptions.keys()):
                if client_id in self.batch_subscriptions[batch_id]:
                    self.batch_subscriptions[batch_id].remove(client_id)
            logger.info(f"WebSocket disconnected: {client_id}")
    
    async def subscribe_to_batch(self, client_id: str, batch_id: str):
        """Подписка клиента на обновления batch"""
        if batch_id not in self.batch_subscriptions:
            self.batch_subscriptions[batch_id] = []
        if client_id not in self.batch_subscriptions[batch_id]:
            self.batch_subscriptions[batch_id].append(client_id)
            logger.info(f"Client {client_id} subscribed to batch {batch_id}")
    
    def unsubscribe_from_batch(self, client_id: str, batch_id: str):
        """Отписка клиента от обновлений batch"""
        if batch_id in self.batch_subscriptions and client_id in self.batch_subscriptions[batch_id]:
            self.batch_subscriptions[batch_id].remove(client_id)
            logger.info(f"Client {client_id} unsubscribed from batch {batch_id}")
    
    async def send_to_client(self, client_id: str, message: dict):
        """Отправка сообщения конкретному клиенту"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                self.disconnect(client_id)
    
    async def broadcast_to_batch(self, batch_id: str, message: dict, exclude_client: str = None):
        """Отправка сообщения всем подписчикам batch"""
        if batch_id in self.batch_subscriptions:
            for client_id in self.batch_subscriptions[batch_id]:
                if client_id != exclude_client:
                    await self.send_to_client(client_id, message)
    
    async def send_notification(self, client_id: str, title: str, message: str, notification_type: str = "info"):
        """Отправка уведомления клиенту"""
        notification = {
            "type": "notification",
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_to_client(client_id, notification)
    
    async def send_processing_update(self, client_id: str, batch_id: str, status: str, progress: int = None):
        """Отправка обновления о процессе обработки"""
        update = {
            "type": "processing_update",
            "batch_id": batch_id,
            "status": status,
            "progress": progress,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_to_client(client_id, update)

# Глобальный экземпляр менеджера
websocket_manager = WebSocketManager()