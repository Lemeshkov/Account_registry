from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import sys

print("=" * 50)
print("DATABASE CONNECTION DEBUG")
print("=" * 50)

# Базовая строка подключения с паролем
DEFAULT_DATABASE_URL = "postgresql://postgres:admin123@localhost:5432/account_registry"

# Используем значение из переменной окружения если оно задано
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

# Маскируем пароль для вывода
safe_url = DATABASE_URL.replace('admin123', '******').replace('postgres', 'postgres')
print(f"📌 DATABASE_URL from env: {safe_url}")
print(f"📌 DATABASE_URL final: {safe_url}")

# Проверим все переменные окружения, содержащие DB
print("\n📌 All DB-related env vars:")
for key, value in os.environ.items():
    if 'DB' in key.upper() or 'DATABASE' in key.upper() or 'POSTGRES' in key.upper():
        masked_value = value
        if 'admin123' in value:
            masked_value = value.replace('admin123', '******')
        print(f"  {key}: {masked_value}")

print("=" * 50)

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "connect_timeout": 10,
        "sslmode": "disable",
        "gssencmode": "disable"
    },
    pool_pre_ping=True
)

# Тестовое подключение при старте
try:
    with engine.connect() as conn:
        print("✅ Database connection successful!")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    print(f"❌ Error type: {type(e)}")
    sys.exit(1)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()