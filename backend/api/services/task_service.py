from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import ValidationError
from api.models import Task, UserProfile
from api.services.skill_service import apply_effects_on_task_complete

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

    # Блокируем профиль пользователя до конца транзакции
    profile = UserProfile.objects.select_for_update().get(user=user)
    rewards = task.get_rewards()

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
            task.completion_count += 1
        else:
            task.last_completed_at = None
            task.completion_count = max(0, task.completion_count - 1)

    elif task.task_type == Task.TaskType.HABIT:
        task.completion_count += 1
        if not is_positive:
            profile.hp = max(0, profile.hp - 5)
            # Reverting mana or rewards for negative habit is not needed as it's a penalty
            profile.save()
            task.save()
            return {
                "detail": "Habit deviation noted.",
                "penalty": {"hp": -5},
                "profile": profile,
                "task": task,
                "leveled_up": False,
                "rewards": {"xp": 0, "gold": 0},
                "skill_effects": [],
            }

    task.save()

    # ── Начисляем награды персонажу ───────────────────────────────────
    mana_gained = 2 if task.task_type == Task.TaskType.HABIT else (5 if task.task_type == Task.TaskType.DAILY else 3)
    leveled_up = False
    
    if is_positive:
        leveled_up = profile.gain_xp(rewards["xp"])
        profile.gold += rewards["gold"]
        profile.mana = min(profile.mana_max, profile.mana + mana_gained)
    else:
        # Reverting task rewards
        profile.xp = max(0, profile.xp - rewards["xp"])
        profile.gold = max(0, profile.gold - rewards["gold"])
        profile.mana = max(0, profile.mana - mana_gained)
        
    profile.save()

    # ── Применяем эффекты скиллов ──────────────────────────────────────
    skill_effects = apply_effects_on_task_complete(profile, task)
    if skill_effects["xp_bonus"] > 0:
        leveled_up = profile.gain_xp(skill_effects["xp_bonus"]) or leveled_up
        profile.save(update_fields=["xp", "xp_to_next_level", "level", "hp", "hp_max", "mana_max"])

    # ── Боевая система: Наносим урон боссу ────────────────────────────
    from api.models import BossEncounter
    from api.services.combat_service import calculate_damage
    
    combat_result = None
    active_encounter = BossEncounter.objects.filter(user=user, is_defeated=False).first()
    if active_encounter:
        # Урон зависит от сложности (аналог фронтенда: easy=25, medium=50, hard=75, trivial=15)
        base_dmg_map = {"trivial": 15, "easy": 25, "medium": 50, "hard": 75}
        base_dmg = base_dmg_map.get(task.difficulty, 25) * task.value
        
        combat_result = calculate_damage(user, active_encounter.id, base_dmg)

    return {
        "detail": "Task completed!",
        "leveled_up": leveled_up,
        "skill_effects": skill_effects["notes"],
        "rewards": rewards,
        "task": task,
        "profile": profile,
        "combat": combat_result,
    }
