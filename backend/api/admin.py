"""
MIND OS — регистрация моделей в Django-админке.
"""

from django.contrib import admin
from django.db.models import Count
from .models import UserProfile, Task, FeatureEvent


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Профиль персонажа в админ-панели."""

    list_display = ("user", "level", "xp", "gold", "hp", "mana", "character_class")
    list_filter = ("level", "character_class")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")

    # Разбиваем поля на логические секции
    fieldsets = (
        ("Пользователь", {"fields": ("user", "avatar", "character_class")}),
        (
            "Характеристики",
            {
                "fields": (
                    ("hp",),
                    ("mana", "mana_max"),
                    "gold",
                )
            },
        ),
        ("Прогресс", {"fields": (("level", "xp", "xp_to_next_level"),)}),
        (
            "Метаданные",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),  # Скрыта по умолчанию
            },
        ),
    )


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Задачи пользователей в админ-панели."""

    list_display = (
        "title",
        "user",
        "task_type",
        "difficulty",
        "order",
        "is_completed",
        "completion_count",
        "due_date",
        "created_at",
    )
    list_filter = ("task_type", "difficulty", "is_completed")
    search_fields = ("title", "notes", "user__username")
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_completed_at",
        "completion_count",
    )
    date_hierarchy = "created_at"  # Навигация по датам
    list_editable = ("is_completed", "order")  # Быстрое редактирование в списке

    fieldsets = (
        ("Основное", {"fields": ("user", "task_type", "title", "notes")}),
        ("Параметры", {"fields": ("difficulty", "value", "order", "due_date")}),
        (
            "Прогресс",
            {
                "fields": ("is_completed", "last_completed_at", "completion_count"),
            },
        ),
        (
            "Метаданные",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(FeatureEvent)
class FeatureEventAdmin(admin.ModelAdmin):
    """События аналитики фич в админке."""

    change_list_template = "admin/api/featureevent/change_list.html"

    list_display = ("user", "event_name", "timestamp")
    list_filter = ("event_name", "timestamp")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("timestamp",)

    def changelist_view(self, request, extra_context=None):
        # Calculate aggregate counts
        counts = (
            FeatureEvent.objects.values("event_name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        extra_context = extra_context or {}
        extra_context["event_counts"] = counts

        return super().changelist_view(request, extra_context=extra_context)
