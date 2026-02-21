# FROM python:3.11-slim

# WORKDIR /app

# # Устанавливаем только необходимые системные зависимости
# RUN apt-get update && apt-get install -y \
#     # Для компиляции Python пакетов
#     gcc \
#     g++ \
#     # Для psycopg2 (PostgreSQL)
#     libpq-dev \
#     # Для paddlepaddle/paddleocr (графические зависимости)
#     libgl1 \ 
#     libglib2.0-0 \
#     # Для pdfplumber
#     poppler-utils \
#     # Для сетевых утилит (health check)
#     netcat-traditional \
#     # Для отладки
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# # Копируем и устанавливаем зависимости
# COPY requirements.txt .
# RUN pip install --no-cache-dir --upgrade pip && \
#     pip install --no-cache-dir --default-timeout=100 -r requirements.txt && \
#     pip install --no-cache-dir xlsx2csv==0.8.2  # Явная установка!

# # Копируем код приложения
# COPY . .

# # Создаем необходимые директории
# RUN mkdir -p /app/uploads

# EXPOSE 8000

# # Запускаем через uvicorn для поддержки WebSocket
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# backend/Dockerfile

# Базовый образ для всех этапов
FROM python:3.11-slim as base

WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    netcat-traditional \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Этап разработки
FROM base as development

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --default-timeout=100 -r requirements.txt && \
    pip install --no-cache-dir xlsx2csv==0.8.2

# Код будет монтироваться через volume
EXPOSE 8000

# Этап продакшн
FROM base as production

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --default-timeout=100 -r requirements.txt && \
    pip install --no-cache-dir xlsx2csv==0.8.2 && \
    # Очищаем кэш pip
    pip cache purge

# Копируем код приложения
COPY . .

# Создаем необходимые директории
RUN mkdir -p /app/uploads

# Создаем непривилегированного пользователя
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]