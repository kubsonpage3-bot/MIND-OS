"""
MIND OS — главный файл настроек Django.
Использует переменные окружения из .env через python-dotenv.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# ── Базовый путь проекта ──────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# Загружаем .env (manage.py тоже делает это, но страхуемся)
load_dotenv(BASE_DIR / ".env")

# ── Безопасность ──────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set. "
        "The application cannot start without it."
    )

# Режим отладки: True только в разработке!
DEBUG = os.environ.get("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "api.mindosgrowth.org",
    "mind-os-d5sk.onrender.com",  # <--- Добавили вот это!
]

# ── Приложения ────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # --- Сторонние пакеты ---               # Django REST Framework
    "rest_framework_simplejwt",  # JWT-аутентификация                      # CORS для Tauri  # noqa: E501
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",  # Фильтрация списков в API
    "drf_spectacular",  # Автодокументация OpenAPI
    # --- Наши приложения ---
    "api",  # Основное API-приложение
]

# ── Middleware ────────────────────────────────────────────────────────────
MIDDLEWARE = [
    # CorsMiddleware ДОЛЖЕН стоять первым, до CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "mindos.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "mindos.wsgi.application"

# ── База данных ───────────────────────────────────────────────────
USE_SQLITE = os.environ.get("USE_SQLITE", "False") == "True"

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ.get("DATABASE_URL"),
            conn_max_age=600,
            ssl_require=True,
            conn_health_checks=True,
        )
    }

# ── Аутентификация ────────────────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "api.auth_backends.CaseInsensitiveModelBackend",
]

# ── Валидация паролей ─────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"  # noqa: E501
    },
]

# ── Локализация ───────────────────────────────────────────────────────────
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

# ── Статика и медиа ───────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── CORS — разрешаем запросы от Tauri ─────────────────────────────────────
# Tauri может обращаться с разных схем в зависимости от платформы:
#   - tauri://localhost          (macOS/Linux)
#   - http://tauri.localhost     (Windows)
#   - http://localhost:1420      (Vite dev-сервер при разработке)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ORIGIN_ALLOW_ALL = False
CORS_ALLOWED_ORIGINS = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://api.mindosgrowth.org",
    "https://mindos.pages.dev",
    "https://mind-os-d5sk.onrender.com",
]

# CSRF Trusted Origins for Render & Cloudflare Pages
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://mindos.pages.dev",
    "https://mind-os-d5sk.onrender.com",
]

# На время разработки, чтобы исключить блокировки CSRF
CSRF_COOKIE_HTTPONLY = False

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
# Разрешаем куки и заголовок Authorization
CORS_ALLOW_CREDENTIALS = True
# Разрешённые заголовки запросов
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# ── Django REST Framework ─────────────────────────────────────────────────
REST_FRAMEWORK = {
    # По умолчанию требуем JWT-токен для всех эндпоинтов
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),  # noqa: E501
    # Пагинация списков
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),  # noqa: E501
    "PAGE_SIZE": 25,
    # Поддержка фильтрации через django-filter
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    # Схема для drf-spectacular
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # ── Throttling — защита от спама/DDoS ────────────────────────────────────
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        "user": "200/min",
        "login": "5/min",
        "register": "3/min",
        "guest_login": "5/min",
    },
}

# ── JWT-настройки (djangorestframework-simplejwt) ─────────────────────────
SIMPLE_JWT = {
    # Время жизни access-токена — 60 минут
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    # Время жизни refresh-токена — 7 дней
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # Генерировать новый refresh при обновлении
    "ROTATE_REFRESH_TOKENS": True,
    # Инвалидировать старый refresh после обновления
    "BLACKLIST_AFTER_ROTATION": True,
    # Алгоритм подписи
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ── drf-spectacular (OpenAPI документация) ─────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "MIND OS API",
    "DESCRIPTION": (
        "REST API для десктопного приложения MIND OS (Tauri + React)"
    ),  # noqa: E501
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ── Логирование (Observability) ──────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": (
                "{levelname} {asctime} {module} "
                "{process:d} {thread:d} {message}"  # noqa: E501
            ),
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "file": {
            "level": "WARNING",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "debug.log",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": True,
        },
        "api": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": True,
        },
    },
}

STATICFILES_DIRS = [BASE_DIR / "static"]

# Stripe Settings
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PREMIUM_PRICE_ID = os.getenv("STRIPE_PREMIUM_PRICE_ID", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Only enable these if you have HTTPS (you do — Render provides it)
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# HSTS — tells browsers to always use HTTPS
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
