"""
MIND OS — модели базы данных.

Схема:
  User (встроенная Django-модель)
   └── UserProfile (1:1) — характеристики персонажа (HP, Mana, Gold, Level, XP)

  Task — задачи пользователя (привычки, дейлики, туду)
"""

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


# ─────────────────────────────────────────────────────────────────────────────
# Профиль персонажа
# ─────────────────────────────────────────────────────────────────────────────

class UserProfile(models.Model):
    """
    Расширяет встроенную модель User характеристиками персонажа MIND OS.
    Создаётся автоматически при регистрации нового пользователя (сигнал post_save).
    """

    # Связь один-к-одному с пользователем Django
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,       # При удалении User — удаляется и Profile
        related_name="profile",
        verbose_name="Пользователь",
    )

    # ── Характеристики персонажа ──────────────────────────────────────────

    # Здоровье (Hit Points): текущее и максимальное
    hp = models.PositiveIntegerField(default=100, verbose_name="HP (текущее)")
    hp_max = models.PositiveIntegerField(default=100, verbose_name="HP (максимум)")

    # Мана: текущая и максимальная
    mana = models.PositiveIntegerField(default=50, verbose_name="Мана (текущая)")
    mana_max = models.PositiveIntegerField(default=50, verbose_name="Мана (максимум)")

    # Золото (внутриигровая валюта)
    gold = models.PositiveIntegerField(default=0, verbose_name="Золото")

    # Уровень персонажа
    level = models.PositiveIntegerField(default=1, verbose_name="Уровень")

    # Опыт: текущий и необходимый для следующего уровня
    xp = models.PositiveIntegerField(default=0, verbose_name="Опыт (текущий)")
    xp_to_next_level = models.PositiveIntegerField(
        default=100,
        verbose_name="Опыт до следующего уровня",
    )

    # Аватар персонажа (опционально)
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        verbose_name="Аватар",
    )

    # Класс/раса персонажа (расширяется по мере развития игры)
    character_class = models.CharField(
        max_length=50,
        default="Путник",
        verbose_name="Класс персонажа",
    )

    # ── Когнитивные метрики (IQ) ──────────────────────────────────────────
    gf = models.FloatField(default=100.0, verbose_name="Fluid Intelligence (Gf)")
    gc = models.FloatField(default=100.0, verbose_name="Crystallized Intelligence (Gc)")
    ps = models.FloatField(default=100.0, verbose_name="Processing Speed (Ps)")
    vm = models.FloatField(default=100.0, verbose_name="Verbal Memory (Vm)")

    gf_ceiling = models.FloatField(default=120.0, verbose_name="Gf Ceiling")
    gc_ceiling = models.FloatField(default=135.0, verbose_name="Gc Ceiling")
    ps_ceiling = models.FloatField(default=112.0, verbose_name="Ps Ceiling")
    vm_ceiling = models.FloatField(default=138.0, verbose_name="Vm Ceiling")

    # Временны́е метки
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Профиль персонажа"
        verbose_name_plural = "Профили персонажей"

    def __str__(self):
        return f"Профиль {self.user.username} | Ур.{self.level} ({self.xp}/{self.xp_to_next_level} XP)"

    def gain_xp(self, amount: int) -> bool:
        """
        Начислить опыт персонажу.
        Возвращает True, если произошёл level-up.
        """
        self.xp += amount
        leveled_up = False

        # Проверяем, не достиг ли персонаж нового уровня
        while self.xp >= self.xp_to_next_level:
            self.xp -= self.xp_to_next_level
            self.level += 1
            # Формула масштабирования: каждый уровень требует на 50 XP больше
            self.xp_to_next_level = int(self.xp_to_next_level * 1.5)
            # Бонусы при level-up
            self.hp_max += 10
            self.hp = self.hp_max          # Восстанавливаем HP при повышении уровня
            self.mana_max += 5
            leveled_up = True

        self.save()
        return leveled_up


