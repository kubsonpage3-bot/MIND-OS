from django.db import transaction
from api.models import UserProfile
from api.constants import RANK_THRESHOLDS, HUMANITIES_RANK_THRESHOLDS


@transaction.atomic
def gain_xp(profile: UserProfile, amount: int) -> bool:
    """
    Начисляет опыт персонажу.
    Возвращает True, если произошёл level-up.
    """
    profile.xp += amount
    leveled_up = False

    # Проверяем, не достиг ли персонаж нового уровня
    while profile.xp >= profile.xp_to_next_level:
        profile.xp -= profile.xp_to_next_level
        profile.level += 1
        # Формула масштабирования: каждый уровень требует на 50% больше XP
        profile.xp_to_next_level = int(profile.xp_to_next_level * 1.5)
        # Бонусы при level-up
        profile.hp = profile.max_hp  # Восстанавливаем HP при повышении уровня
        profile.mana_max += 5
        leveled_up = True

    profile.save(update_fields=["xp", "level", "xp_to_next_level", "hp", "mana_max"])

    return leveled_up


def get_rank_info(profile: UserProfile) -> dict:
    """
    Вычисляет пороги рангов с учетом пассивок (endurance_protocol)
    и возвращает текущий ранг и обновленную матрицу порогов.
    Uses Python-level filtering so it works from the prefetch cache (0 extra DB queries).
    """
    has_endurance = any(
        s.skill_code == "endurance_protocol" for s in profile.unlocked_skills.all()
    )
    multiplier = 0.8 if has_endurance else 1.0

    from api.services.mechanics import get_passive_multipliers

    passives = get_passive_multipliers(profile, {})
    reduction = passives.get("science_threshold_reduction", 0.0)
    multiplier = max(0.1, multiplier - reduction)

    thresholds = [
        {"id": r["id"], "min": int(r["min"] * multiplier)} for r in RANK_THRESHOLDS
    ]

    current_id = thresholds[0]["id"]
    for t in thresholds:
        if profile.rank_xp >= t["min"]:
            current_id = t["id"]

    result = {
        "current_id": current_id,
        "thresholds": thresholds,
    }

    if profile.prestige_count > 0:
        result["is_ascendant"] = True
        result["ascendant_level"] = profile.prestige_count

    return result


def get_humanities_rank_info(profile: UserProfile) -> dict:
    """
    Вычисляет пороги рангов Humanities с учетом пассивок (master_of_arts)
    и возвращает текущий ранг и обновленную матрицу порогов.
    Uses Python-level filtering so it works from the prefetch cache (0 extra DB queries).
    """
    has_master = any(
        s.skill_code == "master_of_arts" for s in profile.unlocked_skills.all()
    )
    multiplier = 0.85 if has_master else 1.0

    from api.services.mechanics import get_passive_multipliers

    passives = get_passive_multipliers(profile, {})
    reduction = passives.get("language_threshold_reduction", 0.0)
    multiplier = max(0.1, multiplier - reduction)

    thresholds = []
    for r in HUMANITIES_RANK_THRESHOLDS:
        thresholds.append({"id": r["id"], "min": int(r["min"] * multiplier)})

    current_id = thresholds[0]["id"]
    for t in thresholds:
        if profile.humanities_xp >= t["min"]:
            current_id = t["id"]

    return {"current_id": current_id, "thresholds": thresholds}


@transaction.atomic
def check_death(profile: UserProfile) -> bool:
    """
    Проверяет, не упало ли HP до 0.
    Если да: восстанавливает HP, сбрасывает XP, понижает уровень и ранг.
    Возвращает True если персонаж умер.
    """
    has_died = False
    if profile.hp <= 0:
        print(
            f"[DEATH HANDLER] {profile.user.username} died! HP dropped to {profile.hp}."
        )
        has_died = True
        profile.hp = profile.max_hp
        profile.xp = 0
        profile.level = max(1, profile.level - 1)

        rank_info = get_rank_info(profile)
        thresholds = rank_info["thresholds"]

        current_rank_idx = 0
        for i, t in enumerate(thresholds):
            if profile.rank_xp >= t["min"]:
                current_rank_idx = i

        if current_rank_idx > 0:
            new_rank_idx = current_rank_idx - 1
            profile.rank_xp = thresholds[new_rank_idx]["min"]
        else:
            profile.rank_xp = 0

        profile.save(update_fields=["hp", "xp", "level", "rank_xp"])

    return has_died
