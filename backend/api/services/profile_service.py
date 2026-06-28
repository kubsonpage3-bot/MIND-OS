from django.db import transaction
from api.models import UserProfile
from api.constants import RANK_THRESHOLDS


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
        profile.hp_max += 10
        profile.hp = profile.hp_max  # Восстанавливаем HP при повышении уровня
        profile.mana_max += 5
        leveled_up = True

    profile.save(
        update_fields=["xp", "level", "xp_to_next_level", "hp_max", "hp", "mana_max"]
    )

    return leveled_up


@transaction.atomic
def check_rank_demotion(user_profile: UserProfile):
    """
    Проверяет, не упало ли HP до 0, и понижает ранг, если нужно.
    Вызывается после получения урона.
    """
    profile = UserProfile.objects.select_for_update().get(id=user_profile.id)

    if profile.hp <= 0:
        profile.hp = profile.hp_max

        current_rank_idx = 0
        for i, r in enumerate(RANK_THRESHOLDS):
            if profile.rank_xp >= r["min"]:
                current_rank_idx = i

        if current_rank_idx > 0:
            new_rank_idx = current_rank_idx - 1
            profile.rank_xp = RANK_THRESHOLDS[new_rank_idx]["min"]
        else:
            profile.rank_xp = 0

        profile.save(update_fields=["hp", "rank_xp"])
