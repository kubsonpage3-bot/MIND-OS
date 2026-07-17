"""
MIND OS — Views и ViewSets.

Эндпоинты:
  POST /api/auth/register/           — регистрация (без авторизации)
  GET  /api/profile/                 — профиль персонажа текущего пользователя
  PUT/PATCH /api/profile/            — обновление профиля (аватар, класс)

  GET    /api/tasks/                 — список задач пользователя
  POST   /api/tasks/                 — создать задачу
  GET    /api/tasks/{id}/            — получить задачу по ID
  PUT    /api/tasks/{id}/            — обновить задачу полностью
  PATCH  /api/tasks/{id}/            — частично обновить задачу
  DELETE /api/tasks/{id}/            — удалить задачу
  POST   /api/tasks/{id}/complete/   — выполнить задачу (начисляет XP + Gold)
"""

from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
import logging
from django.db import transaction

from rest_framework import viewsets, generics, status, filters, serializers
from rest_framework.views import APIView
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.throttling import AnonRateThrottle
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from api.services.billing_service import (
    create_checkout_session,
    create_portal_session,
    handle_stripe_webhook,
)
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .constants import ALLIES_CONFIG

from .models import UserProfile, Task, Item, InventoryItem, Recipe
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    TaskSerializer,
    TaskCompleteSerializer,
    ItemSerializer,
    CraftSerializer,
    RecipeListSerializer,
)

from .models import (
    ActiveEffect,
    SkillCooldown,
    Boss,
    BossEncounter,
    UserStats,
    UserAchievement,
)
from .serializers import (
    ActiveEffectSerializer,
    SkillActivateSerializer,
    SkillCooldownSerializer,
    ShopBuySerializer,
    BossSerializer,
    BossEncounterSerializer,
    BossSummonSerializer,
)
from api.services.task_service import complete_task
from api.services.skill_service import activate_skill
from api.services.shop_service import buy_item
from api.services.crafting_service import craft_item
from api.services.rival_service import compute_rival_data
from api.exceptions import GameLogicError
from api.models import CalendarEvent
from api.serializers.calendar import CalendarEventSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# Аутентификация
# ─────────────────────────────────────────────────────────────────────────────


from rest_framework_simplejwt.views import TokenObtainPairView  # noqa: E402
from api.throttles import (  # noqa: E402
    LoginRateThrottle,
    RegisterRateThrottle,
    GuestLoginRateThrottle,
)


class LoginView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]


