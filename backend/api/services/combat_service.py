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
from api.services import mechanics
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
    """
    Calculates final damage from a manual boss strike, processing special skill effects
    (System Overload, Battle Fury), then delegates to mechanics.apply_boss_damage() —
    the single source of truth for boss HP reduction, defeat logic, rewards, and saves.
    Equipment bonuses (frostbite_blade, scar_shard, blade_final_dusk, apex_predator,
    boss_kill HP/MP heals, omniscience, item drops) are all handled by apply_boss_damage.
    """
    try:
        encounter = BossEncounter.objects.select_for_update().get(
            id=encounter_id, user=user
        )
    except BossEncounter.DoesNotExist:
        return 0

    if encounter.is_defeated:
        return 0

    final_damage = float(base_damage)
    effect_notes = []

    # ── Special skill-activation effects ────────────────────────────────────
    effects = ActiveEffect.objects.filter(user=user)
    for effect in effects:
        # System Overload: 3x damage (consumed on use)
        if effect.skill_id == "system_overload" and effect.data.get("active"):
            mult = effect.data.get("damageMultiplier", 3)
            final_damage *= mult
            effect.data["active"] = False
            effect.save(update_fields=["data"])
            effect_notes.append(f"SYSTEM OVERLOAD: x{mult} Boss Damage!")

        # Battle Fury: flat % extra damage
        if effect.skill_id == "battle_fury":
            boost = effect.data.get("physicalDamageBoost", 0.5)
            final_damage += base_damage * boost
            effect_notes.append(f"BATTLE FURY: +{int(boost * 100)}% Boss Damage")

    # ── Delegate everything else to the unified SSOT ─────────────────────────
    # apply_boss_damage applies: equipment multipliers, apex_predator, ActiveEffect
    # bossDamageMultiplier, reduces HP, and on defeat: gold/XP/SP/MP rewards,
    # HP heal (Luna L4), mana restore (Void L3), omniscience cognitive bonus,
    # item drop, push notification, UserActivityLog, UserStats.
    from api.services.mechanics import apply_boss_damage

    result = apply_boss_damage(user, int(final_damage))

    if result is None:
        # No active encounter found (race condition guard)
        return {
            "damage_dealt": 0,
            "boss_hp_remaining": encounter.hp_current,
            "boss_defeated": encounter.is_defeated,
            "rewards": None,
            "effect_notes": effect_notes,
        }

    result["effect_notes"] = effect_notes
    return result


# process_boss_death() has been removed.
# All boss-defeat logic is consolidated in mechanics.apply_boss_damage().
# This prevents duplication and ensures HP heal (Luna L4), mana restore (Void L3),
# omniscience cognitive bonus, and all rewards are always applied correctly.


def calculate_fail_damage(task, profile, checklist_ratio=1.0):
    """
    Рассчитывает урон по HP при провале привычки или дейлика.
    Диапазон: ~1–20 HP в зависимости от сложности, task value и стата DEF.

    DEF снижает урон от: пропущенных дейликов, отрицательных привычек.
    Каждое очко DEF даёт 3.5% снижения урона, максимум 55%.
    """
    # Базовый урон 2 для всех сложностей — множитель DIFF_MULT даёт реальное различие.
    # Итоговый диапазон при нейтральной задаче (value≈0): trivial≈1, easy≈2, medium≈3, hard≈5, critical≈7
    # Красная задача (value≈-47): trivial≈4, easy≈7, medium≈14, hard≈21, critical≈28
    BASE_DAMAGE = 2
    DIFF_MULT = {"trivial": 0.5, "easy": 1, "medium": 2, "hard": 3, "critical": 4}

    difficulty = getattr(task, "difficulty", "medium")
    if difficulty not in DIFF_MULT:
        difficulty = "medium"

    diff_mult = DIFF_MULT[difficulty]

    task_value = getattr(task, "value", 0.0)
    if task_value < 0:
        value_mult = 1 + abs(task_value) / 15.0
    else:
        value_mult = max(0.5, 1 - task_value / 30.0)

    # DEF стат — реальный, из снаряжения + класса + skill tree + prestige.
    # Чем выше DEF, тем меньше урон от пропущенных дейликов и минус-привычек.
    total_stats = profile.total_stats if isinstance(profile.total_stats, dict) else {}
    con_stat = max(1, total_stats.get("def", 1))
    con_reduction = min(0.55, (con_stat - 1) * 0.035)

    # Item passives: Silk Mantle (-5%), Winter Plate (-12%), Luna L2 (-10%)
    item_reduction = 0.0
    try:
        from api.services.mechanics import get_passive_multipliers

        passives = get_passive_multipliers(profile, {})
        item_reduction = passives.get("missed_daily_hp_reduction", 0.0)
    except Exception:
        pass

    total_reduction = min(0.75, con_reduction + item_reduction)
    raw = BASE_DAMAGE * diff_mult * value_mult * checklist_ratio
    return max(1, round(raw * (1 - total_reduction)))


