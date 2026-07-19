"""
MIND OS — модели базы данных.

Схема:
  User (встроенная Django-модель)
   └── UserProfile (1:1) — характеристики персонажа (HP, Mana, Gold, Level, XP)

  Task — задачи пользователя (привычки, дейлики, туду)
"""

import secrets
import string

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.functional import cached_property
from datetime import date


# ─────────────────────────────────────────────────────────────────────────────
# Профиль персонажа
# ─────────────────────────────────────────────────────────────────────────────
def distribute_sum(total_sum, num_bins, rng):
    # Ensure each bin gets at least 1
    bins = [1] * num_bins
    remaining = total_sum - num_bins
    if remaining > 0:
        # Generate random dividers
        dividers = sorted(rng.sample(range(1, total_sum), num_bins - 1))
        prev = 0
        for idx, val in enumerate(dividers):
            bins[idx] = val - prev
            prev = val
        bins[-1] = total_sum - prev
    return bins


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

    # Privacy & Analytics
    analytics_enabled = models.BooleanField(
        default=True,
        verbose_name="Аналитика включена",
    )
    anonymous_mode = models.BooleanField(
        default=False,
        verbose_name="Анонимный режим",
    )
    rival_visibility = models.BooleanField(
        default=True,
        verbose_name="Видимость для соперника",
    )
    character_name = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Имя персонажа",
    )
    equipped_title = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Экипированный титул ID",
    )

    # Гостевой аккаунт (без email/пароля, привязан к устройству)
    is_guest = models.BooleanField(
        default=False,
        verbose_name="Гость",
    )

    # ── Характеристики персонажа ──────────────────────────────────────────

    # Здоровье (Hit Points): текущее и максимальное
    hp = models.PositiveIntegerField(default=100, verbose_name="HP (текущее)")

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

    # New Mutator fields
    ledger_gold = models.PositiveIntegerField(
        default=0, verbose_name="Золото в сейфе (Gambler's Ledger)"
    )
    last_chronomancer_used = models.DateTimeField(
        null=True, blank=True, verbose_name="Последнее использование Chronomancer"
    )
    chronomancer_banked_days = models.PositiveIntegerField(
        default=0, verbose_name="Запасные дни Chronomancer"
    )

    # Премиум-подписка (Stripe)
    is_premium = models.BooleanField(default=False, verbose_name="Премиум статус")
    stripe_customer_id = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="Stripe Customer ID"
    )
    stripe_subscription_id = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="Stripe Subscription ID"
    )

    # Track last used for void_clarity active skill passive
    void_clarity_last_used = models.DateTimeField(null=True, blank=True)
    # Престиж-множители (перманентные бонусы)
    damage_multiplier = models.FloatField(default=1.0, verbose_name="Множитель урона")
    gold_multiplier = models.FloatField(default=1.0, verbose_name="Множитель золота")
    xp_multiplier = models.FloatField(default=1.0, verbose_name="Множитель опыта")
    rank_xp = models.PositiveIntegerField(
        default=0, verbose_name="Опыт ранга (Rank XP)"
    )
    streak = models.PositiveIntegerField(default=0, verbose_name="Стрик (дней подряд)")
    last_login_date = models.DateField(
        null=True, blank=True, verbose_name="Последний логин (Дата)"
    )
    last_daily_cron_at = models.DateField(
        null=True, blank=True, verbose_name="Последний крон дейликов"
    )
    last_training_at = models.DateField(
        null=True, blank=True, verbose_name="Последняя тренировка"
    )

    # Активные мутаторы (список ID мутаторов)
    active_mutators = models.JSONField(
        default=list, blank=True, verbose_name="Активные мутаторы"
    )

    # Активные союзники (список ID союзников, макс 3)
    active_allies = models.JSONField(
        default=list, blank=True, verbose_name="Активные союзники"
    )

    # Просмотренные гайды (первый визит на вкладку)
    seen_guides = models.JSONField(
        default=dict, blank=True, verbose_name="Просмотренные гайды"
    )
    # Скрытые инсайты
    dismissed_insights = models.JSONField(
        default=dict, blank=True, verbose_name="Скрытые инсайты"
    )
    last_insight_dismissed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Время последнего скрытия инсайта"
    )
    last_weekly_reset = models.CharField(
        max_length=10, null=True, blank=True, verbose_name="Неделя последнего сброса"
    )

    # Данные соперника (RivalTab)
    rival_data = models.JSONField(
        default=dict, blank=True, verbose_name="Данные соперника"
    )

    # Настройки уведомлений
    notification_preferences = models.JSONField(
        default=dict, blank=True, verbose_name="Настройки push-уведомлений"
    )

    # Настройки помодоро
    pomodoro_settings = models.JSONField(
        default=dict, blank=True, verbose_name="Настройки помодоро"
    )

    # Поля для мутаторов (Group 3)
    tasks_completed_today = models.PositiveIntegerField(
        default=0, verbose_name="Выполнено задач сегодня (momentum)"
    )
    last_completed_category = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Категория последней задачи (tunnel_vision)",
    )
    same_category_streak = models.PositiveIntegerField(
        default=0, verbose_name="Стрик одной категории (tunnel_vision)"
    )
    total_overdue_tasks = models.PositiveIntegerField(
        default=0, verbose_name="Всего просрочено/провалено (weight_of_history)"
    )
    last_deja_vu_use = models.DateTimeField(
        null=True, blank=True, verbose_name="Последнее использование deja_vu"
    )

    # Временная зона пользователя (для сброса дейликов)
    timezone = models.CharField(max_length=50, default="UTC", verbose_name="Timezone")

    # ── Базовые характеристики (RPG Stats) ───────────────────────────────
    base_pwr = models.PositiveIntegerField(default=5, verbose_name="Power (PWR)")
    base_foc = models.PositiveIntegerField(default=5, verbose_name="Focus (FOC)")
    base_spd = models.PositiveIntegerField(default=5, verbose_name="Speed (SPD)")
    base_lck = models.PositiveIntegerField(default=5, verbose_name="Luck (LCK)")
    base_def = models.PositiveIntegerField(default=5, verbose_name="Defense (DEF)")
    base_mem = models.PositiveIntegerField(default=5, verbose_name="Memory (MEM)")
    unspent_stat_points = models.PositiveIntegerField(
        default=0, verbose_name="Нераспределённые очки характеристик"
    )
    skill_points = models.PositiveIntegerField(
        default=0, verbose_name="Очки навыков (SP)"
    )
    humanities_xp = models.FloatField(default=0.0, verbose_name="Humanities XP")

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

    gf_ceiling = models.FloatField(default=105.0, verbose_name="Gf Ceiling")
    gc_ceiling = models.FloatField(default=105.0, verbose_name="Gc Ceiling")
    ps_ceiling = models.FloatField(default=105.0, verbose_name="Ps Ceiling")
    vm_ceiling = models.FloatField(default=105.0, verbose_name="Vm Ceiling")

    # Временны́е метки
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    last_seen_at = models.DateTimeField(auto_now_add=True, verbose_name="Был в сети")

    # Недельный опыт
    weekly_xp = models.PositiveIntegerField(default=0)
    weekly_xp_reset_week = models.CharField(max_length=10, null=True, blank=True)

    # Ally tracking fields
    grier_revenge_charges = models.PositiveIntegerField(
        default=0, verbose_name="Заряды возмездия Гриера"
    )
    last_temporal_rewind_used = models.DateField(
        null=True, blank=True, verbose_name="Последнее использование Temporal Rewind"
    )
    last_time_paradox_used = models.DateField(
        null=True, blank=True, verbose_name="Последнее использование Time Paradox"
    )
    time_paradox_charges = models.PositiveIntegerField(
        default=0, verbose_name="Заряды временного парадокса"
    )
    last_decoy_shadow_used = models.DateTimeField(
        null=True, blank=True, verbose_name="Последнее использование Decoy Shadow"
    )
    last_dark_sacrifice_used = models.DateTimeField(
        null=True, blank=True, verbose_name="Последнее использование Dark Sacrifice"
    )
    last_chaos_control_used = models.DateTimeField(
        null=True, blank=True, verbose_name="Последнее использование Chaos Control"
    )

    class Meta:
        verbose_name = "Профиль персонажа"
        verbose_name_plural = "Профили персонажей"

    def __str__(self):
        return f"Профиль {self.user.username} | Ур.{self.level} ({self.xp}/{self.xp_to_next_level} XP)"  # noqa: E501

    CLASS_STAT_BONUSES = {
        "architect": {"pwr": 3, "def": 4, "foc": 12, "mem": 10, "spd": 5, "lck": 6},
        "ascetic": {"pwr": 7, "def": 8, "foc": 7, "mem": 10, "spd": 7, "lck": 6},
        "linguist": {"pwr": 5, "def": 5, "foc": 10, "mem": 11, "spd": 9, "lck": 5},
        "warlord": {"pwr": 14, "def": 10, "foc": 5, "mem": 4, "spd": 10, "lck": 7},
    }

    @property
    def class_stats(self) -> dict:
        """
        Возвращает бонусы характеристик на основе выбранного класса персонажа.
        """
        # Convert class name to lowercase to match dict keys (e.g. "The Linguist" -> "linguist" or just handle direct ids)  # noqa: E501
        class_id = str(self.character_class).lower().strip()
        # Fallback if the user has a class name instead of ID, try to clean it
        if class_id.startswith("the "):
            class_id = class_id[4:]

        return self.CLASS_STAT_BONUSES.get(
            class_id, {"pwr": 0, "def": 0, "foc": 0, "mem": 0, "spd": 0, "lck": 0}
        )

    @cached_property
    def equip_stats(self) -> dict:
        """
        SSOT: Считает суммарные бонусы от ВСЕГО экипированного снаряжения.
        Возвращает словарь с агрегированными бустами.
        """
        totals: dict[str, float | int] = {
            "damage_boost": 0.0,
            "gold_boost": 0.0,
            "xp_boost": 0.0,
            "hp_boost": 0,
            "mana_boost": 0,
            "pwr": 0,
            "def": 0,
            "foc": 0,
            "mem": 0,
            "spd": 0,
            "lck": 0,  # adding for equip stats completeness
        }
        equipped = self.inventory_items.filter(is_equipped=True).select_related("item")  # type: ignore
        for inv in equipped:
            totals["damage_boost"] += inv.item.damage_boost
            totals["gold_boost"] += inv.item.gold_boost
            totals["xp_boost"] += inv.item.xp_boost
            totals["hp_boost"] += inv.item.hp_boost
            totals["mana_boost"] += inv.item.mana_boost

            # Use ItemEffects for stats like pwr, def, foc, etc.
            for effect in inv.item.effects.all():
                if effect.effect_name in totals:
                    totals[effect.effect_name] += int(effect.effect_value)

            if inv.stat_bonuses:
                for stat_key, stat_value in inv.stat_bonuses.items():
                    if stat_key in totals:
                        totals[stat_key] += int(stat_value)

        return totals

    @cached_property
    def total_stats(self) -> dict:
        """
        SSOT: Возвращает итоговые характеристики персонажа
        (базовые + бонусы класса + бонусы от снаряжения + престиж-множители).
        """
        equip = self.equip_stats
        cls_stats = self.class_stats
        prestige_mult = 1.0 + (0.10 * float(self.prestige_count))
        passives = self.get_cached_passives()

        pwr_bonus = passives.get("pwr_stat_bonus", 0)
        def_bonus = passives.get("def_stat_bonus", 0)
        foc_bonus = passives.get("foc_stat_bonus", 0)
        mem_bonus = passives.get("mem_stat_bonus", 0)
        spd_bonus = passives.get("spd_stat_bonus", 0)
        lck_bonus = passives.get("lck_stat_bonus", 0)

        has_rhea_l1 = passives.get("rhea_cosmic_shuffle", False)
        active_muts = (
            self.active_mutators.get("active", [])
            if isinstance(self.active_mutators, dict)
            else []
        )

        if has_rhea_l1 and active_muts:
            total_sum = (
                self.base_pwr
                + self.base_foc
                + self.base_spd
                + self.base_lck
                + self.base_def
                + self.base_mem
            )
            new_sum = int(total_sum * 1.20)

            from django.utils import timezone
            import random

            current_hour = int(timezone.now().timestamp() // 3600)
            rng = random.Random(current_hour + self.id)

            shuffled_vals = distribute_sum(new_sum, 6, rng)

            shuffled_pwr = shuffled_vals[0]
            shuffled_foc = shuffled_vals[1]
            shuffled_spd = shuffled_vals[2]
            shuffled_lck = shuffled_vals[3]
            shuffled_def = shuffled_vals[4]
            shuffled_mem = shuffled_vals[5]
        else:
            shuffled_pwr = self.base_pwr
            shuffled_foc = self.base_foc
            shuffled_spd = self.base_spd
            shuffled_lck = self.base_lck
            shuffled_def = self.base_def
            shuffled_mem = self.base_mem

        return {
            "pwr": int(
                (shuffled_pwr + cls_stats["pwr"] + equip.get("pwr", 0)) * prestige_mult
            )
            + pwr_bonus,
            "foc": int(
                (shuffled_foc + cls_stats["foc"] + equip.get("foc", 0)) * prestige_mult
            )
            + foc_bonus,
            "spd": int(
                (shuffled_spd + cls_stats["spd"] + equip.get("spd", 0)) * prestige_mult
            )
            + spd_bonus,
            "lck": int(
                (shuffled_lck + cls_stats["lck"] + equip.get("lck", 0)) * prestige_mult
            )
            + lck_bonus,
            "def": int(
                (shuffled_def + cls_stats["def"] + equip.get("def", 0)) * prestige_mult
            )
            + def_bonus,
            "mem": int(
                (shuffled_mem + cls_stats["mem"] + equip.get("mem", 0)) * prestige_mult
            )
            + mem_bonus,
            "damage_multiplier": float(
                round(self.damage_multiplier + equip["damage_boost"], 4)
            ),
            "gold_multiplier": float(
                round(self.gold_multiplier + equip["gold_boost"], 4)
            ),
            "xp_multiplier": float(round(self.xp_multiplier + equip["xp_boost"], 4)),
            "hp_max": int(self.max_hp + equip["hp_boost"]),
            "mana_max": int(self.max_mana + equip["mana_boost"]),
        }

    def save(self, *args, **kwargs):
        if hasattr(self, "_cached_passives"):
            delattr(self, "_cached_passives")
        if "total_stats" in self.__dict__:
            del self.__dict__["total_stats"]
        if "equip_stats" in self.__dict__:
            del self.__dict__["equip_stats"]
        # Enforce minimum IQ metrics to fix legacy accounts
        if self.gf < 100.0:
            self.gf = 100.0  # type: ignore
        if self.gc < 100.0:
            self.gc = 100.0  # type: ignore
        if self.ps < 100.0:
            self.ps = 100.0  # type: ignore
        if self.vm < 100.0:
            self.vm = 100.0  # type: ignore

        # Auto-sync computed mana_max to the database field
        self.mana_max = self.max_mana
        if "update_fields" in kwargs and kwargs["update_fields"] is not None:
            fields = list(kwargs["update_fields"])
            if "mana_max" not in fields:
                fields.append("mana_max")
            kwargs["update_fields"] = fields

        super().save(*args, **kwargs)

    def get_cached_passives(self) -> dict:
        """
        Returns a cached dict of passive multipliers.
        Avoids redundant DB queries on property hot-paths.
        """
        if self.pk is None:
            return {}
        if not hasattr(self, "_cached_passives"):
            from api.services.mechanics import get_passive_multipliers

            self._cached_passives = get_passive_multipliers(self, {})
        return self._cached_passives

    @property
    def max_hp(self) -> int:
        """
        Computed max HP — derived from prestige level, never stored directly.
        Formula: 100 + (prestige_count × 50) + Luna Level 5 bonus (if active)
        This is the SSOT for HP maximum.
        """
        BASE_HP = 100
        HP_PER_PRESTIGE = 50
        passives = self.get_cached_passives()
        bonus = passives.get("max_hp_bonus", 0)
        return BASE_HP + (self.prestige_count * HP_PER_PRESTIGE) + bonus

    @property
    def max_mana(self) -> int:
        """
        Computed max mana. Base depends on class, +15% per prestige + level-up bonus + Yuki Level 2 bonus (if active).
        """
        class_key = str(self.character_class).lower().strip()
        if class_key.startswith("the "):
            class_key = class_key[4:]

        from api.services.skill_service import CLASS_DEFS

        class_def = CLASS_DEFS.get(class_key, {})
        base_mana = class_def.get("max_mana", 100)

        level_bonus = max(0, (self.level - 1) * 5)
        multiplier = 1.0 + (0.15 * float(self.prestige_count))
        passives = self.get_cached_passives()
        bonus = passives.get("max_mana_bonus", 0)
        return int(base_mana * multiplier) + level_bonus + bonus

    @property
    def streak_title(self) -> str:
        """
        Computed title based on the user's current streak.
        Provides gamified feedback for long-term consistency.
        """
        s = self.streak
        if s < 7:
            return "The Forsaken"
        elif s < 30:
            return "The Defiant"
        elif s < 90:
            return "Iron-Willed"
        elif s < 365:
            return "Revenant"
        else:
            return "Abyssal Sovereign"


# ─────────────────────────────────────────────────────────────────────────────
# Сигнал: автоматически создаём UserProfile при создании User
# ─────────────────────────────────────────────────────────────────────────────


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Создаёт UserProfile и UserStats при регистрации нового пользователя."""
    if created:
        UserProfile.objects.create(user=instance)  # type: ignore
        UserStats.objects.create(user=instance)  # type: ignore


# NOTE: save_user_profile signal intentionally removed — it caused a phantom
# profile.save() on every User.save() (e.g., JWT token rotation), adding an
# unnecessary DB write per request cycle.


class PushSubscription(models.Model):
    """
    Stores Web Push subscription details for a user (can have multiple per user for different devices).
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=100)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Push-подписка"
        verbose_name_plural = "Push-подписки"

    def __str__(self):
        return f"Push sub for {self.user.username}"