class RegisterView(generics.CreateAPIView):
    throttle_classes = [RegisterRateThrottle]
    """
    POST /api/auth/register/
    Регистрация нового пользователя. Доступна без токена.
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # Регистрация открыта всем

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "detail": "Account successfully created. Please log in via /api/auth/token/",  # noqa: E501
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )


from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402
from django.contrib.auth.models import User  # noqa: E402
from django.contrib.auth.hashers import make_password, check_password  # noqa: E402


class GuestLoginView(APIView):
    """
    POST /api/auth/guest-login/
    Создаёт или авторизует гостевой аккаунт, привязанный к guest_id и guest_secret.
    """

    permission_classes = [AllowAny]
    throttle_classes = [GuestLoginRateThrottle]

    def post(self, request):
        guest_id = request.data.get("guest_id")
        guest_secret = request.data.get("guest_secret")

        if not guest_id or not guest_secret:
            return Response(
                {"detail": "guest_id and guest_secret are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure it's a valid guest format to avoid abuse, e.g. guest_UUID
        if not guest_id.startswith("guest_"):
            return Response(
                {"detail": "Invalid guest_id format"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(username=guest_id)
            if not check_password(guest_secret, user.password):
                return Response(
                    {"detail": "Invalid guest credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if getattr(user, "profile", None) and not getattr(user, "profile").is_guest:
                return Response(
                    {"detail": "User is not a guest"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except User.DoesNotExist:
            user = User.objects.create(
                username=guest_id, password=make_password(guest_secret)
            )
            # Profile created by post_save signal
            profile = getattr(user, "profile")
            profile.is_guest = True
            profile.save(update_fields=["is_guest"])

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "refresh": str(refresh),
                "access": str(getattr(refresh, "access_token", "")),
            }
        )


class ConvertGuestView(APIView):
    """
    POST /api/auth/convert-guest/
    Конвертирует гостевой аккаунт в полноценный (заменяет username, email, пароль и снимает флаг is_guest).
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        if not request.user.profile.is_guest:
            return Response(
                {"detail": "Current user is not a guest"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")
        password_confirm = request.data.get("password_confirm")

        if not all([username, email, password, password_confirm]):
            return Response(
                {"detail": "All fields are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != password_confirm:
            return Response(
                {"detail": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username is already taken"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "Email is already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = request.user
            user.username = username
            user.email = email
            user.set_password(password)
            user.save()

            profile = user.profile
            profile.is_guest = False
            profile.save(update_fields=["is_guest"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "Successfully converted to full account",
                "refresh": str(refresh),
                "access": str(getattr(refresh, "access_token", "")),
            }
        )


# ─────────────────────────────────────────────────────────────────────────────

# Профиль персонажа
# ─────────────────────────────────────────────────────────────────────────────


@method_decorator(never_cache, name="dispatch")
class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    GET    /api/profile/ — получить свой профиль
    PUT    /api/profile/ — полное обновление
    PATCH  /api/profile/ — частичное обновление (например, только аватар)

    Доступно только авторизованным пользователям.
    Каждый пользователь видит только свой профиль.
    """

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Возвращаем профиль текущего авторизованного пользователя с предзагрузкой инвентаря."""
        from django.utils import timezone
        from api.services.daily_service import process_daily_login

        # FIX 8: fast-path — avoid the heavy select_for_update() atomic block
        # if the user already has a daily-login recorded for today.
        today = timezone.now().date()
        already_checked_today = UserProfile.objects.filter(
            user=self.request.user, last_login_date=today
        ).exists()
        if not already_checked_today:
            process_daily_login(self.request.user)

        # FIX 4: full prefetch — covers inventory, skills, allies, achievements
        # so serializer method fields cost 0 extra DB queries.
        profile, created = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects",
            "unlocked_skills",
            "recruited_allies",
            "user__achievements",
        ).get_or_create(user=self.request.user)

        now = timezone.now()
        if profile.last_seen_at:
            setattr(
                profile,
                "offline_seconds",
                int((now - profile.last_seen_at).total_seconds()),
            )
        else:
            setattr(profile, "offline_seconds", 0)

        profile.last_seen_at = now
        profile.save(update_fields=["last_seen_at"])

        return profile


# ─────────────────────────────────────────────────────────────────────────────
# Задачи — CRUD + кастомный action "complete"
# ─────────────────────────────────────────────────────────────────────────────


@method_decorator(never_cache, name="dispatch")
class TaskViewSet(viewsets.ModelViewSet):
    """
    Полный CRUD для задач пользователя.

    Фильтрация:
      ?task_type=todo        — только туду
      ?task_type=daily       — только дейлики
      ?task_type=habit       — только привычки
      ?is_completed=true     — только выполненные
      ?is_completed=false    — только невыполненные
      ?difficulty=hard       — только сложные

    Поиск:
      ?search=название       — поиск по title и notes

    Сортировка:
      ?ordering=order         — по порядку (по умолчанию)
      ?ordering=-created_at   — сначала новые
      ?ordering=due_date      — по дедлайну
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]  # Только авторизованные!

    # Подключаем фильтрацию, поиск и сортировку
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["task_type", "is_completed", "difficulty"]
    search_fields = ["title", "notes"]
    ordering_fields = ["order", "created_at", "due_date", "difficulty"]
    ordering = ["order"]

    def get_queryset(self):
        """
        КРИТИЧЕСКИ ВАЖНО: возвращаем ТОЛЬКО задачи текущего пользователя.
        Это главная защита от утечки данных между пользователями.
        """
        return Task.objects.filter(user=self.request.user).select_related("user")

    def perform_create(self, serializer):
        """
        При создании задачи автоматически устанавливаем user = текущий пользователь.
        Пользователь не может создать задачу от чужого имени.
        """
        serializer.save(user=self.request.user)

    # ── Кастомный action: выполнить задачу ───────────────────────────────

    @action(
        detail=True,  # Требует {id} в URL
        methods=["post"],  # Только POST
        url_path="complete",  # URL: /api/tasks/{id}/complete/
        serializer_class=TaskCompleteSerializer,
    )
    def complete(self, request, pk=None):
        """
        POST /api/tasks/{id}/complete/
        Отмечает задачу как выполненную и начисляет XP + Gold персонажу.
        Использует Service Layer.
        """
        # Валидируем входные данные
        serializer = TaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_positive = serializer.validated_data.get("is_positive", True)

        try:
            result = complete_task(request.user, pk, is_positive)
            return Response(
                {
                    "detail": result.get("detail", "Task completed!"),
                    "leveled_up": result.get("leveled_up", False),
                    "skill_effects": result.get("skill_effects", []),
                    "rewards": result.get("rewards", {"xp": 0, "gold": 0}),
                    "task": TaskSerializer(result["task"]).data,
                    "profile": UserProfileSerializer(result["profile"]).data,
                    "combat": result.get("combat"),
                    "xp_earned": result.get("xp_earned", 0),
                    "gold_earned": result.get("gold_earned", 0),
                    "mana_gained": result.get("mana_gained", 0),
                    "penalty": result.get("penalty"),
                    "died": result.get("died", False),
                    "is_dead": result.get("died", False),
                    "newly_unlocked_achievements": result.get(
                        "newly_unlocked_achievements", []
                    ),
                    "mirror_match_autocomplete": result.get(
                        "mirror_match_autocomplete"
                    ),
                },
                status=status.HTTP_200_OK,
            )
        except ValidationError as e:
            return Response(
                {
                    "detail": str(
                        e.detail[0] if isinstance(e.detail, list) else e.detail
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Task completion failed: {e}")
            return Response(
                {"detail": "Task completion failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="sacrifice",
    )
    def sacrifice(self, request, pk=None):
        """
        POST /api/tasks/{id}/sacrifice/
        Sacrifices a completed Habit or Daily in exchange for a large XP/Gold burst.
        """
        from datetime import timedelta
        from django.utils import timezone
        from django.db import transaction
        from api.models import UserProfile, RecruitedAlly
        from api.serializers.profile import UserProfileSerializer
        from api.services.profile_service import gain_xp

        try:
            with transaction.atomic():
                task = (
                    self.get_object()
                )  # Automatically retrieves the task of request.user or raises 404

                # Check active mutators
                profile = UserProfile.objects.select_for_update().get(user=request.user)
                active_list = (
                    profile.active_mutators.get("active", [])
                    if isinstance(profile.active_mutators, dict)
                    else []
                )
                active_ids = [
                    m.get("id") if isinstance(m, dict) else m for m in active_list
                ]

                if "sacrificial_altar" not in active_ids:
                    return Response(
                        {"detail": "Sacrificial Altar mutator is not active."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if task.task_type not in ["habit", "daily"]:
                    return Response(
                        {"detail": "Only Habits and Dailies can be sacrificed."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Streak check
                streak = task.streak if task.task_type == "daily" else task.pos_streak

                # Age check
                is_old_enough = (timezone.now() - task.created_at) >= timedelta(days=7)
                is_high_streak = streak >= 5

                if not (is_old_enough or is_high_streak):
                    return Response(
                        {
                            "detail": "Task is too new or streak is too low. Must be at least 7 days old or have a streak of 5+."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Calculate rewards
                xp_reward = min(1000, 100 * (streak + 1))
                gold_reward = min(500, 50 * (streak + 1))

                # Twin Souls split
                active_codes = profile.active_allies or []
                if "twin_souls" in active_ids and active_codes:
                    active_recruited = RecruitedAlly.objects.filter(
                        user_profile=profile, ally_code__in=active_codes
                    )
                    if active_recruited.exists():
                        least_xp_ally = active_recruited.order_by(
                            "total_xp_received", "recruited_at"
                        ).first()
                        if least_xp_ally:
                            ally_xp_share = int(xp_reward * 0.15)
                            ally_gold_share = int(gold_reward * 0.15)

                            xp_reward -= ally_xp_share
                            gold_reward -= ally_gold_share

                            least_xp_ally.total_xp_received += ally_xp_share
                            least_xp_ally.save(update_fields=["total_xp_received"])

                # Null Zone conversion
                if "null_zone" in active_ids:
                    gold_reward += int(xp_reward * 0.5)
                    xp_reward = 0

                # The Gambler's Ledger redirect
                if "gamblers_ledger" in active_ids:
                    profile.ledger_gold += gold_reward
                    gold_reward = 0

                # Apply rewards to profile
                leveled_up = False
                if xp_reward > 0:
                    leveled_up = gain_xp(profile, xp_reward)
                    profile.rank_xp = max(0, profile.rank_xp + xp_reward)
                profile.gold = max(0, profile.gold + gold_reward)
                profile.save()

                # Delete task
                task_title = task.title
                task.delete()

                return Response(
                    {
                        "detail": f"Successfully sacrificed '{task_title}'!",
                        "leveled_up": leveled_up,
                        "xp_earned": xp_reward,
                        "gold_earned": gold_reward,
                        "profile": UserProfileSerializer(profile).data,
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Task sacrifice failed: {e}")
            return Response(
                {"detail": f"Sacrifice failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,  # Не требует {id}
        methods=["post"],  # Только POST
        url_path="process-missed",
    )
    def process_missed(self, request):
        """
        POST /api/tasks/process-missed/
        Processes missed daily tasks (cron trigger).
        """
        from api.services.task_service import process_missed_tasks

        try:
            result = process_missed_tasks(request.user)
            return Response(
                {
                    "fired": result.get("fired", False),
                    "total_dmg": result.get("total_dmg", 0),
                    "died": result.get("died", False),
                    "is_dead": result.get("died", False),
                    "log": result.get("log", []),
                    "profile": UserProfileSerializer(result["profile"]).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"process_missed failed: {e}", exc_info=True)
            return Response(
                {"detail": "Failed to process missed tasks. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="toggle",
    )
    def toggle(self, request, pk=None):
        """
        POST /api/tasks/{id}/toggle/
        Wraps complete_task to handle Habitica-style toggle for ToDos.
        """
        task = self.get_object()
        is_positive = not task.is_completed

        try:
            from api.services.task_service import complete_task

            result = complete_task(request.user, pk, is_positive)

            # Match old API response shape while adding new combat payload
            xp_change = (
                result.get("xp_earned", 0)
                if is_positive
                else -result.get("gamification_result", {}).get("xp_lost", 0)
            )
            gold_change = (
                result.get("gold_earned", 0)
                if is_positive
                else -result.get("gamification_result", {}).get("gold_lost", 0)
            )

            return Response(
                {
                    "completed": is_positive,
                    "xp_change": xp_change,
                    "gold_change": gold_change,
                    "new_xp": result["profile"].xp,
                    "new_gold": result["profile"].gold,
                    "combat": result.get("combat"),
                    "gamification_result": result.get("gamification_result"),
                    "newly_unlocked_achievements": result.get(
                        "newly_unlocked_achievements", []
                    ),
                },
                status=status.HTTP_200_OK,
            )
        except ValidationError as e:
            return Response(
                {
                    "detail": str(
                        e.detail[0] if isinstance(e.detail, list) else e.detail
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Task toggle failed: {e}")
            return Response(
                {"detail": "Task completion failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="revert-failure",
    )
    def revert_failure(self, request, pk=None):
        """
        POST /api/tasks/{id}/revert-failure/
        Reverts a task failure to restore lost HP (Lyra Level 2 perk).
        """
        from django.utils import timezone
        from django.db import transaction
        from api.models import UserProfile
        from api.serializers.profile import UserProfileSerializer

        try:
            with transaction.atomic():
                task = self.get_object()
                profile = UserProfile.objects.select_for_update().get(user=request.user)

                # Check Lyra Level 2
                active_codes = profile.active_allies or []
                lyra_ally = profile.recruited_allies.filter(ally_code="lyra").first()
                if "lyra" not in active_codes or not lyra_ally or lyra_ally.level < 2:
                    return Response(
                        {"detail": "Lyra (Level 2+) must be recruited and active."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Check daily cooldown
                today = timezone.now().date()
                if profile.last_temporal_rewind_used == today:
                    return Response(
                        {"detail": "You have already used Temporal Rewind today."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Check hp_lost in last_reward_data
                reward_data = task.last_reward_data or {}
                hp_lost = reward_data.get("hp_lost", 0)
                if hp_lost <= 0:
                    return Response(
                        {"detail": "No failure damage found to revert for this task."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Restore HP and save
                profile.hp = min(
                    profile.total_stats.get("hp_max", 100), profile.hp + hp_lost
                )
                profile.last_temporal_rewind_used = today
                profile.save(update_fields=["hp", "last_temporal_rewind_used"])

                # Clear hp_lost so it cannot be double reverted
                reward_data["hp_lost"] = 0
                task.last_reward_data = reward_data
                task.save(update_fields=["last_reward_data"])

                return Response(
                    {
                        "detail": f"Temporal Rewind activated! Restored {hp_lost} HP.",
                        "profile": UserProfileSerializer(profile).data,
                        "task": TaskSerializer(task).data,
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Revert failure failed: {e}")
            return Response(
                {"detail": "Failed to revert failure. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,
        methods=["post"],
        url_path="reorder",
    )
    def reorder(self, request):
        """
        POST /api/tasks/reorder/
        Обновляет порядок сортировки для переданных задач.
        Ожидает JSON массива объектов: [{"id": 1, "order": 0}, {"id": 2, "order": 1}]
        """
        updates = request.data
        if not isinstance(updates, list):
            return Response(
                {"detail": "Expected a list of updates."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tasks_to_update = []
        for item in updates:
            task_id = item.get("id")
            order = item.get("order")
            if task_id is None or order is None:
                continue

            try:
                task = Task.objects.get(id=task_id, user=request.user)
                task.order = int(order)
                tasks_to_update.append(task)
            except (Task.DoesNotExist, ValueError):
                continue

        if tasks_to_update:
            Task.objects.bulk_update(tasks_to_update, ["order"])

        return Response({"detail": "Tasks reordered successfully."})


# ─────────────────────────────────────────────────────────────────────────────
# Скиллы — активация и эффекты
# ─────────────────────────────────────────────────────────────────────────────


class SkillActivateView(generics.GenericAPIView):
    """
    POST /api/skills/activate/
    Активирует скилл: проверяет ману, ставит кулдаун, создаёт ActiveEffect.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = SkillActivateSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        skill_id = serializer.validated_data["skill_id"]

        success, message, class_data, effects = activate_skill(request.user, skill_id)

        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        profile = UserProfile.objects.get(user=request.user)

        return Response(
            {
                "detail": message,
                "class_data": class_data,
                "active_effects": effects,
                "profile": UserProfileSerializer(profile).data,
            }
        )


class ActiveEffectsView(generics.GenericAPIView):
    """
    GET /api/skills/active-effects/
    Возвращает активные эффекты и кулдауны текущего пользователя.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone  # type: ignore

        # Чистим истекшие
        ActiveEffect.objects.filter(
            user=request.user, expires_at__lt=timezone.now()
        ).delete()
        SkillCooldown.objects.filter(
            user=request.user, cooldown_until__lt=timezone.now()
        ).delete()

        effects = ActiveEffect.objects.filter(user=request.user)
        cooldowns = SkillCooldown.objects.filter(user=request.user)

        return Response(
            {
                "active_effects": ActiveEffectSerializer(effects, many=True).data,
                "cooldowns": SkillCooldownSerializer(cooldowns, many=True).data,
            }
        )


# ─────────────────────────────────────────────────────────────────────────────
# Магазин (Shop)
# ─────────────────────────────────────────────────────────────────────────────


class ShopBuyView(generics.GenericAPIView):
    """
    POST /api/shop/buy/
    Списывает золото и применяет эффект от купленного предмета.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ShopBuySerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]
        success, message, profile = buy_item(request.user, item_id)

        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        profile_fresh = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects"
        ).get(user=request.user)
        return Response(
            {
                "detail": message,
                "profile": UserProfileSerializer(profile_fresh).data,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Combat System
# ─────────────────────────────────────────────────────────────────────────────


class ShopSellView(generics.GenericAPIView):
    """
    POST /api/shop/sell/
    Sells an item from inventory and adds gold to profile.
    """

    permission_classes = [IsAuthenticated]
    from api.serializers.shop import ShopSellSerializer

    serializer_class = ShopSellSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]
        quantity = serializer.validated_data.get("quantity", 1)

        from api.services.shop_service import sell_item

        success, message, profile = sell_item(request.user, item_id, quantity)

        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        profile_fresh = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects"
        ).get(user=request.user)
        return Response(
            {
                "detail": message,
                "profile": UserProfileSerializer(profile_fresh).data,
            },
            status=status.HTTP_200_OK,
        )


class BossListView(generics.ListAPIView):
    """
    GET /api/combat/bosses/
    Returns list of all available bosses (scroll templates).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = BossSerializer
    queryset = Boss.objects.all()
    pagination_class = None


class BossEncounterView(generics.ListAPIView):
    """
    GET /api/combat/encounters/
    Returns the user's active/completed boss encounters.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = BossEncounterSerializer
    pagination_class = None

    def get_queryset(self):
        encounters = list(BossEncounter.objects.filter(user=self.request.user))
        from api.services.combat_service import apply_idle_damage

        for encounter in encounters:
            if not encounter.is_defeated:
                damage = apply_idle_damage(encounter)
                setattr(encounter, "idle_damage_applied", damage)
                if damage > 0:
                    encounter.save(update_fields=["hp_current", "last_idle_tick_at"])
            else:
                setattr(encounter, "idle_damage_applied", 0)

        return encounters


# ─────────────────────────────────────────────────────────────────────────────
# Billing & Premium (Stripe)
# ─────────────────────────────────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_session_view(request):
    """POST /api/billing/create-checkout-session/"""
    try:
        url = create_checkout_session(request.user)
        return Response({"url": url})
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        return Response(
            {"error": "Failed to create checkout session"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_portal_session_view(request):
    """POST /api/billing/create-portal-session/"""
    try:
        url = create_portal_session(request.user)
        return Response({"url": url})
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Portal error: {e}")
        return Response(
            {"error": "Failed to create portal session"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def stripe_webhook_view(request):
    """POST /api/billing/webhook/"""
    payload = request.body
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        handle_stripe_webhook(payload, sig_header)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"status": "success"})


class BossSummonView(generics.GenericAPIView):
    """
    POST /api/combat/summon/
    Spends gold to summon a boss, creating an active encounter.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = BossSummonSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        boss_id = serializer.validated_data["boss_id"]

        from django.db import transaction  # type: ignore

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            try:
                boss = Boss.objects.get(id_name=boss_id)
            except Boss.DoesNotExist:
                return Response(
                    {"detail": "Boss template not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # SSOT: cost from DB, not frontend
            summon_cost = boss.reward_gold // 2
            if profile.gold < summon_cost:
                return Response(
                    {"detail": f"Not enough gold. Need {summon_cost}G."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check for active encounters
            active_encounter = BossEncounter.objects.filter(
                user=request.user, is_defeated=False
            ).first()
            if active_encounter:
                return Response(
                    {
                        "detail": f"You already have an active boss: {active_encounter.boss.name}"  # noqa: E501
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile.gold -= summon_cost
            profile.save(update_fields=["gold"])

            # Apply difficulty multipliers
            difficulty = profile.boss_difficulty
            multipliers = {
                "EASY": {"hp": 0.5, "reward": 0.8},
                "NORMAL": {"hp": 1.0, "reward": 1.0},
                "HARD": {"hp": 2.0, "reward": 1.5},
                "EXTREME": {"hp": 5.0, "reward": 2.5},
            }
            mult = multipliers.get(difficulty, multipliers["NORMAL"])

            # Create encounter
            encounter = BossEncounter.objects.create(
                user=request.user,
                boss=boss,
                hp_current=int(boss.hp_max * mult["hp"]),
                reward_multiplier=mult["reward"],
            )

        return Response(
            {
                "detail": f"Summoned {boss.name}!",
                "encounter": BossEncounterSerializer(encounter).data,
                "profile": UserProfileSerializer(profile).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Магазин — список предметов
# ─────────────────────────────────────────────────────────────────────────────


class ShopItemListView(generics.ListAPIView):
    """
    GET /api/shop/items/
    Returns all items available for purchase.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer
    queryset = Item.objects.prefetch_related("effects").filter(is_purchasable=True)
    pagination_class = None


# ─────────────────────────────────────────────────────────────────────────────
# Инвентарь — надеть / снять предмет
# ─────────────────────────────────────────────────────────────────────────────


class ToggleEquipView(generics.GenericAPIView):
    """
    POST /api/inventory/<item_code>/equip/
    Toggles equipped state of an inventory item.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, item_code):
        from django.db import transaction  # type: ignore

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            try:
                inv_item = InventoryItem.objects.select_related("item").get(
                    user_profile=profile, item__code=item_code
                )
            except InventoryItem.DoesNotExist:
                return Response(
                    {"detail": "Item not in inventory."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not inv_item.is_equipped:
                slot_type = inv_item.item.slot_type
                if slot_type:
                    InventoryItem.objects.filter(
                        user_profile=profile,
                        item__slot_type=slot_type,
                        is_equipped=True,
                    ).update(is_equipped=False)
                inv_item.is_equipped = True
            else:
                inv_item.is_equipped = False

            inv_item.save(update_fields=["is_equipped"])

        profile_fresh = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects"
        ).get(user=request.user)
        return Response(
            {
                "detail": f"{'Equipped' if inv_item.is_equipped else 'Unequipped'} {inv_item.item.name}.",  # noqa: E501
                "profile": UserProfileSerializer(profile_fresh).data,
            },
            status=status.HTTP_200_OK,
        )


class ConsumeItemView(generics.GenericAPIView):
    """
    POST /api/inventory/<item_code>/consume/
    Consumes an item from the inventory.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, item_code):
        from api.services.inventory_service import consume_item

        success, message, profile = consume_item(request.user, item_code)

        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        profile_fresh = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects", "active_effects"
        ).get(user=request.user)

        return Response(
            {
                "detail": message,
                "profile": UserProfileSerializer(profile_fresh).data,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Престиж
# ─────────────────────────────────────────────────────────────────────────────


class PrestigeView(generics.GenericAPIView):
    """
    POST /api/profile/prestige/
    Resets progress and grants permanent multiplier bonuses.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.db import transaction  # type: ignore
        from api.constants import get_prestige_xp_required
        from api.services.rpg_service import respec_skill_nodes

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            required_xp = get_prestige_xp_required(profile.prestige_count)
            if profile.rank_xp < required_xp:
                return Response(
                    {"detail": (f"You must reach {required_xp} " "XP to prestige.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from api.services.mechanics import get_passive_multipliers

            passive_effects = get_passive_multipliers(profile, {})
            p_bonus = passive_effects.get("prestige_bonus", 0.0)

            profile.prestige_count += 1
            profile.damage_multiplier = round(
                profile.damage_multiplier + 0.1 + p_bonus, 4
            )
            profile.gold_multiplier = round(profile.gold_multiplier + 0.15 + p_bonus, 4)
            profile.xp_multiplier = round(profile.xp_multiplier + 0.15 + p_bonus, 4)

            # Increase IQ ceilings permanently by 15%
            profile.gf_ceiling = round(profile.gf_ceiling * 1.15, 2)
            profile.gc_ceiling = round(profile.gc_ceiling * 1.15, 2)
            profile.ps_ceiling = round(profile.ps_ceiling * 1.15, 2)
            profile.vm_ceiling = round(profile.vm_ceiling * 1.15, 2)

            profile.level = 1
            profile.xp = 0
            profile.xp_to_next_level = 100

            # Use computed max_hp and max_mana properties
            profile.hp = profile.max_hp
            profile.mana = profile.max_mana

            # Start rank
            start_rank = passive_effects.get("prestige_start_rank", "F")
            if start_rank == "C":
                profile.rank_xp = 600
            else:
                profile.rank_xp = 0

            profile.save()

            # Free skill tree respec
            respec_skill_nodes(request.user, free=True)

            # Reset training tasks if they exist in the DB (safe check for 'rank' field)
            from api.models import Task

            task_fields = [f.name for f in Task._meta.get_fields()]
            if "rank" in task_fields:
                Task.objects.filter(user=request.user, task_type="training").update(
                    rank="F", value=0.0
                )

            # Unequip all inventory items
            profile.inventory_items.filter(is_equipped=True).update(is_equipped=False)  # type: ignore
            profile.save()

        return Response(
            {
                "detail": "Prestige successful!",
                "new_rank_xp": profile.rank_xp,
                "new_mana": profile.mana,
                "prestige_count": profile.prestige_count,
                "profile": UserProfileSerializer(profile).data,
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Тренировочный лог (Training Log)
# ─────────────────────────────────────────────────────────────────────────────


class TrainingLogView(generics.GenericAPIView):
    """
    GET /api/training/log/
    Returns last 20 completed tasks as a training log.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from api.models import TrainingSession
        from api.serializers.tasks import TrainingSessionSerializer

        recent = TrainingSession.objects.filter(
            user_profile__user=request.user
        ).order_by("-created_at")[:20]
        return Response(
            {"log": TrainingSessionSerializer(recent, many=True).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        """
        POST /api/training/log/
        Logs a training session, grants XP and applies boss damage.
        """
        from django.db import transaction  # type: ignore
        from django.utils import timezone  # type: ignore
        from api.models import UserProfile, Task
        from api.services.profile_service import gain_xp
        from api.services.mechanics import (
            calculate_task_outcome,
            apply_boss_damage,
            calculate_cognitive_gains,
        )
        from api.serializers.profile import UserProfileSerializer
        from api.serializers.training import TrainingLogSerializer

        # FIX 7: validate and sanitize all training inputs before any game logic
        input_serializer = TrainingLogSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        data = request.data
        hours = validated["hours"]
        focus_rating = validated["focus_rating"]
        flat_xp_bonus = validated["flat_xp_bonus"]
        activity = validated["activity"]

        # Look up custom task if applicable
        task = None
        if isinstance(activity, str) and activity.startswith("custom_task_"):
            try:
                task_id = int(activity.replace("custom_task_", ""))
                task = Task.objects.get(
                    id=task_id, user=request.user, task_type=Task.TaskType.BUTTON
                )
            except (ValueError, Task.DoesNotExist):
                pass

        SCIENCE_ACTIVITIES = {"mathematics", "physics", "chess", "coding"}
        EXERCISE_ACTIVITIES = {"exercise", "running"}
        LANGUAGE_ACTIVITIES = {"english", "german", "languages"}
        PRAYER_ACTIVITIES = {"prayer"}

        task_category = task.category if task else "Other"

        is_science = activity in SCIENCE_ACTIVITIES or task_category in {
            "STEM",
            "Math",
            "Physics",
            "Coding",
            "Chemistry",
            "Biology",
        }
        is_exercise = activity in EXERCISE_ACTIVITIES or task_category in {
            "Health & Fitness",
            "Exercise",
            "Running",
        }
        is_language = activity in LANGUAGE_ACTIVITIES or task_category in {
            "Languages",
            "Humanities & Arts",
            "Reading & Writing",
            "English",
            "History",
            "Philosophy",
        }
        is_prayer = activity in PRAYER_ACTIVITIES or task_category in {"Mindfulness"}

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            # Apply mutators and passives
            from api.services.mechanics import (
                apply_active_mutators,
                get_passive_multipliers,
                calculate_base_training_xp,
            )

            context = {
                "is_science": is_science,
                "is_language": is_language,
                "is_exercise": is_exercise,
                "is_prayer": is_prayer,
                "task_type": "training",
                "hours": hours,
                "focus_rating": focus_rating,
                "activity": activity,
                "task_category": task_category,
                "task_mastery_category": task.mastery_category if task else "",
            }

            mutator_effects = apply_active_mutators(profile, context)
            passive_effects = get_passive_multipliers(profile, context)

            active_list = (
                profile.active_mutators.get("active", [])
                if isinstance(profile.active_mutators, dict)
                else []
            )
            active_ids = [
                m.get("id") if isinstance(m, dict) else m for m in active_list
            ]
            active_codes = profile.active_allies or []
            recruited_allies = {
                a.ally_code: a.level
                for a in profile.recruited_allies.filter(ally_code__in=active_codes)
            }

            # Lyra Level 3 Decaying Focus
            if passive_effects.get("decaying_focus", False) and hours > 0:
                # Divide into 15-minute chunks (0.25h)
                chunks = max(1, int(hours / 0.25))
                total_focus = 0.0
                for c in range(chunks):
                    t_start = c * 0.25
                    if t_start < 0.5:
                        val = 10.0
                    else:
                        decay_steps = int((t_start - 0.5) / 0.25) + 1
                        val = max(1.0, 10.0 - 1.5 * decay_steps)
                    total_focus += val
                focus_rating = total_focus / chunks
            else:
                focus_rating = max(focus_rating, passive_effects.get("min_focus", 0.0))

            # Inversion focus quality flip
            if "inversion" in active_ids:
                focus_rating = 11.0 - focus_rating

            # Combine multipliers (additive)
            xp_mult = (
                mutator_effects.get("xp_mult", 1.0)
                + passive_effects.get("xp_mult", 1.0)
                - 1.0
            )
            gold_mult = (
                mutator_effects.get("gold_mult", 1.0)
                + passive_effects.get("gold_mult", 1.0)
                - 1.0
            )
            flat_xp_bonus += mutator_effects.get("flat_xp", 0) + passive_effects.get(
                "flat_xp", 0
            )

            # Lyra Level 1 duration requirements
            lyra_level = recruited_allies.get("lyra", 0)
            lyra_zero_rewards = False
            if lyra_level >= 1:
                if hours > 2.0:
                    xp_mult += 0.30
                elif hours < 0.5:
                    lyra_zero_rewards = True
                    xp_mult = 0.0
                    gold_mult = 0.0
                    flat_xp_bonus = 0

            # Zephyr Level 1: different focus subject gives +20% Rank XP
            zephyr_level = recruited_allies.get("zephyr", 0)
            if zephyr_level >= 1:
                from api.models import TrainingSession

                last_session = (
                    TrainingSession.objects.filter(user_profile=profile)
                    .order_by("-created_at")
                    .first()
                )
                is_different_subject = True
                if last_session and last_session.activity_key == activity:
                    is_different_subject = False
                if is_different_subject:
                    xp_mult += 0.20

            # Lyra Level 4 active skill cooldowns reduction
            if lyra_level >= 4 and hours > 0:
                from api.models import SkillCooldown

                cooldowns = SkillCooldown.objects.filter(user=profile.user)
                for cd in cooldowns:
                    cd.cooldown_until -= timezone.timedelta(hours=hours)
                    cd.save(update_fields=["cooldown_until"])

            gf_mult = passive_effects.get("gf_mult", 1.0)
            gc_mult = passive_effects.get("gc_mult", 1.0)
            ps_mult = passive_effects.get("ps_mult", 1.0)
            vm_mult = passive_effects.get("vm_mult", 1.0)
            boss_dmg_mult = passive_effects.get("boss_dmg_mult", 1.0)
            gf_flat_bonus = mutator_effects.get("gc_flat", 0.0) + passive_effects.get(
                "gf_flat_bonus", 0.0
            )
            gc_flat_bonus = passive_effects.get("gc_flat_bonus", 0.0)

            unlocked_skills = set(
                profile.unlocked_skills.values_list("skill_code", flat=True)  # type: ignore
            )
            if "flow_state" in unlocked_skills:
                profile.last_training_at = timezone.now().date()

            # Track unique subjects
            try:
                stats = request.user.stats
            except Exception:
                from api.models import UserStats

                stats, _ = UserStats.objects.get_or_create(user=request.user)

            from api.services.mechanics import add_unique_subject_today

            unique_subjects_count = add_unique_subject_today(stats, activity)
            if unique_subjects_count == 3:
                triple_gold = passive_effects.get("triple_subject_gold_bonus", 0)
                if triple_gold > 0:
                    profile.gold += triple_gold

            # Update cognitive stats using backend calculation
            eff_total = float(data.get("efficiency", 1.0))
            gains = calculate_cognitive_gains(activity, hours, eff_total, profile)
            if lyra_zero_rewards:
                gains = {k: 0.0 for k in gains}

            from api.models import ActiveEffect

            meditation_effect = ActiveEffect.objects.filter(
                user=request.user, skill_id="meditation"
            ).first()
            if (
                meditation_effect
                and meditation_effect.data.get("sessionsRemaining", 0) > 0
            ):
                meditation_effect.data["sessionsRemaining"] -= 1
                meditation_effect.save(update_fields=["data"])
                print(
                    f"[Training View] Meditation active. Focus rating boosted. Remaining sessions: {meditation_effect.data['sessionsRemaining']}."
                )

            if ActiveEffect.objects.filter(
                user=request.user, skill_id="infinite_loop"
            ).exists():
                for key in gains:
                    gains[key] *= 2

            gf_gain = gains["gf"]
            gc_gain = gains["gc"]
            ps_gain = gains["ps"]
            vm_gain = gains["vm"]

            actual_gc_gain = gc_gain * gc_mult
            actual_vm_gain = vm_gain * vm_mult

            if ActiveEffect.objects.filter(
                user=request.user, skill_id="memetic_transfer"
            ).exists():
                gf_flat_bonus += (actual_gc_gain + actual_vm_gain) * 0.5

            effective_gf_ceiling = profile.gf_ceiling + passive_effects.get(
                "gf_ceiling_flat", 0.0
            )
            profile.gf = min(
                effective_gf_ceiling, profile.gf + gf_gain * gf_mult + gf_flat_bonus
            )

            profile.gc = min(
                profile.gc_ceiling, profile.gc + gc_gain * gc_mult + gc_flat_bonus
            )

            ps_gain = gains["ps"]
            profile.ps = min(profile.ps_ceiling, profile.ps + ps_gain * ps_mult)

            vm_gain = gains["vm"]
            profile.vm = min(profile.vm_ceiling, profile.vm + vm_gain * vm_mult)

            if task:
                # [CRITICAL SAFETY CONDITIONS] Check against ZeroDivisionError
                def_hours = task.default_hours if task.default_hours else 1.0
                if def_hours <= 0:
                    def_hours = 1.0
                def_focus = float(task.default_focus) if task.default_focus else 7.0
                if def_focus <= 0:
                    def_focus = 7.0

                scale = (hours / def_hours) * (focus_rating / def_focus)
                base_xp = ((scale * task.xp_reward) + flat_xp_bonus) * xp_mult
                base_gold = ((scale * task.gold_reward)) * gold_mult
                raw_boss_dmg = int(scale * task.boss_damage)

                # Increment completion stats for custom button tasks
                task.completion_count += 1
                task.last_completed_at = timezone.now()
                task.save()
            else:
                base_xp = calculate_base_training_xp(
                    hours, focus_rating, flat_xp_bonus, xp_mult
                )
                base_gold = ((hours * 25)) * gold_mult
                raw_boss_dmg = int(hours * focus_rating * 10)

            outcome = calculate_task_outcome(
                request.user,
                "training",
                base_xp=base_xp,
                base_gold=base_gold,
                is_positive=True,
                passive_effects=passive_effects,
            )

            final_xp = max(0, int(outcome["xp_earned"] * profile.xp_multiplier))
            if lyra_zero_rewards:
                final_xp = 0

            if "godmind" in unlocked_skills:
                godmind_bonus = int(
                    (profile.gf + profile.gc + profile.ps + profile.vm) * 0.5
                )
                final_xp += godmind_bonus

            task_cat_lower = task_category.lower() if task_category else ""
            if (
                isinstance(activity, str)
                and activity.lower() in ["reading", "philosophy"]
            ) or task_cat_lower in [
                "reading",
                "philosophy",
                "reading & writing",
                "humanities & arts",
            ]:
                if "living_library" in unlocked_skills:
                    final_xp = int(final_xp * 1.15)

            if is_language:
                mana_bonus = passive_effects.get("language_mana_bonus", 0)
                if mana_bonus > 0:
                    profile.mana = min(profile.max_mana, profile.mana + mana_bonus)

                if "cross_training" in unlocked_skills:
                    profile.humanities_xp += (
                        hours * 0.3 * passive_effects.get("humanities_xp_mult", 1.0)
                    )
                    profile.save(update_fields=["humanities_xp", "mana"])
                elif mana_bonus > 0:
                    profile.save(update_fields=["mana"])

            final_gold = max(0, int(outcome["gold_earned"] * profile.gold_multiplier))
            if lyra_zero_rewards:
                final_gold = 0

            # Twin Souls split
            active_codes = profile.active_allies or []
            if "twin_souls" in active_ids and active_codes:
                from api.models import RecruitedAlly

                active_recruited = RecruitedAlly.objects.filter(
                    user_profile=profile, ally_code__in=active_codes
                )
                if active_recruited.exists():
                    least_xp_ally = active_recruited.order_by(
                        "total_xp_received", "recruited_at"
                    ).first()
                    if least_xp_ally:
                        ally_xp_share = int(final_xp * 0.15)
                        ally_gold_share = int(final_gold * 0.15)

                        final_xp -= ally_xp_share
                        final_gold -= ally_gold_share

                        least_xp_ally.total_xp_received += ally_xp_share
                        least_xp_ally.save(update_fields=["total_xp_received"])

            # Null Zone conversion
            if "null_zone" in active_ids:
                final_gold += int(final_xp * 0.5)
                final_xp = 0

            # The Gambler's Ledger redirect
            if "gamblers_ledger" in active_ids:
                profile.ledger_gold += final_gold
                final_gold = 0

            gain_xp(profile, final_xp)
            profile.rank_xp = max(0, profile.rank_xp + final_xp)
            profile.gold = max(0, profile.gold + final_gold)

            # Handle item drops
            if outcome.get("item_dropped"):
                from api.models import Item, InventoryItem

                item_obj = Item.objects.filter(code=outcome["item_dropped"]).first()
                if item_obj:
                    inv_item, created = InventoryItem.objects.get_or_create(
                        user_profile=profile, item=item_obj
                    )
                    if not created:
                        inv_item.quantity += 1
                        inv_item.save()

            # ── Create TrainingSession Record ──
            from api.models import TrainingSession

            TrainingSession.objects.create(
                user_profile=profile,
                activity_key=activity,
                hours=hours,
                focus_rating=focus_rating,
                efficiency=eff_total,
                xp_earned=final_xp,
                gf_gain=gf_gain,
                gc_gain=gc_gain,
                ps_gain=ps_gain,
                vm_gain=vm_gain,
            )

            # Grier Level 1: Focus >= 9.0 restores +2 HP
            if passive_effects.get("grier_l1_heal", False):
                profile.hp = min(profile.total_stats.get("hp_max", 100), profile.hp + 2)

            profile.save()

            # Boss Damage Logic
            damage_dealt = outcome.get(
                "damage_dealt", 10
            )  # Base 10 + PWR from mechanics

            final_damage_dealt = int(
                (raw_boss_dmg + damage_dealt)
                * profile.damage_multiplier
                * boss_dmg_mult
            )
            is_crit = outcome.get("is_crit", False)

            combat_result = apply_boss_damage(request.user, final_damage_dealt, is_crit)

            # Consume one-time buffs used in this session
            from api.models import ActiveEffect

            session_buffs = ActiveEffect.objects.filter(
                user=request.user, skill_id__in=["focus_stim", "boss_damage_plus"]
            )
            for buff in session_buffs:
                if buff.data and "uses_left" in buff.data:
                    buff.data["uses_left"] -= 1
                    if buff.data["uses_left"] <= 0:
                        buff.delete()
                    else:
                        buff.save()

        # Needs prefetching for the response
        profile = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects"
        ).get(user=request.user)

        return Response(
            {
                "detail": "Training logged successfully.",
                "profile": UserProfileSerializer(profile).data,
                "gold_earned": final_gold,
                "xp_earned": final_xp,
                "combat": combat_result,
                "gf_gain": gf_gain,
                "gc_gain": gc_gain,
                "ps_gain": ps_gain,
                "vm_gain": vm_gain,
                "item_dropped": outcome.get("item_dropped"),
            },
            status=status.HTTP_200_OK,
        )


class BuySkillSerializer(serializers.Serializer):
    skill_code = serializers.CharField(
        max_length=50,
        required=True,
    )

    # Validate format — only alphanumeric and underscores
    def validate_skill_code(self, value):
        import re

        if not re.match(r"^[a-zA-Z0-9_]+$", value):
            raise serializers.ValidationError("Invalid skill_code format.")
        return value


class BuySkillView(generics.GenericAPIView):
    """
    POST /api/skills/buy/
    Buys a skill node.
    Payload: { "skill_code": "some_skill" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.rpg_service import buy_skill_node

        serializer = BuySkillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        skill_code = serializer.validated_data["skill_code"]
        try:
            profile = buy_skill_node(request.user, skill_code)
            # Prefetch for serializer
            profile = UserProfile.objects.prefetch_related(
                "inventory_items__item__effects"
            ).get(id=profile.id)
            return Response(
                {
                    "detail": f"Successfully unlocked skill: {skill_code}",
                    "profile": UserProfileSerializer(profile).data,
                },
                status=status.HTTP_200_OK,
            )
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RespecSkillView(generics.GenericAPIView):
    """
    POST /api/skills/respec/
    Resets all skills, refunds SP, and costs gold.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.rpg_service import respec_skill_nodes

        try:
            profile = respec_skill_nodes(request.user)
            profile = UserProfile.objects.prefetch_related(
                "inventory_items__item__effects"
            ).get(id=profile.id)
            return Response(
                {
                    "detail": "Successfully reset skill tree.",
                    "profile": UserProfileSerializer(profile).data,
                },
                status=status.HTTP_200_OK,
            )
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AlliesConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Returns static ally config with metadata"""
        allies_list = []
        for code, data in ALLIES_CONFIG.items():
            ally = {
                "id": code,
                "name": data.get("name"),
                "title": data.get("title"),
                "lore": data.get("lore"),
                "image": data.get("image_url"),
                "color": data.get("color"),
                "rank": data.get("rank"),
                "recruitCost": data.get("recruit_cost"),
                "upgradeCosts": data.get("upgrade_costs"),
                "levels": [
                    lvl_data.get("desc")
                    for lvl, lvl_data in sorted(data.get("levels", {}).items())  # type: ignore
                ],
            }
            allies_list.append(ally)
        return Response(allies_list, status=status.HTTP_200_OK)


class RecruitAllySerializer(serializers.Serializer):
    ally_code = serializers.CharField(
        max_length=50,
        required=True,
    )

    def validate_ally_code(self, value):
        import re

        if not re.match(r"^[a-zA-Z0-9_]+$", value):
            raise serializers.ValidationError("Invalid ally_code format.")
        return value


class RecruitAllyView(generics.GenericAPIView):
    """
    POST /api/allies/recruit/
    Recruits or upgrades an ally.
    Payload: { "ally_code": "some_ally" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.rpg_service import recruit_ally

        serializer = RecruitAllySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ally_code = serializer.validated_data["ally_code"]
        try:
            ally_rec = recruit_ally(request.user, ally_code)
            profile = UserProfile.objects.prefetch_related(
                "inventory_items__item__effects"
            ).get(user=request.user)
            return Response(
                {
                    "detail": f"Successfully processed ally: {ally_code}",
                    "ally": {"ally_code": ally_rec.ally_code, "level": ally_rec.level},
                    "profile": UserProfileSerializer(profile).data,
                },
                status=status.HTTP_200_OK,
            )
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class VivianDarkSacrificeView(generics.GenericAPIView):
    """
    POST /api/allies/vivian/dark-sacrifice/
    Vivian L2: Lose 15 HP to instantly reset the cooldown of one random skill (12h cooldown).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.models import UserProfile, SkillCooldown
        from api.services.profile_service import check_death
        from django.db import transaction
        from django.utils import timezone
        import random

        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(user=request.user)
                active_codes = profile.active_allies or []

                vivian_recruited = profile.recruited_allies.filter(
                    ally_code="vivian"
                ).first()
                if (
                    "vivian" not in active_codes
                    or not vivian_recruited
                    or vivian_recruited.level < 2
                ):
                    return Response(
                        {
                            "detail": "Vivian Level 2 must be recruited and active to use Dark Sacrifice."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if profile.last_dark_sacrifice_used:
                    cooldown_until = (
                        profile.last_dark_sacrifice_used + timezone.timedelta(hours=12)
                    )
                    if timezone.now() < cooldown_until:
                        remaining = cooldown_until - timezone.now()
                        hours, remainder = divmod(remaining.seconds, 3600)
                        minutes, _ = divmod(remainder, 60)
                        return Response(
                            {
                                "detail": f"Dark Sacrifice is on cooldown: {hours}h {minutes}m remaining."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                active_cooldowns = list(
                    SkillCooldown.objects.filter(
                        user=request.user, cooldown_until__gt=timezone.now()
                    )
                )
                if not active_cooldowns:
                    return Response(
                        {"detail": "No skills are currently on cooldown."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                profile.hp = max(0, profile.hp - 15)
                is_dead = check_death(profile)
                profile.last_dark_sacrifice_used = timezone.now()
                profile.save(update_fields=["hp", "last_dark_sacrifice_used"])

                reset_skill = None
                if not is_dead:
                    target_cd = random.choice(active_cooldowns)
                    reset_skill = target_cd.skill_id
                    target_cd.delete()

                from api.serializers.profile import UserProfileSerializer

                profile_data = UserProfileSerializer(profile).data

                msg = "Dark Sacrifice activated! Lost 15 HP."
                if reset_skill:
                    msg += f" Reset cooldown for skill '{reset_skill}'."
                if is_dead:
                    msg += " You have died."

                return Response(
                    {
                        "detail": msg,
                        "reset_skill": reset_skill,
                        "is_dead": is_dead,
                        "profile": profile_data,
                    },
                    status=status.HTTP_200_OK,
                )
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RheaChaosControlView(generics.GenericAPIView):
    """
    POST /api/allies/rhea/chaos-control/
    Rhea L2: Once per day: Swap an active Mutator with a random one from the entire pool, ignoring lock status.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.models import UserProfile
        from api.constants.mutators import MUTATORS_CONFIG
        from django.db import transaction
        from django.utils import timezone
        import random
        import time

        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(user=request.user)
                active_codes = profile.active_allies or []

                rhea_recruited = profile.recruited_allies.filter(
                    ally_code="rhea"
                ).first()
                if (
                    "rhea" not in active_codes
                    or not rhea_recruited
                    or rhea_recruited.level < 2
                ):
                    return Response(
                        {
                            "detail": "Rhea Level 2 must be recruited and active to use Chaos Control."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if profile.last_chaos_control_used:
                    cooldown_until = (
                        profile.last_chaos_control_used + timezone.timedelta(hours=24)
                    )
                    if timezone.now() < cooldown_until:
                        remaining = cooldown_until - timezone.now()
                        hours, remainder = divmod(remaining.seconds, 3600)
                        minutes, _ = divmod(remainder, 60)
                        return Response(
                            {
                                "detail": f"Chaos Control is on cooldown: {hours}h {minutes}m remaining."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                active_mutators = profile.active_mutators or {}
                active_list = active_mutators.get("active", [])

                if not active_list:
                    return Response(
                        {"detail": "No active mutators to swap."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                all_ids = list(MUTATORS_CONFIG.keys())
                active_ids = [
                    m.get("id") if isinstance(m, dict) else m for m in active_list
                ]
                available_ids = [mid for mid in all_ids if mid not in active_ids]

                if not available_ids:
                    return Response(
                        {"detail": "No other mutators available to swap."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Swap a random active mutator
                target_idx = random.randint(0, len(active_list) - 1)
                old_mutator = active_list[target_idx]
                old_id = (
                    old_mutator.get("id")
                    if isinstance(old_mutator, dict)
                    else old_mutator
                )

                new_mutator_id = random.choice(available_ids)
                duration = MUTATORS_CONFIG[new_mutator_id].get("durationDays", None)
                active_list[target_idx] = {
                    "id": new_mutator_id,
                    "activatedAt": int(time.time() * 1000),
                    "duration": duration,
                }

                active_mutators["active"] = active_list
                profile.active_mutators = active_mutators
                profile.last_chaos_control_used = timezone.now()
                profile.save(
                    update_fields=["active_mutators", "last_chaos_control_used"]
                )

                from api.serializers.profile import UserProfileSerializer

                profile_data = UserProfileSerializer(profile).data

                return Response(
                    {
                        "detail": f"Chaos Control activated! Swapped mutator '{old_id}' with '{new_mutator_id}'.",
                        "old_mutator": old_id,
                        "new_mutator": new_mutator_id,
                        "profile": profile_data,
                    },
                    status=status.HTTP_200_OK,
                )
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
# Крафт
# ─────────────────────────────────────────────────────────────────────────────


class RecipeListView(generics.ListAPIView):
    """
    GET /api/crafting/recipes/
    Returns all crafting recipes.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = RecipeListSerializer
    queryset = (
        Recipe.objects.prefetch_related("ingredients__item")
        .select_related("result_item")
        .all()
    )
    pagination_class = None


class CraftItemView(generics.GenericAPIView):
    """
    POST /api/crafting/craft/
    Crafts an item using ingredients and gold.
    Payload: { "recipe_code": "some_recipe" }
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CraftSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipe_code = serializer.validated_data["recipe_code"]

        try:
            result_item = craft_item(request.user, recipe_code)
        except GameLogicError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        profile = UserProfile.objects.prefetch_related(
            "inventory_items__item__effects"
        ).get(user=request.user)
        return Response(
            {
                "detail": f"Crafted {result_item.name} successfully!",
                "item": ItemSerializer(result_item).data,
                "profile": UserProfileSerializer(profile).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CombatSyncView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.db import transaction  # type: ignore
        from api.models import UserProfile, UserStats
        from api.services.achievement_service import check_and_grant_achievements
        from api.serializers.profile import UserProfileSerializer

        data = request.data
        damage_dealt = int(data.get("damage_dealt", 0))
        damage_taken = int(data.get("damage_taken", 0))
        crits = int(data.get("crits", 0))
        time_elapsed_sec = int(data.get("time_elapsed_sec", 0))

        if damage_dealt <= 0 and crits <= 0 and damage_taken <= 0:
            return Response(
                {"detail": "No combat data to sync."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            stats_dict = profile.total_stats
            pwr = stats_dict.get("pwr", 0)
            max_dps = (10 + pwr) * profile.damage_multiplier * 10
            sanity_limit = max(1000, max_dps * time_elapsed_sec * 1.15)

            if time_elapsed_sec > 0 and damage_dealt > sanity_limit:
                damage_dealt = int(sanity_limit)  # type: ignore

            is_dead = False
            if damage_taken > 0:
                profile.hp = max(0, profile.hp - damage_taken)
                from api.services.profile_service import check_death

                is_dead = check_death(profile)
                if not is_dead:
                    profile.save(update_fields=["hp"])

            try:
                stats = request.user.stats
            except UserStats.DoesNotExist:
                stats = UserStats.objects.create(user=request.user)

            stats.total_boss_damage += damage_dealt
            stats.total_crits += crits
            stats.save(update_fields=["total_boss_damage", "total_crits"])

            unlocked_achievements = check_and_grant_achievements(request.user)
            profile.refresh_from_db()

            return Response(
                {
                    "detail": "Combat synced.",
                    "profile": UserProfileSerializer(profile).data,
                    "unlocked_achievements": unlocked_achievements,
                    "is_dead": is_dead,
                },
                status=status.HTTP_200_OK,
            )


class ResetDataView(generics.GenericAPIView):
    """
    POST /api/profile/reset/
    Resets user data based on type: "tasks", "stats", or "nuclear".
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logger = logging.getLogger(__name__)
        reset_type = request.data.get("reset_type", "stats")

        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(user=request.user)

                if reset_type == "training":
                    from api.models import TrainingSession

                    TrainingSession.objects.filter(user_profile=profile).delete()
                    profile.humanities_xp = 0.0
                    profile.save(update_fields=["humanities_xp"])
                    return Response(
                        {"message": "Training data reset"}, status=status.HTTP_200_OK
                    )

                if reset_type == "allies":
                    profile.recruited_allies.all().delete()  # type: ignore
                    profile.active_allies = []
                    profile.save(update_fields=["active_allies"])
                    return Response(
                        {"message": "Allies reset"}, status=status.HTTP_200_OK
                    )

                if reset_type == "skills":
                    from api.services.rpg_service import respec_skill_nodes

                    respec_skill_nodes(request.user, free=True)
                    return Response(
                        {"message": "Skills reset"}, status=status.HTTP_200_OK
                    )

                if reset_type == "streak":
                    profile.streak = 0
                    profile.save(update_fields=["streak"])
                    return Response(
                        {"message": "Streak reset"}, status=status.HTTP_200_OK
                    )

                if reset_type in ["tasks", "nuclear"]:
                    Task.objects.filter(user=request.user).delete()
                    profile.rank_xp = 0

                if reset_type in ["stats", "nuclear"]:
                    InventoryItem.objects.filter(user_profile=profile).delete()
                    profile.mana = 0
                    profile.mana_max = 100  # Will auto-sync in save()
                    profile.gold = 0
                    profile.level = 1
                    profile.xp = 0
                    profile.xp_to_next_level = 100
                    profile.rank_xp = 0
                    profile.prestige_count = 0
                    profile.hp = profile.max_hp
                    profile.character_class = ""
                    profile.skill_points = 0
                    profile.unspent_stat_points = 0
                    profile.streak = 0
                    profile.last_daily_cron_at = None
                    profile.seen_guides = {}
                    profile.rival_data = {}

                    profile.base_pwr = 5
                    profile.base_foc = 5
                    profile.base_spd = 5
                    profile.base_lck = 5
                    profile.base_def = 5
                    profile.base_mem = 5

                    profile.gf = 100.0
                    profile.gc = 100.0
                    profile.ps = 100.0
                    profile.vm = 100.0

                    profile.gf_ceiling = 105.0
                    profile.gc_ceiling = 105.0
                    profile.ps_ceiling = 105.0
                    profile.vm_ceiling = 105.0

                    profile.damage_multiplier = 1.0
                    profile.gold_multiplier = 1.0
                    profile.xp_multiplier = 1.0

                    ActiveEffect.objects.filter(user=request.user).delete()
                    SkillCooldown.objects.filter(user=request.user).delete()
                    BossEncounter.objects.filter(user=request.user).delete()
                    from api.models import TrainingSession

                    TrainingSession.objects.filter(user_profile=profile).delete()
                    profile.humanities_xp = 0.0

                    # Direct update as requested
                    UserStats.objects.filter(user=request.user).update(
                        total_tasks_completed=0,
                        max_streak=0,
                        total_boss_damage=0,
                        bosses_defeated=0,
                        total_gold_earned=0,
                        prayer_sessions=0,
                        total_crits=0,
                        allies_recruited=0,
                        ally_max_level=0,
                        unique_subjects=[],
                        highest_subject_rank=0,
                        prayer_rank=0,
                    )

                if reset_type in ["stats", "nuclear"]:
                    profile.unlocked_skills.all().delete()  # type: ignore
                    profile.recruited_allies.all().delete()  # type: ignore
                    profile.active_allies = []

                if reset_type == "nuclear":
                    InventoryItem.objects.filter(user_profile=profile).delete()
                    UserAchievement.objects.filter(user=request.user).delete()
                    from api.models import PomodoroSession

                    PomodoroSession.objects.filter(user=request.user).delete()

                profile.save()

            return Response(
                {"message": "Data reset successfully"}, status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Reset error: {str(e)}", exc_info=True)
            return Response(
                {"error": "Internal server error during data reset. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ——— Rival System ————————————————————————————————————————————————


class RivalView(generics.GenericAPIView):
    """
    GET /api/rival/
    Returns rival data generated deterministically for the current day.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = UserProfile.objects.get(user=request.user)
            rival_data = compute_rival_data(profile)
            return Response(rival_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error computing rival data: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to compute rival data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─── Party System ─────────────────────────────────────────────────────────────


class PartyCreateView(generics.GenericAPIView):
    """POST /api/party/create/  — create a new party and auto-join as creator."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.party_service import create_party
        from api.serializers.party import PartySerializer
        from api.exceptions import GameLogicError

        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"error": "Party name is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            party = create_party(request.user, name)
            return Response(PartySerializer(party).data, status=status.HTTP_201_CREATED)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Party create error: %s", str(e), exc_info=True)
            return Response(
                {"error": "Internal server error."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PartyJoinView(generics.GenericAPIView):
    """POST /api/party/join/  — join a party by invite_code."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.party_service import join_party
        from api.serializers.party import PartySerializer
        from api.exceptions import GameLogicError

        invite_code = request.data.get("invite_code", "").strip()
        if not invite_code:
            return Response(
                {"error": "invite_code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            party = join_party(request.user, invite_code)
            return Response(PartySerializer(party).data, status=status.HTTP_200_OK)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Party join error: %s", str(e), exc_info=True)
            return Response(
                {"error": "Internal server error."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PartyLeaveView(generics.GenericAPIView):
    """POST /api/party/leave/  — leave the user's current party."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.party_service import leave_party
        from api.exceptions import GameLogicError

        try:
            leave_party(request.user)
            return Response(
                {"message": "You have left the party."}, status=status.HTTP_200_OK
            )
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Party leave error: %s", str(e), exc_info=True)
            return Response(
                {"error": "Internal server error."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PartyMembersView(generics.GenericAPIView):
    """
    GET /api/party/members/
    Returns the current user's party + all member public profiles.
    Returns 404 if user is not in a party.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from api.services.party_service import get_party_with_members
        from api.serializers.party import PartySerializer

        party = get_party_with_members(request.user)
        if party is None:
            return Response({"party": None}, status=status.HTTP_200_OK)

        return Response(PartySerializer(party).data, status=status.HTTP_200_OK)


class MarkGuideSeenView(generics.GenericAPIView):
    """
    POST /api/profile/mark-guide-seen/
    Body: {"guide_id": "mutators"}
    Marks a specific guide as seen in the user profile's seen_guides JSONField.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        guide_id = request.data.get("guide_id")
        if not guide_id:
            return Response(
                {"error": "guide_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        profile = request.user.profile
        # Initialize if none (just in case)
        if not isinstance(profile.seen_guides, dict):
            profile.seen_guides = {}

        profile.seen_guides[guide_id] = True
        profile.save(update_fields=["seen_guides"])

        from api.serializers.profile import UserProfileSerializer

        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)


class FeatureEventView(generics.GenericAPIView):
    """
    POST /api/analytics/event/
    Логирует использование фич.
    Если пользователь авторизован, проверяет analytics_enabled.
    """

    from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

    class FeatureEventAnonThrottle(AnonRateThrottle):
        rate = "20/min"

    class FeatureEventUserThrottle(UserRateThrottle):
        rate = "60/min"

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]
    throttle_classes = [FeatureEventAnonThrottle, FeatureEventUserThrottle]

    def post(self, request, *args, **kwargs):
        event_name = request.data.get("event_name")
        if not event_name:
            return Response(
                {"error": "event_name required"}, status=status.HTTP_400_BAD_REQUEST
            )

        user = None
        if request.user.is_authenticated:
            # Check if analytics is enabled for this user
            if hasattr(request.user, "profile"):
                if not request.user.profile.analytics_enabled:
                    # Silent drop: pretend it succeeded to not clutter client logs
                    return Response({"status": "ignored"}, status=status.HTTP_200_OK)
            user = request.user

        from api.models import FeatureEvent

        FeatureEvent.objects.create(user=user, event_name=event_name)
        return Response({"status": "logged"}, status=status.HTTP_201_CREATED)


class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CalendarEvent.
    Supports CRUD operations for manual calendar events.
    """

    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not hasattr(request.user, "profile") or not request.user.profile.is_premium:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Premium subscription required to access Calendar.")

    def get_queryset(self):
        return CalendarEvent.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PartyFeedView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from api.models import PartyEvent
        from api.serializers.party import PartyEventSerializer

        try:
            party = request.user.party_membership.party
        except Exception:
            return Response(
                {"error": "Not in a party"}, status=status.HTTP_400_BAD_REQUEST
            )

        events = PartyEvent.objects.filter(party=party).order_by("-created_at")
        page = self.paginate_queryset(events)
        if page is not None:
            serializer = PartyEventSerializer(
                page, many=True, context={"request": request}
            )
            return self.get_paginated_response(serializer.data)

        serializer = PartyEventSerializer(
            events, many=True, context={"request": request}
        )
        return Response(serializer.data)


class PartyEventReactView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        from api.services.party_service import toggle_reaction

        emoji = request.data.get("emoji", "").strip()
        allowed_emojis = ["🔥", "👏", "💪", "🎉"]
        if emoji not in allowed_emojis:
            return Response(
                {"error": "Invalid emoji"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            res = toggle_reaction(request.user, event_id, emoji)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PartyBuffView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.party_service import send_buff

        receiver_username = request.data.get("receiver_username")
        effect_code = request.data.get("effect_code")
        if not receiver_username or not effect_code:
            return Response(
                {"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            res = send_buff(request.user, receiver_username, effect_code)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PartyLeaderboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            party = request.user.party_membership.party
        except Exception:
            return Response(
                {"error": "Not in a party"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure weekly_xp is current for everyone
        from django.utils import timezone

        today_iso = timezone.now().date().isocalendar()
        current_iso_week = f"{str(today_iso[0])[-2:]}W{today_iso[1]:02d}"

        memberships = party.memberships.select_related("user__profile").all()
        for mem in memberships:
            if mem.weekly_xp_reset_week != current_iso_week:
                mem.weekly_xp = 0
                mem.weekly_xp_reset_week = current_iso_week
                mem.save(update_fields=["weekly_xp", "weekly_xp_reset_week"])

        memberships = memberships.order_by("-weekly_xp")

        # Serialize list
        data = []
        for mem in memberships:
            # Reusing parts of PartyMembershipSerializer, or just a simple dict
            display_name = mem.user.profile.character_name or mem.user.username
            if mem.user.profile.anonymous_mode:
                display_name = "Anonymous Wanderer"

            data.append(
                {
                    "username": display_name,
                    "weekly_xp": mem.weekly_xp,
                    "level": mem.user.profile.level,
                    "avatar": (
                        mem.user.profile.avatar.url
                        if mem.user.profile.avatar and mem.user.profile.avatar.name
                        else None
                    ),
                }
            )

        return Response({"leaderboard": data}, status=status.HTTP_200_OK)


class PartyMemberProfileView(generics.GenericAPIView):
    """GET /api/party/members/<user_id>/profile/"""

    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            requester_membership = request.user.party_membership
            party = requester_membership.party
        except Exception:
            return Response(
                {"error": "Not in a party"}, status=status.HTTP_403_FORBIDDEN
            )

        from django.contrib.auth.models import User
        from django.shortcuts import get_object_or_404

        target_user = get_object_or_404(User, id=user_id)

        # Enforce target user is in the same party
        try:
            target_membership = target_user.party_membership  # type: ignore
            if target_membership.party_id != party.id:
                return Response(
                    {"error": "User not in your party"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Exception:
            return Response(
                {"error": "User not in your party"}, status=status.HTTP_403_FORBIDDEN
            )

        profile = target_user.profile  # type: ignore
        stats = target_user.stats  # type: ignore

        # Format recruited allies
        allies = [
            {"ally_code": a.ally_code, "level": a.level}
            for a in profile.recruited_allies.all()
        ]

        total_stats = profile.total_stats

        from api.services.profile_service import get_rank_info

        rank_info = get_rank_info(profile)

        return Response(
            {
                "user_id": target_user.id,
                "username": target_user.username,
                "joined": target_user.date_joined.isoformat(),
                "party_joined_at": (
                    target_membership.joined_at.isoformat()
                    if target_membership
                    else None
                ),
                "character_image": (
                    profile.avatar.url
                    if profile.avatar and profile.avatar.name
                    else None
                ),
                "character_class": profile.character_class,
                "level": profile.level,
                "rank": rank_info.get("current_id", "F"),
                "rank_info": rank_info,
                "rank_xp": profile.rank_xp,
                "hp": profile.hp,
                "max_hp": total_stats.get("hp_max", 100),
                "hp_max": total_stats.get("hp_max", 100),
                "xp": profile.xp,
                "xp_to_next_level": profile.xp_to_next_level,
                "mana": profile.mana,
                "max_mana": total_stats.get("mana_max", 50),
                "mana_max": total_stats.get("mana_max", 50),
                "total_tasks_completed": stats.total_tasks_completed,
                "max_streak": stats.max_streak,
                "allies": allies,
            },
            status=status.HTTP_200_OK,
        )


class BuyMutatorView(generics.GenericAPIView):
    """
    POST /api/mutators/<str:mutator_id>/buy/
    Direct purchases are disabled. Mutators can only be unlocked via Mutator Chests.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, mutator_id, *args, **kwargs):
        return Response(
            {
                "error": "Direct purchases are disabled. Mutators can only be unlocked via Mutator Chests."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class OpenMutatorChestView(generics.GenericAPIView):
    """
    POST /api/mutators/chest/open/
    Opens a mutator chest, costing 100 gold, and grants a random unowned mutator.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from django.db import transaction
        from api.models import UserProfile
        from api.constants.mutators import MUTATORS_CONFIG
        import random

        cost = 100

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            if profile.gold < cost:
                return Response(
                    {"error": "Not enough gold. Mutator Chest costs 100G."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            active_mutators = profile.active_mutators or {}
            purchased = active_mutators.get("purchased", [])

            # Pool of all active (non-disabled) mutators that the user doesn't already own
            pool = [
                m_id
                for m_id, cfg in MUTATORS_CONFIG.items()
                if not cfg.get("disabled", False) and m_id not in purchased
            ]

            if not pool:
                return Response(
                    {"error": "You already own all mutators!"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            won_mutator_id = random.choice(pool)

            # Deduct gold and grant mutator
            profile.gold = max(0, profile.gold - cost)
            purchased.append(won_mutator_id)
            active_mutators["purchased"] = purchased
            profile.active_mutators = active_mutators
            profile.save(update_fields=["gold", "active_mutators"])

            from api.serializers.profile import UserProfileSerializer

            return Response(
                {
                    "won_mutator_id": won_mutator_id,
                    "profile": UserProfileSerializer(profile).data,
                },
                status=status.HTTP_200_OK,
            )


class ToggleMutatorView(generics.GenericAPIView):
    """
    POST /api/mutators/<str:mutator_id>/toggle/
    Activates or deactivates a mutator for the user.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, mutator_id, *args, **kwargs):
        from django.db import transaction
        from api.models import UserProfile
        from api.constants.mutators import MUTATORS_CONFIG
        import time

        with transaction.atomic():
            if mutator_id not in MUTATORS_CONFIG:
                return Response(
                    {"error": "Invalid mutator ID"}, status=status.HTTP_400_BAD_REQUEST
                )
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            active_mutators = profile.active_mutators or {}
            purchased = active_mutators.get("purchased", [])
            active_list = active_mutators.get("active", [])

            if mutator_id not in purchased:
                return Response(
                    {"error": "You do not own this mutator."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Find if it's already active
            existing = next(
                (
                    m
                    for m in active_list
                    if (m.get("id") if isinstance(m, dict) else m) == mutator_id
                ),
                None,
            )

            if existing:
                # Deactivate
                active_list = [
                    m
                    for m in active_list
                    if (m.get("id") if isinstance(m, dict) else m) != mutator_id
                ]
            else:
                from api.services.mechanics import get_passive_multipliers

                passive_effects = get_passive_multipliers(profile, {})
                max_active = 4 if passive_effects.get("rhea_singularity", False) else 3
                if len(active_list) >= max_active:
                    return Response(
                        {"error": f"Maximum of {max_active} active mutators allowed."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                duration = MUTATORS_CONFIG[mutator_id].get("durationDays", None)
                active_list.append(
                    {
                        "id": mutator_id,
                        "activatedAt": int(time.time() * 1000),
                        "duration": duration,
                    }
                )

            active_mutators["active"] = active_list
            profile.active_mutators = active_mutators
            profile.save(update_fields=["active_mutators"])

            from api.serializers.profile import UserProfileSerializer

            serializer = UserProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)


class DejaVuView(generics.GenericAPIView):
    """
    POST /api/tasks/<id>/deja-vu/
    Re-completes a task if Deja Vu mutator is active, with a 7-day cooldown.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        user = request.user
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Response(
                {"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND
            )

        active_mutators = profile.active_mutators or {}
        active_list = (
            active_mutators.get("active", [])
            if isinstance(active_mutators, dict)
            else []
        )
        active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]

        if "deja_vu" not in active_ids:
            return Response(
                {"error": "Deja Vu mutator is not active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if profile.last_deja_vu_use:
            from django.utils import timezone
            import datetime

            time_since_use = timezone.now() - profile.last_deja_vu_use
            if time_since_use < datetime.timedelta(days=7):
                return Response(
                    {"error": "Deja Vu is on cooldown (7 days)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            task = Task.objects.get(id=task_id, user=user)
        except Task.DoesNotExist:
            return Response(
                {"error": "Task not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if not task.is_completed and task.task_type == Task.TaskType.TODO:
            return Response(
                {"error": "Task must be completed to use Deja Vu."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from api.services.task_service import _complete_task_logic
        from django.utils import timezone

        try:
            with transaction.atomic():
                result = _complete_task_logic(
                    user, task.id, is_positive=True, is_deja_vu=True
                )
                profile.last_deja_vu_use = timezone.now()
                profile.save(update_fields=["last_deja_vu_use"])
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Loot Chest System
# ─────────────────────────────────────────────────────────────────────────────


class LootChestListView(generics.GenericAPIView):
    """
    GET /api/chests/
    Returns available chest types with their drop rates and costs.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from api.models import LootChest

        chests = LootChest.objects.all().values(
            "chest_type", "name", "description", "cost_gold", "drop_rates", "icon_url"
        )
        return Response(list(chests), status=status.HTTP_200_OK)


class OpenChestView(generics.GenericAPIView):
    """
    POST /api/chests/<chest_type>/open/
    Opens a loot chest, deducts gold, and returns the won item.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, chest_type: str):
        from api.services.chest_service import open_chest
        from api.exceptions import GameLogicError

        try:
            success, message, result = open_chest(request.user, chest_type)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Unexpected error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"detail": message, **result}, status=status.HTTP_200_OK)