def calculate_habit_fail_hp(task, profile, for_next=False):
    """
    SSOT: Рассчитывает точный урон по HP при срыве привычки (habit negative).
    Используется как для реального списания в task_service, так и для превью 'next: -X HP'.

    Учитывает:
      - Базовый урон 2
      - Сложность задачи (trivial: 0.5, easy: 1.0, medium: 2.0, hard: 3.0, critical: 4.0)
      - Текущий task.value (Habitica-style: отрицательный value увеличивает штраф)
      - neg_streak (текущий или следующий при for_next=True, +10% за каждый срыв подряд)
      - Реальный DEF персонажа (экипировка + класс + пассивки + престиж): def_multiplier = 100 / (100 + DEF)
      - Навыки персонажа (pain_threshold: -25%, союзник luna L2+: -10%, winter_plate: -12%)
      - Активные мутаторы (например, glass_cannon: +60% входящего урона, time_dilation: +30%)
    """
    BASE_DAMAGE = 2
    DIFF_MULT = {
        "trivial": 0.5,
        "easy": 1.0,
        "medium": 2.0,
        "hard": 3.0,
        "critical": 4.0,
    }

    difficulty = getattr(task, "difficulty", "medium") or "medium"
    diff_mult = DIFF_MULT.get(difficulty, 2.0)

    task_value = getattr(task, "value", 0.0) or 0.0
    if task_value < 0:
        value_mult = 1.0 + abs(task_value) / 15.0
    else:
        value_mult = max(0.5, 1.0 - task_value / 30.0)

    current_streak = getattr(task, "neg_streak", 0) or 0
    neg_streak = (current_streak + 1) if for_next else max(1, current_streak)
    streak_mult = 1.0 + (neg_streak * 0.1)

    raw = BASE_DAMAGE * diff_mult * value_mult * streak_mult

    total_stats = (
        profile.total_stats
        if hasattr(profile, "total_stats") and isinstance(profile.total_stats, dict)
        else {}
    )
    def_stat = max(0, total_stats.get("def", 0))
    def_multiplier = 100.0 / (100.0 + def_stat)

    hp_loss_reduction = 1.0
    try:
        if profile.unlocked_skills.filter(skill_code="pain_threshold").exists():
            hp_loss_reduction -= 0.25
        luna_ally = profile.recruited_allies.filter(ally_code="luna").first()
        if luna_ally and luna_ally.level >= 2:
            hp_loss_reduction -= 0.10
        equipped_codes = (
            profile.get_equipped_item_codes()
            if hasattr(profile, "get_equipped_item_codes")
            else set()
        )
        if "winter_plate" in equipped_codes:
            hp_loss_reduction -= 0.12
    except Exception:
        pass
    hp_loss_reduction = max(0.0, hp_loss_reduction)

    final_dmg = raw * def_multiplier * hp_loss_reduction

    active_mutators = getattr(profile, "active_mutators", {})
    if isinstance(active_mutators, dict):
        active_list = active_mutators.get("active", [])
        active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]
        if "glass_cannon" in active_ids:
            final_dmg *= 1.6
        if "time_dilation" in active_ids:
            final_dmg *= 1.3

    return max(1, round(final_dmg))