class UserStats(models.Model):
    """
    Cumulative statistics for achievements and tracking.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="stats")

    total_tasks_completed = models.PositiveIntegerField(default=0)
    max_streak = models.PositiveIntegerField(default=0)
    total_boss_damage = models.PositiveIntegerField(default=0)
    bosses_defeated = models.PositiveIntegerField(default=0)
    total_gold_earned = models.PositiveIntegerField(default=0)
    prayer_sessions = models.PositiveIntegerField(default=0)
    total_crits = models.PositiveIntegerField(default=0)
    allies_recruited = models.PositiveIntegerField(default=0)
    ally_max_level = models.PositiveIntegerField(default=0)
    unique_subjects = models.JSONField(default=list, blank=True)
    unique_subjects_today = models.JSONField(default=list, blank=True)
    highest_subject_rank = models.PositiveIntegerField(default=0)
    prayer_rank = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Статистика пользователя"
        verbose_name_plural = "Статистика пользователей"

    def __str__(self):
        return f"Stats for {self.user.username}"


class UserAchievement(models.Model):
    """
    Records unlocked achievements so they are only claimed once.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="achievements"
    )
    achievement_id = models.CharField(max_length=100)
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "achievement_id")
        verbose_name = "Достижение пользователя"
        verbose_name_plural = "Достижения пользователей"

    def __str__(self):
        return f"{self.user.username} - {self.achievement_id}"


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
        BUTTON = "button", "Кнопка"  # Кастомная тренировка (ручной лог)

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
    value = models.FloatField(
        default=1.0,
        verbose_name="Значение сложности",
        help_text="Множитель наград: 1.0 = норма, 2.0 = двойная награда",
    )

    # Категория (для группировки и тренировочных коэффициентов)
    category = models.CharField(
        max_length=50,
        default="Other",
        blank=True,
        verbose_name="Категория",
    )

    # Категория мастерства (для кастомных тренировок BUTTON)
    mastery_category = models.CharField(
        max_length=50,
        default="",
        blank=True,
        verbose_name="Категория мастерства",
    )

    icon = models.CharField(
        max_length=20, blank=True, null=True, default="", verbose_name="Иконка"
    )

    # Календарь
    scheduled_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Время (календарь)",
    )
    scheduled_end_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Время окончания (календарь)",
    )
    show_in_calendar = models.BooleanField(
        default=False,
        verbose_name="Показывать в календаре",
    )
    repeat_weekdays = models.PositiveSmallIntegerField(
        default=127,
        verbose_name="Дни повторения",
    )

    # Настройки кастомного сессионного лога (для типа BUTTON)
    default_hours = models.FloatField(
        default=1.0,
        null=True,
        blank=True,
        verbose_name="Часы по умолчанию",
    )
    default_focus = models.PositiveIntegerField(
        default=7,
        null=True,
        blank=True,
        verbose_name="Фокус по умолчанию",
    )
    xp_reward = models.PositiveIntegerField(
        default=10,
        null=True,
        blank=True,
        verbose_name="Награда XP",
    )
    gold_reward = models.PositiveIntegerField(
        default=8,
        null=True,
        blank=True,
        verbose_name="Награда Золото",
    )
    boss_damage = models.PositiveIntegerField(
        default=15,
        null=True,
        blank=True,
        verbose_name="Урон боссу",
    )

    # ── Состояние задачи ──────────────────────────────────────────────────

    # Выполнена ли задача (для TODO)
    is_completed = models.BooleanField(default=False, verbose_name="Выполнено")

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

    # Точные данные наград при последнем выполнении (для отката)
    last_reward_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Данные последней награды",
    )

    # Сохранённые суммы XP и Gold при выполнении (для обратной отмены)
    xp_awarded = models.IntegerField(
        default=0,
        verbose_name="XP выдано (для отмены)",
    )
    gold_awarded = models.IntegerField(
        default=0,
        verbose_name="Gold выдано (для отмены)",
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
        indexes = [
            models.Index(fields=["user", "task_type"]),
            models.Index(fields=["user", "is_completed"]),
        ]

    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"[{status}] {self.get_task_type_display()}: {self.title} ({self.user.username})"  # noqa: E501

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
            value_mod = 1.0 + abs(float(task_value)) * 0.05
        else:
            scale = 0.06 if self.task_type == self.TaskType.TODO else 0.04
            value_mod = max(0.1, 1.0 - float(task_value) * scale)

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
        indexes = [
            models.Index(fields=["user", "skill_id"]),
        ]

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
    last_idle_tick_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Последний тик урона"
    )

    class Meta:
        verbose_name = "Битва с боссом"
        verbose_name_plural = "Битвы с боссами"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "is_defeated"]),
        ]

    def __str__(self):
        return f"{self.user.username} vs {self.boss.name} (HP: {self.hp_current}/{self.boss.hp_max})"  # noqa: E501


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

    class GearClass(models.TextChoices):
        E = "E", "Scrap"
        D = "D", "Integrated"
        C = "C", "Enhanced"
        B = "B", "Advanced"
        A = "A", "Elite"
        S = "S", "Anomaly"

    code = models.CharField(
        max_length=100, unique=True, verbose_name="Уникальный код (напр. misted_hood)"
    )
    name = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(blank=True, verbose_name="Описание")
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.EQUIPMENT
    )
    icon_url = models.CharField(
        max_length=255, blank=True, verbose_name="URL иконки (WEBP)"
    )
    cost = models.PositiveIntegerField(default=0, verbose_name="Стоимость")
    slot_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Слот экипировки (напр. headware, ring1)",
    )
    gear_class = models.CharField(
        max_length=1,
        choices=GearClass.choices,
        default=GearClass.E,
        blank=True,
        null=True,
        verbose_name="Gear Class (E–S): Scrap/Integrated/Enhanced/Advanced/Elite/Anomaly",
    )

    damage_boost = models.FloatField(default=0.0, verbose_name="Множитель урона (+%)")
    gold_boost = models.FloatField(default=0.0, verbose_name="Множитель золота (+%)")
    xp_boost = models.FloatField(default=0.0, verbose_name="Множитель опыта (+%)")
    hp_boost = models.IntegerField(default=0, verbose_name="Бонус к HP (Flat)")
    mana_boost = models.IntegerField(default=0, verbose_name="Бонус к Мане (Flat)")

    is_purchasable = models.BooleanField(
        default=True,
        verbose_name="Доступен в магазине",
    )
    source = models.CharField(
        max_length=20,
        choices=[
            ("shop", "Shop"),
            ("boss_drop", "Boss Drop"),
            ("quest_reward", "Quest Reward"),
            ("chest", "Chest Drop"),
        ],
        default="shop",
    )
    boss_rank = models.CharField(
        max_length=5,
        choices=[
            ("F", "F"),
            ("D", "D"),
            ("C", "C"),
            ("B", "B"),
            ("A", "A"),
            ("S", "S"),
            ("SS", "SS"),
            ("SSS", "SSS"),
        ],
        null=True,
        blank=True,
    )

    def __str__(self) -> str:
        gc = f" [{self.gear_class}]" if self.gear_class else ""
        return f"{self.name}{gc} ({self.code})"


