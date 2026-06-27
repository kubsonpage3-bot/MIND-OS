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

from .models import UserProfile, Task
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    TaskSerializer,
    TaskCompleteSerializer,
)


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
                "detail": "Аккаунт успешно создан. Теперь войдите через /api/auth/token/",
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
        """Возвращаем профиль текущего авторизованного пользователя."""
        # get_or_create — страховка, если профиль не создался сигналом
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
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

        Логика по типам:
          - TODO:   is_completed = True (однократно)
          - DAILY:  last_completed_at = now() (сбрасывается каждый день)
          - HABIT:  completion_count++ (бесконечно)
        """
        task = self.get_object()    # get_object уже проверяет принадлежность user'у

        # Валидируем входные данные (только is_positive для привычек)
        serializer = TaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        rewards = task.get_rewards()

        # ── Логика по типу задачи ─────────────────────────────────────────

        if task.task_type == Task.TaskType.TODO:
            # Туду нельзя выполнить дважды
            if task.is_completed:
                return Response(
                    {"detail": "Задача уже выполнена."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task.is_completed = True
            task.last_completed_at = timezone.now()
            task.completion_count += 1

        elif task.task_type == Task.TaskType.DAILY:
            # Проверяем, не выполнялся ли дейлик уже сегодня
            today = timezone.now().date()
            if task.last_completed_at and task.last_completed_at.date() == today:
                return Response(
                    {"detail": "Дейлик уже выполнен сегодня."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task.last_completed_at = timezone.now()
            task.completion_count += 1

        elif task.task_type == Task.TaskType.HABIT:
            # Привычки не имеют статуса "выполнено" — просто считаем
            task.completion_count += 1
            # Если привычка отрицательная — снимаем HP вместо начисления наград
            if not serializer.validated_data.get("is_positive", True):
                profile.hp = max(0, profile.hp - 5)    # Штраф: -5 HP
                profile.save()
                task.save()
                return Response(
                    {
                        "detail": "Отмечено нарушение привычки.",
                        "penalty": {"hp": -5},
                        "profile": UserProfileSerializer(profile).data,
                    },
                    status=status.HTTP_200_OK,
                )

        task.save()

        # ── Начисляем награды персонажу ───────────────────────────────────
        leveled_up = profile.gain_xp(rewards["xp"])
        profile.gold += rewards["gold"]
        profile.save()

        return Response(
            {
                "detail":    "Задача выполнена!",
                "leveled_up": leveled_up,
                "rewards":   rewards,
                "task":      TaskSerializer(task).data,
                "profile":   UserProfileSerializer(profile).data,
            },
            status=status.HTTP_200_OK,
        )
