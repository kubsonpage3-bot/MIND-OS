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
from django.utils import timezone
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

    # Когда для пользователя в последний раз выполнялся backfill/reconciliation
    # истории активности (ActivityHistoryView). Пока это поле пустое —
    # backfill выполняется; после первого успешного прогона выставляется,
    # чтобы не гонять тяжёлые перебор-запросы на каждый GET /api/history/.
    history_backfilled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Дата последнего backfill истории",
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
    # Separate from last_daily_cron_at on purpose: that field is stamped by
    # the lazy daily-rollover check in task_service.py, which fires as soon
    # as any request detects a new day for the user — almost always before
    # the daily_mutator_tick management command (Loan Shark/Cursed
    # Clock/Compound/Alchemist) gets a chance to run. Sharing one field
    # meant whichever ran first for the day silently blocked the other for
    # that whole day.
    last_mutator_tick_at = models.DateField(
        null=True, blank=True, verbose_name="Последний тик мутаторов"
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
    # Список разблокированных титулов (Option B)
    unlocked_playstyle_titles = models.JSONField(
        default=list, blank=True, verbose_name="Разблокированные титулы"
    )
    # Стрики по категориям (Sciences/Humanities/Languages/Body/Spirit)
    category_streaks = models.JSONField(
        default=dict, blank=True, verbose_name="Стрики по категориям"
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
    habits_completed_today = models.PositiveIntegerField(
        default=0, verbose_name="Выполнено привычек сегодня"
    )
    habit_boss_dmg_today = models.PositiveIntegerField(
        default=0,
        verbose_name="Суммарный boss dmg от Habits сегодня (DIS-3 cap)",
    )
    todos_completed_today = models.PositiveIntegerField(
        default=0, verbose_name="Выполнено тудушек сегодня"
    )
    dailies_completed_today = models.PositiveIntegerField(
        default=0, verbose_name="Выполнено дейликов сегодня"
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
        class_id = (self.character_class or "").lower().strip()
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
        class_key = (self.character_class or "").lower().strip()
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
    boss_attacks_count = models.PositiveIntegerField(
        default=0, verbose_name="Количество атак на боссов"
    )
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
    items_purchased = models.PositiveIntegerField(default=0)
    chests_opened = models.PositiveIntegerField(default=0)
    potions_consumed = models.PositiveIntegerField(default=0)
    items_crafted = models.PositiveIntegerField(default=0)

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
        # По умолчанию сортируем: сначала порядок, потом id
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["user", "task_type"]),
            models.Index(fields=["user", "is_completed"]),
        ]

    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"[{status}] {self.get_task_type_display()}: {self.title} ({self.user.username})"  # noqa: E501

    def save(self, *args, **kwargs):
        from api.services.rewards_service import task_rewards

        diff = (
            self.difficulty
            if self.difficulty in ["trivial", "easy", "medium", "hard"]
            else "medium"
        )
        rewards = task_rewards(diff)
        self.xp_reward = rewards["xp"]
        self.gold_reward = rewards["gold"]
        self.boss_damage = rewards["dmg"]

        # Enforce training session defaults on Training Activity (button)
        if self.task_type == self.TaskType.BUTTON:
            if not self.default_hours or self.default_hours <= 0:
                self.default_hours = 1.0
            if not self.default_focus or self.default_focus <= 0:
                self.default_focus = 7

        super().save(*args, **kwargs)

    @property
    def hp_damage_on_miss(self) -> int:
        from api.services.rewards_service import MISS_PENALTY

        diff = (
            self.difficulty
            if self.difficulty in ["trivial", "easy", "medium", "hard"]
            else "medium"
        )
        return MISS_PENALTY.get(diff, 20)

    def get_rewards(self) -> dict:
        """
        Возвращает словарь с наградами за выполнение задачи.
        Учитывает:
          - value_mod (Habitica-style деградация/рост от выполнений)
          - hours_bonus для Todo/Daily: +15% за каждый estimated_hour, cap 2.0×
            → min(2.0, 1.0 + hours * 0.15)
            0h → 1.0×, 1h → 1.15×, 4h → 1.6×, 6.7h+ → 2.0× (cap)
        """
        task_value = self.value
        if task_value < 0:
            value_mod = min(2.0, 1.0 + abs(task_value) * 0.05)
        else:
            scale = 0.06 if self.task_type == self.TaskType.TODO else 0.04
            value_mod = max(0.6, 1.0 - task_value * scale)

        # Hours bonus: only for Todo/Daily (not Habit — Habits use streak for scaling)
        hours_bonus = 1.0
        if self.task_type in (self.TaskType.TODO, self.TaskType.DAILY):
            estimated_hours = getattr(self, "estimated_hours", None) or 0
            if estimated_hours > 0:
                hours_bonus = min(2.0, 1.0 + float(estimated_hours) * 0.15)

        base_xp = self.xp_reward if self.xp_reward is not None else 10
        base_gold = self.gold_reward if self.gold_reward is not None else 8
        xp_reward = round(base_xp * value_mod * hours_bonus)
        gold_reward = round(base_gold * value_mod * hours_bonus)

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
        unique_together = ("user", "effect_id")
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
        SS = "SS", "Transcendent"
        SSS = "SSS", "Singularity"

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
        max_length=3,
        choices=GearClass.choices,
        default=GearClass.E,
        blank=True,
        null=True,
        verbose_name="Gear Class (E–SSS): Scrap/Integrated/Enhanced/Advanced/Elite/Anomaly/Transcendent/Singularity",
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
            ("E", "E"),
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
        APEX = "apex_vault", "Apex Vault"
        SOVEREIGN = "sovereign_reliquary", "Sovereign Reliquary"

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


class UserActivityLog(models.Model):
    """
    Unified Activity and Event Log for MIND OS.
    Tracks all user accomplishments across:
    - study: Study/Training sessions with focus and cognitive gains
    - habit_pos: Positive habit triggers (+XP, +Gold, pos_streak)
    - habit_neg: Negative habit fails (-HP, neg_streak)
    - daily: Completed daily tasks (+XP, +Gold, streak, boss_damage)
    - daily_uncomplete: Reverted daily completion
    - todo: Completed one-off tasks (+XP, +Gold)
    - todo_uncomplete: Reverted todo completion
    - pomodoro: Completed Pomodoro focus sessions
    """

    class ActivityType(models.TextChoices):
        STUDY = "study", "Предмет / Учёба"
        HABIT_POS = "habit_pos", "Привычка (+)"
        HABIT_NEG = "habit_neg", "Привычка (-)"
        DAILY = "daily", "Дейлик"
        DAILY_UNCOMPLETE = "daily_uncomplete", "Отмена дейлика"
        TODO = "todo", "To-Do"
        TODO_UNCOMPLETE = "todo_uncomplete", "Отмена To-Do"
        POMODORO = "pomodoro", "Помодоро"
        ACHIEVEMENT = "achievement", "Достижение"
        BOSS_DEFEAT = "boss_defeat", "Победа над боссом"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="activity_logs",
        verbose_name="Пользователь",
    )
    activity_type = models.CharField(
        max_length=20,
        choices=ActivityType.choices,
        default=ActivityType.STUDY,
        verbose_name="Тип активности",
    )
    task = models.ForeignKey(
        "Task",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        verbose_name="Связанная задача",
    )
    title = models.CharField(max_length=255, verbose_name="Название")
    category = models.CharField(
        max_length=50, default="Other", blank=True, verbose_name="Категория"
    )
    icon = models.CharField(
        max_length=50, blank=True, default="", verbose_name="Иконка"
    )
    hours = models.FloatField(default=0.0, verbose_name="Часы")
    focus_rating = models.FloatField(
        null=True, blank=True, verbose_name="Рейтинг фокуса"
    )
    xp_earned = models.IntegerField(default=0, verbose_name="Полученный опыт")
    gold_earned = models.IntegerField(default=0, verbose_name="Полученное золото")
    hp_lost = models.IntegerField(default=0, verbose_name="Потерянное HP")
    mana_gained = models.IntegerField(default=0, verbose_name="Полученная мана")
    boss_damage = models.IntegerField(default=0, verbose_name="Урон боссу")
    streak_value = models.IntegerField(default=0, verbose_name="Значение стрика")
    difficulty = models.CharField(
        max_length=20, default="medium", blank=True, verbose_name="Сложность"
    )
    cognitive_gains = models.JSONField(
        default=dict, blank=True, verbose_name="Когнитивные приросты"
    )
    metadata = models.JSONField(
        default=dict, blank=True, verbose_name="Дополнительные метаданные"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, db_index=True, verbose_name="Дата и время"
    )

    class Meta:
        verbose_name = "Лог активности"
        verbose_name_plural = "Логи активности"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "activity_type", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.user.username}] {self.activity_type}: {self.title} ({self.created_at})"


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
    v2: added description, member_cap, weekly quests, achievements.
    """

    objects = models.Manager()

    name = models.CharField(max_length=64, verbose_name="Party name")
    description = models.CharField(
        max_length=140,
        blank=True,
        default="",
        verbose_name="Description",
    )
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
    quest_streak = models.PositiveIntegerField(
        default=0, verbose_name="Consecutive Quests Completed"
    )
    member_cap = models.PositiveSmallIntegerField(
        default=8,
        verbose_name="Member cap",
        help_text="Max members allowed (2–8).",
    )

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
        ("buff_sent", "Buff Sent"),
        ("rank_up", "Rank Up"),
        ("ally_unlock", "Ally Unlocked"),
        ("milestone", "Milestone Reached"),
        ("chat", "Chat Message"),
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
# Party v2 — Weekly Quests & Achievements
# ─────────────────────────────────────────────────────────────────────────────


class PartyWeeklyQuest(models.Model):
    """
    A shared weekly challenge for the entire party.
    One quest per party per ISO week. Completed when current_value >= target_value.
    """

    QUEST_TYPES = (
        ("tasks_completed", "Tasks Completed"),
        ("habits_completed", "Habits Completed"),
    )

    objects = models.Manager()

    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name="weekly_quests",
    )
    quest_type = models.CharField(
        max_length=30, choices=QUEST_TYPES, default="tasks_completed"
    )
    target_value = models.PositiveIntegerField(default=50)
    current_value = models.PositiveIntegerField(default=0)
    week_key = models.CharField(
        max_length=10,
        help_text="ISO week key, e.g. '25W30'",
    )
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Party Weekly Quest"
        verbose_name_plural = "Party Weekly Quests"
        constraints = [
            models.UniqueConstraint(
                fields=["party", "week_key"],
                name="unique_party_week_quest",
            )
        ]

    def __str__(self):
        return f"[{self.party.name}] {self.quest_type} W{self.week_key}: {self.current_value}/{self.target_value}"


class PartyAchievement(models.Model):
    """
    A permanent trophy earned by the party for reaching a milestone.
    Each achievement code can only be earned once per party.
    """

    ACHIEVEMENT_CODES = (
        ("streak_7", "7-Day Streak"),
        ("streak_30", "30-Day Streak"),
        ("streak_100", "100-Day Streak"),
        ("full_house", "Full House (max members)"),
        ("first_quest", "First Weekly Quest Completed"),
        ("quest_master", "5 Weekly Quests Completed"),
    )

    objects = models.Manager()

    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name="achievements",
    )
    code = models.CharField(max_length=30, choices=ACHIEVEMENT_CODES)
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Party Achievement"
        verbose_name_plural = "Party Achievements"
        constraints = [
            models.UniqueConstraint(
                fields=["party", "code"],
                name="unique_party_achievement",
            )
        ]

    def __str__(self):
        return f"[{self.party.name}] {self.code}"


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


class ActivePomodoroSession(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="active_pomodoro",
        verbose_name="Пользователь",
    )
    linked_activity_key = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="Ключ активности"
    )
    duration_minutes = models.PositiveIntegerField(
        default=25, verbose_name="Длительность (мин)"
    )
    started_at = models.DateTimeField(default=timezone.now, verbose_name="Время старта")
    is_paused = models.BooleanField(default=False, verbose_name="Пауза")
    paused_remaining_seconds = models.PositiveIntegerField(
        default=0, verbose_name="Остаток секунд на паузе"
    )
    mode = models.CharField(max_length=20, default="work", verbose_name="Режим")

    class Meta:
        verbose_name = "Активная сессия помодоро"
        verbose_name_plural = "Активные сессии помодоро"

    def remaining_seconds(self):
        if self.is_paused:
            return self.paused_remaining_seconds
        total_sec = self.duration_minutes * 60
        elapsed = (timezone.now() - self.started_at).total_seconds()
        return max(0, int(total_sec - elapsed))

    def __str__(self):
        return f"ActivePomodoro {self.user.username} ({self.remaining_seconds()}s left)"


# ─────────────────────────────────────────────────────────────────────────────
# Дневник питания (NutriLog)
# ─────────────────────────────────────────────────────────────────────────────


class FoodItem(models.Model):
    """Личный справочник продуктов пользователя."""

    UNIT_CHOICES = [
        ("g", "Граммы"),
        ("ml", "Миллилитры"),
        ("pcs", "Штуки"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="food_items",
        verbose_name="Пользователь",
    )
    name = models.CharField(max_length=200, verbose_name="Название")
    calories_per_100 = models.FloatField(verbose_name="Калории на 100г/мл")
    protein_per_100 = models.FloatField(default=0.0, verbose_name="Белки на 100г/мл")
    fat_per_100 = models.FloatField(default=0.0, verbose_name="Жиры на 100г/мл")
    carbs_per_100 = models.FloatField(default=0.0, verbose_name="Углеводы на 100г/мл")
    # Микронутриенты (из Open Food Facts, nullable — данные есть не у всех продуктов)
    fiber_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Клетчатка на 100г"
    )
    sugar_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Сахар на 100г"
    )
    sodium_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Натрий на 100г (мг)"
    )
    saturated_fat_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Нас. жиры на 100г"
    )
    unit = models.CharField(
        max_length=5, choices=UNIT_CHOICES, default="g", verbose_name="Единица"
    )
    is_favorite = models.BooleanField(default=False, verbose_name="Избранное")
    # Статистика использования для Quick-Add / Recent Foods
    last_used_at = models.DateTimeField(
        null=True, blank=True, db_index=True, verbose_name="Последнее использование"
    )
    use_count = models.PositiveIntegerField(
        default=0, verbose_name="Количество использований"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Продукт"
        verbose_name_plural = "Продукты"
        ordering = ["-is_favorite", "name"]
        indexes = [
            models.Index(fields=["user", "is_favorite"]),
            models.Index(fields=["user", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.calories_per_100} ккал/100)"


class MealEntry(models.Model):
    """Запись приёма пищи за конкретный день."""

    MEAL_CHOICES = [
        ("breakfast", "Завтрак"),
        ("lunch", "Обед"),
        ("dinner", "Ужин"),
        ("snack", "Снэк"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="meal_entries",
        verbose_name="Пользователь",
    )
    food_item = models.ForeignKey(
        FoodItem,
        on_delete=models.CASCADE,
        related_name="meal_entries",
        verbose_name="Продукт",
    )
    date = models.DateField(db_index=True, verbose_name="Дата")
    meal_type = models.CharField(
        max_length=20, choices=MEAL_CHOICES, default="snack", verbose_name="Приём пищи"
    )
    amount = models.FloatField(verbose_name="Количество (г/мл/шт)")

    # Денормализованные значения — считаются при сохранении, не в runtime
    calories = models.FloatField(verbose_name="Калории")
    protein = models.FloatField(default=0.0, verbose_name="Белки")
    fat = models.FloatField(default=0.0, verbose_name="Жиры")
    carbs = models.FloatField(default=0.0, verbose_name="Углеводы")
    # Денормализованные микронутриенты (null если у продукта нет данных)
    fiber = models.FloatField(null=True, blank=True, verbose_name="Клетчатка")
    sugar = models.FloatField(null=True, blank=True, verbose_name="Сахар")
    sodium = models.FloatField(null=True, blank=True, verbose_name="Натрий (мг)")
    saturated_fat = models.FloatField(null=True, blank=True, verbose_name="Нас. жиры")

    note = models.CharField(
        max_length=300, blank=True, default="", verbose_name="Заметка"
    )
    photo_url = models.TextField(blank=True, default="", verbose_name="Фото блюда")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Запись питания"
        verbose_name_plural = "Записи питания"
        ordering = ["date", "meal_type", "created_at"]
        indexes = [
            models.Index(fields=["user", "date"]),
        ]

    def save(self, *args, **kwargs) -> None:
        """Авто-пересчёт КБЖУ + микронутриентов при сохранении."""
        ratio = self.amount / 100.0
        self.calories = round(self.food_item.calories_per_100 * ratio, 2)
        self.protein = round(self.food_item.protein_per_100 * ratio, 2)
        self.fat = round(self.food_item.fat_per_100 * ratio, 2)
        self.carbs = round(self.food_item.carbs_per_100 * ratio, 2)
        # Микронутриенты — только если есть данные у продукта
        fi = self.food_item
        self.fiber = (
            round(fi.fiber_per_100 * ratio, 2) if fi.fiber_per_100 is not None else None
        )
        self.sugar = (
            round(fi.sugar_per_100 * ratio, 2) if fi.sugar_per_100 is not None else None
        )
        self.sodium = (
            round(fi.sodium_per_100 * ratio, 2)
            if fi.sodium_per_100 is not None
            else None
        )
        self.saturated_fat = (
            round(fi.saturated_fat_per_100 * ratio, 2)
            if fi.saturated_fat_per_100 is not None
            else None
        )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.date} | {self.meal_type} | {self.food_item.name} {self.amount}{self.food_item.unit}"


class NutriGoal(models.Model):
    """Цели питания пользователя (одна запись на пользователя)."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="nutri_goal",
        verbose_name="Пользователь",
    )
    calories = models.FloatField(default=2000.0, verbose_name="Цель ккал/день")
    protein = models.FloatField(default=150.0, verbose_name="Цель белки г/день")
    fat = models.FloatField(default=65.0, verbose_name="Цель жиры г/день")
    carbs = models.FloatField(default=250.0, verbose_name="Цель углеводы г/день")
    water_ml = models.PositiveIntegerField(
        default=2000, verbose_name="Цель вода мл/день"
    )
    # Цель по весу тела (для WeightTracker)
    target_weight_kg = models.FloatField(
        null=True, blank=True, verbose_name="Целевой вес (кг)"
    )
    # Напоминания о приёмах пищи (время по UTC, null = выключено)
    reminder_breakfast = models.TimeField(
        null=True, blank=True, verbose_name="Напоминание завтрак"
    )
    reminder_lunch = models.TimeField(
        null=True, blank=True, verbose_name="Напоминание обед"
    )
    reminder_dinner = models.TimeField(
        null=True, blank=True, verbose_name="Напоминание ужин"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Цель питания"
        verbose_name_plural = "Цели питания"

    def __str__(self) -> str:
        return f"NutriGoal {self.user.username} ({self.calories} ккал)"


class GlobalFoodCache(models.Model):
    """Кеш продуктов из Open Food Facts и глобальных баз."""

    name = models.CharField(max_length=255, db_index=True, verbose_name="Название")
    brand = models.CharField(
        max_length=255, blank=True, default="", verbose_name="Бренд"
    )
    barcode = models.CharField(
        max_length=64, blank=True, default="", db_index=True, verbose_name="Штрихкод"
    )
    calories_per_100 = models.FloatField(default=0.0, verbose_name="Ккал на 100г")
    protein_per_100 = models.FloatField(default=0.0, verbose_name="Белки на 100г")
    fat_per_100 = models.FloatField(default=0.0, verbose_name="Жиры на 100г")
    carbs_per_100 = models.FloatField(default=0.0, verbose_name="Углеводы на 100г")
    # Микронутриенты из Open Food Facts
    fiber_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Клетчатка на 100г"
    )
    sugar_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Сахар на 100г"
    )
    sodium_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Натрий на 100г (мг)"
    )
    saturated_fat_per_100 = models.FloatField(
        null=True, blank=True, verbose_name="Нас. жиры на 100г"
    )
    unit = models.CharField(max_length=5, default="g", verbose_name="Единица")
    image_url = models.TextField(blank=True, default="", verbose_name="Ссылка на фото")
    source = models.CharField(
        max_length=32, default="openfoodfacts", verbose_name="Источник"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Глобальный продукт (кеш)"
        verbose_name_plural = "Глобальные продукты (кеш)"
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["barcode"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.brand}) - {self.calories_per_100} kcal"


