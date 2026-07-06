# ===== Stage 1: Build frontend (Vite + React TS) =====
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Stage 2: PHP + Laravel =====
FROM php:8.3-fpm-alpine AS backend

RUN apk add --no-cache \
    nginx supervisor \
    libzip-dev zip unzip git curl \
    icu-dev oniguruma-dev

RUN docker-php-ext-install pdo pdo_mysql mbstring zip exif pcntl bcmath intl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .
COPY --from=frontend /app/public/build ./public/build

RUN composer install --optimize-autoloader --no-dev --no-interaction

RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]