class ItemEffect(models.Model):
    """
    Уникальные/Сложные эффекты предметов.
    """

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="effects")
    effect_name = models.CharField(max_length=100, verbose_name="Название эффекта")
    effect_value = models.FloatField(default=0.0, verbose_name="Значение эффекта")

    def __str__(self):
        return f"{self.item.code} - {self.effect_name}"


class LootChest(models.Model):
    """
    Типы лут-сундуков с весами выпадения по gear_class.
    drop_rates хранит JSON: {'E': 45, 'D': 30, 'C': 15, 'B': 7, 'A': 2.5, 'S': 0.5}
    """

    class ChestType(models.TextChoices):
        STANDARD = "standard_cache", "Standard Cache"
        QUANTUM = "quantum_safe", "Quantum Safe"

    chest_type = models.CharField(
        max_length=30,
        choices=ChestType.choices,
        unique=True,
        verbose_name="Тип сундука",
    )
    name = models.CharField(max_length=100, verbose_name="Название")
    description = models.TextField(blank=True, verbose_name="Описание")
    cost_gold = models.PositiveIntegerField(default=0, verbose_name="Стоимость (Gold)")
    drop_rates = models.JSONField(
        default=dict,
        verbose_name="Шансы выпадения по gear_class (JSON)",
    )
    icon_url = models.CharField(max_length=255, blank=True, verbose_name="URL иконки")

    class Meta:
        verbose_name = "Лут-сундук"
        verbose_name_plural = "Лут-сундуки"

    def __str__(self) -> str:
        return f"{self.name} ({self.chest_type}) — {self.cost_gold}g"


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
    stat_bonuses = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Уникальные характеристики",
    )

    class Meta:
        unique_together = ("user_profile", "item")
        indexes = [
            models.Index(fields=["user_profile", "is_equipped"]),
        ]

    def __str__(self):
        return f"{self.user_profile.user.username} - {self.item.name} x{self.quantity}"  # type: ignore


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
        Item,
        on_delete=models.CASCADE,
        related_name="recipes",
        verbose_name="Результат крафта",
    )
    crafting_cost = models.PositiveIntegerField(
        default=0, verbose_name="Стоимость крафта (Gold)"
    )

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
        Recipe,
        on_delete=models.CASCADE,
        related_name="ingredients",
        verbose_name="Рецепт",
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


