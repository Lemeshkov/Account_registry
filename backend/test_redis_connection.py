# backend/test_redis_connection.py
import asyncio
import redis
import sys
import os

# Добавляем путь к backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from redis_manager import redis_manager

async def test_redis_connections():
    """Тест всех типов подключений к Redis"""
    
    print("🔍 Testing Redis connections...")
    print("-" * 50)
    
    # 1. Тест синхронного подключения (redis-py)
    print("1. Testing synchronous Redis connection...")
    try:
        sync_redis = redis.Redis(host='localhost', port=6379, db=0)
        sync_ping = sync_redis.ping()
        print(f"   ✅ Sync Redis: {sync_ping}")
        
        # Простой тест записи/чтения
        sync_redis.set('test_sync', 'hello_sync')
        result = sync_redis.get('test_sync')
        print(f"   ✅ Sync read/write: {result.decode()}")
        
    except Exception as e:
        print(f"   ❌ Sync Redis error: {e}")
    
    print("-" * 50)
    
    # 2. Тест асинхронного подключения через наш менеджер
    print("2. Testing async Redis connection (via manager)...")
    try:
        connected = await redis_manager.connect()
        if connected:
            print(f"   ✅ Async Redis connected: {connected}")
            
            # Тест публикации
            await redis_manager.publish('test_channel', {'type': 'test', 'message': 'Hello Redis!'})
            print(f"   ✅ Published test message")
            
            # Тест кэширования
            await redis_manager.set_cache('test_cache', {'data': 'cached_data'}, 60)
            cached = await redis_manager.get_cache('test_cache')
            print(f"   ✅ Cache test: {cached}")
            
            # Тест счетчика
            count = await redis_manager.increment_counter('test_counter')
            print(f"   ✅ Counter test: {count}")
        else:
            print(f"   ❌ Async Redis connection failed")
            
    except Exception as e:
        print(f"   ❌ Async Redis error: {e}")
        import traceback
        traceback.print_exc()
    
    print("-" * 50)
    
    # 3. Тест прямого асинхронного подключения (aioredis)
    print("3. Testing direct async Redis (aioredis)...")
    try:
        import redis.asyncio as aioredis
        direct_client = aioredis.Redis(host='localhost', port=6379, db=0)
        direct_ping = await direct_client.ping()
        print(f"   ✅ Direct async Redis: {direct_ping}")
        
        # Тест запись/чтение
        await direct_client.set('test_async', 'hello_async')
        result = await direct_client.get('test_async')
        print(f"   ✅ Direct async read/write: {result}")
        
        await direct_client.close()
        
    except Exception as e:
        print(f"   ❌ Direct async Redis error: {e}")
    
    print("-" * 50)
    print("🎯 Tests completed!")

def check_docker_status():
    """Проверить статус Docker контейнеров"""
    print("🐳 Checking Docker containers...")
    try:
        import subprocess
        result = subprocess.run(
            ['docker-compose', 'ps'],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        
        if result.returncode == 0:
            print("✅ Docker Compose is running")
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'redis' in line.lower() or 'postgres' in line.lower():
                    print(f"   {line}")
        else:
            print(f"❌ Docker Compose error: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Docker check error: {e}")

if __name__ == "__main__":
    check_docker_status()
    print()
    asyncio.run(test_redis_connections())