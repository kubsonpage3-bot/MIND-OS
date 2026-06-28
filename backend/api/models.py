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

    objects = models.Manager()

    # Связь один-к-одному с пользователем Django
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,  # При удалении User — удаляется и Profile
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

    # Инвентарь теперь реализован через реляционную модель InventoryItem (см. ниже)

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
        default="Wanderer",
        verbose_name="Character class",
    )

    # Уровень престижа
    prestige_count = models.PositiveIntegerField(default=0, verbose_name="Престиж")

    # Престиж-множители (перманентные бонусы)
    damage_multiplier = models.FloatField(default=1.0, verbose_name="Множитель урона")
    gold_multiplier = models.FloatField(default=1.0, verbose_name="Множитель золота")
    xp_multiplier = models.FloatField(default=1.0, verbose_name="Множитель опыта")
    rank_xp: int = models.PositiveIntegerField(
        default=0, verbose_name="Опыт ранга (Rank XP)"
    )
    last_daily_cron_at = models.DateField(
        null=True, blank=True, verbose_name="Последний крон дейликов"
    )

    # ── Базовые характеристики (RPG Stats) ───────────────────────────────
    base_pwr: int = models.PositiveIntegerField(default=5, verbose_name="Power (PWR)")
    base_foc: int = models.PositiveIntegerField(default=5, verbose_name="Focus (FOC)")
    base_spd: int = models.PositiveIntegerField(default=5, verbose_name="Speed (SPD)")
    base_lck: int = models.PositiveIntegerField(default=5, verbose_name="Luck (LCK)")
    base_def: int = models.PositiveIntegerField(default=5, verbose_name="Defense (DEF)")
    base_mem: int = models.PositiveIntegerField(default=5, verbose_name="Memory (MEM)")
    unspent_stat_points: int = models.PositiveIntegerField(
        default=0, verbose_name="Нераспределённые очки характеристик"
    )

    # Настройки сложности боссов
    class BossDifficulty(models.TextChoices):
        EASY = "EASY", "Easy"
        NORMAL = "NORMAL", "Normal"
        HARD = "HARD", "Hard"
        EXTREME = "EXTREME", "Extreme"

    boss_difficulty = models.CharField(
        max_length=20,
        choices=BossDifficulty.choices,
        default=BossDifficulty.NORMAL,
        verbose_name="Сложность боссов",
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

    @property
    def equip_stats(self) -> dict:
        """
        SSOT: Считает суммарные бонусы от ВСЕГО экипированного снаряжения.
        Возвращает словарь с агрегированными бустами.
        """
        totals = {
            "damage_boost": 0.0,
            "gold_boost": 0.0,
            "xp_boost": 0.0,
            "hp_boost": 0,
            "mana_boost": 0,
        }
        equipped = self.inventory_items.filter(is_equipped=True).select_related("item")
        for inv in equipped:
            totals["damage_boost"] += inv.item.damage_boost
            totals["gold_boost"] += inv.item.gold_boost
            totals["xp_boost"] += inv.item.xp_boost
            totals["hp_boost"] += inv.item.hp_boost
            totals["mana_boost"] += inv.item.mana_boost
        return totals

    @property
    def total_stats(self) -> dict:
        """
        SSOT: Возвращает итоговые характеристики персонажа
        (базовые + бонусы от снаряжения + престиж-множители).
        """
        equip = self.equip_stats
        return {
            "pwr": self.base_pwr,
            "foc": self.base_foc,
            "spd": self.base_spd,
            "lck": self.base_lck,
            "def": self.base_def,
            "mem": self.base_mem,
            "damage_multiplier": round(self.damage_multiplier + equip["damage_boost"], 4),
            "gold_multiplier": round(self.gold_multiplier + equip["gold_boost"], 4),
            "xp_multiplier": round(self.xp_multiplier + equip["xp_boost"], 4),
            "hp_max": self.hp_max + equip["hp_boost"],
            "mana_max": self.mana_max + equip["mana_boost"],
        }

    def save(self, *args, **kwargs):
        # Если здоровье опускается до 0, автоматически запускаем понижение ранга
        if self.hp == 0:
            self.hp = self.hp_max

            RANK_THRESHOLDS = [
                {"id": "F", "min": 0},
                {"id": "D", "min": 50},
                {"id": "C", "min": 150},
                {"id": "B", "min": 400},
                {"id": "A", "min": 800},
                {"id": "S", "min": 1500},
                {"id": "SS", "min": 2500},
                {"id": "SSS", "min": 4000},
            ]

            current_rank_idx = 0
            for i, r in enumerate(RANK_THRESHOLDS):
                if self.rank_xp >= r["min"]:
                    current_rank_idx = i

            if current_rank_idx > 0:
                new_rank_idx = current_rank_idx - 1
                self.rank_xp = RANK_THRESHOLDS[new_rank_idx]["min"]
            else:
                self.rank_xp = 0

        super().save(*args, **kwargs)


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

        HABIT = "habit", "Привычка"  # Повторяющееся действие без дедлайна
        DAILY = "daily", "Дейлик"  # Ежедневная задача (сбрасывается каждый день)
        TODO = "todo", "Туду"  # Разовая задача с возможным дедлайном

    class Difficulty(models.TextChoices):
        """Сложность задачи — влияет на количество XP и Gold при выполнении."""

        TRIVIAL = "trivial", "Тривиальная"  # XP: 1,   Gold: 1
        EASY = "easy", "Лёгкая"  # XP: 5,   Gold: 3
        MEDIUM = "medium", "Средняя"  # XP: 15,  Gold: 7
        HARD = "hard", "Сложная"  # XP: 40,  Gold: 15

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
    value: float = models.FloatField(
        default=1.0,
        verbose_name="Значение сложности",
        help_text="Множитель наград: 1.0 = норма, 2.0 = двойная награда",
    )

    # ── Состояние задачи ──────────────────────────────────────────────────

    # Выполнена ли задача (для TODO)
    is_completed: bool = models.BooleanField(default=False, verbose_name="Выполнено")

    # Дата выполнения дейлика (для сброса статуса)
    last_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Последнее выполнение",
    )

    # Дедлайн (только для TODO, опционально)
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Дедлайн",
    )

    # Счётчик выполнений (особенно полезен для привычек)
    completion_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Количество выполнений",
    )

    # Серии выполнений (стрики)
    streak = models.PositiveIntegerField(default=0, verbose_name="Стрик дейлика")
    pos_streak = models.PositiveIntegerField(
        default=0, verbose_name="Положительный стрик привычки"
    )
    neg_streak = models.PositiveIntegerField(
        default=0, verbose_name="Отрицательный стрик привычки"
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
        Difficulty.TRIVIAL: {"xp": 1, "gold": 1},
        Difficulty.EASY: {"xp": 5, "gold": 3},
        Difficulty.MEDIUM: {"xp": 15, "gold": 7},
        Difficulty.HARD: {"xp": 40, "gold": 15},
    }

    def get_rewards(self) -> dict:
        """
        Возвращает словарь с наградами за выполнение задачи.
        Учитывает числовой множитель value.
        """
        base = self.REWARD_TABLE.get(self.difficulty, {"xp": 10, "gold": 5})
        task_value = self.value
        if task_value < 0:
            value_mod = 1.0 + abs(task_value) * 0.05
        else:
            scale = 0.06 if self.task_type == self.TaskType.TODO else 0.04
            value_mod = max(0.1, 1.0 - task_value * scale)

        xp_reward = round(base["xp"] * value_mod)
        gold_reward = round(base["gold"] * value_mod)

        return {
            "xp": max(0, xp_reward),
            "gold": max(0, gold_reward),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Эффекты скиллов (Active Effects)
# ─────────────────────────────────────────────────────────────────────────────


class ActiveEffect(models.Model):
    """
    Активный эффект скилла, применённый к пользователю.
    Создаётся при активации скилла, удаляется при истечении или потреблении.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="active_effects",
        verbose_name="Пользователь",
    )
    effect_id = models.CharField(
        max_length=80,
        unique=True,
        verbose_name="ID эффекта",
        help_text="Уникальный идентификатор: blueprint_effect, iron_fast_effect...",
    )
    skill_id = models.CharField(
        max_length=50,
        verbose_name="ID скилла",
        help_text="blueprint, system_overload, iron_fast...",
    )
    # JSON с данными эффекта: { tasksRemaining: 3, xpBoost: 0.5, ... }
    data = models.JSONField(default=dict, verbose_name="Данные эффекта")
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Истекает",
        help_text="Когда эффект перестаёт действовать. null = пока не потреблён.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")

    class Meta:
        verbose_name = "Активный эффект"
        verbose_name_plural = "Активные эффекты"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.effect_id} → {self.user.username}"


class SkillCooldown(models.Model):
    """
    Кулдаун скилла для пользователя.
    Пока cooldown_until > now(), скилл нельзя использовать.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="skill_cooldowns",
        verbose_name="Пользователь",
    )
    skill_id = models.CharField(max_length=50, verbose_name="ID скилла")
    cooldown_until = models.DateTimeField(verbose_name="Кулдаун до")

    class Meta:
        verbose_name = "Кулдаун скилла"
        verbose_name_plural = "Кулдауны скиллов"
        unique_together = [["user", "skill_id"]]  # Один кулдаун на скилл на юзера

    def __str__(self):
        return (
            f"{self.skill_id} CD → {self.user.username} (until {self.cooldown_until})"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Combat System (Боевая система)
# ─────────────────────────────────────────────────────────────────────────────


class Boss(models.Model):
    """
    Статический шаблон босса (аналог Scroll).
    """

    id_name = models.CharField(
        max_length=50, unique=True, verbose_name="ID босса (напр. misted_wanderer)"
    )
    name = models.CharField(max_length=100, verbose_name="Имя")
    hp_max = models.PositiveIntegerField(verbose_name="Макс. HP")
    level = models.PositiveIntegerField(default=1, verbose_name="Уровень/Ранг")
    reward_gold = models.PositiveIntegerField(verbose_name="Награда (Золото)")
    reward_xp = models.PositiveIntegerField(verbose_name="Награда (XP)")
    # Уникальный дроп (ID предмета)
    drop_item_id = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = "Босс"
        verbose_name_plural = "Боссы"
        ordering = ["level", "hp_max"]

    def __str__(self):
        return f"{self.name} (Lvl {self.level} | {self.hp_max} HP)"


class BossEncounter(models.Model):
    """
    Активная битва между пользователем и боссом.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="boss_encounters",
        verbose_name="Пользователь",
    )
    boss = models.ForeignKey(Boss, on_delete=models.CASCADE, verbose_name="Босс")
    hp_current = models.PositiveIntegerField(verbose_name="Текущее HP")
    reward_multiplier = models.FloatField(default=1.0, verbose_name="Множитель наград")
    is_defeated = models.BooleanField(default=False, verbose_name="Повержен")
    started_at = models.DateTimeField(auto_now_add=True, verbose_name="Начало боя")
    expires_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Время истечения"
    )

    class Meta:
        verbose_name = "Битва с боссом"
        verbose_name_plural = "Битвы с боссами"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} vs {self.boss.name} (HP: {self.hp_current}/{self.boss.hp_max})"


# ─────────────────────────────────────────────────────────────────────────────
# Inventory System (Инвентарь и Предметы)
# ─────────────────────────────────────────────────────────────────────────────


class Item(models.Model):
    """
    Строгая реляционная модель предмета.
    """

    class ItemType(models.TextChoices):
        EQUIPMENT = "equipment", "Equipment"
        CONSUMABLE = "consumable", "Consumable"
        MATERIAL = "material", "Material"

    code = models.CharField(
        max_length=100, unique=True, verbose_name="Уникальный код (напр. misted_hood)"
    )
    name = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(blank=True, verbose_name="Описание")
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.EQUIPMENT
    )
    icon_url = models.CharField(max_length=255, blank=True, verbose_name="URL иконки (WEBP)")
    cost = models.PositiveIntegerField(default=0, verbose_name="Стоимость")

    damage_boost = models.FloatField(default=0.0, verbose_name="Множитель урона (+%)")
    gold_boost = models.FloatField(default=0.0, verbose_name="Множитель золота (+%)")
    xp_boost = models.FloatField(default=0.0, verbose_name="Множитель опыта (+%)")
    hp_boost = models.IntegerField(default=0, verbose_name="Бонус к HP (Flat)")
    mana_boost = models.IntegerField(default=0, verbose_name="Бонус к Мане (Flat)")

    def __str__(self):
        return f"{self.name} ({self.code})"


class ItemEffect(models.Model):
    """
    Уникальные/Сложные эффекты предметов.
    """

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="effects")
    effect_name = models.CharField(max_length=100, verbose_name="Название эффекта")
    effect_value = models.FloatField(default=0.0, verbose_name="Значение эффекта")

    def __str__(self):
        return f"{self.item.code} - {self.effect_name}"


class InventoryItem(models.Model):
    """
    Связующая таблица инвентаря пользователя.
    """

    user_profile = models.ForeignKey(
        "UserProfile", on_delete=models.CASCADE, related_name="inventory_items"
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    is_equipped = models.BooleanField(default=False, verbose_name="Экипировано")

    class Meta:
        unique_together = ("user_profile", "item")

    def __str__(self):
        return f"{self.user_profile.user.username} - {self.item.name} x{self.quantity}"


# ─────────────────────────────────────────────────────────────────────────────
# Crafting System (Крафт и Рецепты)
# ─────────────────────────────────────────────────────────────────────────────

class Recipe(models.Model):
    """
    Рецепт для создания предмета.
    """
    code = models.CharField(max_length=100, unique=True, verbose_name="Код рецепта")
    name = models.CharField(max_length=255, verbose_name="Название рецепта")
    result_item = models.ForeignKey(
        Item, on_delete=models.CASCADE, related_name="recipes", verbose_name="Результат крафта"
    )
    crafting_cost = models.PositiveIntegerField(default=0, verbose_name="Стоимость крафта (Gold)")

    class Meta:
        verbose_name = "Рецепт"
        verbose_name_plural = "Рецепты"

    def __str__(self):
        return f"Recipe: {self.name} -> {self.result_item.name}"


class RecipeIngredient(models.Model):
    """
    Ингредиент, необходимый для рецепта.
    """
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="ingredients", verbose_name="Рецепт"
    )
    item = models.ForeignKey(
        Item, on_delete=models.CASCADE, verbose_name="Предмет-ингредиент"
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")

    class Meta:
        verbose_name = "Ингредиент рецепта"
        verbose_name_plural = "Ингредиенты рецептов"
        unique_together = ("recipe", "item")

    def __str__(self):
        return f"{self.recipe.name}: {self.item.name} x{self.quantity}"