def calculate_boss_daily_damage(encounter, profile):
    """
    Рассчитывает ежедневный урон по персонажу от активного непобеждённого босса.

    Баланс по рангам (E -> SSS):
      - E-ранг: 10 HP/день (короткий спринт 7 дней, высокая цена бездействия)
      - D-ранг: 9 HP/день
      - C-ранг: 8 HP/день
      - B-ранг: 7 HP/день
      - A-ранг: 6 HP/день
      - S-ранг: 6 HP/день
      - SS-ранг: 5 HP/день
      - SSS-ранг: 5 HP/день (марафон на 90 дней, устойчивый бой)

    Защита и экипировка (DEF):
      Снижает урон по формуле: 100 / (100 + DEF).
      Топовая экипировка (DEF 80-120+) снижает урон SS/SSS боссов до 1-2 HP.

    Особые эффекты:
      - Если босс оглушён (war_cry, decoy_shadow_stun) -> урон 0 HP
      - Если игрок неуязвим (iron_fast, elixir) -> урон 0 HP
      - Исступление (HP < 20% от макс) -> +25% урон
    """
    from api.constants import (
        BOSS_DAILY_BASE_DAMAGE,
        SCROLL_BOSSES_DICT,
        RANK_TO_LEVEL,
    )
    from django.db.models import Q

    if not encounter or getattr(encounter, "is_defeated", False):
        return {
            "damage": 0,
            "base_damage": 0,
            "mitigated_by_def": 0,
            "reason": "No active boss",
        }

    user = profile.user
    boss = encounter.boss
    boss_id = getattr(boss, "id_name", "")
    boss_info = SCROLL_BOSSES_DICT.get(boss_id, {})
    rank = boss_info.get("rank") or RANK_TO_LEVEL.get(boss.level, "E")

    base_damage = BOSS_DAILY_BASE_DAMAGE.get(rank, 6)

    # 1. Check boss stun
    now = timezone.now()
    boss_stunned = (
        ActiveEffect.objects.filter(
            user=user, skill_id__in=["war_cry", "decoy_shadow_stun", "titans_roar"]
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .exists()
    )

    if boss_stunned:
        return {
            "damage": 0,
            "base_damage": base_damage,
            "mitigated_by_def": 0,
            "is_stunned": True,
            "is_invulnerable": False,
            "boss_name": boss.name,
            "boss_rank": rank,
            "reason": "Boss is stunned!",
        }

    # 2. Check player invulnerability
    player_invulnerable = (
        ActiveEffect.objects.filter(
            user=user, skill_id__in=["iron_fast", "eye_of_the_storm", "elixir"]
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .exists()
    )

    if player_invulnerable:
        return {
            "damage": 0,
            "base_damage": base_damage,
            "mitigated_by_def": 0,
            "is_stunned": False,
            "is_invulnerable": True,
            "boss_name": boss.name,
            "boss_rank": rank,
            "reason": "Player is invulnerable!",
        }

    # 3. Enrage check: if boss HP < 20% of max
    is_enraged = False
    enrage_mult = 1.0
    if boss.hp_max > 0 and encounter.hp_current < (boss.hp_max * 0.20):
        is_enraged = True
        enrage_mult = 1.25

    raw_damage = base_damage * enrage_mult

    # 4. DEF mitigation from total_stats (gear + class + skills + prestige)
    total_stats = (
        profile.total_stats
        if hasattr(profile, "total_stats") and isinstance(profile.total_stats, dict)
        else {}
    )
    def_stat = max(0, total_stats.get("def", 0))
    def_mitigation = 100.0 / (100.0 + def_stat)

    mitigated_dmg = max(1, round(raw_damage * def_mitigation))
    saved_by_def = max(0, round(raw_damage) - mitigated_dmg)

    return {
        "damage": mitigated_dmg,
        "base_damage": round(raw_damage),
        "mitigated_by_def": saved_by_def,
        "is_stunned": False,
        "is_invulnerable": False,
        "is_enraged": is_enraged,
        "boss_name": boss.name,
        "boss_rank": rank,
        "def_stat": def_stat,
    }


@transaction.atomic
def summon_boss(user, boss_id):
    profile = UserProfile.objects.select_for_update().get(user=user)

    boss_data = SCROLL_BOSSES_DICT.get(boss_id)
    if not boss_data:
        raise GameLogicError("Unknown boss id.")
    assert isinstance(boss_data, dict)
    reward_data = boss_data.get("reward")
    assert isinstance(reward_data, dict)

    cost = int(boss_data.get("price", 0))

    if profile.gold < cost:
        raise GameLogicError(f"Not enough gold. Need {cost}G.")

    active_encounter = BossEncounter.objects.filter(
        user=user, is_defeated=False
    ).first()
    if active_encounter:
        raise GameLogicError(
            f"You already have an active boss: {active_encounter.boss.name}"
        )

    from api.constants import RANK_TO_LEVEL
    boss, created = Boss.objects.get_or_create(
        id_name=boss_id,
        defaults={
            "name": boss_data["name"],
            "hp_max": boss_data["bossHP"],
            "level": RANK_TO_LEVEL.get(boss_data.get("rank"), 1),
            "reward_gold": reward_data["gold"],
            "reward_xp": reward_data["xp"],
            "reward_sp": reward_data.get("sp", 3),
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

    return {"detail": f"Summoned {boss.name}!", "encounter": encounter, "profile": profile}
