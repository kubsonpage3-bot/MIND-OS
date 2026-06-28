from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import ValidationError
from api.models import Task, UserProfile, Item, InventoryItem
from api.services.skill_service import apply_effects_on_task_complete
from api.services.profile_service import gain_xp, check_rank_demotion
from api.services.mechanics import calculate_task_outcome


@transaction.atomic
def complete_task(user, task_id, is_positive=True):
    """
    Выполнение задачи и начисление наград.
    Использует transaction.atomic и select_for_update для предотвращения состояния гонки.
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
        else:
            if not task.is_completed:
                raise ValidationError("Task is not completed.")
            task.is_completed = False
            task.last_completed_at = None
            task.completion_count = max(0, task.completion_count - 1)

    elif task.task_type == Task.TaskType.DAILY:
        if is_positive:
            today = timezone.now().date()
            if task.last_completed_at and task.last_completed_at.date() == today:
                raise ValidationError("Daily task already completed today.")
            task.last_completed_at = timezone.now()
            task.is_completed = True
            task.value = calc_new_value(task.value, "complete", "daily")
            task.completion_count += 1
            task.streak += 1
        else:
            task.last_completed_at = None
            task.is_completed = False
            task.value = calc_new_value(task.value, "fail", "daily")
            task.completion_count = max(0, task.completion_count - 1)
            task.streak = 0

    elif task.task_type == Task.TaskType.HABIT:
        task.completion_count += 1
        task.value = calc_new_value(
            task.value, "complete" if is_positive else "fail", "habit"
        )
        if is_positive:
            task.pos_streak += 1
            task.neg_streak = 0
            # Увеличиваем награды в зависимости от размера pos_streak (по 5% за каждый стрик)
            streak_mult = 1.0 + (task.pos_streak * 0.05)
            rewards["xp"] = int(rewards["xp"] * streak_mult)
            rewards["gold"] = int(rewards["gold"] * streak_mult)
        else:
            task.neg_streak += 1
            task.pos_streak = 0

            from api.services.combat_service import calculate_fail_damage

            base_damage = calculate_fail_damage(task, profile)

            # Увеличиваем урон в зависимости от размера neg_streak (по 10% за каждый провал подряд)
            damage_mult = 1.0 + (task.neg_streak * 0.1)
            damage = int(base_damage * damage_mult)
            
            outcome = calculate_task_outcome(user, "habit", base_hp_lost=damage, is_positive=False)
            final_damage = outcome["hp_lost"]

            died = False
            if profile.hp - final_damage <= 0:
                died = True
                profile.hp = 0
            else:
                profile.hp -= final_damage
            profile.save(update_fields=["hp"])
            if died:
                check_rank_demotion(profile)
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

    if is_positive:
        outcome = calculate_task_outcome(user, task.task_type, rewards.get("xp", 0), rewards.get("gold", 0), is_positive=True)
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
                inv_item, created = InventoryItem.objects.get_or_create(user_profile=profile, item=item_obj)
                if not created:
                    inv_item.quantity += 1
                    inv_item.save()
    else:
        # Reverting task rewards (ignoring multipliers for reverting, or we can use them, but easier to use base)
        outcome = calculate_task_outcome(user, task.task_type, rewards.get("xp", 0), rewards.get("gold", 0), is_positive=False)
        gamification_result = outcome
        
        profile.xp = max(0, profile.xp - max(0, outcome.get("xp_lost", 0)))
        profile.rank_xp = max(0, profile.rank_xp - max(0, outcome.get("xp_lost", 0)))
        profile.gold = max(0, profile.gold - max(0, outcome.get("gold_lost", 0)))
        profile.mana = max(0, profile.mana - mana_gained)

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
    from api.models import BossEncounter

    combat_result = None
    active_encounter = BossEncounter.objects.filter(
        user=user, is_defeated=False
    ).first()
    
    if active_encounter and is_positive:
        damage_dealt = gamification_result.get("damage_dealt", 0)
        
        # Урон зависит от сложности (аналог фронтенда: easy=25, medium=50, hard=75, trivial=15)
        # User requested: Base_Damage + total_stats['pwr'].
        # However, to retain difficulty scaling, let's inject it into the mechanics.py or here.
        # Since we already calculated damage_dealt in mechanics.py (base 10 + PWR), let's scale it by task value/difficulty.
        base_dmg_map = {"trivial": 15, "easy": 25, "medium": 50, "hard": 75}
        task_base_dmg = base_dmg_map.get(task.difficulty, 25) * task.value
        
        # Combine the mechanics damage (PWR + base 10) with task base damage
        final_damage_dealt = int((task_base_dmg + damage_dealt) * profile.damage_multiplier)
        
        if gamification_result.get("is_crit"):
            final_damage_dealt *= 2

        active_encounter.hp_current = max(0, active_encounter.hp_current - final_damage_dealt)
        boss_defeated = False
        
        if active_encounter.hp_current <= 0:
            active_encounter.hp_current = 0
            active_encounter.is_defeated = True
            boss_defeated = True
            
            # Automatically grant Boss rewards
            boss = active_encounter.boss
            if boss:
                leveled_up = gain_xp(profile, boss.reward_xp) or leveled_up
                profile.rank_xp += boss.reward_xp
                profile.gold += boss.reward_gold
                profile.save(update_fields=["xp", "level", "xp_to_next_level", "rank_xp", "gold"])
                
                # Add to total rewards response
                rewards["xp"] += boss.reward_xp
                rewards["gold"] += boss.reward_gold
                
        active_encounter.save(update_fields=["hp_current", "is_defeated"])
        
        combat_result = {
            "damage_dealt": final_damage_dealt,
            "boss_hp_remaining": active_encounter.hp_current,
            "boss_defeated": boss_defeated
        }

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
    Проверяет, наступил ли новый день, начисляет урон за невыполненные дейлики на бэкенде,
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
            task.value = calc_new_value(task.value, "complete", "daily")
            log.append({"type": "daily_done", "id": task.id, "title": task.title})
        else:
            # Missed daily
            dmg = calculate_fail_damage(task, profile)
            outcome = calculate_task_outcome(user, "daily", base_hp_lost=dmg, is_positive=False)
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

    died = False
    if total_dmg > 0:
        profile.hp = max(0, profile.hp - total_dmg)
        if profile.hp == 0:
            died = True

    profile.last_daily_cron_at = today
    profile.save(update_fields=["hp", "last_daily_cron_at"])
    if died:
        check_rank_demotion(profile)

    return {
        "fired": True,
        "total_dmg": total_dmg,
        "profile": profile,
        "log": log,
        "died": died,
    }
