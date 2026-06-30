"""
MIND OS API â€” Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚Ñ‹ Ð¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ api/.
ÐŸÐ¾Ð´ÐºÐ»ÑŽÑ‡Ð°ÐµÑ‚ÑÑ Ð² mindos/urls.py Ñ‡ÐµÑ€ÐµÐ· include('api.urls').
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterView,
    UserProfileView,
    TaskViewSet,
    SkillActivateView,
    ActiveEffectsView,
    ShopBuyView,
    ShopItemListView,
    BossListView,
    BossEncounterView,
    BossSummonView,
    PrestigeView,
    TrainingLogView,
    CraftItemView,
    RecipeListView,
    ToggleEquipView,
    BuySkillView,
    RecruitAllyView,
    CombatSyncView,
    ResetDataView,
)

# ——— DRF Router автоматически генерирует CRUD-маршруты ————————————————
# TaskViewSet → /api/tasks/
#               /api/tasks/{id}/
#               /api/tasks/{id}/complete/
router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")

urlpatterns = [
    # ——— Регистрация —————————————————————————————————————————————————
    # POST /api/auth/register/
    path("auth/register/", RegisterView.as_view(), name="register"),
    # ——— Профиль персонажа ————————————————————————————————————————————
    # GET    /api/profile/
    # PUT    /api/profile/
    # PATCH  /api/profile/
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("profile/prestige/", PrestigeView.as_view(), name="profile-prestige"),
    path("profile/reset/", ResetDataView.as_view(), name="profile-reset"),
    # ——— Задачи (CRUD + complete) —————————————————————————————————————
    path("", include(router.urls)),
    # ——— Скиллы ——————————————————————————————————————————————————————
    # POST /api/skills/activate/
    # GET  /api/skills/active-effects/
    path("skills/activate/", SkillActivateView.as_view(), name="skill-activate"),
    path("skills/active-effects/", ActiveEffectsView.as_view(), name="active-effects"),
    # Ã¢â€â‚¬Ã¢â€â‚¬ ÃÅ“ÃÂ°ÃÂ³ÃÂ°ÃÂ·ÃÂ¸ÃÂ½ Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬  # noqa: E501
    path("shop/buy/", ShopBuyView.as_view(), name="shop-buy"),
    path("shop/items/", ShopItemListView.as_view(), name="shop-items"),
    path(
        "inventory/<str:item_code>/equip/",
        ToggleEquipView.as_view(),
        name="inventory-equip",
    ),
    # Ã¢â€ â‚¬Ã¢â€ â‚¬ Ã â€˜Ã Â¾Ã ÂµÃ Â²Ã Â°Ã‘Â  Ã‘Â Ã Â¸Ã‘Â Ã‘â€šÃ ÂµÃ Â¼Ã Â° Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬  # noqa: E501
    path("combat/bosses/", BossListView.as_view(), name="combat-bosses"),
    path("combat/encounters/", BossEncounterView.as_view(), name="combat-encounters"),
    path("combat/summon/", BossSummonView.as_view(), name="combat-summon"),
    path("combat/sync/", CombatSyncView.as_view(), name="combat-sync"),
    # Ã¢â€ â‚¬Ã¢â€ â‚¬ Ã Â¢Ã‘â‚¬Ã ÂµÃ Â½Ã Â¸Ã‘â‚¬Ã Â¾Ã Â²Ã ÂºÃ Â¸ Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬  # noqa: E501
    path("training/log/", TrainingLogView.as_view(), name="training-log"),
    path("skills/buy/", BuySkillView.as_view(), name="skill-buy"),
    path("allies/recruit/", RecruitAllyView.as_view(), name="ally-recruit"),
    # ─── Крафт ──────────────────────────────────────────────────────────────────
    path("crafting/recipes/", RecipeListView.as_view(), name="crafting-recipes"),
    path("crafting/craft/", CraftItemView.as_view(), name="crafting-craft"),
]
