# frontend/Dockerfile

# Базовый образ для всех этапов
FROM node:18-alpine as base

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Этап разработки
FROM base as development

# Устанавливаем зависимости
RUN npm ci

# Код будет монтироваться через volume
EXPOSE 3000

# Этап сборки
FROM base as builder

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Этап продакшн
FROM nginx:alpine as production

# Копируем собранные файлы из этапа builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]