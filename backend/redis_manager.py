# backend/redis_manager.py
import redis.asyncio as redis
import json
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class RedisManager:
    """Менеджер для работы с Redis (WebSocket уведомления, кэш)"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.client = None
            cls._instance._is_connected = False
        return cls._instance
    
    async def connect(self) -> bool:
        """Подключиться к Redis"""
        if self._is_connected and self.client:
            return True
            
        try:
            # 🔧 Настройки подключения
            # Если Redis требует пароль, добавьте: password='ваш_пароль'
            self.client = redis.Redis(
                host='localhost',
                port=6379,
                db=0,
                decode_responses=True,      # Автоматически декодировать из bytes в str
                socket_connect_timeout=5,   # Таймаут подключения
                socket_keepalive=True,      # Поддержание соединения
                retry_on_timeout=True,      # Повтор при таймауте
                # password='redispassword123',  # Раскомментируйте если Redis с паролем
            )
            
            # Тестовый ping
            response = await self.client.ping()
            if response:
                self._is_connected = True
                logger.info("✅ Redis connected successfully")
                return True
            else:
                logger.error("❌ Redis ping failed")
                return False
                
        except redis.ConnectionError as e:
            logger.error(f"❌ Redis connection error: {e}")
            self.client = None
            self._is_connected = False
            return False
        except redis.AuthenticationError as e:
            logger.error(f"❌ Redis authentication error: {e}")
            logger.info("   Tip: Check if Redis requires password in docker-compose.yml")
            self.client = None
            self._is_connected = False
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected Redis error: {e}")
            self.client = None
            self._is_connected = False
            return False
    
    async def ensure_connection(self) -> bool:
        """Гарантировать подключение"""
        if not self._is_connected or not self.client:
            return await self.connect()
        return True
    
    async def publish(self, channel: str, message: dict) -> bool:
        """Опубликовать сообщение в Redis канал (Pub/Sub)"""
        try:
            if await self.ensure_connection():
                await self.client.publish(channel, json.dumps(message))
                logger.debug(f"📤 Published to {channel}: {message.get('type', 'unknown')}")
                return True
        except Exception as e:
            logger.error(f"❌ Redis publish error: {e}")
        return False
    
    async def subscribe(self, channel: str):
        """Подписаться на Redis канал"""
        try:
            if await self.ensure_connection():
                pubsub = self.client.pubsub()
                await pubsub.subscribe(channel)
                logger.info(f"📥 Subscribed to channel: {channel}")
                return pubsub
        except Exception as e:
            logger.error(f"❌ Redis subscribe error: {e}")
        return None
    
    async def set_cache(self, key: str, value: dict, ttl_seconds: int = 300) -> bool:
        """Сохранить данные в кэш Redis с TTL"""
        try:
            if await self.ensure_connection():
                await self.client.setex(
                    key,
                    timedelta(seconds=ttl_seconds),
                    json.dumps(value, ensure_ascii=False)
                )
                logger.debug(f"💾 Cached {key} for {ttl_seconds}s")
                return True
        except Exception as e:
            logger.error(f"❌ Redis set_cache error: {e}")
        return False
    
    async def get_cache(self, key: str):
        """Получить данные из кэша Redis"""
        try:
            if await self.ensure_connection():
                cached = await self.client.get(key)
                if cached:
                    logger.debug(f"📥 Retrieved from cache: {key}")
                    return json.loads(cached)
        except Exception as e:
            logger.error(f"❌ Redis get_cache error: {e}")
        return None
    
    async def delete_cache(self, key: str) -> bool:
        """Удалить данные из кэша"""
        try:
            if await self.ensure_connection():
                result = await self.client.delete(key)
                if result:
                    logger.debug(f"🗑️ Deleted cache: {key}")
                return bool(result)
        except Exception as e:
            logger.error(f"❌ Redis delete_cache error: {e}")
        return False
    
    async def increment_counter(self, key: str, amount: int = 1) -> int:
        """Инкрементировать счетчик"""
        try:
            if await self.ensure_connection():
                return await self.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"❌ Redis increment error: {e}")
        return 0
    
    async def get_counter(self, key: str) -> int:
        """Получить значение счетчика"""
        try:
            if await self.ensure_connection():
                value = await self.client.get(key)
                return int(value) if value else 0
        except Exception as e:
            logger.error(f"❌ Redis get_counter error: {e}")
        return 0
    
    async def close(self):
        """Закрыть соединение с Redis"""
        if self.client:
            await self.client.close()
            self.client = None
            self._is_connected = False
            logger.info("🔌 Redis connection closed")

# Глобальный экземпляр для использования во всем приложении
redis_manager = RedisManager()