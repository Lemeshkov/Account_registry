# create_first_user.py
from database import SessionLocal
from models import User
from passlib.context import CryptContext
import sys

print("🚀 Начинаем создание пользователей...")

try:
    # Проверяем версию bcrypt
    import bcrypt
    print(f"✅ bcrypt version: {bcrypt.__version__}")
except ImportError:
    print("❌ bcrypt не установлен!")
    sys.exit(1)

# Создаем контекст с явным указанием схемы
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()

try:
    # Проверяем, есть ли уже пользователи
    user_count = db.query(User).count()
    print(f"📊 Текущих пользователей: {user_count}")
    
    if user_count == 0:
        print("👥 Создаем тестовых пользователей...")
        
        # Проверяем длину паролей (bcrypt ограничение 72 символа)
        passwords = [
            ("admin", "admin123", "admin"),
            ("user", "user123", "user"),
            ("approver", "approver123", "approver")
        ]
        
        for username, password, role in passwords:
            if len(password.encode('utf-8')) > 72:
                print(f"⚠️ Пароль для {username} слишком длинный!")
                continue
                
            hashed = pwd_context.hash(password)
            user = User(
                username=username,
                email=f"{username}@example.com",
                full_name=f"Тестовый {role}",
                hashed_password=hashed,
                role=role,
                is_active=True
            )
            db.add(user)
            print(f"   ➕ {username} создан")
        
        db.commit()
        print("✅ Тестовые пользователи созданы:")
        print("   admin / admin123  (администратор)")
        print("   approver / approver123  (согласователь)")
        print("   user / user123  (обычный пользователь)")
    else:
        print("ℹ️ Пользователи уже существуют, пропускаем создание")
        
    # Показываем всех пользователей
    print("\n📋 Список пользователей в базе:")
    users = db.query(User).all()
    for u in users:
        print(f"   • {u.username} ({u.role}) - {u.full_name}")
        
except Exception as e:
    print(f"❌ Ошибка: {e}")
    db.rollback()
    
finally:
    db.close()
    print("🏁 Готово!")