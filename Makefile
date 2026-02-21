# Makefile
.PHONY: help dev build prod down logs clean

help:
	@echo "Available commands:"
	@echo "  make dev     - Запустить в режиме разработки (с hot-reload)"
	@echo "  make build   - Собрать образы для продакшн"
	@echo "  make prod    - Запустить в продакшн режиме"
	@echo "  make down    - Остановить все контейнеры"
	@echo "  make logs    - Просмотреть логи"
	@echo "  make clean   - Очистить все (контейнеры, volumes)"
	@echo "  make tools   - Запустить с инструментами (pgadmin, redis-commander)"

dev:
	docker-compose up --build

build:
	docker-compose build --no-cache

prod:
	ENVIRONMENT=production BUILD_TARGET=production docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --remove-orphans
	docker system prune -f

tools:
	docker-compose --profile tools up -d pgadmin redis-commander

shell-backend:
	docker-compose exec backend bash

shell-frontend:
	docker-compose exec frontend sh

db-migrate:
	docker-compose exec backend alembic upgrade head