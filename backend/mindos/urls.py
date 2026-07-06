"""
MIND OS — главный маршрутизатор URL.
Подключает API-эндпоинты, JWT-токены и документацию.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from api.views import LoginView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    # ── Админ-панель Django ────────────────────────────────────────────────
    path("admin/", admin.site.urls),
    # ── JWT Аутентификация ─────────────────────────────────────────────────
    # POST /api/auth/token/       → получить access + refresh токены (логин)
    # POST /api/auth/token/refresh/ → обновить access по refresh-токену
    # POST /api/auth/token/verify/  → проверить валидность токена
    path("api/auth/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # ── Наше API (приложение api/) ─────────────────────────────────────────
    path("api/", include("api.urls")),
    # ── OpenAPI Документация ───────────────────────────────────────────────
    # Доступна только в DEBUG-режиме
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/swagger/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"
    ),
]

# Отдача медиафайлов и статики (иконки предметов) в режиме разработки
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
