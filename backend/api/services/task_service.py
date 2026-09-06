import logging
from datetime import timedelta
from django.utils import timezone
import random
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError
from api.models import Task, UserProfile, Item, InventoryItem, RecruitedAlly
from api.services.rewards_service import task_rewards
from api.services.skill_service import apply_effects_on_task_complete
from api.services.profile_service import gain_xp, check_death
from api.services.mechanics import calculate_task_outcome

logger = logging.getLogger(__name__)


def is_daily_scheduled_for_date(task, date_val) -> bool:
    """
    Checks if a daily task is scheduled to run on a given date based on repeat_weekdays.
    """
    if task.task_type != Task.TaskType.DAILY:
        return True
    repeat_weekdays = getattr(task, "repeat_weekdays", 127)
    if repeat_weekdays is None:
        repeat_weekdays = 127
    weekday_flag = 1 << date_val.weekday()
    return (repeat_weekdays & weekday_flag) > 0


def award_free_chest(profile, chest_type):
    from api.models import LootChest, Item, InventoryItem
    import random

    chest = LootChest.objects.filter(
        chest_type__in=[chest_type, f"{chest_type}_cache", "standard_cache", "standard"]
    ).first()
    if not chest:
        chest = LootChest.objects.first()
    if not chest:
        return None
    drop_rates = chest.drop_rates or {"E": 1.0}
    classes = list(drop_rates.keys())
    weights = [float(drop_rates[c]) for c in classes]
    rolled_class = random.choices(classes, weights=weights, k=1)[0] if classes else "E"

    eligible_items = list(
        Item.objects.filter(gear_class=rolled_class, item_type=Item.ItemType.EQUIPMENT)
    )
    if not eligible_items:
        eligible_items = list(
            Item.objects.filter(gear_class="E", item_type=Item.ItemType.EQUIPMENT)
        )
    if not eligible_items:
        return None
    won_item = random.choice(eligible_items)

    inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile,
        item=won_item,
        defaults={"quantity": 1, "is_equipped": False},
    )
    if not created:
        inv_item.quantity += 1
        inv_item.save(update_fields=["quantity"])
    return won_item


def seed_starter_tasks(user, lang="en"):
    """
    Seeds initial starter quests (2 dailies, 1 habit) for a new player.
    Ensures zero state is gamified and engaging right after class selection.
    Only seeds if the user does not already have any tasks.
    """
    if Task.objects.filter(user=user).exists():
        return []

    is_ru = bool(lang and str(lang).lower().startswith("ru"))

    starter_configs = [
        {
            "task_type": Task.TaskType.DAILY,
            "title": "Прочитай 30 минут" if is_ru else "Read for 30 minutes",
            "difficulty": Task.Difficulty.MEDIUM,
            "category": "Reading & Writing",
            "notes": (
                "Книга, научная статья или конспекты для роста эрудиции и фокуса"
                if is_ru
                else "Book, article, or study notes for knowledge & mental focus"
            ),
            "icon": "book",
            "order": 1,
        },
        {
            "task_type": Task.TaskType.DAILY,
            "title": "Сделай зарядку" if is_ru else "Morning workout",
            "difficulty": Task.Difficulty.EASY,
            "category": "Health & Fitness",
            "notes": (
                "10-15 минут разминки, растяжки или утренней прогулки"
                if is_ru
                else "10-15 minutes of stretching, mobility or brisk walk"
            ),
            "icon": "dumbbell",
            "order": 2,
        },
        {
            "task_type": Task.TaskType.HABIT,
            "title": "Выпей стакан воды" if is_ru else "Drink a glass of water",
            "difficulty": Task.Difficulty.EASY,
            "category": "Health & Fitness",
            "notes": (
                "Поддерживай водный баланс для энергии мозга"
                if is_ru
                else "Hydrate your body & brain for sustained alertness"
            ),
            "icon": "water",
            "order": 1,
        },
    ]

    created_tasks = []
    for cfg in starter_configs:
        task = Task.objects.create(user=user, **cfg)
        created_tasks.append(task)

    logger.info(f"[Onboarding] Seeded {len(created_tasks)} starter quests for user {user.username}")
    return created_tasks


def complete_task(user, task_id, is_positive=True):
    try:
        with transaction.atomic():
            return _complete_task_logic(user, task_id, is_positive)
    except Task.DoesNotExist:
        from rest_framework.exceptions import ValidationError

        raise ValidationError("Task not found.")
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"complete_task failed: {e}")
        raise


def has_completed_any_daily_yesterday(user, yesterday_date=None) -> bool:
    """
    Checks if the user completed at least one daily task yesterday.
    Used to determine if the Welcome Back / Dawn Report modal should be displayed.
    Rule: If the user completed at least 1 daily yesterday, do NOT show the modal.
    Only show the modal if 0 dailies were completed during the entire day.
    """
    import zoneinfo
    from datetime import datetime, time, timedelta
    from django.utils import timezone as tz
    from api.models import UserProfile, Task, UserActivityLog

    try:
        profile = UserProfile.objects.get(user=user)
        user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")

    if yesterday_date is None:
        local_now = tz.now().astimezone(user_tz)
        yesterday_date = (local_now - timedelta(days=1)).date()

    start_of_yesterday = datetime.combine(yesterday_date, time.min).replace(tzinfo=user_tz)
    end_of_yesterday = datetime.combine(yesterday_date, time.max).replace(tzinfo=user_tz)

    # 1. Check UserActivityLog for daily activity created yesterday
    if UserActivityLog.objects.filter(
        user=user,
        activity_type=UserActivityLog.ActivityType.DAILY,
        created_at__gte=start_of_yesterday,
        created_at__lte=end_of_yesterday,
    ).exists():
        return True

    # 2. Check if any daily task has last_completed_at falling on yesterday
    if Task.objects.filter(
        user=user,
        task_type=Task.TaskType.DAILY,
        last_completed_at__gte=start_of_yesterday,
        last_completed_at__lte=end_of_yesterday,
    ).exists():
        return True

    return False


def get_yesterday_uncompleted_dailies(user):
    """
    Returns a list of dailies that were scheduled for YESTERDAY but were NOT completed.
    Used by the Welcome Back modal (Habitica-style daily check-in).
    """
    import zoneinfo
    from datetime import datetime, time, timedelta
    from django.utils import timezone as tz
    from api.models import UserProfile, Task, UserActivityLog

    profile = UserProfile.objects.get(user=user)

    try:
        user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")

    yesterday = (tz.now().astimezone(user_tz) - timedelta(days=1)).date()
    start_of_yesterday = datetime.combine(yesterday, time.min).replace(tzinfo=user_tz)
    end_of_yesterday = datetime.combine(yesterday, time.max).replace(tzinfo=user_tz)

    dailies = Task.objects.filter(user=user, task_type=Task.TaskType.DAILY)
    result = []
    for task in dailies:
        if not is_daily_scheduled_for_date(task, yesterday):
            continue
        # Check if completed yesterday
        was_completed_yesterday = False
        if task.last_completed_at:
            local_date = task.last_completed_at.astimezone(user_tz).date()
            was_completed_yesterday = (local_date == yesterday)
        if not was_completed_yesterday:
            # Fallback check on UserActivityLog
            was_completed_yesterday = UserActivityLog.objects.filter(
                user=user,
                task=task,
                activity_type=UserActivityLog.ActivityType.DAILY,
                created_at__gte=start_of_yesterday,
                created_at__lte=end_of_yesterday,
            ).exists()
        if not was_completed_yesterday:
            result.append(task)
    return result


