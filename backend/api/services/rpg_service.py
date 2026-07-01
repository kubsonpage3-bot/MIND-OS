from django.db import transaction
from api.models import UserProfile, UnlockedSkill, RecruitedAlly
from api.constants import SKILL_TREE_CONFIG, ALLIES_CONFIG
from api.exceptions import GameLogicError


@transaction.atomic
def buy_skill_node(user, skill_code: str) -> UserProfile:
    """
    Разблокирует узел дерева навыков для пользователя.
    Списывает очки навыков (SP) и золото.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    if skill_code not in SKILL_TREE_CONFIG:
        raise GameLogicError("Skill node does not exist in backend configuration.")

    config = SKILL_TREE_CONFIG[skill_code]

    # Проверка: уже разблокирован?
    if UnlockedSkill.objects.filter(
        user_profile=profile, skill_code=skill_code
    ).exists():
        raise GameLogicError("Skill is already unlocked.")

    # Проверка: зависимость (requires) разблокирована?
    requires = config.get("requires")
    if (
        requires
        and not UnlockedSkill.objects.filter(
            user_profile=profile, skill_code=requires
        ).exists()
    ):
        raise GameLogicError(f"Requires previous skill '{requires}' to be unlocked.")

    cost_sp = config.get("sp", 0)
    cost_gold = config.get("gold", 0)

    if profile.skill_points < cost_sp:
        raise GameLogicError("Insufficient Skill Points (SP).")
    if profile.gold < cost_gold:
        raise GameLogicError("Insufficient Gold.")

    # Списание ресурсов
    profile.skill_points -= cost_sp
    profile.gold -= cost_gold

    # Применение перманентных бонусов, если они есть (например, gf_ceiling_bonus)
    gf_ceiling_bonus = config.get("gf_ceiling_bonus", 0)
    if gf_ceiling_bonus > 0:
        profile.gf_ceiling = round(profile.gf_ceiling + gf_ceiling_bonus, 2)

    profile.save(update_fields=["skill_points", "gold", "gf_ceiling"])

    # Создание записи в БД
    UnlockedSkill.objects.create(user_profile=profile, skill_code=skill_code)

    return profile


@transaction.atomic
def respec_skill_nodes(user) -> UserProfile:
    """
    Сбрасывает все изученные узлы навыков, возвращает очки навыков (SP) и списывает золото.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    unlocked_skills = UnlockedSkill.objects.filter(user_profile=profile)
    unlocked_count = unlocked_skills.count()

    if unlocked_count == 0:
        raise GameLogicError("No skills to respec.")

    respec_cost = max(50, unlocked_count * 80)

    if profile.gold < respec_cost:
        raise GameLogicError(f"Insufficient Gold. Respec costs {respec_cost}G.")

    total_sp_refund = 0
    total_gf_ceiling_refund = 0

    for us in unlocked_skills:
        if us.skill_code in SKILL_TREE_CONFIG:
            config = SKILL_TREE_CONFIG[us.skill_code]
            total_sp_refund += config.get("sp", 0)
            total_gf_ceiling_refund += config.get("gf_ceiling_bonus", 0)

    # Списание золота, возврат SP
    profile.gold -= respec_cost
    profile.skill_points += total_sp_refund

    # Возврат ceiling bonus
    if total_gf_ceiling_refund > 0:
        profile.gf_ceiling = round(
            max(5.0, profile.gf_ceiling - total_gf_ceiling_refund), 2
        )
        if profile.gf > profile.gf_ceiling:
            profile.gf = profile.gf_ceiling

    profile.save(update_fields=["gold", "skill_points", "gf_ceiling", "gf"])

    # Удаляем изученные навыки
    unlocked_skills.delete()

    return profile


@transaction.atomic
def recruit_ally(user, ally_code: str) -> RecruitedAlly:
    """
    Нанимает союзника или повышает его уровень.
    Списывает золото на основе уровня союзника.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    if ally_code not in ALLIES_CONFIG:
        raise GameLogicError("Ally does not exist in backend configuration.")

    config = ALLIES_CONFIG[ally_code]

    # Получаем или создаем запись союзника с уровнем 0 (до списания)
    ally_rec, created = RecruitedAlly.objects.get_or_create(
        user_profile=profile, ally_code=ally_code, defaults={"level": 0}
    )

    current_level = ally_rec.level

    if current_level == 0:
        # Найм
        cost = config["recruit_cost"]
        if profile.gold < cost:
            if created:
                ally_rec.delete()
            raise GameLogicError("Insufficient Gold to recruit ally.")
        profile.gold -= cost
        ally_rec.level = 1
        ally_rec.save()
    else:
        # Улучшение
        if current_level >= 5:
            raise GameLogicError("Ally is already at max level (5).")
        cost = config["upgrade_costs"][current_level - 1]
        if profile.gold < cost:
            raise GameLogicError("Insufficient Gold to upgrade ally.")
        profile.gold -= cost
        ally_rec.level += 1
        ally_rec.save()

    profile.save(update_fields=["gold"])
    return ally_rec
