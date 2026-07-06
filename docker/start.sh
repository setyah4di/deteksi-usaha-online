#!/bin/sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link || true
php artisan migrate --force

supervisord -c /etc/supervisor/conf.d/supervisord.conf