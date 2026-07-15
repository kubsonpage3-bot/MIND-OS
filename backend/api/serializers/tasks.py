from api.models import TrainingSession
from rest_framework import serializers
from api.models import Task
from .profile import UserProfileSerializer


class TaskSerializer(serializers.ModelSerializer):
    """
    Сериализатор задач — поддерживает создание, чтение, обновление и удаление.
    Поле 'user' устанавливается автоматически из request.user, не из запроса.
    """

    task_type_display = serializers.CharField(
        source="get_task_type_display", read_only=True
    )
    difficulty_display = serializers.CharField(
        source="get_difficulty_display", read_only=True
    )
    rewards = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "task_type",
            "task_type_display",
            "title",
            "notes",
            "difficulty",
            "difficulty_display",
            "value",
            "is_completed",
            "last_completed_at",
            "due_date",
            "completion_count",
            "streak",
            "pos_streak",
            "neg_streak",
            "order",
            "rewards",
            "category",
            "mastery_category",
            "icon",
            "scheduled_time",
            "scheduled_end_time",
            "show_in_calendar",
            "repeat_weekdays",
            "default_hours",
            "default_focus",
            "xp_reward",
            "gold_reward",
            "boss_damage",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "task_type_display",
            "difficulty_display",
            "last_completed_at",
            "completion_count",
            "streak",
            "pos_streak",
            "neg_streak",
            "rewards",
            "created_at",
            "updated_at",
        )

    def get_rewards(self, obj) -> dict:
        """Возвращает словарь с ожидаемыми наградами за задачу."""
        return obj.get_rewards()

    def validate_value(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Difficulty value must be greater than zero."
            )
        return value

    def validate_repeat_weekdays(self, value):
        if value == 0:
            raise serializers.ValidationError("At least one weekday must be selected.")
        return value

    def validate(self, attrs):
        scheduled_time = attrs.get("scheduled_time", getattr(self.instance, "scheduled_time", None) if self.instance else None)
        scheduled_end_time = attrs.get("scheduled_end_time", getattr(self.instance, "scheduled_end_time", None) if self.instance else None)

        if scheduled_time and scheduled_end_time:
            if scheduled_end_time <= scheduled_time:
                raise serializers.ValidationError(
                    {"scheduled_end_time": "Scheduled end time must be after start time."}
                )
        if scheduled_end_time and not scheduled_time:
            raise serializers.ValidationError(
                {"scheduled_time": "Scheduled start time is required if end time is set."}
            )
        return attrs


class TaskCompleteSerializer(serializers.Serializer):
    """
    Минимальный сериализатор для эндпоинта 'complete'.
    Подтверждает выполнение задачи и возвращает начисленные награды.
    """

    is_positive = serializers.BooleanField(
        default=True,
        help_text="Для привычек: True = выполнить позитивное действие, False = нарушение",  # noqa: E501
    )


class RewardsSerializer(serializers.Serializer):
    xp = serializers.IntegerField()
    gold = serializers.IntegerField()


class PenaltySerializer(serializers.Serializer):
    hp = serializers.FloatField(required=False, allow_null=True)


class CombatResultSerializer(serializers.Serializer):
    damage_dealt = serializers.IntegerField()
    boss_hp_remaining = serializers.IntegerField()
    boss_defeated = serializers.BooleanField()
    rewards = serializers.DictField(required=False, allow_null=True)
    effect_notes = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )


class TaskCompleteResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    leveled_up = serializers.BooleanField()
    skill_effects = serializers.ListField(
        child=serializers.DictField(), required=False, allow_null=True
    )
    rewards = RewardsSerializer()
    task = TaskSerializer()
    profile = UserProfileSerializer()
    gamification_result = serializers.DictField(required=False, allow_null=True)
    combat = CombatResultSerializer(required=False, allow_null=True)
    penalty = PenaltySerializer(required=False, allow_null=True)
    xp_earned = serializers.IntegerField()
    gold_earned = serializers.IntegerField()
    mana_gained = serializers.IntegerField()
    died = serializers.BooleanField()


class TrainingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSession
        fields = "__all__"
