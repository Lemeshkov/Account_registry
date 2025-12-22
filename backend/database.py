# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, declarative_base
# import os
# from dotenv import load_dotenv

# load_dotenv()

# # пример строки соединения:
# # postgresql+psycopg2://user:password@localhost:5432/registrydb
# DATABASE_URL = os.getenv(
#     "DATABASE_URL",
#     "postgresql+psycopg2://postgres:postgres@localhost:5432/registrydb"
# )

# engine = create_engine(
#     DATABASE_URL,
#     echo=False,
#     pool_pre_ping=True
# )

# SessionLocal = sessionmaker(
#     autocommit=False,
#     autoflush=False,
#     bind=engine
# )

# Base = declarative_base()

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

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
