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
    path("api/auth/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # ── Наше API ──────────────────────────────────────────────────────────
    path("api/", include("api.urls")),
    # ── Firefox Extension API ──────────────────────────────────────────────
    path("api/extension/", include("extension.urls")),
]

# ── Только в DEBUG: документация + медиа/статика ─────────────────────────
# В продакшне эти маршруты НЕ регистрируются, чтобы не отдавать
# полную карту API всем желающим.
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/swagger/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/docs/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
        ),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
