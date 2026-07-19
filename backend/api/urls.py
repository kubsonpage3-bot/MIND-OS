"""
MIND OS API â€” Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚Ñ‹ Ð¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ api/.
ÐŸÐ¾Ð´ÐºÐ»ÑŽÑ‡Ð°ÐµÑ‚ÑÑ Ð² mindos/urls.py Ñ‡ÐµÑ€ÐµÐ· include('api.urls').
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterView,
    GuestLoginView,
    ConvertGuestView,
    UserProfileView,
    TaskViewSet,
    SkillActivateView,
    ActiveEffectsView,
    ShopBuyView,
    ShopSellView,
    ShopItemListView,
    BossListView,
    BossEncounterView,
    BossSummonView,
    PrestigeView,
    TrainingLogView,
    CraftItemView,
    RecipeListView,
    ToggleEquipView,
    ConsumeItemView,
    BuySkillView,
    RespecSkillView,
    RecruitAllyView,
    AlliesConfigView,
    VivianDarkSacrificeView,
    RheaChaosControlView,
    CombatSyncView,
    ResetDataView,
    RivalView,
    PartyCreateView,
    PartyJoinView,
    PartyLeaveView,
    PartyMembersView,
    PartyKickView,
    PartyFeedView,
    PartyEventReactView,
    PartyBuffView,
    PartyLeaderboardView,
    PartyMemberProfileView,
    MarkGuideSeenView,
    FeatureEventView,
    health_check,
    CalendarEventViewSet,
    create_checkout_session_view,
    create_portal_session_view,
    stripe_webhook_view,
    BuyMutatorView,
    ToggleMutatorView,
    OpenMutatorChestView,
    DejaVuView,
    LootChestListView,
    OpenChestView,
    GdprDeleteRequestView,
    EquipTitleView,
)
from .views_push import PushSubscribeView, PushUnsubscribeView, CronStreakWarningView
from .views_pomodoro import PomodoroSessionViewSet

# ——— DRF Router автоматически генерирует CRUD-маршруты ————————————————
# TaskViewSet → /api/tasks/
#               /api/tasks/{id}/
#               /api/tasks/{id}/complete/
router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")
router.register(r"calendar/events", CalendarEventViewSet, basename="calendar-event")
router.register(
    r"pomodoro/sessions", PomodoroSessionViewSet, basename="pomodoro-session"
)

urlpatterns = [
    # ——— Здоровье / Healthcheck ——————————————————————————————————————
    path("health/", health_check, name="health_check"),
    # ——— Регистрация —————————————————————————————————————————————————
    # POST /api/auth/register/
    path("auth/register/", RegisterView.as_view(), name="register"),
    # POST /api/auth/guest-login/
    path("auth/guest-login/", GuestLoginView.as_view(), name="guest-login"),
    # POST /api/auth/convert-guest/
    path("auth/convert-guest/", ConvertGuestView.as_view(), name="convert-guest"),
    # ——— Профиль персонажа ————————————————————————————————————————————
    # GET    /api/profile/
    # PUT    /api/profile/
    # PATCH  /api/profile/
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("profile/prestige/", PrestigeView.as_view(), name="profile-prestige"),
    path("profile/reset/", ResetDataView.as_view(), name="profile-reset"),
    path(
        "profile/mark-guide-seen/",
        MarkGuideSeenView.as_view(),
        name="profile-mark-guide-seen",
    ),
    path("analytics/event/", FeatureEventView.as_view(), name="analytics-event"),
    path("rival/", RivalView.as_view(), name="rival"),
    # ——— Billing (Stripe) —————————————————————————————————————————————
    path(
        "billing/create-checkout-session/",
        create_checkout_session_view,
        name="create-checkout-session",
    ),
    path(
        "billing/create-portal-session/",
        create_portal_session_view,
        name="create-portal-session",
    ),
    path("billing/webhook/", stripe_webhook_view, name="stripe-webhook"),
    # ——— Задачи (CRUD + complete) —————————————————————————————————————
    path("", include(router.urls)),
    # ——— Скиллы ——————————————————————————————————————————————————————
    # POST /api/skills/activate/
    # GET  /api/skills/active-effects/
    path("skills/activate/", SkillActivateView.as_view(), name="skill-activate"),
    path("skills/active-effects/", ActiveEffectsView.as_view(), name="active-effects"),
    # Ã¢â€â‚¬Ã¢â€â‚¬ ÃÅ“ÃÂ°ÃÂ³ÃÂ°ÃÂ·ÃÂ¸ÃÂ½ Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬  # noqa: E501
    path("shop/buy/", ShopBuyView.as_view(), name="shop-buy"),
    path("shop/sell/", ShopSellView.as_view(), name="shop-sell"),
    path("shop/items/", ShopItemListView.as_view(), name="shop-items"),
    path(
        "inventory/<str:item_code>/equip/",
        ToggleEquipView.as_view(),
        name="inventory-equip",
    ),
    path(
        "inventory/<str:item_code>/consume/",
        ConsumeItemView.as_view(),
        name="inventory-consume",
    ),
    # Ã¢â€ â‚¬Ã¢â€ â‚¬ Ã â€˜Ã Â¾Ã ÂµÃ Â²Ã Â°Ã‘Â  Ã‘Â Ã Â¸Ã‘Â Ã‘â€šÃ ÂµÃ Â¼Ã Â° Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬  # noqa: E501
    path("combat/bosses/", BossListView.as_view(), name="combat-bosses"),
    path("combat/encounters/", BossEncounterView.as_view(), name="combat-encounters"),
    path("combat/summon/", BossSummonView.as_view(), name="combat-summon"),
    path("combat/sync/", CombatSyncView.as_view(), name="combat-sync"),
    # Ã¢â€ â‚¬Ã¢â€ â‚¬ Ã Â¢Ã‘â‚¬Ã ÂµÃ Â½Ã Â¸Ã‘â‚¬Ã Â¾Ã Â²Ã ÂºÃ Â¸ Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬  # noqa: E501
    path("training/log/", TrainingLogView.as_view(), name="training-log"),
    path("skills/buy/", BuySkillView.as_view(), name="skill-buy"),
    path("skills/respec/", RespecSkillView.as_view(), name="skill-respec"),
    path("allies/recruit/", RecruitAllyView.as_view(), name="ally-recruit"),
    path("allies/config/", AlliesConfigView.as_view(), name="allies-config"),
    path(
        "allies/vivian/dark-sacrifice/",
        VivianDarkSacrificeView.as_view(),
        name="vivian-dark-sacrifice",
    ),
    path(
        "allies/rhea/chaos-control/",
        RheaChaosControlView.as_view(),
        name="rhea-chaos-control",
    ),
    path(
        "mutators/<str:mutator_id>/buy/", BuyMutatorView.as_view(), name="mutator-buy"
    ),
    path(
        "mutators/<str:mutator_id>/toggle/",
        ToggleMutatorView.as_view(),
        name="mutator-toggle",
    ),
    path(
        "mutators/chest/open/",
        OpenMutatorChestView.as_view(),
        name="mutator-chest-open",
    ),
    path("tasks/<int:task_id>/deja-vu/", DejaVuView.as_view(), name="deja-vu"),
    # ─── Крафт ──────────────────────────────────────────────────────────────────
    path("crafting/recipes/", RecipeListView.as_view(), name="crafting-recipes"),
    path("crafting/craft/", CraftItemView.as_view(), name="crafting-craft"),
    # ─── Loot Chests ──────────────────────────────────────────────────────────
    path("chests/", LootChestListView.as_view(), name="chests-list"),
    path("chests/<str:chest_type>/open/", OpenChestView.as_view(), name="chest-open"),
    # ─── Party System ─────────────────────────────────────────────────────────
    path("party/create/", PartyCreateView.as_view(), name="party-create"),
    path("party/join/", PartyJoinView.as_view(), name="party-join"),
    path("party/leave/", PartyLeaveView.as_view(), name="party-leave"),
    path("party/members/", PartyMembersView.as_view(), name="party-members"),
    path("party/kick/", PartyKickView.as_view(), name="party-kick"),
    path("party/feed/", PartyFeedView.as_view(), name="party-feed"),
    path(
        "party/feed/<int:event_id>/react/",
        PartyEventReactView.as_view(),
        name="party-event-react",
    ),
    path("party/buff/", PartyBuffView.as_view(), name="party-buff"),
    path(
        "party/leaderboard/", PartyLeaderboardView.as_view(), name="party-leaderboard"
    ),
    path(
        "party/members/<int:user_id>/profile/",
        PartyMemberProfileView.as_view(),
        name="party-member-profile",
    ),
    # ─── Push Notifications ───────────────────────────────────────────────────
    path(
        "notifications/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"
    ),
    path(
        "notifications/unsubscribe/",
        PushUnsubscribeView.as_view(),
        name="push-unsubscribe",
    ),
    path(
        "cron/streak-warnings/",
        CronStreakWarningView.as_view(),
        name="cron-streak-warnings",
    ),
    # ——— GDPR / Data Deletion (public, no auth) ———————————————————
    path(
        "gdpr/delete-request/",
        GdprDeleteRequestView.as_view(),
        name="gdpr-delete-request",
    ),
    # ——— Playstyle Titles —————————————————─────────────────────────
    path("profile/equip-title/", EquipTitleView.as_view(), name="profile-equip-title"),
]
