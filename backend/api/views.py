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

from rest_framework import viewsets, generics, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

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
    TrainingSession,
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

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# Аутентификация
# ─────────────────────────────────────────────────────────────────────────────


class RegisterView(generics.CreateAPIView):
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
        """Возвращаем профиль текущего авторизованного пользователя с предзагрузкой инвентаря."""  # noqa: E501
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        if not created:
            profile = UserProfile.objects.prefetch_related(
                "inventory_items__item__effects"
            ).get(user=self.request.user)
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
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"detail": str(e.detail[0] if hasattr(e, "detail") else e)},
                status=status.HTTP_400_BAD_REQUEST,
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
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
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
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"detail": str(e.detail[0] if hasattr(e, "detail") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


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
        return BossEncounter.objects.filter(user=self.request.user)


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
    queryset = Item.objects.prefetch_related("effects").all()
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

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            if profile.rank_xp < 8000:
                return Response(
                    {"detail": "You must reach 8000 XP to prestige."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.prestige_count += 1
            profile.damage_multiplier = round(profile.damage_multiplier + 0.1, 4)
            profile.gold_multiplier = round(profile.gold_multiplier + 0.1, 4)
            profile.xp_multiplier = round(profile.xp_multiplier + 0.05, 4)

            # Increase IQ ceilings permanently by 15%
            profile.gf_ceiling = round(profile.gf_ceiling * 1.15, 2)
            profile.gc_ceiling = round(profile.gc_ceiling * 1.15, 2)
            profile.ps_ceiling = round(profile.ps_ceiling * 1.15, 2)
            profile.vm_ceiling = round(profile.vm_ceiling * 1.15, 2)

            profile.level = 1
            profile.xp = 0
            profile.xp_to_next_level = 100
            # Use computed max_hp property (SSOT: 100 + prestige_count * 50)
            # prestige_count already incremented above, so max_hp reflects the new level
            profile.hp = profile.max_hp
            profile.mana = 0
            profile.rank_xp = 0

            # Reset training tasks if they exist in the DB (safe check for 'rank' field)
            from api.models import Task

            task_fields = [f.name for f in Task._meta.get_fields()]
            if "rank" in task_fields:
                Task.objects.filter(user=request.user, task_type="training").update(
                    rank="F", value=0.0
                )

            # Unequip all inventory items
            profile.inventory_items.filter(is_equipped=True).update(is_equipped=False)
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
        from api.services.mechanics import calculate_task_outcome, apply_boss_damage
        from api.serializers.profile import UserProfileSerializer

        data = request.data
        hours = float(data.get("hours", 0))
        focus_rating = float(data.get("focus_rating", 5))
        mutator_multiplier = float(data.get("mutator_multiplier", 1.0))
        flat_xp_bonus = int(data.get("flat_xp_bonus", 0))
        activity = data.get("activity", "")

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
            "Math",
            "Physics",
            "Coding",
            "Chemistry",
            "Biology",
        }
        is_exercise = activity in EXERCISE_ACTIVITIES or task_category in {
            "Exercise",
            "Running",
        }
        is_language = activity in LANGUAGE_ACTIVITIES or task_category in {
            "English",
            "Languages",
            "History",
            "Philosophy",
        }
        is_prayer = activity in PRAYER_ACTIVITIES or task_category in {"Mindfulness"}

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            # Fetch passive modifiers from DB
            unlocked_skills = set(
                profile.unlocked_skills.values_list("skill_code", flat=True)
            )
            recruited_allies = {
                a.ally_code: a.level for a in profile.recruited_allies.all()
            }

            # Initialize multipliers (additive approach)
            xp_mult = 1.0
            gold_mult = 1.0
            gf_mult = 1.0
            gc_mult = 1.0
            ps_mult = 1.0
            vm_mult = 1.0
            boss_dmg_mult = 1.0
            gf_flat_bonus = 0.0

            # 1. Apply Skills
            if "sharp_focus" in unlocked_skills and focus_rating >= 8:
                xp_mult += 0.10

            if "iron_conditioning" in unlocked_skills and is_exercise:
                xp_mult += 0.15

            if "inner_stillness" in unlocked_skills and is_prayer:
                xp_mult += 0.20

            if "resource_awareness" in unlocked_skills:
                gold_mult += 0.10

            if "cognitive_supremacy" in unlocked_skills:
                gf_mult += 0.20
                gc_mult += 0.20
                ps_mult += 0.20
                vm_mult += 0.20

            if "encyclopedia" in unlocked_skills:
                gc_mult += 0.20

            if "apex_predator" in unlocked_skills:
                boss_dmg_mult += 0.30

            if "flow_state" in unlocked_skills:
                today = timezone.now().date()
                if profile.last_training_at != today:
                    xp_mult += 0.50  # +50% XP
                    profile.last_training_at = today

            # 2. Apply Allies
            # Kira
            kira_level = recruited_allies.get("kira", 0)
            if kira_level >= 1 and is_science:
                xp_mult += 0.05 if kira_level == 1 else 0.10
            if kira_level >= 3 and is_science:
                gf_flat_bonus += 0.002

            # Neko
            neko_level = recruited_allies.get("neko", 0)
            if neko_level >= 5:
                gold_mult += 0.15

            # Void
            void_level = recruited_allies.get("void", 0)
            if void_level >= 1:
                boss_dmg_mult += 0.50 if void_level == 5 else 0.10

            # Luna
            luna_level = recruited_allies.get("luna", 0)
            if luna_level >= 1 and is_exercise:
                xp_mult += 0.08

            # Sakura
            sakura_level = recruited_allies.get("sakura", 0)
            if sakura_level >= 1 and is_language:
                xp_mult += 0.10
            if sakura_level >= 2:
                gc_mult += 0.10
                vm_mult += 0.10
            if sakura_level >= 4:
                xp_mult += 0.08

            # Yuki
            yuki_level = recruited_allies.get("yuki", 0)
            if yuki_level >= 1:
                xp_mult += 0.08

            # Nene
            nene_level = recruited_allies.get("nene", 0)
            if nene_level >= 1 and is_prayer:
                xp_mult += 0.15
            if nene_level >= 4:
                gf_mult += 0.10
                gc_mult += 0.10
                ps_mult += 0.10
                vm_mult += 0.10

            # Update cognitive stats using difference (gain) and applying multipliers
            if "gf" in data:
                gf_gain = max(0.0, float(data["gf"]) - profile.gf)
                profile.gf = min(
                    profile.gf_ceiling, profile.gf + gf_gain * gf_mult + gf_flat_bonus
                )
            if "gc" in data:
                gc_gain = max(0.0, float(data["gc"]) - profile.gc)
                profile.gc = min(profile.gc_ceiling, profile.gc + gc_gain * gc_mult)
            if "ps" in data:
                ps_gain = max(0.0, float(data["ps"]) - profile.ps)
                profile.ps = min(profile.ps_ceiling, profile.ps + ps_gain * ps_mult)
            if "vm" in data:
                vm_gain = max(0.0, float(data["vm"]) - profile.vm)
                profile.vm = min(profile.vm_ceiling, profile.vm + vm_gain * vm_mult)

            if task:
                # [CRITICAL SAFETY CONDITIONS] Check against ZeroDivisionError
                def_hours = float(task.default_hours) if task.default_hours else 1.0
                if def_hours <= 0:
                    def_hours = 1.0
                def_focus = float(task.default_focus) if task.default_focus else 7.0
                if def_focus <= 0:
                    def_focus = 7.0

                scale = (hours / def_hours) * (focus_rating / def_focus)
                base_xp = (
                    (scale * task.xp_reward) * mutator_multiplier + flat_xp_bonus
                ) * xp_mult
                base_gold = (
                    (scale * task.gold_reward) * mutator_multiplier
                ) * gold_mult
                raw_boss_dmg = int(scale * task.boss_damage)

                # Increment completion stats for custom button tasks
                task.completion_count += 1
                task.last_completed_at = timezone.now()
                task.save()
            else:
                base_xp = (
                    (hours * focus_rating * 5) * mutator_multiplier + flat_xp_bonus
                ) * xp_mult
                base_gold = ((hours * 25) * mutator_multiplier) * gold_mult
                raw_boss_dmg = int(hours * focus_rating * 10)

            outcome = calculate_task_outcome(
                request.user,
                "training",
                base_xp=base_xp,
                base_gold=base_gold,
                is_positive=True,
            )

            final_xp = max(0, int(outcome["xp_earned"] * profile.xp_multiplier))
            final_gold = max(0, int(outcome["gold_earned"] * profile.gold_multiplier))

            gain_xp(profile, final_xp)
            profile.rank_xp = max(0, profile.rank_xp + final_xp)
            profile.gold = max(0, profile.gold + final_gold)

            # ── Create TrainingSession Record ──
            from api.models import TrainingSession

            TrainingSession.objects.create(
                user_profile=profile,
                activity_key=activity,
                hours=hours,
                focus_rating=focus_rating,
                efficiency=data.get("efficiency", 1.0),
                xp_earned=final_xp,
                gf_gain=gf_gain if "gf" in data else 0,
                gc_gain=gc_gain if "gc" in data else 0,
                ps_gain=ps_gain if "ps" in data else 0,
                vm_gain=vm_gain if "vm" in data else 0,
            )

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

            if combat_result and combat_result.get("boss_defeated"):
                profile.save()
                profile.refresh_from_db()
            else:
                profile.save()

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
            },
            status=status.HTTP_200_OK,
        )