@transaction.atomic
def complete_yesterday_dailies(user, completed_ids: list):
    """
    Handles the Welcome Back daily check-in response.
    - Tasks in completed_ids: grant XP/Gold rewards retroactively.
      If process_missed_tasks already ran and dealt fail damage, refund that damage.
    - Tasks NOT in completed_ids:
      If process_missed_tasks has not run yet, apply fail damage.
      If process_missed_tasks already ran, do NOT double-apply damage.
    Returns a summary dict.
    """
    import zoneinfo
    from datetime import datetime, time, timedelta
    from django.utils import timezone as tz
    from api.services.combat_service import calculate_fail_damage
    from api.services.mechanics import apply_active_mutators
    from api.models import ActiveEffect, UserActivityLog
    from api.services.profile_service import gain_xp, check_death

    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")

    local_now = tz.now().astimezone(user_tz)
    local_today = local_now.date()
    yesterday = local_today - timedelta(days=1)
    yesterday_dt = datetime.combine(yesterday, time(12, 0)).replace(tzinfo=user_tz)

    cron_already_ran = bool(
        profile.last_daily_cron_at and profile.last_daily_cron_at >= local_today
    )

    missed_tasks = get_yesterday_uncompleted_dailies(user)
    total_xp = 0
    total_gold = 0
    total_dmg = 0
    total_refund = 0
    log = []

    transcendence_active = ActiveEffect.objects.filter(
        user=user, skill_id="transcendence"
    ).exists()
    iron_fast_active = ActiveEffect.objects.filter(
        user=user, skill_id="iron_fast"
    ).exists()
    elixir_active = ActiveEffect.objects.filter(
        user=user, skill_id="elixir", expires_at__gt=tz.now()
    ).exists()

    for task in missed_tasks:
        fail_dmg = calculate_fail_damage(task, profile)
        if iron_fast_active or elixir_active:
            fail_dmg = 0

        if task.id in completed_ids:
            # ── Grant retroactive rewards ─────────────────────────
            rewards = task.get_rewards()
            base_xp = rewards.get("xp", 0)
            base_gold = rewards.get("gold", 0)
            final_xp = max(0, int(base_xp * profile.xp_multiplier))
            final_gold = max(0, int(base_gold * profile.gold_multiplier))

            gain_xp(profile, final_xp)
            profile.rank_xp = max(0, profile.rank_xp + final_xp)
            profile.gold = max(0, profile.gold + final_gold)

            # Mark task as completed yesterday (keep is_completed=False so task is ready for today)
            task.is_completed = False
            task.last_completed_at = yesterday_dt
            task.completion_count += 1
            task.streak += 1
            task.value = calc_new_value(task.value, "complete", "daily")
            task.save()

            # Record UserActivityLog backdated to yesterday
            try:
                act_log = UserActivityLog.objects.create(
                    user=user,
                    activity_type=UserActivityLog.ActivityType.DAILY,
                    task=task,
                    title=task.title,
                    category=task.category or "Other",
                    difficulty=task.difficulty,
                    xp_earned=final_xp,
                    gold_earned=final_gold,
                    streak_value=task.streak,
                    metadata={"retroactive_checkin": True},
                )
                UserActivityLog.objects.filter(id=act_log.id).update(
                    created_at=yesterday_dt
                )
            except Exception as e:
                logger.warning(
                    "Failed to record retroactive checkin activity log: %s", e
                )

            # If cron already ran, user was already penalized for this task, so refund the damage!
            if cron_already_ran and fail_dmg > 0:
                total_refund += fail_dmg

            total_xp += final_xp
            total_gold += final_gold
            log.append(
                {
                    "type": "checkin_done",
                    "id": task.id,
                    "title": task.title,
                    "xp": final_xp,
                    "gold": final_gold,
                    "refunded_hp": fail_dmg if cron_already_ran else 0,
                }
            )
        else:
            # ── Uncompleted task ──────────────────────────────────
            context = {
                "is_science": False,
                "is_language": False,
                "is_exercise": False,
                "is_prayer": False,
                "task_type": "daily",
                "hours": 0,
            }
            mutator_effects = apply_active_mutators(
                profile, context, trigger_side_effects=False
            )
            outcome = calculate_task_outcome(
                user,
                "daily",
                base_hp_lost=fail_dmg,
                is_positive=False,
                mutator_effects=mutator_effects,
            )
            final_dmg = outcome["hp_lost"]
            if iron_fast_active or elixir_active:
                final_dmg = 0

            if not cron_already_ran:
                # Apply penalty since cron hasn't executed yet
                if not transcendence_active:
                    task.streak = 0
                    task.value = calc_new_value(task.value, "fail", "daily")
                task.is_completed = False
                task.save()
                total_dmg += final_dmg

            log.append(
                {
                    "type": "checkin_missed",
                    "id": task.id,
                    "title": task.title,
                    "damage": final_dmg,
                    "already_penalized": cron_already_ran,
                }
            )

    # Apply HP adjustments
    if total_refund > 0:
        max_hp = profile.total_stats.get("hp_max", 100)
        profile.hp = min(max_hp, profile.hp + total_refund)

    if total_dmg > 0:
        profile.hp = max(0, profile.hp - total_dmg)

    # Mark cron as executed for today so process_missed_tasks won't re-penalize
    profile.last_daily_cron_at = local_today
    profile.save(
        update_fields=["hp", "gold", "rank_xp", "level", "last_daily_cron_at"]
    )

    died = check_death(profile)

    return {
        "total_xp": total_xp,
        "total_gold": total_gold,
        "total_dmg": total_dmg,
        "total_refund": total_refund,
        "died": died,
        "log": log,
    }


