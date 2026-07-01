import random
from api.models import UserProfile, Item


def calculate_task_outcome(
    user, task_type, base_xp=0, base_gold=0, base_hp_lost=0, is_positive=True
):
    """
    Calculates the final outcome of a task based on the user's total RPG stats.
    """
    profile = UserProfile.objects.get(user=user)
    stats = profile.total_stats

    pwr = stats.get("pwr", 0)
    foc = stats.get("foc", 0)
    spd = stats.get("spd", 0)
    lck = stats.get("lck", 0)
    def_stat = stats.get("def", 0)
    mem = stats.get("mem", 0)

    result = {
        "xp_earned": 0,
        "gold_earned": 0,
        "hp_lost": 0,
        "is_crit": False,
        "item_dropped": None,
        "damage_dealt": 0,
        "mana_cost_multiplier": 100.0
        / (100.0 + mem),  # MEM: Reduces Mana/Fatigue cost by (100 / (100 + MEM))
    }

    if is_positive:
        # Power (PWR): Adds a flat bonus to the base XP earned. Formula: Base_XP + (PWR * 0.5)  # noqa: E501
        pwr_bonus = pwr * 0.5
        final_xp = base_xp + pwr_bonus

        # Base Boss Damage: Flat 10 + PWR stat
        base_damage = 10
        damage_dealt = base_damage + pwr

        # Speed (SPD): Grants a flat bonus to Gold. Formula: Base_Gold + (SPD * 0.5)
        spd_bonus = spd * 0.5
        final_gold = base_gold + spd_bonus

        # Focus (FOC): Grants a "Critical Focus" chance. Formula: FOC * 0.5% chance. If triggered, multiply final XP and Gold by 2.  # noqa: E501
        crit_chance = foc * 0.005
        if random.random() < crit_chance:
            result["is_crit"] = True
            final_xp *= 2
            final_gold *= 2
            damage_dealt *= 2

        # Luck (LCK): Acts as a multiplier for Gold. Formula: Final_Gold * (1 + (LCK / 100))  # noqa: E501
        final_gold = final_gold * (1 + (lck / 100.0))

        # Drop chance: LCK * 0.2% to find a random item.
        drop_chance = lck * 0.002
        if random.random() < drop_chance:
            items = list(Item.objects.all())
            if items:
                dropped_item = random.choice(items)
                result["item_dropped"] = dropped_item.code

        result["xp_earned"] = int(final_xp)
        result["gold_earned"] = int(final_gold)
        result["damage_dealt"] = int(damage_dealt)
    else:
        # For negative habits/missed dailies: DEF reduces HP damage taken by (100 / (100 + DEF))  # noqa: E501
        def_multiplier = 100.0 / (100.0 + def_stat)

        # Check unlocked skills and recruited allies for HP loss reduction
        hp_loss_reduction = 1.0
        if profile.unlocked_skills.filter(skill_code="pain_threshold").exists():
            hp_loss_reduction -= 0.25  # 25% reduction

        luna_ally = profile.recruited_allies.filter(ally_code="luna").first()
        if luna_ally and luna_ally.level >= 2:
            hp_loss_reduction -= 0.10  # 10% reduction

        # Ensure we don't reduce below 0
        hp_loss_reduction = max(0.0, hp_loss_reduction)

        final_hp_lost = base_hp_lost * def_multiplier * hp_loss_reduction
        result["hp_lost"] = int(final_hp_lost)

        # For reverting completed tasks, calculate exact xp_lost and gold_lost
        # using the same formula as positive, to prevent XP/Gold duplication
        pwr_bonus = pwr * 0.5
        final_xp_lost = base_xp + pwr_bonus

        spd_bonus = spd * 0.5
        final_gold_lost = base_gold + spd_bonus
        final_gold_lost = final_gold_lost * (1 + (lck / 100.0))

        result["xp_lost"] = int(final_xp_lost)
        result["gold_lost"] = int(final_gold_lost)

    return result


def apply_boss_damage(user, final_damage_dealt, is_crit=False):
    """
    Applies calculated damage to the active BossEncounter, handles defeat,
    and returns a combat_result dictionary.
    """
    from api.models import BossEncounter, UserProfile
    from api.services.profile_service import gain_xp

    active_encounter = (
        BossEncounter.objects.select_for_update()
        .filter(user=user, is_defeated=False)
        .first()
    )

    if not active_encounter:
        return None

    if is_crit:
        final_damage_dealt *= 2

    active_encounter.hp_current = max(
        0, active_encounter.hp_current - final_damage_dealt
    )
    boss_defeated = False

    if active_encounter.hp_current <= 0:
        active_encounter.hp_current = 0
        active_encounter.is_defeated = True
        boss_defeated = True

    boss = active_encounter.boss
    rewards = {}
    if boss_defeated and boss:
        profile = UserProfile.objects.select_for_update().get(user=user)
        xp_reward = int(boss.reward_xp * active_encounter.reward_multiplier)
        gold_reward = int(boss.reward_gold * active_encounter.reward_multiplier)

        final_xp = max(0, int(xp_reward * profile.xp_multiplier))
        final_gold = max(0, int(gold_reward * profile.gold_multiplier))

        gain_xp(profile, final_xp)
        profile.rank_xp = max(0, profile.rank_xp + final_xp)
        profile.gold = max(0, profile.gold + final_gold)
        sp_reward = 3 + boss.level * 2
        profile.skill_points = max(0, profile.skill_points + sp_reward)
        profile.save()

        rewards = {"boss_xp": final_xp, "boss_gold": final_gold, "boss_sp": sp_reward}

    active_encounter.save()

    # Update UserStats
    from api.models import UserStats

    try:
        stats = user.stats
    except UserStats.DoesNotExist:
        stats = UserStats.objects.create(user=user)

    stats.total_boss_damage += final_damage_dealt
    if is_crit:
        stats.total_crits += 1
    if boss_defeated:
        stats.bosses_defeated += 1
    stats.save(update_fields=["total_boss_damage", "total_crits", "bosses_defeated"])

    return {
        "encounter_id": active_encounter.id,
        "damage_dealt": final_damage_dealt,
        "boss_hp_remaining": active_encounter.hp_current,
        "boss_defeated": boss_defeated,
        "boss_name": boss.name if boss else None,
        "rewards": rewards,
    }


def revert_boss_damage(user, encounter_id, damage_to_heal):
    """
    Safely heals a boss if a task completion is reverted.
    Only heals if the encounter ID matches and the boss isn't defeated.
    """
    from api.models import BossEncounter, UserStats

    active_encounter = (
        BossEncounter.objects.select_for_update()
        .filter(id=encounter_id, user=user, is_defeated=False)
        .first()
    )

    if not active_encounter:
        return  # Safe no-op if boss was defeated or encounter is gone

    # Heal the boss, capping at max HP
    active_encounter.hp_current = min(
        active_encounter.boss.hp_max, active_encounter.hp_current + damage_to_heal
    )
    active_encounter.save(update_fields=["hp_current"])

    # Revert UserStats total damage
    try:
        stats = user.stats
        stats.total_boss_damage = max(0, stats.total_boss_damage - damage_to_heal)
        stats.save(update_fields=["total_boss_damage"])
    except UserStats.DoesNotExist:
        pass