class SavedMealCombo(models.Model):
    """Сохранённый набор блюд/комбо-приём пищи пользователя."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="saved_meal_combos",
        verbose_name="Пользователь",
    )
    name = models.CharField(max_length=200, verbose_name="Название комбо")
    default_meal_type = models.CharField(
        max_length=20,
        choices=MealEntry.MEAL_CHOICES,
        default="breakfast",
        verbose_name="Приём по умолчанию",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Сохранённое комбо блюд"
        verbose_name_plural = "Сохранённые комбо блюд"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.name}"


class MealComboItem(models.Model):
    """Элемент сохранённого комбо блюда."""

    combo = models.ForeignKey(
        SavedMealCombo,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Комбо",
    )
    food_item = models.ForeignKey(
        FoodItem,
        on_delete=models.CASCADE,
        related_name="combo_items",
        verbose_name="Продукт",
    )
    amount = models.FloatField(default=100.0, verbose_name="Количество (г/мл/шт)")

    class Meta:
        verbose_name = "Элемент комбо"
        verbose_name_plural = "Элементы комбо"

    def __str__(self) -> str:
        return f"{self.combo.name} -> {self.food_item.name} ({self.amount})"


class WaterLog(models.Model):
    """Лог выпитой воды за конкретный день."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="water_logs",
        verbose_name="Пользователь",
    )
    date = models.DateField(db_index=True, verbose_name="Дата")
    amount_ml = models.PositiveIntegerField(default=0, verbose_name="Выпито мл")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Лог воды"
        verbose_name_plural = "Логи воды"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"], name="unique_user_daily_water"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user.username} {self.date}: {self.amount_ml}ml"


# ─────────────────────────────────────────────────────────────────────────────
# Трекер веса
# ─────────────────────────────────────────────────────────────────────────────


class WeightLog(models.Model):
    """Запись веса тела пользователя за конкретный день."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="weight_logs",
        verbose_name="Пользователь",
    )
    date = models.DateField(db_index=True, verbose_name="Дата")
    weight_kg = models.FloatField(verbose_name="Вес (кг)")
    note = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Заметка"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Запись веса"
        verbose_name_plural = "Записи веса"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"], name="unique_user_daily_weight"
            )
        ]
        ordering = ["date"]

    def __str__(self) -> str:
        return f"{self.user.username} {self.date}: {self.weight_kg}kg"
