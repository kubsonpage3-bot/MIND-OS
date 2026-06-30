from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import ValidationError
from api.models import Task, UserProfile, Item, InventoryItem
from api.services.skill_service import apply_effects_on_task_complete
from api.services.profile_service import gain_xp, check_death
from api.services.mechanics import calculate_task_outcome


@transaction.atomic
def complete_task(user, task_id, is_positive=True):
    """
    Выполнение задачи и начисление наград.
    Использует transaction.atomic и select_for_update для предотвращения состояния гонки.  # noqa: E501
    """
    try:
        task = Task.objects.get(id=task_id, user=user)
    except Task.DoesNotExist:
        raise ValidationError("Task not found.")

    # Блокируем профиль для обновления в рамках транзакции
    profile = UserProfile.objects.select_for_update().get(user=user)
    rewards = task.get_rewards()
    gamification_result = {}

    # ── Логика по типу задачи ─────────────────────────────────────────
    if task.task_type == Task.TaskType.TODO:
        if is_positive:
            if task.is_completed:
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
        today = timezone.now().date()
        already_done_today = (
            task.last_completed_at and task.last_completed_at.date() == today
        )

        if is_positive:
            if already_done_today:
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
            task.streak = max(0, task.streak - 1)

    elif task.task_type == Task.TaskType.HABIT:
        task.completion_count += 1
        task.value = calc_new_value(
            task.value, "complete" if is_positive else "fail", "habit"
        )
        if is_positive:
            task.pos_streak += 1
            task.neg_streak = 0
            # Увеличиваем награды в зависимости от размера pos_streak (по 5% за каждый стрик)  # noqa: E501
            streak_mult = 1.0 + (task.pos_streak * 0.05)
            rewards["xp"] = int(rewards["xp"] * streak_mult)
            rewards["gold"] = int(rewards["gold"] * streak_mult)
        else:
            task.neg_streak += 1
            task.pos_streak = 0

            from api.services.combat_service import calculate_fail_damage

            base_damage = calculate_fail_damage(task, profile)

            # Увеличиваем урон в зависимости от размера neg_streak (по 10% за каждый провал подряд)  # noqa: E501
            damage_mult = 1.0 + (task.neg_streak * 0.1)
            damage = int(base_damage * damage_mult)

            outcome = calculate_task_outcome(
                user, "habit", base_hp_lost=damage, is_positive=False
            )
            final_damage = outcome["hp_lost"]

            died = False
            if profile.hp - final_damage <= 0:
                died = True
                profile.hp = 0
            else:
                profile.hp -= final_damage
            profile.save(update_fields=["hp"])

            died = check_death(profile)

            task.save()
            return {
                "detail": "Habit deviation noted.",
                "penalty": {"hp": -final_damage},
                "profile": profile,
                "task": task,
                "leveled_up": False,
                "rewards": {"xp": 0, "gold": 0},
                "skill_effects": [],
                "died": died,
                "is_dead": died,
                "gamification_result": outcome,
            }

    task.save()

    # ── Начисляем награды персонажу ───────────────────────────────────
    mana_gained = (
        2
        if task.task_type == Task.TaskType.HABIT
        else (5 if task.task_type == Task.TaskType.DAILY else 3)
    )
    leveled_up = False

    # Fetch passive modifiers from DB
    unlocked_skills = set(profile.unlocked_skills.values_list("skill_code", flat=True))
    recruited_allies = {a.ally_code: a.level for a in profile.recruited_allies.all()}

    # Calculate additive multipliers
    gold_mult = 1.0
    xp_mult = 1.0

    # Skills
    if "resource_awareness" in unlocked_skills:
        gold_mult += 0.10

    # Allies
    neko_level = recruited_allies.get("neko", 0)
    if neko_level >= 1 and task.task_type == Task.TaskType.DAILY:
        gold_mult += 0.05
    if neko_level >= 5:
        gold_mult += 0.15

    sakura_level = recruited_allies.get("sakura", 0)
    if sakura_level >= 4:
        xp_mult += 0.08

    yuki_level = recruited_allies.get("yuki", 0)
    if yuki_level >= 1:
        xp_mult += 0.08

    # Apply multipliers to base task rewards
    base_xp = int(rewards.get("xp", 0) * xp_mult)
    base_gold = int(rewards.get("gold", 0) * gold_mult)

    if is_positive:
        outcome = calculate_task_outcome(
            user, task.task_type, base_xp, base_gold, is_positive=True
        )
        gamification_result = outcome

        final_xp = max(0, int(outcome["xp_earned"] * profile.xp_multiplier))
        final_gold = max(0, int(outcome["gold_earned"] * profile.gold_multiplier))

        leveled_up = gain_xp(profile, final_xp)
        profile.rank_xp = max(0, profile.rank_xp + final_xp)
        profile.gold = max(0, profile.gold + final_gold)
        profile.mana = min(profile.mana_max, profile.mana + mana_gained)
        rewards["xp"] = final_xp
        rewards["gold"] = final_gold

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
            task.last_reward_data["xp_earned"] = final_xp
            task.last_reward_data["gold_earned"] = final_gold
            task.last_reward_data["item_dropped"] = outcome.get("item_dropped")
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
                    inv_item = InventoryItem.objects.filter(
                        user_profile=profile, item=item_obj
                    ).first()
                    if inv_item:
                        inv_item.quantity = max(0, inv_item.quantity - 1)
                        if inv_item.quantity == 0:
                            inv_item.delete()
                        else:
                            inv_item.save()

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
                user, task.task_type, base_xp, base_gold, is_positive=False
            )
            gamification_result = outcome

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

    profile.save()

    # ── Применяем эффекты скиллов ──────────────────────────────────────
    skill_effects = apply_effects_on_task_complete(profile, task)
    if skill_effects["xp_bonus"] > 0:
        leveled_up = gain_xp(profile, skill_effects["xp_bonus"]) or leveled_up
        profile.save(
            update_fields=[
                "xp",
                "xp_to_next_level",
                "level",
                "hp",
                "hp_max",
                "mana_max",
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
        try:
            stats = user.stats
        except UserStats.DoesNotExist:
            stats = UserStats.objects.create(user=user)

        stats.total_tasks_completed += 1

        if getattr(task, "streak", 0) > stats.max_streak:
            stats.max_streak = task.streak

        stats.total_gold_earned += final_gold

        category = getattr(task, "category", getattr(task, "tags", None))
        if category == "Prayer/Meditation":
            stats.prayer_sessions += 1

        if category:
            subjects = (
                stats.unique_subjects if isinstance(stats.unique_subjects, list) else []
            )
            if category not in subjects:
                subjects.append(category)
                stats.unique_subjects = subjects

        stats.save(
            update_fields=[
                "total_tasks_completed",
                "max_streak",
                "total_gold_earned",
                "prayer_sessions",
                "unique_subjects",
            ]
        )

        # Урон от статов
        damage_dealt = gamification_result.get("damage_dealt", 0)

        # Базовый урон от сложности (Easy, Medium, Hard)
        base_dmg_map = {"trivial": 15, "easy": 25, "medium": 50, "hard": 75}
        base_dmg = base_dmg_map.get(task.difficulty, 25)

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

        final_damage_dealt = max(
            0, int((task_base_dmg + damage_dealt) * profile.damage_multiplier)
        )
        is_crit = gamification_result.get("is_crit", False)

        combat_result = apply_boss_damage(user, final_damage_dealt, is_crit)

        if combat_result and combat_result.get("boss_defeated"):
            boss_rewards = combat_result.get("rewards", {})
            rewards["xp"] += boss_rewards.get("boss_xp", 0)
            rewards["gold"] += boss_rewards.get("boss_gold", 0)

        # Check achievements at the very end
        unlocked_achievements = check_and_grant_achievements(user)

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
        "unlocked_achievements": unlocked_achievements,
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

    return max(TV_MIN, min(TV_MAX, current + delta * squeeze))


@transaction.atomic
def process_missed_tasks(user):
    """
    Проверяет, наступил ли новый день, начисляет урон за невыполненные дейлики на бэкенде,  # noqa: E501
    сбрасывает их флаг выполнения и возвращает обновленный профиль.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)
    today = timezone.now().date()

    # Если крон еще не запускался или сегодня новый день
    if profile.last_daily_cron_at is None:
        profile.last_daily_cron_at = today
        profile.save()
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

    if profile.last_daily_cron_at >= today:
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

    dailies = Task.objects.filter(user=user, task_type=Task.TaskType.DAILY)
    total_dmg = 0
    log = []

    from api.services.combat_service import calculate_fail_damage

    for task in dailies:
        # Проверяем, был ли дейлик выполнен вчера
        # Если last_completed_at равен дате последнего крона (или позже, но до сегодня)
        was_completed = (
            task.is_completed
            and task.last_completed_at
            and task.last_completed_at.date() >= profile.last_daily_cron_at
        )

        if was_completed:
            task.is_completed = False
            task.last_completed_at = (
                None  # Clear timestamp so tomorrow's first click is never blocked.
            )
            task.value = calc_new_value(task.value, "complete", "daily")
            log.append({"type": "daily_done", "id": task.id, "title": task.title})
        else:
            # Missed daily
            dmg = calculate_fail_damage(task, profile)
            outcome = calculate_task_outcome(
                user, "daily", base_hp_lost=dmg, is_positive=False
            )
            final_dmg = outcome["hp_lost"]
            total_dmg += final_dmg
            task.is_completed = False
            task.streak = 0
            task.value = calc_new_value(task.value, "fail", "daily")
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

    profile.hp = max(0, profile.hp - total_dmg)
    profile.last_daily_cron_at = today
    profile.save(update_fields=["hp", "last_daily_cron_at"])

    died = check_death(profile)

    return {
        "fired": True,
        "total_dmg": total_dmg,
        "profile": profile,
        "is_dead": died,
        "log": log,
        "died": died,
    }
