# test_simple.py
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:admin123@localhost:5432/account_registry"
print(f"Попытка подключения к: {DATABASE_URL}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ УСПЕХ! Результат:", result.scalar())
        
        # Проверим версию PostgreSQL
        result = conn.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"📊 Версия PostgreSQL: {version}")
        
except Exception as e:
    print("❌ ОШИБКА:", e)