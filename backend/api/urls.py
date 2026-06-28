"""
MIND OS API — маршруты приложения api/.
Подключается в mindos/urls.py через include('api.urls').
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RegisterView, UserProfileView, TaskViewSet, SkillActivateView, ActiveEffectsView

# ── DRF Router автоматически генерирует CRUD-маршруты ────────────────────────
# TaskViewSet → /api/tasks/
#               /api/tasks/{id}/
#               /api/tasks/{id}/complete/
router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")

urlpatterns = [
    # ── Регистрация ────────────────────────────────────────────────────────
    # POST /api/auth/register/
    path("auth/register/", RegisterView.as_view(), name="register"),

    # ── Профиль персонажа ──────────────────────────────────────────────────
    # GET    /api/profile/
    # PUT    /api/profile/
    # PATCH  /api/profile/
    path("profile/", UserProfileView.as_view(), name="profile"),

    # ── Задачи (CRUD + complete) ───────────────────────────────────────────
    path("", include(router.urls)),
]
# ── Скиллы ────────────────────────────────────────────────────────────
    # POST /api/skills/activate/
    # GET  /api/skills/active-effects/
    path("skills/activate/", SkillActivateView.as_view(), name="skill-activate"),
    path("skills/active-effects/", ActiveEffectsView.as_view(), name="active-effects"),
