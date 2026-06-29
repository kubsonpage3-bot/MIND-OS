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

        outcome = calculate_task_outcome(user, task.task_type, base_xp, base_gold, is_positive=True)
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
    from api.services.mechanics import apply_boss_damage

    combat_result = None
    
    if is_positive:
        # 1. Урон от статов 
        damage_dealt = gamification_result.get("damage_dealt", 0)
        
        # 2. Базовый урон от сложности (Easy, Medium, Hard)
        base_dmg_map = {"trivial": 15, "easy": 25, "medium": 50, "hard": 75}
        base_dmg = base_dmg_map.get(task.difficulty, 25)
        
        # ИЗВЛЕКАЕМ ТИП И РАНГ (Безопасно, чтобы не сломать БД)
        task_type = getattr(task, "task_type", "habit")
        
        if task_type == "training":
            # ПРОГРЕССИЯ ТРЕНИРОВОК: Балансируем под огромный урон от привычек
            # Ранги выступают в роли мощного множителя базы, чтобы пробивать 20к ХП
            rank_multipliers = {
                "F": 1.0,    # База x1
                "E": 2.5,    # База x2.5
                "D": 5.0,    # База x5
                "C": 8.0,    # База x8
                "B": 12.0,   # База x12
                "A": 18.0,   # База x18 (Hard: 75 * 18 = 1350 урона)
                "S": 25.0    # База x25 (Hard: 75 * 25 = 1875 урона)
            }
            
            task_rank = getattr(task, "rank", "F").upper()
            rank_multiplier = rank_multipliers.get(task_rank, 1.0)
            
            # Итоговый базовый урон для тренировки
            task_base_dmg = int(base_dmg * rank_multiplier)
            
        else:
            # ОБЫЧНЫЕ ПРИВЫЧКИ (ОСТАВЛЯЕМ СТАРУЮ ФОРМУЛУ КАК ЕСТЬ)
            # Умножаем напрямую на value (избегаем отрицательного урона)
            task_value = max(0.0, getattr(task, "value", 1.0))
            task_base_dmg = int(base_dmg * task_value)

        # 3. ФИНАЛЬНЫЙ УРОН = (Урон задачи + Статы) * Множитель профиля
        final_damage_dealt = max(0, int((task_base_dmg + damage_dealt) * profile.damage_multiplier))
        
        is_crit = gamification_result.get("is_crit", False)
        
        combat_result = apply_boss_damage(user, final_damage_dealt, is_crit)
        
        # Add to total rewards response if boss was defeated
        if combat_result and combat_result.get("boss_defeated"):
            boss_rewards = combat_result.get("rewards", {})
            rewards["xp"] += boss_rewards.get("boss_xp", 0)
            rewards["gold"] += boss_rewards.get("boss_gold", 0)

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
