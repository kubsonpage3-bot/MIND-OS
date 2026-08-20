from django.db import transaction
from django.utils import timezone
from api.models import (
    Boss,
    BossEncounter,
    ActiveEffect,
    Item,
    InventoryItem,
    UserProfile,
)
from api.services.profile_service import gain_xp
from api.constants import SCROLL_BOSSES_DICT, BOSS_DIFFICULTY_MULTIPLIERS
from api.exceptions import GameLogicError
import random

BOSS_RANK_STATS = {
    "E": {"count": 1, "min": 1, "max": 1},
    "D": {"count": 1, "min": 1, "max": 2},
    "C": {"count": 2, "min": 2, "max": 2},
    "B": {"count": 2, "min": 2, "max": 3},
    "A": {"count": 3, "min": 3, "max": 3},
    "S": {"count": 3, "min": 3, "max": 4},
    "SS": {"count": 4, "min": 4, "max": 4},
    "SSS": {"count": 4, "min": 4, "max": 5},
}
POSSIBLE_STATS = ["pwr", "def", "foc", "mem", "spd", "lck"]


@transaction.atomic
def calculate_damage(user, encounter_id, base_damage):
    try:
        encounter = BossEncounter.objects.select_for_update().get(
            id=encounter_id, user=user
        )
    except BossEncounter.DoesNotExist:
        return 0

    if encounter.is_defeated:
        return 0

    final_damage = float(base_damage)

    # Интеграция с ActiveEffects
    effects = ActiveEffect.objects.filter(user=user)
    effect_notes = []

    for effect in effects:
        # System Overload: 3x damage
        if effect.skill_id == "system_overload" and effect.data.get("active"):
            mult = effect.data.get("damageMultiplier", 3)
            final_damage *= mult
            effect.data["active"] = False
            effect.save(update_fields=["data"])
            effect_notes.append(f"SYSTEM OVERLOAD: x{mult} Boss Damage!")

        # Battle Fury: Доп. урон
        if effect.skill_id == "battle_fury":
            boost = effect.data.get("physicalDamageBoost", 0.5)
            final_damage += base_damage * boost
            effect_notes.append(f"BATTLE FURY: +{int(boost*100)}% Boss Damage")

    final_damage = int(final_damage)
    encounter.hp_current = max(0, encounter.hp_current - final_damage)
    encounter.save()

    rewards = None
    if encounter.hp_current == 0:
        rewards = process_boss_death(user, encounter)

    return {
        "damage_dealt": final_damage,
        "boss_hp_remaining": encounter.hp_current,
        "boss_defeated": encounter.is_defeated,
        "rewards": rewards,
        "effect_notes": effect_notes,
    }


def process_boss_death(user, encounter):
    encounter.is_defeated = True
    encounter.expires_at = timezone.now()
    encounter.save()

    profile = user.profile
    final_gold = int(encounter.boss.reward_gold * encounter.reward_multiplier)
    final_xp = int(encounter.boss.reward_xp * encounter.reward_multiplier)

    profile.gold += final_gold
    gain_xp(profile, final_xp)

    # Trigger push notification
    from api.services.push_service import send_notification_to_user

    send_notification_to_user(
        user=user,
        pref_key="boss_defeated",
        title="Boss Defeated! 🎉",
        body=f"You successfully defeated {encounter.boss.name} and earned {final_gold} gold!",
        url="/character/boss",
    )

    # Добавление уникального лута в инвентарь
    item_dropped = None
    if encounter.boss.drop_item_id:
        item_dropped = encounter.boss.drop_item_id
        try:
            item = Item.objects.get(code=item_dropped)

            rolled_stats = {}
            if item.boss_rank and item.boss_rank in BOSS_RANK_STATS:
                rules = BOSS_RANK_STATS[item.boss_rank]
                chosen_stats = random.sample(POSSIBLE_STATS, rules["count"])
                for stat in chosen_stats:
                    rolled_stats[stat] = random.randint(rules["min"], rules["max"])

            inv_item, created = InventoryItem.objects.get_or_create(
                user_profile=profile,
                item=item,
                defaults={"stat_bonuses": rolled_stats} if rolled_stats else {},
            )
            if not created:
                inv_item.quantity += 1
                inv_item.save(update_fields=["quantity"])
        except Item.DoesNotExist:
            pass

    profile.save(update_fields=["gold"])

    return {"gold": final_gold, "xp": final_xp, "item_dropped": item_dropped}


def calculate_fail_damage(task, profile, checklist_ratio=1.0):
    """
    Рассчитывает базовый урон по HP при провале привычки или дейлика (до применения DEF в calculate_task_outcome).
    Диапазон базового урона:
      - Trivial: ~3–4 HP
      - Easy: ~6–8 HP
      - Medium: ~9–12 HP (5 пропущенных дейликов ≈ 35–45 HP)
      - Hard: ~15–20 HP
      - Critical: ~21–28 HP
    Для запущенных/красных задач (value < 0) урон масштабируется выше (до 2–3×).
    """
    BASE_DAMAGE = 6
    DIFF_MULT = {"trivial": 0.5, "easy": 1.0, "medium": 1.5, "hard": 2.5, "critical": 3.5}

    difficulty = getattr(task, "difficulty", "medium")
    if difficulty not in DIFF_MULT:
        difficulty = "medium"

    diff_mult = DIFF_MULT[difficulty]

    task_value = getattr(task, "value", 0.0)
    if task_value < 0:
        value_mult = 1.0 + abs(task_value) / 15.0
    else:
        value_mult = max(0.6, 1.0 - task_value / 30.0)

    raw = BASE_DAMAGE * diff_mult * value_mult * checklist_ratio
    damage = max(1, round(raw))

    return int(damage)


@transaction.atomic
def summon_boss(user, boss_id):
    profile = UserProfile.objects.select_for_update().get(user=user)

    boss_data = SCROLL_BOSSES_DICT.get(boss_id)
    if not boss_data:
        raise GameLogicError("Unknown boss id.")
    assert isinstance(boss_data, dict)
    reward_data = boss_data.get("reward")
    assert isinstance(reward_data, dict)

    cost = boss_data.get("price", 0)

    if profile.gold < cost:
        raise GameLogicError("Not enough gold.")

    active_encounter = BossEncounter.objects.filter(
        user=user, is_defeated=False
    ).first()
    if active_encounter:
        raise GameLogicError(
            f"You already have an active boss: {active_encounter.boss.name}"
        )

    boss, created = Boss.objects.get_or_create(
        id_name=boss_id,
        defaults={
            "name": boss_data["name"],
            "hp_max": boss_data["bossHP"],
            "level": 1,
            "reward_gold": reward_data["gold"],
            "reward_xp": reward_data["xp"],
            "drop_item_id": boss_data.get("uniqueItem", ""),
        },
    )

    profile.gold -= cost
    profile.save(update_fields=["gold"])

    difficulty = profile.boss_difficulty
    mult = BOSS_DIFFICULTY_MULTIPLIERS.get(
        difficulty, BOSS_DIFFICULTY_MULTIPLIERS["NORMAL"]
    )

    from api.services.mechanics import get_passive_multipliers

    passives = get_passive_multipliers(profile, {})
    boss_hp_reduction = passives.get("boss_hp_reduction", 0.0)
    boss_hp_multiplier = mult["hp"] * (1.0 - boss_hp_reduction)

    encounter = BossEncounter.objects.create(
        user=user,
        boss=boss,
        hp_current=int(boss.hp_max * boss_hp_multiplier),
        reward_multiplier=mult["reward"],
    )

    return {"detail": f"Summoned {boss.name}!", "encounter": encounter}