def _complete_task_logic(user, task_id, is_positive=True, is_deja_vu=False):
    """
    Выполнение задачи и начисление наград.
    Использует transaction.atomic и select_for_update для предотвращения состояния гонки.  # noqa: E501
    """
    task = Task.objects.select_for_update().get(id=task_id, user=user)

    # Блокируем профиль для обновления в рамках транзакции
    profile = UserProfile.objects.select_for_update().get(user=user)
    rewards = task.get_rewards()
    gamification_result = {}

    # ── Логика по типу задачи ─────────────────────────────────────────
    from api.models import ActiveEffect

    transcendence_active = ActiveEffect.objects.filter(
        user=user, skill_id="transcendence"
    ).exists()
    if task.task_type == Task.TaskType.TODO:
        if is_positive:
            if task.is_completed and not is_deja_vu:
                raise ValidationError("Task already completed.")
            task.is_completed = True
            task.last_completed_at = timezone.now()
            task.completion_count += 1

            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
            task.last_reward_data["value_before"] = task.value
        else:
            if not task.is_completed:
                raise ValidationError("Task is not completed.")
            task.is_completed = False
            task.last_completed_at = None
            task.completion_count = max(0, task.completion_count - 1)

            if (
                isinstance(task.last_reward_data, dict)
                and "value_before" in task.last_reward_data
            ):
                task.value = task.last_reward_data.get("value_before", task.value)

    elif task.task_type == Task.TaskType.DAILY:
        import zoneinfo

        try:
            user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
        except Exception:
            user_tz = zoneinfo.ZoneInfo("UTC")

        local_now = timezone.now().astimezone(user_tz)
        local_today = local_now.date()

        # Check if daily is scheduled for today
        if not is_daily_scheduled_for_date(task, local_today):
            raise ValidationError("This daily task is not scheduled for today.")

        already_done_today = False
        if task.last_completed_at:
            last_completed_local = task.last_completed_at.astimezone(user_tz).date()
            already_done_today = last_completed_local == local_today

        if is_positive:
            if already_done_today and not is_deja_vu:
                raise ValidationError("Daily task already completed today.")
            task.last_completed_at = timezone.now()
            task.is_completed = True

            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
            task.last_reward_data["value_before"] = task.value

            task.value = calc_new_value(task.value, "complete", "daily")
            task.completion_count += 1
            task.streak += 1
        else:
            if not already_done_today:
                if task.is_completed:
                    task.is_completed = False
                    task.save(update_fields=["is_completed"])
                    return {
                        "detail": "Daily task completion status reset.",
                        "task": task,
                        "profile": profile,
                    }
                raise ValidationError("Daily task is not completed today.")
            # Revert: clear both the timestamp AND the flag so the task is fully unlocked.  # noqa: E501
            task.last_completed_at = None
            task.is_completed = False

            if (
                isinstance(task.last_reward_data, dict)
                and "value_before" in task.last_reward_data
            ):
                task.value = task.last_reward_data.get("value_before", task.value)
            else:
                task.value = calc_new_value(task.value, "fail", "daily")

            task.completion_count = max(0, task.completion_count - 1)
            if not transcendence_active:
                task.streak = max(0, task.streak - 1)

    elif task.task_type == Task.TaskType.HABIT:
        task.completion_count += 1
        task.last_completed_at = timezone.now()
        task.value = calc_new_value(
            task.value, "complete" if is_positive else "fail", "habit"
        )
        if is_positive:
            task.pos_streak += 1
            task.neg_streak = 0
            # Streak bonus capped at 1.3x (reached at streak=15, +2% per step).
            # Cap matches focus_factor ceiling — habit discipline has real value
            # but cannot outpace a genuine training session indefinitely.
            streak_mult = min(1.3, 1.0 + (task.pos_streak * 0.02))
            rewards["xp"] = int(rewards["xp"] * streak_mult)
            rewards["gold"] = int(rewards["gold"] * streak_mult)
        else:
            task.neg_streak += 1
            if not transcendence_active:
                task.pos_streak = 0

            from api.services.combat_service import calculate_fail_damage

            base_damage = calculate_fail_damage(task, profile)

            # Увеличиваем урон в зависимости от размера neg_streak (по 10% за каждый провал подряд)  # noqa: E501
            damage_mult = 1.0 + (task.neg_streak * 0.1)
            damage = int(base_damage * damage_mult)

            context = {
                "is_science": False,
                "is_language": False,
                "is_exercise": False,
                "is_prayer": False,
                "task_type": "habit",
                "hours": 0,
            }
            from api.services.mechanics import apply_active_mutators

            mutator_effects = apply_active_mutators(
                profile, context, trigger_side_effects=False
            )

            outcome = calculate_task_outcome(
                user,
                "habit",
                base_hp_lost=damage,
                is_positive=False,
                mutator_effects=mutator_effects,
            )
            final_damage = outcome["hp_lost"]

            # Fetch active allies level
            active_codes = profile.active_allies or []

            recruited_allies = {
                a.ally_code: a.level
                for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore[attr-defined]
            }

            # Grier Level 2 Shield Slam
            if outcome.get("grier_shield_slam") and profile.mana >= 5:
                profile.mana = max(0, profile.mana - 5)
                profile.save()
                from api.services.mechanics import apply_boss_damage

                apply_boss_damage(user, outcome["grier_shield_slam_dmg"])
                profile.refresh_from_db()

            # Grier Level 4 Revenge Mark: failed habit adds charge
            if recruited_allies.get("grier", 0) >= 4:
                profile.grier_revenge_charges = min(
                    3, profile.grier_revenge_charges + 1
                )

            xp_gained = outcome.get("xp_earned", 0)
            leveled_up = False
            if xp_gained > 0:
                leveled_up = gain_xp(profile, xp_gained)
                profile.rank_xp += xp_gained

            died = False
            if profile.hp - final_damage <= 0:
                died = True
                profile.hp = 0
            else:
                profile.hp -= final_damage

            profile.total_overdue_tasks += 1

            active_mutators = profile.active_mutators or {}
            active_list = (
                active_mutators.get("active", [])
                if isinstance(active_mutators, dict)
                else []
            )
            active_ids = [
                m.get("id") if isinstance(m, dict) else m for m in active_list
            ]

            if "ironman" in active_ids:
                profile.hp = max(1, int(profile.hp * 0.75))
                profile.gold = max(0, int(profile.gold * 0.90))

            profile.save(
                update_fields=[
                    "hp",
                    "gold",
                    "rank_xp",
                    "level",
                    "total_overdue_tasks",
                    "mana",
                    "grier_revenge_charges",
                ]
            )

            died = check_death(profile)

            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
            task.last_reward_data["hp_lost"] = final_damage

            task.save()

            # ── Record unified UserActivityLog for negative habit ────
            try:
                from api.models import UserActivityLog

                UserActivityLog.objects.create(
                    user=user,
                    activity_type=UserActivityLog.ActivityType.HABIT_NEG,
                    task=task,
                    title=task.title,
                    category=getattr(task, "category", "Other") or "Other",
                    icon=getattr(task, "icon", "") or "",
                    difficulty=getattr(task, "difficulty", "medium") or "medium",
                    xp_earned=xp_gained,
                    gold_earned=0,
                    hp_lost=final_damage,
                    mana_gained=0,
                    boss_damage=0,
                    streak_value=task.neg_streak,
                    metadata={
                        "is_positive": False,
                        "value_after": task.value,
                        "penalty": {"hp": -final_damage},
                    },
                )
            except Exception as e:
                logger.warning(
                    "Failed to create UserActivityLog for negative habit %s: %s",
                    task.id,
                    e,
                )

            return {
                "detail": "Habit deviation noted.",
                "penalty": {"hp": -final_damage},
                "profile": profile,
                "task": task,
                "leveled_up": leveled_up,
                "rewards": {"xp": xp_gained, "gold": 0},
                "skill_effects": [],
                "died": died,
                "is_dead": died,
                "silent_mode": mutator_effects.get("silent_mode", False),
                "gamification_result": outcome,
            }

    task.save()

    # ── Начисляем награды персонажу ───────────────────────────────────
    base_mana = (
        2
        if task.task_type == Task.TaskType.HABIT
        else (5 if task.task_type == Task.TaskType.DAILY else 3)
    )
    leveled_up = False

    # Apply mutators and passives
    from api.services.mechanics import apply_active_mutators, get_passive_multipliers

    task_category = getattr(task, "category", "")
    is_science = task_category in {
        "STEM",
        "Math",
        "Physics",
        "Coding",
        "Chemistry",
        "Biology",
    }
    is_language = task_category in {
        "Languages",
        "Humanities & Arts",
        "Reading & Writing",
        "English",
        "Philosophy",
        "History",
    }
    is_exercise = task_category in {"Health & Fitness", "Exercise", "Running"}
    is_prayer = task_category in {"Mindfulness", "Prayer", "Prayer/Meditation"}

    completed_near_deadline = False
    if task.task_type == Task.TaskType.DAILY:
        # A daily task deadline is midnight (end of the day). We check if it's completed within 2 hours of midnight.
        now = timezone.now()
        end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        time_left = (end_of_day - now).total_seconds()
        if time_left <= 7200:  # 2 hours
            completed_near_deadline = True
    elif task.task_type == Task.TaskType.TODO and task.due_date:
        now = timezone.now()
        if hasattr(task.due_date, "tzinfo") and task.due_date.tzinfo is not None:
            time_left = (task.due_date - now).total_seconds()
        else:
            # naive
            time_left = (task.due_date - now.replace(tzinfo=None)).total_seconds()
        if 0 <= time_left <= 7200:
            completed_near_deadline = True

    task_age_days = (
        (timezone.now() - task.created_at).days
        if getattr(task, "created_at", None)
        else 0
    )

    context = {
        "is_science": is_science,
        "is_language": is_language,
        "is_exercise": is_exercise,
        "is_prayer": is_prayer,
        "task_type": (
            "daily"
            if task.task_type == Task.TaskType.DAILY
            else ("habit" if task.task_type == Task.TaskType.HABIT else "todo")
        ),
        "hours": getattr(task, "estimated_hours", 0) or 0,
        "completed_near_deadline": completed_near_deadline,
        "task_category": task_category,
        "task_mastery_category": getattr(task, "mastery_category", "") or "",
        "task_age_days": task_age_days,
        "task_streak": (
            getattr(task, "streak", 0)
            if task.task_type == Task.TaskType.DAILY
            else getattr(task, "pos_streak", 0)
        ),
    }

    mutator_effects = apply_active_mutators(profile, context)
    passive_effects = get_passive_multipliers(profile, context)

    active_list = (
        profile.active_mutators.get("active", [])
        if isinstance(profile.active_mutators, dict)
        else []
    )
    active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]

    mutator_died = mutator_effects.get("is_dead", False)

    mana_gained = int(
        base_mana * passive_effects.get("mana_regen_mult", 1.0)
    ) + passive_effects.get("mana_flat_bonus", 0)

    battle_fury_active = ActiveEffect.objects.filter(
        user=user, skill_id="battle_fury"
    ).exists()
    if battle_fury_active:
        mana_gained = int(mana_gained * 0.8)

    # Calculate additive multipliers
    gold_mult = (
        mutator_effects.get("gold_mult", 1.0)
        + passive_effects.get("gold_mult", 1.0)
        - 1.0
    )
    xp_mult = (
        mutator_effects.get("xp_mult", 1.0) + passive_effects.get("xp_mult", 1.0) - 1.0
    )
    flat_xp_bonus = mutator_effects.get("flat_xp", 0) + passive_effects.get(
        "flat_xp", 0
    )

    # Apply multipliers to base task rewards
    base_xp = int((rewards.get("xp", 0) + flat_xp_bonus) * xp_mult)
    base_gold = int(rewards.get("gold", 0) * gold_mult)

    final_xp_mult = mutator_effects.get("final_xp_mult", 1.0)
    final_gold_mult = mutator_effects.get("final_gold_mult", 1.0)

    if final_xp_mult != 1.0:
        base_xp = int(base_xp * final_xp_mult)
    if final_gold_mult != 1.0:
        base_gold = int(base_gold * final_gold_mult)

    mirror_autocomplete_data = None
    if is_positive:
        outcome = calculate_task_outcome(
            user,
            task.task_type,
            base_xp,
            base_gold,
            is_positive=True,
            passive_effects=passive_effects,
            mutator_effects=mutator_effects,
        )
        gamification_result = outcome

        final_xp = max(0, int(outcome["xp_earned"] * profile.xp_multiplier))
        final_gold = max(0, int(outcome["gold_earned"] * profile.gold_multiplier))

        # Party buff: XP boost (xp_boost_24h effect from party member)
        if ActiveEffect.objects.filter(
            user=user, skill_id="xp_boost_24h", expires_at__gt=timezone.now()
        ).exists():
            final_xp = int(final_xp * 1.25)

        # Party buff: Gold boost (gold_boost_12h effect from party member)
        if ActiveEffect.objects.filter(
            user=user, skill_id="gold_boost_12h", expires_at__gt=timezone.now()
        ).exists():
            final_gold = int(final_gold * 1.20)

        active_codes = profile.active_allies or []

        recruited_allies = {
            a.ally_code: a.level
            for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore[attr-defined]
        }

        # Meldor Level 1: Todo completion has 10% chance to drop ingredient but costs 2 HP
        meldor_level = recruited_allies.get("meldor", 0)
        if task.task_type == Task.TaskType.TODO and meldor_level >= 1:
            profile.hp = max(0, profile.hp - 2)
            check_death(profile)
            if random.random() < 0.10:
                eligible_materials = list(Item.objects.filter(item_type="material"))
                if eligible_materials:
                    dropped_material = random.choice(eligible_materials)
                    inv_item, created = InventoryItem.objects.get_or_create(
                        user_profile=profile, item=dropped_material
                    )
                    if not created:
                        inv_item.quantity += 1
                        inv_item.save()
                    outcome["item_dropped"] = dropped_material.code

        # Zephyr Level 4: Syncopation
        zephyr_level = recruited_allies.get("zephyr", 0)
        if zephyr_level >= 4:
            current_task_num = profile.tasks_completed_today + 1
            if current_task_num % 4 == 0:
                won_item = award_free_chest(profile, "standard")
                if won_item:
                    outcome["item_dropped"] = won_item.code
            else:
                final_gold = int(final_gold * 0.85)

        if mutator_effects.get("trigger_echo") and random.random() < 0.10:
            final_xp *= 2
            final_gold *= 2

        # Twin Souls split
        if "twin_souls" in active_ids and active_codes:
            active_recruited = RecruitedAlly.objects.filter(
                user_profile=profile, ally_code__in=active_codes
            )
            least_xp_ally = active_recruited.order_by(
                "total_xp_received", "recruited_at"
            ).first()
            if least_xp_ally is not None:
                ally_xp_share = int(final_xp * 0.15)
                ally_gold_share = int(final_gold * 0.15)

                final_xp -= ally_xp_share
                final_gold -= ally_gold_share

                least_xp_ally.total_xp_received += ally_xp_share
                least_xp_ally.save(update_fields=["total_xp_received"])

        # Null Zone conversion
        if "null_zone" in active_ids:
            final_gold += int(final_xp * 0.5)
            final_xp = 0

        # The Gambler's Ledger redirect
        if "gamblers_ledger" in active_ids:
            profile.ledger_gold += final_gold
            final_gold = 0

        if mutator_effects.get("trigger_volatile"):
            stat_list = [
                "base_pwr",
                "base_foc",
                "base_spd",
                "base_lck",
                "base_def",
                "base_mem",
            ]
            stat_choice = random.choice(stat_list)
            current_val = getattr(profile, stat_choice)
            if random.random() < 0.5:
                setattr(profile, stat_choice, current_val + 1)
            else:
                setattr(profile, stat_choice, max(0, current_val - 1))
            profile.save(update_fields=[stat_choice])

        # Lyra Level 5 Time Paradox Activation on completing a Daily
        lyra_level = recruited_allies.get("lyra", 0)
        if task.task_type == Task.TaskType.DAILY and lyra_level >= 5:
            today = timezone.now().date()
            if profile.last_time_paradox_used != today:
                profile.last_time_paradox_used = today
                profile.mana = max(0, int(profile.mana * 0.5))
                profile.time_paradox_charges = 3

        # Lyra Level 5 Time Paradox Reward duplication on Todo
        if task.task_type == Task.TaskType.TODO and profile.time_paradox_charges > 0:
            final_xp *= 2
            final_gold *= 2
            profile.time_paradox_charges = max(0, profile.time_paradox_charges - 1)

        # Grier Level 5: disable mana regen below 20% HP
        grier_l5_active = passive_effects.get("grier_unbreakable_will", False)
        below_20_hp = profile.hp < profile.total_stats.get("hp_max", 100) * 0.20
        if grier_l5_active and below_20_hp:
            mana_gained = 0

        # Kage Level 2 Silent Strike: yields 0 Gold on Todo
        kage_level = recruited_allies.get("kage", 0)
        if kage_level >= 2 and task.task_type == Task.TaskType.TODO:
            final_gold = 0

        # Kage Level 3 Flesh Rip: crit heals, normal hit damages
        if kage_level >= 3:
            is_crit = outcome.get("is_crit", False)
            if is_crit:
                profile.hp = min(profile.total_stats.get("hp_max", 100), profile.hp + 8)
                profile.mana = min(profile.max_mana, profile.mana + 8)
            else:
                profile.hp = max(0, profile.hp - 1)
                check_death(profile)

        if task.task_type == Task.TaskType.DAILY:
            completed_heal = passive_effects.get("daily_completed_hp_heal", 0)
            if completed_heal > 0:
                profile.hp = min(
                    profile.total_stats.get("hp_max", 100), profile.hp + completed_heal
                )

        leveled_up = gain_xp(profile, final_xp)
        profile.rank_xp = max(0, profile.rank_xp + final_xp)
        profile.gold = max(0, profile.gold + final_gold)
        profile.mana = min(profile.max_mana, profile.mana + mana_gained)

        # Group 3 Mutator stats
        profile.tasks_completed_today += 1
        if task.task_type == Task.TaskType.HABIT:
            profile.habits_completed_today += 1
        elif task.task_type == Task.TaskType.TODO:
            profile.todos_completed_today += 1
        elif task.task_type == Task.TaskType.DAILY:
            profile.dailies_completed_today += 1

        if task_category:
            if profile.last_completed_category == task_category:
                profile.same_category_streak += 1
            else:
                profile.same_category_streak = 1
                profile.last_completed_category = task_category
        else:
            profile.same_category_streak = 0
            profile.last_completed_category = ""

        rewards["xp"] = final_xp
        rewards["gold"] = final_gold

        try:
            membership = user.party_membership

            if task.task_type == task.TaskType.DAILY:
                today = timezone.now().date()
                if membership.last_daily_completed_date != today:
                    membership.last_daily_completed_date = today
                    party = membership.party
                    if (
                        party.last_streak_update_date is None
                        or party.last_streak_update_date < today
                    ):
                        all_done = not party.memberships.filter(
                            last_daily_completed_date__lt=today
                        ).exists()
                        if all_done:
                            party.streak += 1
                            party.last_streak_update_date = today
                            party.save(
                                update_fields=["streak", "last_streak_update_date"]
                            )
                            # Check streak achievements
                            try:
                                from api.services.party_service import (
                                    check_streak_achievements,
                                )

                                check_streak_achievements(party)
                            except Exception as e:
                                logger.warning(
                                    "Failed to check party streak achievements: %s", e
                                )
                            if party.streak in [3, 7, 14, 30, 50, 100, 365]:
                                try:
                                    with transaction.atomic():
                                        from api.models import PartyEvent

                                        PartyEvent.objects.create(
                                            party=party,
                                            member=membership,
                                            event_type="milestone",
                                            message=f"hit a {party.streak}-day streak!",
                                        )
                                except Exception as e:
                                    logger.warning(
                                        "Failed to create milestone event: %s", e
                                    )

            membership.save(
                update_fields=[
                    "last_daily_completed_date",
                ]
            )

            # Log event
            if final_xp > 0:
                try:
                    with transaction.atomic():
                        from api.models import PartyEvent

                        PartyEvent.objects.create(
                            party=membership.party,
                            member=membership,
                            event_type="task",
                            message=task.title[:250],
                        )
                except Exception as e:
                    logger.warning("Failed to create task event: %s", e)

            # Party Weekly Quest progress
            try:
                from api.services.party_service import add_quest_progress

                add_quest_progress(membership.party)
            except Exception as e:
                logger.warning("Failed to add party quest progress: %s", e)

        except ObjectDoesNotExist:
            pass

        # Handle item drops
        if outcome.get("item_dropped"):
            item_obj = Item.objects.filter(code=outcome["item_dropped"]).first()
            if item_obj:
                inv_item, created = InventoryItem.objects.get_or_create(
                    user_profile=profile, item=item_obj
                )
                if not created:
                    inv_item.quantity += 1
                    inv_item.save()

        if task.task_type in [Task.TaskType.DAILY, Task.TaskType.TODO]:
            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
            task.last_reward_data["shield_used"] = False
            task.last_reward_data["xp_earned"] = final_xp
            task.last_reward_data["gold_earned"] = final_gold
            task.last_reward_data["item_dropped"] = outcome.get("item_dropped")
            task.save(update_fields=["last_reward_data"])

        # Mirror Match autocomplete
        if "mirror_match" in active_ids and random.random() < 0.30:
            other_task = (
                Task.objects.filter(
                    user=user,
                    category=task.category if task.category else "Other",
                    is_completed=False,
                )
                .exclude(id=task.id)
                .order_by("?")
                .first()
            )
            if other_task:
                other_diff_reward = task_rewards(other_task.difficulty)
                other_base_xp = int(other_diff_reward["xp"] * 0.5)
                other_base_gold = int(other_diff_reward["gold"] * 0.5)

                other_final_xp = max(0, int(other_base_xp * profile.xp_multiplier))
                other_final_gold = max(
                    0, int(other_base_gold * profile.gold_multiplier)
                )

                if "twin_souls" in active_ids and active_codes:
                    active_recruited = RecruitedAlly.objects.filter(
                        user_profile=profile, ally_code__in=active_codes
                    )
                    least_xp_ally = active_recruited.order_by(
                        "total_xp_received", "recruited_at"
                    ).first()
                    if least_xp_ally is not None:
                        other_ally_xp_share = int(other_final_xp * 0.15)
                        other_ally_gold_share = int(other_final_gold * 0.15)

                        other_final_xp -= other_ally_xp_share
                        other_final_gold -= other_ally_gold_share

                        least_xp_ally.total_xp_received += other_ally_xp_share
                        least_xp_ally.save(update_fields=["total_xp_received"])

                if "null_zone" in active_ids:
                    other_final_gold += int(other_final_xp * 0.5)
                    other_final_xp = 0

                if "gamblers_ledger" in active_ids:
                    profile.ledger_gold += other_final_gold
                    other_final_gold = 0

                if other_final_xp > 0:
                    gain_xp(profile, other_final_xp)
                    profile.rank_xp = max(0, profile.rank_xp + other_final_xp)
                profile.gold = max(0, profile.gold + other_final_gold)
                profile.save(update_fields=["gold", "rank_xp", "ledger_gold"])

                other_task.is_completed = True
                if not isinstance(other_task.last_reward_data, dict):
                    other_task.last_reward_data = {}
                other_task.last_reward_data["xp_earned"] = other_final_xp
                other_task.last_reward_data["gold_earned"] = other_final_gold
                other_task.save()

                try:
                    from api.models import UserActivityLog

                    if other_task.task_type == Task.TaskType.DAILY:
                        other_act_type = UserActivityLog.ActivityType.DAILY
                        other_streak = other_task.streak
                    elif other_task.task_type == Task.TaskType.HABIT:
                        other_act_type = UserActivityLog.ActivityType.HABIT_POS
                        other_streak = other_task.pos_streak
                    else:
                        other_act_type = UserActivityLog.ActivityType.TODO
                        other_streak = 0

                    UserActivityLog.objects.create(
                        user=user,
                        activity_type=other_act_type,
                        task=other_task,
                        title=other_task.title,
                        category=other_task.category or "Other",
                        icon=other_task.icon or "",
                        difficulty=other_task.difficulty or "medium",
                        xp_earned=other_final_xp,
                        gold_earned=other_final_gold,
                        streak_value=other_streak,
                        metadata={"mirror_match": True},
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to create UserActivityLog for mirror match task: %s", e
                    )

                mirror_autocomplete_data = {
                    "id": other_task.id,
                    "title": other_task.title,
                    "xp_gained": other_final_xp,
                    "gold_gained": other_final_gold,
                }
    else:
        # Reverting task rewards (applying exact same amounts to avoid XP/Gold farming)
        if (
            task.task_type in [Task.TaskType.DAILY, Task.TaskType.TODO]
            and isinstance(task.last_reward_data, dict)
            and "xp_earned" in task.last_reward_data
        ):
            final_xp_lost = task.last_reward_data.get("xp_earned", 0)
            final_gold_lost = task.last_reward_data.get("gold_earned", 0)
            item_dropped_code = task.last_reward_data.get("item_dropped")

            if item_dropped_code:
                item_obj = Item.objects.filter(code=item_dropped_code).first()
                if item_obj:
                    existing_inv_item = InventoryItem.objects.filter(
                        user_profile=profile, item=item_obj
                    ).first()
                    if existing_inv_item:
                        existing_inv_item.quantity = max(
                            0, existing_inv_item.quantity - 1
                        )
                        if existing_inv_item.quantity == 0:
                            existing_inv_item.delete()
                        else:
                            existing_inv_item.save()

            # Safely revert boss damage if recorded
            damage_to_heal = task.last_reward_data.get("damage_dealt", 0)
            encounter_id = task.last_reward_data.get("encounter_id")
            if damage_to_heal > 0 and encounter_id:
                from api.services.mechanics import revert_boss_damage

                revert_boss_damage(user, encounter_id, damage_to_heal)

            gamification_result = {
                "xp_lost": final_xp_lost,
                "gold_lost": final_gold_lost,
                "hp_lost": 0,
                "item_dropped": None,
                "is_crit": False,
                "damage_dealt": 0,
            }
            task.last_reward_data = {}
        else:
            outcome = calculate_task_outcome(
                user,
                task.task_type,
                base_xp,
                base_gold,
                is_positive=False,
                mutator_effects=mutator_effects,
            )
            gamification_result = outcome

            # Fetch active allies level
            active_codes = profile.active_allies or []

            recruited_allies = {
                a.ally_code: a.level
                for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore[attr-defined]
            }

            # Grier Level 2 Shield Slam
            if outcome.get("grier_shield_slam") and profile.mana >= 5:
                profile.mana = max(0, profile.mana - 5)
                profile.save()
                from api.services.mechanics import apply_boss_damage

                apply_boss_damage(user, outcome["grier_shield_slam_dmg"])
                profile.refresh_from_db()

            # Grier Level 4 Revenge Mark: failed task/habit adds charge
            if recruited_allies.get("grier", 0) >= 4:
                profile.grier_revenge_charges = min(
                    3, profile.grier_revenge_charges + 1
                )

            final_xp_lost = max(
                0, int(outcome.get("xp_lost", 0) * profile.xp_multiplier)
            )
            final_gold_lost = max(
                0, int(outcome.get("gold_lost", 0) * profile.gold_multiplier)
            )

        profile.xp = max(0, profile.xp - final_xp_lost)
        profile.rank_xp = max(0, profile.rank_xp - final_xp_lost)
        profile.gold = max(0, profile.gold - final_gold_lost)
        profile.mana = max(0, profile.mana - mana_gained)
        rewards["xp"] = final_xp_lost
        rewards["gold"] = final_gold_lost

        if task.task_type == Task.TaskType.TODO:
            profile.todos_completed_today = max(0, profile.todos_completed_today - 1)
        elif task.task_type == Task.TaskType.DAILY:
            profile.dailies_completed_today = max(
                0, profile.dailies_completed_today - 1
            )

    profile.save()

    # ── Применяем эффекты скиллов ──────────────────────────────────────
    skill_effects = apply_effects_on_task_complete(profile, task)
    if skill_effects["xp_bonus"] > 0:
        leveled_up = gain_xp(profile, skill_effects["xp_bonus"]) or leveled_up
        profile.rank_xp = max(0, profile.rank_xp + skill_effects["xp_bonus"])
        if leveled_up:
            try:
                membership = user.party_membership
                try:
                    with transaction.atomic():
                        from api.models import PartyEvent

                        PartyEvent.objects.create(
                            party=membership.party,
                            member=membership,
                            event_type="level_up",
                            message=str(profile.level),
                        )
                except Exception as e:
                    logger.warning("Failed to create level_up event: %s", e)
            except ObjectDoesNotExist:
                pass
        profile.save(
            update_fields=[
                "xp",
                "level",
                "xp_to_next_level",
                "hp",
                "mana_max",
                "rank_xp",
            ]
        )

    # ── Боевая система: Наносим урон боссу ────────────────────────────
    from api.services.mechanics import apply_boss_damage
    from api.services.achievement_service import check_and_grant_achievements
    from api.models import UserStats

    combat_result = None
    unlocked_achievements = []

    if is_positive:
        # Update UserStats
        stats, _ = UserStats.objects.get_or_create(user=user)

        stats.total_tasks_completed += 1

        if getattr(task, "streak", 0) > stats.max_streak:
            stats.max_streak = task.streak

        stats.total_gold_earned += final_gold

        category = getattr(task, "category", getattr(task, "tags", None))
        if category == "Prayer/Meditation":
            stats.prayer_sessions += 1

        updated_fields = [
            "total_tasks_completed",
            "max_streak",
            "total_gold_earned",
            "prayer_sessions",
        ]

        if category:
            subjects = (
                stats.unique_subjects if isinstance(stats.unique_subjects, list) else []
            )
            if category not in subjects:
                subjects.append(category)
                stats.unique_subjects = subjects
                updated_fields.append("unique_subjects")

        if updated_fields:
            stats.save(update_fields=updated_fields)

        if category:
            from api.services.mechanics import add_unique_subject_today

            add_unique_subject_today(stats, category)

            # BABEL MODE: Count languages as 3 subjects
            if (
                is_language
                and ActiveEffect.objects.filter(
                    user=user, skill_id="babel_mode"
                ).exists()
            ):
                add_unique_subject_today(stats, "Languages")
                add_unique_subject_today(stats, "English")
                add_unique_subject_today(stats, "Vocabulary")
                ActiveEffect.objects.filter(user=user, skill_id="babel_mode").delete()

        # Урон от статов
        damage_dealt = gamification_result.get("damage_dealt", 0)

        # Базовый урон от сложности
        from api.services.rewards_service import task_rewards as _task_rewards

        _diff = (
            task.difficulty
            if task.difficulty in ["trivial", "easy", "medium", "hard"]
            else "medium"
        )
        base_dmg = (
            task.boss_damage
            if (task.boss_damage is not None and task.boss_damage > 0)
            else _task_rewards(_diff)["dmg"]
        )

        task_type = getattr(task, "task_type", "habit")

        if task_type == "training":
            rank_multipliers = {
                "F": 1.0,
                "E": 2.5,
                "D": 5.0,
                "C": 8.0,
                "B": 12.0,
                "A": 18.0,
                "S": 25.0,
            }
            task_rank = getattr(task, "rank", "F").upper()
            rank_multiplier = rank_multipliers.get(task_rank, 1.0)
            task_base_dmg = int(base_dmg * rank_multiplier)
        else:
            task_value = max(0.0, getattr(task, "value", 1.0))
            task_base_dmg = int(base_dmg * task_value)

        system_overload_mult = (
            3.0 if skill_effects.get("system_overload_triggered") else 1.0
        )
        battle_fury_mult = 1.5 if battle_fury_active else 1.0

        final_damage_dealt = max(
            0,
            int(
                (task_base_dmg + (damage_dealt or 0))
                * profile.damage_multiplier
                * system_overload_mult
                * battle_fury_mult
            ),
        )

        # Grier Level 4 Revenge Mark
        grier_level = recruited_allies.get("grier", 0)
        if grier_level >= 4 and profile.grier_revenge_charges > 0:
            grier_dmg_mult = 1.0 + (0.50 * profile.grier_revenge_charges)
            final_damage_dealt = int(final_damage_dealt * grier_dmg_mult)
            profile.grier_revenge_charges = 0

        # Rhea Level 4: Void Pull
        rhea_level = recruited_allies.get("rhea", 0)
        if rhea_level >= 4 and profile.mana >= 2:
            from api.models import BossEncounter

            active_encounter = BossEncounter.objects.filter(
                user=user, is_defeated=False
            ).first()
            if active_encounter:
                profile.mana -= 2
                void_pull_dmg = int(active_encounter.boss.hp_max * 0.015)
                final_damage_dealt += void_pull_dmg

        # Zephyr Level 5: Grand Finale
        if zephyr_level >= 5 and task.task_type == Task.TaskType.DAILY:
            import zoneinfo

            try:
                user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
            except Exception:
                user_tz = zoneinfo.ZoneInfo("UTC")
            local_now = timezone.now().astimezone(user_tz)
            local_today = local_now.date()

            all_dailies = Task.objects.filter(user=user, task_type=Task.TaskType.DAILY)
            scheduled_dailies = [
                d for d in all_dailies if is_daily_scheduled_for_date(d, local_today)
            ]

            all_completed = True
            for d in scheduled_dailies:
                if d.id == task.id:
                    continue
                is_done = False
                if d.is_completed:
                    is_done = True
                if d.last_completed_at:
                    d_completed_local = d.last_completed_at.astimezone(user_tz).date()
                    if d_completed_local == local_today:
                        is_done = True
                if not is_done:
                    all_completed = False
                    break

            if all_completed:
                final_damage_dealt += 600

        # Vivian Level 4: Life Drain
        vivian_level = recruited_allies.get("vivian", 0)
        if vivian_level >= 4 and final_damage_dealt > 0:
            life_drain_heal = int(final_damage_dealt * 0.10)
            if life_drain_heal > 0:
                profile.hp = min(
                    profile.total_stats.get("hp_max", 100), profile.hp + life_drain_heal
                )

        # Vivian Level 3: Crimson Surge
        if vivian_level >= 3:
            max_hp = profile.total_stats.get("hp_max", 100)
            missing_hp = max(0, max_hp - profile.hp)
            pct_missing = missing_hp / max_hp
            heal_amount = int(pct_missing * 10) * 2
            if heal_amount > 0:
                profile.hp = min(max_hp, profile.hp + heal_amount)

        is_crit = gamification_result.get("is_crit", False)

        # DIS-3: Habit daily boss-damage cap — prevents Habit farming from
        # outscaling Training sessions. Cap = 3 × hard base_dmg = 498.
        # Only applies to positive Habit completions; all other types unaffected.
        if task.task_type == Task.TaskType.HABIT and is_positive:
            from api.services.rewards_service import DAILY_HABIT_DMG_CAP

            remaining = max(0, DAILY_HABIT_DMG_CAP - profile.habit_boss_dmg_today)
            final_damage_dealt = min(final_damage_dealt, remaining)

        profile.save()
        combat_result = apply_boss_damage(user, final_damage_dealt, is_crit)
        profile.refresh_from_db()

        # Track cumulative Habit boss dmg dealt today (for cap enforcement above)
        if (
            task.task_type == Task.TaskType.HABIT
            and is_positive
            and final_damage_dealt > 0
        ):
            profile.habit_boss_dmg_today = min(
                DAILY_HABIT_DMG_CAP,
                profile.habit_boss_dmg_today + final_damage_dealt,
            )
            profile.save(update_fields=["habit_boss_dmg_today"])

        if task.task_type in [Task.TaskType.DAILY, Task.TaskType.TODO]:
            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
            task.last_reward_data["xp_earned"] = final_xp
            task.last_reward_data["gold_earned"] = final_gold
            if combat_result:
                task.last_reward_data["encounter_id"] = combat_result.get(
                    "encounter_id"
                )
                task.last_reward_data["damage_dealt"] = combat_result.get(
                    "damage_dealt", 0
                )
            task.save(update_fields=["last_reward_data"])

        if combat_result and combat_result.get("boss_defeated"):
            boss_rewards = combat_result.get("rewards", {})
            rewards["boss_xp"] = boss_rewards.get("boss_xp", 0)
            rewards["boss_gold"] = boss_rewards.get("boss_gold", 0)
            rewards["boss_sp"] = boss_rewards.get("boss_sp", 0)

        profile.save()

        # Check achievements at the very end
        unlocked_achievements = check_and_grant_achievements(user)

    # ── Record unified UserActivityLog ───────────────────────────────
    try:
        from api.models import UserActivityLog

        if not is_positive and task.task_type in [
            Task.TaskType.DAILY,
            Task.TaskType.TODO,
        ]:
            # Uncomplete/Revert: remove the most recent completion log for this task so history is 100% synced
            latest_log = (
                UserActivityLog.objects.filter(
                    user=user,
                    task=task,
                    activity_type__in=[
                        UserActivityLog.ActivityType.DAILY,
                        UserActivityLog.ActivityType.TODO,
                    ],
                )
                .order_by("-created_at")
                .first()
            )
            if latest_log:
                latest_log.delete()
        else:
            if task.task_type == Task.TaskType.HABIT:
                act_type = (
                    UserActivityLog.ActivityType.HABIT_POS
                    if is_positive
                    else UserActivityLog.ActivityType.HABIT_NEG
                )
                act_streak = task.pos_streak if is_positive else task.neg_streak
                act_hp_lost = (
                    final_damage
                    if (not is_positive and "final_damage" in locals())
                    else 0
                )
            elif task.task_type == Task.TaskType.DAILY:
                act_type = UserActivityLog.ActivityType.DAILY
                act_streak = task.streak
                act_hp_lost = 0
            else:
                act_type = UserActivityLog.ActivityType.TODO
                act_streak = 0
                act_hp_lost = 0

            total_earned_xp = rewards.get("xp", 0)
            if (
                is_positive
                and "skill_effects" in locals()
                and isinstance(skill_effects, dict)
            ):
                total_earned_xp += skill_effects.get("xp_bonus", 0)

            UserActivityLog.objects.create(
                user=user,
                activity_type=act_type,
                task=task,
                title=task.title,
                category=getattr(task, "category", "Other") or "Other",
                icon=getattr(task, "icon", "") or "",
                difficulty=getattr(task, "difficulty", "medium") or "medium",
                xp_earned=total_earned_xp if is_positive else 0,
                gold_earned=rewards.get("gold", 0) if is_positive else 0,
                hp_lost=act_hp_lost,
                mana_gained=mana_gained if is_positive else 0,
                boss_damage=(
                    final_damage_dealt
                    if (is_positive and "final_damage_dealt" in locals())
                    else 0
                ),
                streak_value=act_streak,
                metadata={
                    "is_positive": is_positive,
                    "value_after": task.value,
                    "combat_result": combat_result if combat_result else None,
                },
            )
    except Exception as e:
        logger.warning("Failed to update UserActivityLog for task %s: %s", task.id, e)

    return {
        "detail": "Task completed!",
        "leveled_up": leveled_up,
        "skill_effects": skill_effects["notes"],
        "rewards": rewards,
        "task": task,
        "profile": profile,
        "combat": combat_result,
        "xp_earned": rewards["xp"] if is_positive else -rewards.get("xp", 0),
        "gold_earned": rewards["gold"] if is_positive else -rewards.get("gold", 0),
        "mana_gained": mana_gained if is_positive else -mana_gained,
        "gamification_result": gamification_result,
        "newly_unlocked_achievements": unlocked_achievements,
        "is_dead": mutator_died,
        "died": mutator_died,
        "silent_mode": mutator_effects.get("silent_mode", False),
        "mirror_match_autocomplete": mirror_autocomplete_data,
    }


