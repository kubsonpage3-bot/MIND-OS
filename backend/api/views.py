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

from django.utils import timezone
from rest_framework import viewsets, generics, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

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
from .models import ActiveEffect, SkillCooldown
from .serializers import ActiveEffectSerializer, SkillActivateSerializer, SkillCooldownSerializer, ShopBuySerializer
from api.services.task_service import complete_task
from api.services.skill_service import activate_skill
from api.services.shop_service import buy_item
from api.services.crafting_service import craft_item
from api.exceptions import GameLogicError


# ─────────────────────────────────────────────────────────────────────────────
# Аутентификация
# ─────────────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Регистрация нового пользователя. Доступна без токена.
    """
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]     # Регистрация открыта всем

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "detail": "Account successfully created. Please log in via /api/auth/token/",
                "user": {
                    "id":       user.id,
                    "username": user.username,
                    "email":    user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Профиль персонажа
# ─────────────────────────────────────────────────────────────────────────────

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
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        if not created:
            profile = UserProfile.objects.prefetch_related("inventory_items__item__effects").get(user=self.request.user)
        return profile


# ─────────────────────────────────────────────────────────────────────────────
# Задачи — CRUD + кастомный action "complete"
# ─────────────────────────────────────────────────────────────────────────────

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
    permission_classes = [IsAuthenticated]      # Только авторизованные!

    # Подключаем фильтрацию, поиск и сортировку
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
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
        detail=True,            # Требует {id} в URL
        methods=["post"],       # Только POST
        url_path="complete",    # URL: /api/tasks/{id}/complete/
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
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"detail": str(e.detail[0] if hasattr(e, 'detail') else e)},
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

        return Response({
            "detail": message,
            "class_data": class_data,
            "active_effects": effects,
            "profile": UserProfileSerializer(profile).data,
        })


class ActiveEffectsView(generics.GenericAPIView):
    """
    GET /api/skills/active-effects/
    Возвращает активные эффекты и кулдауны текущего пользователя.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        # Чистим истекшие
        ActiveEffect.objects.filter(user=request.user, expires_at__lt=timezone.now()).delete()
        SkillCooldown.objects.filter(user=request.user, cooldown_until__lt=timezone.now()).delete()

        effects = ActiveEffect.objects.filter(user=request.user)
        cooldowns = SkillCooldown.objects.filter(user=request.user)

        return Response({
            "active_effects": ActiveEffectSerializer(effects, many=True).data,
            "cooldowns": SkillCooldownSerializer(cooldowns, many=True).data,
        })


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
        cost = serializer.validated_data["cost"]
        heal_amount = serializer.validated_data.get("heal_amount", 0)
        is_consumable = serializer.validated_data.get("is_consumable", False)

        success, message, profile = buy_item(
            request.user, item_id, cost, heal_amount, is_consumable
        )

        if not success:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        from .serializers import UserProfileSerializer
        return Response({
            "detail": message,
            "profile": UserProfileSerializer(profile).data,
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Combat System
# ─────────────────────────────────────────────────────────────────────────────
from .models import Boss, BossEncounter
from .serializers import BossSerializer, BossEncounterSerializer, BossSummonSerializer

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
        cost = serializer.validated_data["cost"]

        from django.db import transaction
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            
            if profile.gold < cost:
                return Response({"detail": "Not enough gold."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Check for active encounters
            active_encounter = BossEncounter.objects.filter(user=request.user, is_defeated=False).first()
            if active_encounter:
                return Response({"detail": f"You already have an active boss: {active_encounter.boss.name}"}, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                boss = Boss.objects.get(id_name=boss_id)
            except Boss.DoesNotExist:
                return Response({"detail": "Boss template not found."}, status=status.HTTP_404_NOT_FOUND)
                
            profile.gold -= cost
            profile.save()
            
            # Apply difficulty multipliers
            difficulty = profile.boss_difficulty
            multipliers = {
                "EASY": {"hp": 0.5, "reward": 0.8},
                "NORMAL": {"hp": 1.0, "reward": 1.0},
                "HARD": {"hp": 2.0, "reward": 1.5},
                "EXTREME": {"hp": 5.0, "reward": 2.5}
            }
            mult = multipliers.get(difficulty, multipliers["NORMAL"])
            
            # Create encounter
            encounter = BossEncounter.objects.create(
                user=request.user,
                boss=boss,
                hp_current=int(boss.hp_max * mult["hp"]),
                reward_multiplier=mult["reward"]
            )
            
        return Response({
            "detail": f"Summoned {boss.name}!",
            "encounter": BossEncounterSerializer(encounter).data,
            "profile": UserProfileSerializer(profile).data
        }, status=status.HTTP_201_CREATED)


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
        from django.db import transaction
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            try:
                inv_item = InventoryItem.objects.select_related("item").get(
                    user_profile=profile, item__code=item_code
                )
            except InventoryItem.DoesNotExist:
                return Response({"detail": "Item not in inventory."}, status=status.HTTP_404_NOT_FOUND)

            inv_item.is_equipped = not inv_item.is_equipped
            inv_item.save(update_fields=["is_equipped"])

        profile_fresh = UserProfile.objects.prefetch_related("inventory_items__item__effects").get(user=request.user)
        return Response({
            "detail": f"{'Equipped' if inv_item.is_equipped else 'Unequipped'} {inv_item.item.name}.",
            "profile": UserProfileSerializer(profile_fresh).data,
        }, status=status.HTTP_200_OK)


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
        from django.db import transaction
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            if profile.level < 10:
                return Response(
                    {"detail": "You must reach level 10 to prestige."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            profile.prestige_count += 1
            profile.damage_multiplier = round(profile.damage_multiplier + 0.1, 4)
            profile.gold_multiplier = round(profile.gold_multiplier + 0.1, 4)
            profile.xp_multiplier = round(profile.xp_multiplier + 0.05, 4)
            profile.level = 1
            profile.xp = 0
            profile.xp_to_next_level = 100
            profile.hp = profile.hp_max
            profile.mana = profile.mana_max
            profile.save()

        return Response({
            "detail": f"Prestige {profile.prestige_count} unlocked! Permanent bonuses applied.",
            "profile": UserProfileSerializer(profile).data,
        }, status=status.HTTP_200_OK)


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
        from .models import Task
        recent = Task.objects.filter(
            user=request.user,
            is_completed=True
        ).order_by("-updated_at")[:20]
        return Response({
            "log": TaskSerializer(recent, many=True).data
        }, status=status.HTTP_200_OK)


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
    queryset = Recipe.objects.prefetch_related("ingredients__item").select_related("result_item").all()
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

        profile = UserProfile.objects.prefetch_related("inventory_items__item__effects").get(user=request.user)
        return Response({
            "detail": f"Crafted {result_item.name} successfully!",
            "item": ItemSerializer(result_item).data,
            "profile": UserProfileSerializer(profile).data,
        }, status=status.HTTP_201_CREATED)
