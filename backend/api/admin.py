"""
MIND OS — регистрация моделей в Django-админке.
"""

from django.contrib import admin
from .models import UserProfile, Task


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Профиль персонажа в админ-панели."""
    list_display  = ("user", "level", "xp", "gold", "hp", "mana", "character_class")
    list_filter   = ("level", "character_class")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")

    # Разбиваем поля на логические секции
    fieldsets = (
        ("Пользователь", {"fields": ("user", "avatar", "character_class")}),
        ("Характеристики", {
            "fields": (
                ("hp", "hp_max"),
                ("mana", "mana_max"),
                "gold",
            )
        }),
        ("Прогресс", {
            "fields": (("level", "xp", "xp_to_next_level"),)
        }),
        ("Метаданные", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),       # Скрыта по умолчанию
        }),
    )


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Задачи пользователей в админ-панели."""
    list_display  = (
        "title", "user", "task_type", "difficulty", "order",
        "is_completed", "completion_count", "due_date", "created_at",
    )
    list_filter   = ("task_type", "difficulty", "is_completed")
    search_fields = ("title", "notes", "user__username")
    readonly_fields = ("created_at", "updated_at", "last_completed_at", "completion_count")
    date_hierarchy = "created_at"       # Навигация по датам
    list_editable = ("is_completed", "order")   # Быстрое редактирование в списке

    fieldsets = (
        ("Основное", {"fields": ("user", "task_type", "title", "notes")}),
        ("Параметры", {"fields": ("difficulty", "value", "order", "due_date")}),
        ("Прогресс", {
            "fields": ("is_completed", "last_completed_at", "completion_count"),
        }),
        ("Метаданные", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
