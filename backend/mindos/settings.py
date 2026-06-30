"""
MIND OS — главный файл настроек Django.
Использует переменные окружения из .env через python-dotenv.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# ── Базовый путь проекта ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# Загружаем .env (manage.py тоже делает это, но страхуемся)
load_dotenv(BASE_DIR / ".env")

# ── Безопасность ──────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-insecure-key-change-me")

# Режим отладки: True только в разработке!
DEBUG = os.environ.get("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "api.mindosgrowth.org",
    "mind-os-d5sk.onrender.com",  # <--- Добавили вот это!
]

# ── Приложения ────────────────────────────────────────────────────────────────
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
    "django_filters",  # Фильтрация списков в API
    "drf_spectacular",  # Автодокументация OpenAPI
    # --- Наши приложения ---
    "api",  # Основное API-приложение
]

# ── Middleware ────────────────────────────────────────────────────────────────
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
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "mindos_db"),
            "USER": os.environ.get("DB_USER", "mindos_user"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }

# ── Валидация паролей ─────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"  # noqa: E501
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Локализация ───────────────────────────────────────────────────────────────
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

# ── Статика и медиа ───────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── CORS — разрешаем запросы от Tauri ─────────────────────────────────────────
# Tauri может обращаться с разных схем в зависимости от платформы:
#   - tauri://localhost          (macOS/Linux)
#   - http://tauri.localhost     (Windows)
#   - http://localhost:1420      (Vite dev-сервер при разработке)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ORIGIN_ALLOW_ALL = True
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

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    # По умолчанию требуем JWT-токен для всех эндпоинтов
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # Пагинация списков
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
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
    # Лимит комментируем для локальной разработки во избежание 429
    # "DEFAULT_THROTTLE_CLASSES": [
    #     "rest_framework.throttling.AnonRateThrottle",
    #     "rest_framework.throttling.UserRateThrottle",
    # ],
    # "DEFAULT_THROTTLE_RATES": {
    #     "anon": "100/min",
    #     "user": "100/min",
    # },
}

# ── JWT-настройки (djangorestframework-simplejwt) ─────────────────────────────
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

# ── drf-spectacular (OpenAPI документация) ────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "MIND OS API",
    "DESCRIPTION": "REST API для десктопного приложения MIND OS (Tauri + React)",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ── Логирование (Observability) ──────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
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