class BuySkillView(generics.GenericAPIView):
    """
    POST /api/skills/buy/
    Buys a skill node.
    Payload: { "skill_code": "some_skill" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.rpg_service import buy_skill_node

        skill_code = request.data.get("skill_code")
        if not skill_code:
            return Response(
                {"detail": "skill_code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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


class RecruitAllyView(generics.GenericAPIView):
    """
    POST /api/allies/recruit/
    Recruits or upgrades an ally.
    Payload: { "ally_code": "some_ally" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from api.services.rpg_service import recruit_ally

        ally_code = request.data.get("ally_code")
        if not ally_code:
            return Response(
                {"detail": "ally_code is required."}, status=status.HTTP_400_BAD_REQUEST
            )
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

                if reset_type in ["tasks", "nuclear"]:
                    Task.objects.filter(user=request.user).delete()
                    profile.rank_xp = 0

                if reset_type in ["stats", "nuclear"]:
                    profile.mana = 0
                    profile.mana_max = 100
                    profile.gold = 0
                    profile.level = 1
                    profile.xp = 0
                    profile.xp_to_next_level = 100
                    profile.rank_xp = 0
                    profile.prestige_count = 0
                    profile.hp = profile.max_hp
                    profile.character_class = ""
                    profile.initialized = False
                    profile.skill_points = 0
                    profile.unspent_stat_points = 0
                    profile.streak = 0

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

                    profile.gf_ceiling = 120.0
                    profile.gc_ceiling = 135.0
                    profile.ps_ceiling = 115.0
                    profile.vm_ceiling = 125.0

                    profile.damage_multiplier = 1.0
                    profile.gold_multiplier = 1.0
                    profile.xp_multiplier = 1.0

                    ActiveEffect.objects.filter(user=request.user).delete()
                    SkillCooldown.objects.filter(user=request.user).delete()
                    BossEncounter.objects.filter(user=request.user).delete()
                    TrainingSession.objects.filter(user_profile=profile).delete()

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

                if reset_type == "nuclear":
                    InventoryItem.objects.filter(user_profile=profile).delete()
                    profile.unlocked_skills.all().delete()
                    profile.recruited_allies.all().delete()
                    UserAchievement.objects.filter(user=request.user).delete()

                profile.save()

            # Token invalidation STRICTLY AFTER successful db transaction commit
            if reset_type == "nuclear":
                try:
                    tokens = OutstandingToken.objects.filter(user=request.user)  # type: ignore
                    for token in tokens:
                        BlacklistedToken.objects.get_or_create(token=token)  # type: ignore
                except Exception as jwt_error:
                    logger.warning(f"Failed to blacklist tokens: {jwt_error}")

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
