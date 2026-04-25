# backend/websocket_manager.py
"""
Минимальный WebSocket менеджер для уведомлений
"""
import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, date
from decimal import Decimal
from fastapi import WebSocket
import asyncio

logger = logging.getLogger(__name__)

class DateTimeEncoder(json.JSONEncoder):
    """Кастомный JSON encoder для обработки datetime объектов"""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

class WebSocketManager:
    """Менеджер WebSocket соединений"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.batch_subscriptions: Dict[str, List[str]] = {}  # batch_id -> list of client_ids
        self.user_connections: Dict[str, List[str]] = {}  # user_id -> list of client_ids
        self.client_to_user: Dict[str, str] = {}  # client_id -> user_id
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Подключение клиента"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        # По умолчанию client_id может быть user_id
        self.client_to_user[client_id] = client_id
        logger.info(f"✅ WebSocket connected: {client_id}")
    
    def disconnect(self, client_id: str):
        """Отключение клиента"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        # Удаляем из привязок пользователя
        user_id = self.client_to_user.get(client_id)
        if user_id and user_id in self.user_connections:
            if client_id in self.user_connections[user_id]:
                self.user_connections[user_id].remove(client_id)
        
        if client_id in self.client_to_user:
            del self.client_to_user[client_id]
        
        # Удаляем из всех подписок батчей
        for batch_id in list(self.batch_subscriptions.keys()):
            if client_id in self.batch_subscriptions[batch_id]:
                self.batch_subscriptions[batch_id].remove(client_id)
        
        logger.info(f"❌ WebSocket disconnected: {client_id}")
    
    async def subscribe_to_batch(self, client_id: str, batch_id: str):
        """Подписка клиента на обновления batch"""
        if batch_id not in self.batch_subscriptions:
            self.batch_subscriptions[batch_id] = []
        if client_id not in self.batch_subscriptions[batch_id]:
            self.batch_subscriptions[batch_id].append(client_id)
            logger.info(f"📡 Client {client_id} subscribed to batch {batch_id}")
    
    def unsubscribe_from_batch(self, client_id: str, batch_id: str):
        """Отписка клиента от обновлений batch"""
        if batch_id in self.batch_subscriptions and client_id in self.batch_subscriptions[batch_id]:
            self.batch_subscriptions[batch_id].remove(client_id)
            logger.info(f"📡 Client {client_id} unsubscribed from batch {batch_id}")
    
    async def authenticate_client(self, client_id: str, user_id: str):
        """Привязать client_id к user_id после аутентификации"""
        if client_id in self.active_connections:
            # Удаляем из старой привязки если была
            old_user_id = self.client_to_user.get(client_id)
            if old_user_id and old_user_id in self.user_connections:
                if client_id in self.user_connections[old_user_id]:
                    self.user_connections[old_user_id].remove(client_id)
            
            # Добавляем в новую
            self.client_to_user[client_id] = user_id
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            if client_id not in self.user_connections[user_id]:
                self.user_connections[user_id].append(client_id)
            
            logger.info(f"🔐 Client {client_id} authenticated as user {user_id}")
    
    async def send_to_client(self, client_id: str, message: dict):
        """Отправка сообщения конкретному клиенту"""
        if client_id in self.active_connections:
            try:
                # Используем кастомный encoder для обработки datetime и Decimal
                message_json = json.dumps(message, cls=DateTimeEncoder)
                await self.active_connections[client_id].send_text(message_json)
                logger.debug(f"📤 Sent message to {client_id}: {message.get('type', 'unknown')}")
            except Exception as e:
                logger.error(f"❌ Error sending to client {client_id}: {e}")
                self.disconnect(client_id)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Отправить сообщение конкретному пользователю"""
        if user_id in self.user_connections:
            for client_id in self.user_connections[user_id]:
                await self.send_to_client(client_id, message)
            logger.info(f"📤 Sent message to user {user_id} ({len(self.user_connections[user_id])} clients)")
        else:
            logger.debug(f"User {user_id} not connected")
    
    async def broadcast_to_batch(self, batch_id: str, message: dict, exclude_client: str = None):
        """Отправка сообщения всем подписчикам batch"""
        if batch_id in self.batch_subscriptions:
            subscribers = self.batch_subscriptions[batch_id]
            logger.info(f"📢 Broadcasting to batch {batch_id}: {message.get('type', 'unknown')} ({len(subscribers)} subscribers)")
            
            for client_id in subscribers:
                if client_id != exclude_client:
                    await self.send_to_client(client_id, message)
        else:
            logger.info(f"📢 No subscribers for batch {batch_id}")
    
    async def send_notification(self, client_id: str, title: str, message: str, notification_type: str = "info"):
        """Отправка уведомления клиенту"""
        notification = {
            "type": "notification",
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_client(client_id, notification)
    
    async def send_processing_update(self, client_id: str, batch_id: str, status: str, progress: int = None):
        """Отправка обновления о процессе обработки"""
        update = {
            "type": "processing_update",
            "batch_id": batch_id,
            "status": status,
            "progress": progress,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_client(client_id, update)
    
    def get_stats(self) -> dict:
        """Получить статистику менеджера"""
        return {
            "active_connections": len(self.active_connections),
            "batch_subscriptions": len(self.batch_subscriptions),
            "user_connections": len(self.user_connections),
            "total_subscribers": sum(len(clients) for clients in self.batch_subscriptions.values())
        }
    
    async def broadcast_to_admins(self, message: dict):
        """Отправить сообщение всем подключенным администраторам"""
        for client_id in self.active_connections:
        # Проверяем, является ли клиент администратором
            if client_id in self.user_auth and self.user_auth[client_id].get('role') == 'admin':
                await self.send_to_client(client_id, message)

# Глобальный экземпляр менеджера
websocket_manager = WebSocketManager()
