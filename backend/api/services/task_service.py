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
        task = Task.objects.select_for_update().get(id=task_id, user=user)
    except Task.DoesNotExist:
        raise ValidationError("Task not found.")

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
            if not transcendence_active:
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
            if not transcendence_active:
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
    base_mana = (
        2
        if task.task_type == Task.TaskType.HABIT
        else (5 if task.task_type == Task.TaskType.DAILY else 3)
    )
    leveled_up = False

    # Apply mutators and passives
    from api.services.mechanics import apply_active_mutators, get_passive_multipliers

    task_category = getattr(task, "category", "")
    is_science = task_category in {"Math", "Physics", "Coding", "Chemistry", "Biology"}
    is_language = task_category in {"English", "Languages", "History", "Philosophy"}
    is_exercise = task_category in {"Exercise", "Running"}
    is_prayer = task_category in {"Prayer", "Mindfulness", "Prayer/Meditation"}

    context = {
        "is_science": is_science,
        "is_language": is_language,
        "is_exercise": is_exercise,
        "is_prayer": is_prayer,
        "task_type": "daily" if task.task_type == Task.TaskType.DAILY else "",
        "hours": 0,
    }

    mutator_effects = apply_active_mutators(profile, context)
    passive_effects = get_passive_multipliers(profile, context)

    mutator_died = mutator_effects.get("is_dead", False)

    mana_gained = int(base_mana * passive_effects.get("mana_regen_mult", 1.0))

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

    if is_positive:
        outcome = calculate_task_outcome(
            user,
            task.task_type,
            base_xp,
            base_gold,
            is_positive=True,
            passive_effects=passive_effects,
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

        try:
            membership = user.partymembership

            today_iso = timezone.now().date().isocalendar()
            current_iso_week = f"{today_iso[0]}-W{today_iso[1]:02d}"

            if membership.weekly_xp_reset_week != current_iso_week:
                membership.weekly_xp = 0
                membership.weekly_xp_reset_week = current_iso_week

            membership.weekly_xp += final_xp

            # Party streak logic: if this is a daily
            if task.task_type == task.TaskType.DAILY:
                today = timezone.now().date()
                if membership.last_daily_completed_date != today:
                    membership.last_daily_completed_date = today
                    party = membership.party
                    # Only increment party streak if we haven't done it today
                    if (
                        party.last_streak_update_date is None
                        or party.last_streak_update_date < today
                    ):
                        # Check if all members have completed a daily today
                        # Members who joined today have last_daily_completed = yesterday,
                        # so they need to complete one today to contribute. Wait, if they just joined,
                        # we want to require them to do it. Yes.
                        # Wait, what if someone hasn't logged in? Their last_daily_completed_date < today
                        all_done = not party.memberships.filter(
                            last_daily_completed_date__lt=today
                        ).exists()
                        if all_done:
                            party.streak += 1
                            party.last_streak_update_date = today
                            party.save(
                                update_fields=["streak", "last_streak_update_date"]
                            )

                            from api.models import PartyEvent

                            if party.streak in [3, 7, 14, 30, 50, 100, 365]:
                                PartyEvent.objects.create(
                                    party=party,
                                    member=membership,
                                    event_type="milestone",
                                    message=f"hit a {party.streak}-day streak!",
                                )

            membership.save(
                update_fields=[
                    "weekly_xp",
                    "weekly_xp_reset_week",
                    "last_daily_completed_date",
                ]
            )

            # Log event
            if final_xp > 0:
                from api.models import PartyEvent

                PartyEvent.objects.create(
                    party=membership.party,
                    member=membership,
                    event_type="task_completed",
                    message=task.title,
                )
        except Exception:
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
            task.last_reward_data["xp_earned"] = final_xp
            task.last_reward_data["gold_earned"] = final_gold
            task.last_reward_data["item_dropped"] = outcome.get("item_dropped")
            task.save(update_fields=["last_reward_data"])
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
        if leveled_up:
            try:
                membership = user.partymembership
                from api.models import PartyEvent

                PartyEvent.objects.create(
                    party=membership.party,
                    member=membership,
                    event_type="level_up",
                    message=str(profile.level),
                )
            except Exception:
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

        boss_dmg_mult = passive_effects.get("boss_dmg_mult", 1.0)

        system_overload_mult = (
            3.0 if skill_effects.get("system_overload_triggered") else 1.0
        )
        battle_fury_mult = 1.5 if battle_fury_active else 1.0

        final_damage_dealt = max(
            0,
            int(
                (task_base_dmg + damage_dealt)
                * profile.damage_multiplier
                * boss_dmg_mult
                * system_overload_mult
                * battle_fury_mult
            ),
        )
        is_crit = gamification_result.get("is_crit", False)

        combat_result = apply_boss_damage(user, final_damage_dealt, is_crit)

        if task.task_type in [Task.TaskType.DAILY, Task.TaskType.TODO]:
            if not isinstance(task.last_reward_data, dict):
                task.last_reward_data = {}
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
        "newly_unlocked_achievements": unlocked_achievements,
        "is_dead": mutator_died,
        "died": mutator_died,
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
    import pytz

    user_tz = pytz.timezone(profile.timezone or "UTC")
    local_today = timezone.now().astimezone(user_tz).date()

    # Если крон еще не запускался или сегодня новый день по локальному времени
    if profile.last_daily_cron_at is None:
        profile.last_daily_cron_at = local_today
        profile.save()
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

    if profile.last_daily_cron_at >= local_today:
        return {"fired": False, "total_dmg": 0, "profile": profile, "log": []}

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
            if iron_fast_active or elixir_active:
                dmg = 0
            outcome = calculate_task_outcome(
                user, "daily", base_hp_lost=dmg, is_positive=False
            )
            final_dmg = outcome["hp_lost"]
            total_dmg += final_dmg
            task.is_completed = False
            if not transcendence_active:
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

    from api.services.mechanics import get_passive_multipliers

    passive_effects = get_passive_multipliers(profile, {})
    daily_regen = passive_effects.get("daily_hp_regen", 0.0)

    profile.hp = max(0, profile.hp - total_dmg)
    if daily_regen > 0:
        profile.hp = min(profile.max_hp, profile.hp + daily_regen)

    profile.last_daily_cron_at = local_today
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
