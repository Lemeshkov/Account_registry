

# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Пример строки подключения — подстрой под вашу БД
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# Если используешь Postgres: "postgresql+psycopg2://user:pass@localhost:5432/dbname"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
