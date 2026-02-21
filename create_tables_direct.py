# create_tables_direct.py
import sys
from pathlib import Path

# Добавляем путь к папке backend, чтобы Python нашел модули database и models
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(Path(__file__).parent))

try:
    from backend.database import engine
    from backend.models import Base
    print("✅ Модули backend найдены")
except ImportError as e:
    print(f"❌ Ошибка импорта: {e}")
    print("Убедитесь, что скрипт запускается из корня проекта и папка backend существует.")
    sys.exit(1)

# Строка подключения (используем ту же, что и для приложения)
DATABASE_URL = "postgresql+psycopg2://admin:admin123@localhost:5432/account_registry"
print(f"Подключение к: {DATABASE_URL}")

try:
    # Создаем все таблицы, описанные в Base.metadata
    print("Создание таблиц...")
    Base.metadata.create_all(bind=engine)
    print("✅ Таблицы успешно созданы!")
except Exception as e:
    print(f"❌ Ошибка при создании таблиц: {e}")