def calc_new_value(current: float, event: str, task_type: str) -> float:
    TV_MIN = -47.0
    TV_MAX = 21.0
    step = 1.0 + abs(current) * 0.1
    decay = 0.9747

    if event == "complete":
        delta = step * decay
    else:
        fail_mult = 1.5 if task_type == "daily" else 1.0
        delta = -step * fail_mult

    range_val = (TV_MAX - current) if event == "complete" else (current - TV_MIN)
    squeeze = max(0.1, min(1.0, range_val / 15.0))

    effective_delta = max(-1.0, min(1.0, delta * squeeze))

    return max(TV_MIN, min(TV_MAX, current + effective_delta))


@transaction.atomic
def process_missed_tasks(user):
    """
    Проверяет, наступил ли новый день, начисляет урон за невыполненные дейлики на бэкенде,  # noqa: E501
    сбрасывает их флаг выполнения и возвращает обновленный профиль.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)
    import zoneinfo

    try:
        user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")

    from api.services.mechanics import get_passive_multipliers

    passive_effects = get_passive_multipliers(profile, {})

    # Rhea Level 3: Gravity Well (4h daily deadline extension)
    adjusted_now = timezone.now()
    if passive_effects.get("rhea_gravity_well", False):
        adjusted_now -= timedelta(hours=4)

    local_today = adjusted_now.astimezone(user_tz).date()

    # Если крон еще не запускался или сегодня новый день по локальному времени
    if profile.last_daily_cron_at is None:
        profile.last_daily_cron_at = local_today
        profile.save()
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

    if profile.last_daily_cron_at >= local_today:
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

    profile.tasks_completed_today = 0
    profile.habits_completed_today = 0
    profile.habit_boss_dmg_today = 0  # DIS-3 cap resets with daily window
    profile.todos_completed_today = 0
    profile.dailies_completed_today = 0
    dailies = Task.objects.filter(user=user, task_type=Task.TaskType.DAILY)
    total_dmg = 0
    log = []

    from api.services.combat_service import calculate_fail_damage
    from api.models import ActiveEffect

    iron_fast_active = ActiveEffect.objects.filter(
        user=user, skill_id="iron_fast"
    ).exists()
    transcendence_active = ActiveEffect.objects.filter(
        user=user, skill_id="transcendence"
    ).exists()
    elixir_active = ActiveEffect.objects.filter(
        user=user, skill_id="elixir", expires_at__gt=timezone.now()
    ).exists()

    from api.services.mechanics import get_passive_multipliers

    passive_effects = get_passive_multipliers(profile, {})

    has_scheduled_dailies = False
    has_missed_scheduled_daily = False

    for task in dailies:
        # If the task is not scheduled for the day that just ended, skip penalty
        if not is_daily_scheduled_for_date(task, profile.last_daily_cron_at):
            if task.is_completed:
                task.is_completed = False
                task.save()
            continue

        has_scheduled_dailies = True

        # Проверяем, был ли дейлик выполнен вчера
        # Если last_completed_at равен дате последнего крона (или позже, но до сегодня) в локальном времени
        was_completed = False
        if task.is_completed and task.last_completed_at:
            last_completed_local = task.last_completed_at.astimezone(user_tz).date()
            was_completed = last_completed_local >= profile.last_daily_cron_at

        if was_completed:
            task.is_completed = False
            # Note: Do not clear task.last_completed_at so check-in history and streak audit know it was done yesterday.
            # Tomorrow's clicks are never blocked because _complete_task_logic checks last_completed_local == local_today.
            log.append({"type": "daily_done", "id": task.id, "title": task.title})
        else:
            # Missed daily
            has_missed_scheduled_daily = True
            profile.total_overdue_tasks += 1

            active_mutators = profile.active_mutators or {}
            active_list = (
                active_mutators.get("active", [])
                if isinstance(active_mutators, dict)
                else []
            )
            active_ids = [
                m.get("id") if isinstance(m, dict) else m for m in active_list
            ]

            if "ironman" in active_ids:
                profile.hp = max(1, int(profile.hp * 0.75))
                profile.gold = max(0, int(profile.gold * 0.90))

            if "double_nothing" in active_ids:
                profile.hp = int(profile.hp * 0.50)

            dmg = calculate_fail_damage(task, profile)
            if iron_fast_active or elixir_active:
                dmg = 0
            context = {
                "is_science": False,
                "is_language": False,
                "is_exercise": False,
                "is_prayer": False,
                "task_type": "daily",
                "hours": 0,
            }
            from api.services.mechanics import apply_active_mutators

            mutator_effects = apply_active_mutators(
                profile, context, trigger_side_effects=False
            )

            outcome = calculate_task_outcome(
                user,
                "daily",
                base_hp_lost=dmg,
                is_positive=False,
                mutator_effects=mutator_effects,
            )
            final_dmg = outcome["hp_lost"]

            active_codes = profile.active_allies or []

            recruited_allies = {
                a.ally_code: a.level
                for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore[attr-defined]
            }

            # Rhea Level 3: Gravity Well +30% HP damage penalty on miss
            if passive_effects.get("rhea_gravity_well", False):
                final_dmg = int(final_dmg * 1.30)

            # Kage Level 5 Executioner: failed daily when boss < 15% HP deals 50% more HP damage
            kage_level = recruited_allies.get("kage", 0)
            if kage_level >= 5:
                from api.models import BossEncounter

                active_encounter = BossEncounter.objects.filter(
                    user=user, is_defeated=False
                ).first()
                if (
                    active_encounter
                    and active_encounter.hp_current
                    < active_encounter.boss.hp_max * 0.15
                ):
                    final_dmg = int(final_dmg * 1.5)

            # Grier Level 5 Unbreakable Will: below 20% HP, prevents all HP damage from missed dailies
            grier_l5_active = passive_effects.get("grier_unbreakable_will", False)
            below_20_hp = profile.hp < profile.total_stats.get("hp_max", 100) * 0.20
            if grier_l5_active and below_20_hp:
                final_dmg = 0

            # Grier Level 2 Shield Slam
            if outcome.get("grier_shield_slam") and profile.mana >= 5:
                profile.mana = max(0, profile.mana - 5)
                profile.save()
                from api.services.mechanics import apply_boss_damage

                apply_boss_damage(user, outcome["grier_shield_slam_dmg"])
                profile.refresh_from_db()

            # Grier Level 4 Revenge Mark: failed daily adds charge
            if recruited_allies.get("grier", 0) >= 4:
                profile.grier_revenge_charges = min(
                    3, profile.grier_revenge_charges + 1
                )

            total_dmg += final_dmg
            task.is_completed = False
            if not transcendence_active:
                habit_shield = passive_effects.get("habit_shield", False)
                if not isinstance(task.last_reward_data, dict):
                    task.last_reward_data = {}

                if habit_shield:
                    shield_used = task.last_reward_data.get("shield_used", False)
                    if not shield_used:
                        task.last_reward_data["shield_used"] = True
                    else:
                        task.streak = 0
                        task.last_reward_data["shield_used"] = False
                else:
                    task.streak = 0
                    task.last_reward_data["shield_used"] = False

            task.value = calc_new_value(task.value, "fail", "daily")

            # Mirror might give XP on failed dailies
            xp_gained = outcome.get("xp_earned", 0)
            if xp_gained > 0:
                gain_xp(profile, xp_gained)
                profile.rank_xp += xp_gained

            log.append(
                {
                    "type": "daily_missed",
                    "id": task.id,
                    "title": task.title,
                    "damage": final_dmg,
                    "gamification_result": outcome,
                }
            )

        task.save()

    # Timezone-Safe Party Streak Decay
    if has_scheduled_dailies and has_missed_scheduled_daily:
        if hasattr(user, "party_membership"):
            membership = user.party_membership
            party = membership.party
            if party.streak > 0:
                party.streak = 0
                party.last_streak_update_date = local_today
                party.save(update_fields=["streak", "last_streak_update_date"])

                from api.models import PartyEvent

                PartyEvent.objects.create(
                    party=party,
                    member=membership,
                    event_type="milestone",
                    message="streak was broken because they missed a Daily task.",
                    metadata={"username": user.username},
                )

    daily_regen = passive_effects.get("daily_hp_regen", 0.0)

    profile.hp = max(0, profile.hp - total_dmg)
    if daily_regen > 0:
        profile.hp = min(profile.max_hp, profile.hp + daily_regen)

    profile.last_daily_cron_at = local_today
    profile.save(
        update_fields=[
            "hp",
            "gold",
            "last_daily_cron_at",
            "rank_xp",
            "level",
            "tasks_completed_today",
            "habits_completed_today",
            "habit_boss_dmg_today",
            "todos_completed_today",
            "dailies_completed_today",
            "total_overdue_tasks",
            "mana",
            "grier_revenge_charges",
        ]
    )

    died = check_death(profile)

    return {
        "fired": True,
        "total_dmg": total_dmg,
        "profile": profile,
        "is_dead": died,
        "log": log,
        "died": died,
    }


def sync_zero_damage_penalties(user, profile=None):
    """
    Auto-heals habit negative penalties that were recorded with 0 HP lost
    due to earlier DEF truncation bugs.
    Ensures each penalty has at least 1 HP damage and deducts the difference
    from the user's HP.
    """
    from api.models import UserActivityLog, UserProfile
    from api.services.combat_service import calculate_fail_damage
    from api.services.mechanics import calculate_task_outcome

    if profile is None:
        profile = getattr(user, "profile", None)
        if profile is None:
            profile = UserProfile.objects.filter(user=user).first()

    zero_penalties = UserActivityLog.objects.filter(
        user=user,
        activity_type=UserActivityLog.ActivityType.HABIT_NEG,
        hp_lost=0,
    )

    if not zero_penalties.exists():
        return 0

    total_damage_to_deduct = 0
    for log in zero_penalties:
        dmg = 1
        if log.task:
            try:
                base_dmg = calculate_fail_damage(log.task, profile)
                mult = 1.0 + (getattr(log, "streak_value", 0) * 0.1)
                calc_dmg = int(base_dmg * mult)
                outcome = calculate_task_outcome(
                    user, "habit", base_hp_lost=calc_dmg, is_positive=False
                )
                dmg = max(1, outcome.get("hp_lost", 1))
            except Exception:
                pass
        else:
            diff = getattr(log, "difficulty", "medium") or "medium"
            dmg = 2 if diff in ["medium", "hard", "critical"] else 1

        log.hp_lost = dmg
        if isinstance(log.metadata, dict):
            penalty = log.metadata.get("penalty")
            if isinstance(penalty, dict):
                penalty["hp"] = -dmg
            else:
                log.metadata["penalty"] = {"hp": -dmg}
        else:
            log.metadata = {"penalty": {"hp": -dmg}}
        log.save(update_fields=["hp_lost", "metadata"])
        total_damage_to_deduct += dmg

    if profile and total_damage_to_deduct > 0:
        profile.hp = max(1, profile.hp - total_damage_to_deduct)
        profile.save(update_fields=["hp"])

    return total_damage_to_deduct