class UnlockedSkill(models.Model):
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="unlocked_skills",
        verbose_name="Профиль пользователя",
    )
    skill_code = models.CharField(max_length=100, verbose_name="Код навыка")
    unlocked_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Дата разблокировки"
    )

    class Meta:
        verbose_name = "Разблокированный навык"
        verbose_name_plural = "Разблокированные навыки"
        unique_together = ("user_profile", "skill_code")

    def __str__(self):
        return f"{self.user_profile.user.username} - {self.skill_code}"


class RecruitedAlly(models.Model):
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="recruited_allies",
        verbose_name="Профиль пользователя",
    )
    ally_code = models.CharField(max_length=100, verbose_name="Код союзника")
    level = models.PositiveIntegerField(default=1, verbose_name="Уровень союзника")
    recruited_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата найма")
    total_xp_received = models.PositiveIntegerField(
        default=0, verbose_name="Получено опыта (Twin Souls)"
    )

    class Meta:
        verbose_name = "Нанятый союзник"
        verbose_name_plural = "Нанятые союзники"
        unique_together = ("user_profile", "ally_code")

    def __str__(self):
        return f"{self.user_profile.user.username} - {self.ally_code} (Lv {self.level})"


class TrainingSession(models.Model):
    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="training_sessions",
        verbose_name="Профиль пользователя",
    )
    activity_key = models.CharField(max_length=100, verbose_name="Активность")
    hours = models.FloatField(default=0, verbose_name="Часы")
    focus_rating = models.FloatField(default=5, verbose_name="Фокус")
    efficiency = models.FloatField(default=1.0, verbose_name="Эффективность")

    xp_earned = models.PositiveIntegerField(default=0, verbose_name="Полученный опыт")
    gf_gain = models.FloatField(default=0, verbose_name="Gf Gain")
    gc_gain = models.FloatField(default=0, verbose_name="Gc Gain")
    ps_gain = models.FloatField(default=0, verbose_name="Ps Gain")
    vm_gain = models.FloatField(default=0, verbose_name="Vm Gain")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата сессии")

    class Meta:
        verbose_name = "Тренировочная сессия"
        verbose_name_plural = "Тренировочные сессии"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user_profile", "created_at"]),
        ]

    def __str__(self):
        return (
            f"{self.user_profile.user.username} - {self.activity_key} ({self.hours}h)"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Party System (v1)
# ─────────────────────────────────────────────────────────────────────────────


def _generate_invite_code() -> str:
    """Generate a 6-character alphanumeric invite code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Party(models.Model):
    """
    A group of users who can view each other's public progress.
    v1: read-only visibility, no shared boss, no chat.
    """

    objects = models.Manager()

    name = models.CharField(max_length=64, verbose_name="Party name")
    invite_code = models.CharField(
        max_length=6,
        unique=True,
        default=_generate_invite_code,
        verbose_name="Invite code",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_parties",
        verbose_name="Creator",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    streak = models.PositiveIntegerField(default=0, verbose_name="Party Streak")
    last_streak_update_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Party"
        verbose_name_plural = "Parties"

    def __str__(self) -> str:
        return f"{self.name} [{self.invite_code}]"


class PartyMembership(models.Model):
    """
    Links a User to a Party. OneToOneField on user enforces
    the v1 constraint: one user can only be in ONE party at a time.
    """

    objects = models.Manager()

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="party_membership",
        verbose_name="Member",
    )
    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name="Party",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(
        max_length=10,
        choices=(("OWNER", "Owner"), ("MEMBER", "Member")),
        default="MEMBER",
        verbose_name="Role",
    )

    # Party Enhancements v1
    last_daily_completed_date = models.DateField(null=True, blank=True)
    last_buff_sent_at = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Party membership"
        verbose_name_plural = "Party memberships"

    def __str__(self) -> str:
        return f"{self.user.username} → {self.party.name}"


class PartyEvent(models.Model):
    """
    Activity Feed event for a Party.
    """

    EVENT_TYPES = (
        ("task", "Task Completed"),
        ("level_up", "Level Up"),
        ("ally_unlock", "Ally Unlocked"),
        ("milestone", "Milestone Reached"),
    )

    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name="events",
    )
    member = models.ForeignKey(
        PartyMembership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feed_events",
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    message = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Party Event"
        verbose_name_plural = "Party Events"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.party.name}] {self.event_type} - {self.message}"


class PartyEventReaction(models.Model):
    """
    Emoji reaction to a PartyEvent.
    """

    event = models.ForeignKey(
        PartyEvent,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="party_reactions",
    )
    emoji = models.CharField(max_length=10)

    class Meta:
        verbose_name = "Party Event Reaction"
        verbose_name_plural = "Party Event Reactions"
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"], name="unique_user_event_reaction"
            )
        ]

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to Event {self.event_id}"  # type: ignore


# ─────────────────────────────────────────────────────────────────────────────
# Calendar Events (Ручные события в календаре)
# ─────────────────────────────────────────────────────────────────────────────


class CalendarEvent(models.Model):
    """
    Ручное событие в календаре (ранее хранилось в localStorage).
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        verbose_name="Пользователь",
    )
    title = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(blank=True, default="", verbose_name="Описание")
    date = models.DateField(verbose_name="Дата")
    start_time = models.TimeField(verbose_name="Время начала")
    end_time = models.TimeField(verbose_name="Время окончания")
    color = models.CharField(max_length=15, default="#3b82f6", verbose_name="Цвет")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Событие календаря"
        verbose_name_plural = "События календаря"
        ordering = ["date", "start_time"]

    def __str__(self):
        return f"{self.title} ({self.date} {self.start_time}-{self.end_time})"


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────