# ─────────────────────────────────────────────────────────────────────────────
# Сигнал: автоматически создаём UserProfile при создании User
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Создаёт UserProfile при регистрации нового пользователя."""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Сохраняет UserProfile при сохранении User."""
    # hasattr — защита от случая, когда профиль ещё не создан
    if hasattr(instance, "profile"):
        instance.profile.save()


# ─────────────────────────────────────────────────────────────────────────────
# Задачи (Tasks)
# ─────────────────────────────────────────────────────────────────────────────

class Task(models.Model):
    """
    Задача пользователя в системе MIND OS.
    Поддерживает три типа: Привычка (habit), Дейлик (daily), Туду (todo).
    """

    class TaskType(models.TextChoices):
        """Перечисление типов задач."""
        HABIT = "habit", "Привычка"     # Повторяющееся действие без дедлайна
        DAILY = "daily", "Дейлик"       # Ежедневная задача (сбрасывается каждый день)
        TODO  = "todo",  "Туду"         # Разовая задача с возможным дедлайном

    class Difficulty(models.TextChoices):
        """Сложность задачи — влияет на количество XP и Gold при выполнении."""
        TRIVIAL = "trivial", "Тривиальная"  # XP: 1,   Gold: 1
        EASY    = "easy",    "Лёгкая"       # XP: 5,   Gold: 3
        MEDIUM  = "medium",  "Средняя"      # XP: 15,  Gold: 7
        HARD    = "hard",    "Сложная"      # XP: 40,  Gold: 15

    # ── Связь с пользователем ─────────────────────────────────────────────
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name="Пользователь",
    )

    # ── Основные поля ─────────────────────────────────────────────────────

    # Тип задачи
    task_type = models.CharField(
        max_length=10,
        choices=TaskType.choices,
        default=TaskType.TODO,
        verbose_name="Тип задачи",
    )

    # Название задачи
    title = models.CharField(max_length=255, verbose_name="Название")

    # Подробное описание (опционально)
    notes = models.TextField(blank=True, default="", verbose_name="Заметки")

    # Сложность — влияет на награды
    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
        verbose_name="Сложность",
    )

    # Числовое значение сложности (для кастомных наград)
    value = models.FloatField(
        default=1.0,
        verbose_name="Значение сложности",
        help_text="Множитель наград: 1.0 = норма, 2.0 = двойная награда",
    )

    # ── Состояние задачи ──────────────────────────────────────────────────

    # Выполнена ли задача (для TODO)
    is_completed = models.BooleanField(default=False, verbose_name="Выполнено")

    # Дата выполнения дейлика (для сброса статуса)
    last_completed_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name="Последнее выполнение",
    )

    # Дедлайн (только для TODO, опционально)
    due_date = models.DateField(
        null=True, blank=True,
        verbose_name="Дедлайн",
    )

    # Счётчик выполнений (особенно полезен для привычек)
    completion_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Количество выполнений",
    )

    # Порядок отображения в списке
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    # ── Временны́е метки ──────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Задача"
        verbose_name_plural = "Задачи"
        # По умолчанию сортируем: сначала порядок, потом дата создания
        ordering = ["order", "-created_at"]

    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"[{status}] {self.get_task_type_display()}: {self.title} ({self.user.username})"

    # ── Таблица наград по сложности ───────────────────────────────────────
    REWARD_TABLE = {
        Difficulty.TRIVIAL: {"xp": 1,  "gold": 1},
        Difficulty.EASY:    {"xp": 5,  "gold": 3},
        Difficulty.MEDIUM:  {"xp": 15, "gold": 7},
        Difficulty.HARD:    {"xp": 40, "gold": 15},
    }

    def get_rewards(self) -> dict:
        """
        Возвращает словарь с наградами за выполнение задачи.
        Учитывает числовой множитель value.
        """
        base = self.REWARD_TABLE.get(self.difficulty, {"xp": 10, "gold": 5})
        return {
            "xp":   int(base["xp"]   * self.value),
            "gold": int(base["gold"] * self.value),
        }
