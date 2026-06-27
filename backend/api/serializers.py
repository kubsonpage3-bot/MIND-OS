"""
MIND OS — сериализаторы DRF.
Преобразуют модели Django в JSON и обратно.

Сериализаторы:
  RegisterSerializer     — регистрация нового пользователя
  UserSerializer         — базовые данные пользователя (read-only)
  UserProfileSerializer  — характеристики персонажа
  TaskSerializer         — задачи пользователя (CRUD)
  TaskCompleteSerializer — эндпоинт выполнения задачи (action)
"""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserProfile, Task


# ─────────────────────────────────────────────────────────────────────────────
# Аутентификация
# ─────────────────────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """
    Сериализатор для регистрации нового пользователя.
    Принимает: username, email, password, password2 (подтверждение).
    """

    # Поле подтверждения пароля — только для записи, в БД не хранится
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],     # Применяем Django-валидаторы паролей
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        label="Подтверждение пароля",
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password2")
        extra_kwargs = {
            "email": {"required": True},
        }

    def validate(self, attrs):
        """Проверяем, что оба пароля совпадают."""
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Пароли не совпадают."}
            )
        return attrs

    def create(self, validated_data):
        """Создаём пользователя через create_user — он хешует пароль."""
        validated_data.pop("password2")     # Убираем дублирующее поле
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Базовые данные пользователя (используется в профиле)."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "date_joined")
        read_only_fields = fields   # Только для чтения


# ─────────────────────────────────────────────────────────────────────────────
# Профиль персонажа
# ─────────────────────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Сериализатор профиля персонажа MIND OS.
    Вложен в ответы API как объект 'profile'.
    """

    # Включаем данные пользователя (вложенный объект, только для чтения)
    user = UserSerializer(read_only=True)

    # Вычисляемое поле: процент заполнения полоски XP
    xp_progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "id",
            "user",
            "hp", "hp_max",
            "mana", "mana_max",
            "gold",
            "level", "xp", "xp_to_next_level",
            "xp_progress_percent",      # вычисляемое поле
            "character_class",
            "avatar",
            "gf", "gc", "ps", "vm",
            "gf_ceiling", "gc_ceiling", "ps_ceiling", "vm_ceiling",
            "created_at",
            "updated_at",
        )
        # Эти поля нельзя изменить напрямую через API — они меняются через игровую логику
        read_only_fields = (
            "id", "user", "level", "xp", "xp_to_next_level",
            "xp_progress_percent", "created_at", "updated_at",
        )

    def get_xp_progress_percent(self, obj) -> int:
        """Возвращает % заполнения XP-бара (0–100)."""
        if obj.xp_to_next_level == 0:
            return 100
        return int((obj.xp / obj.xp_to_next_level) * 100)


# ─────────────────────────────────────────────────────────────────────────────
# Задачи
# ─────────────────────────────────────────────────────────────────────────────

class TaskSerializer(serializers.ModelSerializer):
    """
    Сериализатор задач — поддерживает создание, чтение, обновление и удаление.
    Поле 'user' устанавливается автоматически из request.user, не из запроса.
    """

    # Читаемые названия для choices-полей
    task_type_display  = serializers.CharField(source="get_task_type_display",  read_only=True)
    difficulty_display = serializers.CharField(source="get_difficulty_display", read_only=True)

    # Вычисляемые награды за выполнение задачи
    rewards = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "task_type",        "task_type_display",
            "title",
            "notes",
            "difficulty",       "difficulty_display",
            "value",
            "is_completed",
            "last_completed_at",
            "due_date",
            "completion_count",
            "order",
            "rewards",
            "created_at",
            "updated_at",
        )
        # user устанавливается во ViewSet.perform_create — нельзя задать вручную
        read_only_fields = (
            "id",
            "task_type_display",
            "difficulty_display",
            "last_completed_at",
            "completion_count",
            "rewards",
            "created_at",
            "updated_at",
        )

    def get_rewards(self, obj) -> dict:
        """Возвращает словарь с ожидаемыми наградами за задачу."""
        return obj.get_rewards()

    def validate_value(self, value):
        """Значение сложности должно быть положительным числом."""
        if value <= 0:
            raise serializers.ValidationError(
                "Значение сложности должно быть больше нуля."
            )
        return value


class TaskCompleteSerializer(serializers.Serializer):
    """
    Минимальный сериализатор для эндпоинта 'complete'.
    Подтверждает выполнение задачи и возвращает начисленные награды.
    """

    # Флаг направления для привычек: True = положительное, False = отрицательное
    is_positive = serializers.BooleanField(
        default=True,
        help_text="Для привычек: True = выполнить позитивное действие, False = нарушение",
    )