class FeatureEvent(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feature_events",
        verbose_name="Пользователь",
    )
    event_name = models.CharField(max_length=128, verbose_name="Имя события")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="Время события")

    class Meta:
        verbose_name = "Событие аналитики"
        verbose_name_plural = "События аналитики"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"FeatureEvent: {self.event_name} @ {self.timestamp}"


# ─────────────────────────────────────────────────────────────────────────────
# Pomodoro
# ─────────────────────────────────────────────────────────────────────────────


class PomodoroSession(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="pomodoro_sessions",
        verbose_name="Пользователь",
    )
    date = models.DateField(default=date.today, verbose_name="Дата сессии")
    started_at = models.DateTimeField(auto_now_add=True, verbose_name="Время старта")
    duration = models.PositiveIntegerField(
        default=25, verbose_name="Длительность (мин)"
    )
    mode = models.CharField(max_length=20, default="focus", verbose_name="Режим")
    label = models.CharField(max_length=200, blank=True, verbose_name="Лейбл фокуса")
    completed = models.BooleanField(default=True, verbose_name="Завершена")

    class Meta:
        verbose_name = "Сессия помодоро"
        verbose_name_plural = "Сессии помодоро"
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "date"])]

    def __str__(self):
        return f"Pomodoro {self.mode} ({self.duration}m) - {self.user.username}"
