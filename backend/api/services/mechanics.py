import random
from django.utils import timezone
from api.models import UserProfile, Item


def get_unique_subjects_today(stats):
    if not stats:
        return []
    today_str = str(timezone.now().date())
    data = stats.unique_subjects_today
    if isinstance(data, dict):
        if data.get("date") == today_str:
            return data.get("subjects", [])
    return []


def add_unique_subject_today(stats, subject):
    if not stats:
        return
    today_str = str(timezone.now().date())
    subjects = get_unique_subjects_today(stats)
    if subject not in subjects:
        subjects.append(subject)
        stats.unique_subjects_today = {"date": today_str, "subjects": subjects}
        stats.save(update_fields=["unique_subjects_today"])


COGNITIVE_COEFFICIENTS = {
    "mathematics": {"gf": 0.08, "ps": 0.04, "gc": 0.01, "vm": 0},
    "physics": {"gf": 0.07, "ps": 0.05, "gc": 0.01, "vm": 0},
    "chemistry": {"gf": 0.05, "ps": 0.05, "gc": 0.03, "vm": 0},
    "biology": {"gf": 0.03, "ps": 0.02, "gc": 0.06, "vm": 0.04},
    "history": {"gf": 0.01, "ps": 0, "gc": 0.09, "vm": 0.02},
    "english": {"gf": 0, "ps": 0.02, "gc": 0.07, "vm": 0.10},
    "philosophy": {"gf": 0.02, "ps": 0, "gc": 0.08, "vm": 0.04},
    "vocabulary": {"gf": 0, "ps": 0, "gc": 0.05, "vm": 0.12},
    "languages": {"gf": 0, "ps": 0.03, "gc": 0.06, "vm": 0.07},
    "chess": {"gf": 0.09, "ps": 0.06, "gc": 0, "vm": 0},
    "coding": {"gf": 0.07, "ps": 0.08, "gc": 0.01, "vm": 0},
    "creative_answers": {"gf": 0.015, "gc": 0.010, "vm": 0.008, "ps": 0.005},
    "exercise": {"gf": 0.02, "ps": 0.05, "gc": 0, "vm": 0},
    "running": {"gf": 0.04, "ps": 0.05, "gc": 0, "vm": 0},
    "prayer": {"gf": 0, "ps": 0, "gc": 0.06, "vm": 0.06},
    "mindfulness": {"gf": 0, "ps": 0, "gc": 0.06, "vm": 0.06},
    "sleep": {"gf": 0.01, "ps": 0.01, "gc": 0.01, "vm": 0.01},
    "nutrition": {"gf": 0.01, "ps": 0.02, "gc": 0.02, "vm": 0.01},
    "reading": {"gf": 0.01, "ps": 0, "gc": 0.07, "vm": 0.05},
    "social": {"gf": 0.01, "ps": 0.03, "gc": 0.03, "vm": 0.05},
    "music": {"gf": 0.03, "ps": 0.04, "gc": 0.03, "vm": 0.03},
    "art": {"gf": 0.04, "ps": 0.03, "gc": 0.03, "vm": 0.02},
    "other": {"gf": 0.02, "ps": 0.02, "gc": 0.02, "vm": 0.02},
}


def calculate_cognitive_gains(activity, hours, eff_total, profile):
    # Normalize activity key (e.g., lowercase)
    activity_key = activity.lower() if isinstance(activity, str) else "other"
    # Fallback for custom tasks mapped to categories
    if activity_key not in COGNITIVE_COEFFICIENTS:
        activity_key = "other"

    coeffs = COGNITIVE_COEFFICIENTS[activity_key]

    def get_growth_multiplier(current, ceiling):
        if ceiling <= 0:
            return 0
        ratio = current / ceiling
        return max(0.0, 1.0 - (ratio**2))

    # Base gain formula from frontend: coeff * hours * multiplier * effTotal
    return {
        "gf": coeffs.get("gf", 0)
        * hours
        * eff_total
        * get_growth_multiplier(profile.gf, profile.gf_ceiling),
        "gc": coeffs.get("gc", 0)
        * hours
        * eff_total
        * get_growth_multiplier(profile.gc, profile.gc_ceiling),
        "ps": coeffs.get("ps", 0)
        * hours
        * eff_total
        * get_growth_multiplier(profile.ps, profile.ps_ceiling),
        "vm": coeffs.get("vm", 0)
        * hours
        * eff_total
        * get_growth_multiplier(profile.vm, profile.vm_ceiling),
    }


def calculate_task_outcome(
    user,
    task_type,
    base_xp=0,
    base_gold=0,
    base_hp_lost=0,
    is_positive=True,
    passive_effects=None,
):
    """
    Calculates the final outcome of a task based on the user's total RPG stats.
    """
    if passive_effects is None:
        passive_effects = {}
    profile = UserProfile.objects.get(user=user)
    stats = profile.total_stats

    pwr = stats.get("pwr", 0)
    foc = stats.get("foc", 0) * passive_effects.get("foc_mult", 1.0)
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
        crit_chance = foc * 0.005 + passive_effects.get("crit_chance_bonus", 0.0)
        if random.random() < crit_chance:
            result["is_crit"] = True
            final_xp *= 2
            final_gold *= 2
            damage_dealt *= 2

        # Luck (LCK): Acts as a multiplier for Gold. Formula: Final_Gold * (1 + (LCK / 100))  # noqa: E501
        final_gold = final_gold * (1 + (lck / 100.0))

        # Drop chance: LCK * 0.2% to find a random item.
        drop_chance = lck * 0.002 + passive_effects.get("drop_chance_bonus", 0.0)
        guaranteed_drop = passive_effects.get("guaranteed_loot_drop", False)
        if guaranteed_drop or random.random() < drop_chance:
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

    # Apply Active Effects specifically for boss damage
    from api.models import ActiveEffect
    from django.db.models import Q

    active_effects = ActiveEffect.objects.filter(
        user=user,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))

    boss_dmg_mult = 1.0
    for effect in active_effects:
        if effect.data and "bossDamageMultiplier" in effect.data:
            boss_dmg_mult += effect.data["bossDamageMultiplier"]

    # Check apex_predator passive
    profile = UserProfile.objects.select_for_update().get(user=user)
    if profile.unlocked_skills.filter(skill_code="apex_predator").exists():
        boss_dmg_mult += 0.30

    final_damage_dealt = int(final_damage_dealt * boss_dmg_mult)

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

    stats, _ = UserStats.objects.get_or_create(user=user)

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


def apply_active_mutators(profile, context: dict):
    """
    Applies active mutators on the profile and handles immediate drawbacks like Tithe.
    Returns a dictionary with multipliers and flags.
    context keys: is_science (bool), is_language (bool), hours (float)
    """
    from api.services.profile_service import check_death

    active_mutators = profile.active_mutators or {}
    active_list = (
        active_mutators.get("active", []) if isinstance(active_mutators, dict) else []
    )
    active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]

    is_science = context.get("is_science", False)
    is_language = context.get("is_language", False)
    hours = context.get("hours", 0)

    effects = {
        "xp_mult": 1.0,
        "gold_mult": 1.0,
        "flat_xp": 0,
        "gc_flat": 0.0,
        "is_dead": False,
    }

    if "loan_shark" in active_ids:
        effects["gold_mult"] += 0.40

    if "cursed_clock" in active_ids and hours > 0:
        effects["flat_xp"] += int(hours * 1)

    if "bloodwork" in active_ids:
        if is_science:
            effects["xp_mult"] += 0.20
        else:
            effects["xp_mult"] -= 0.05

    if "lexicon" in active_ids:
        if is_language:
            effects["xp_mult"] += 0.20
        effects["gc_flat"] += 0.01

    if "tithe" in active_ids:
        effects["xp_mult"] += 0.15
        if profile.gold >= 3:
            profile.gold -= 3
        else:
            profile.hp = max(0, profile.hp - 5)
            if check_death(profile):
                effects["is_dead"] = True

    return effects


def get_passive_multipliers(profile, context: dict):
    from django.utils import timezone

    unlocked_skills = set(profile.unlocked_skills.values_list("skill_code", flat=True))
    recruited_allies = {a.ally_code: a.level for a in profile.recruited_allies.all()}

    from api.models import ActiveEffect
    from django.db.models import Q

    active_effects = ActiveEffect.objects.filter(
        user=profile.user,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))

    effects = {
        "xp_mult": 1.0,
        "humanities_xp_mult": 1.0,
        "gold_mult": 1.0,
        "flat_xp": 0,
        "gf_mult": 1.0,
        "gc_mult": 1.0,
        "ps_mult": 1.0,
        "vm_mult": 1.0,
        "boss_dmg_mult": 1.0,
        "foc_mult": 1.0,
        "crit_chance_bonus": 0.0,
        "drop_chance_bonus": 0.0,
        "mana_regen_mult": 1.0,
        "ally_stat_mult": 1.0,
        "min_focus": 0.0,
        "gf_ceiling_flat": 0.0,
        "gf_flat_bonus": 0.0,
        "daily_hp_regen": 0.0,
        "guaranteed_loot_drop": False,
    }

    focus_rating = context.get("focus_rating", 0.0)
    is_exercise = context.get("is_exercise", False)
    is_prayer = context.get("is_prayer", False)
    is_science = context.get("is_science", False)
    is_language = context.get("is_language", False)
    task_type = context.get("task_type", "")

    # SKILLS
    if "sharp_focus" in unlocked_skills and focus_rating >= 8.0:
        effects["xp_mult"] += 0.10

    if "cross_training" in unlocked_skills and is_language:
        effects["gf_flat_bonus"] += 0.2

    # APPLY ACTIVE EFFECTS (CONSUMABLES)
    for effect in active_effects:
        if not effect.data:
            continue

        eff_type = effect.data.get("effect_type", "")

        # Focus Stim
        if eff_type == "focus_stim":
            effects["foc_mult"] += 0.3

        # XP Booster
        if eff_type == "xp_booster" or "xpBoost" in effect.data:
            val = effect.data.get("xpBoost", 0.5)
            effects["xp_mult"] += val

        # Boss Damage Plus
        if eff_type == "boss_damage_plus" or "bossDamageMultiplier" in effect.data:
            val = effect.data.get("bossDamageMultiplier", 1.0)
            effects["boss_dmg_mult"] += val

        # Legacy Gold Boost
        if "gold_boost" in effect.data:
            effects["gold_mult"] += effect.data["gold_boost"]

        # Humanities XP Boost
        if "humanitiesXpBoost" in effect.data and is_language:
            effects["humanities_xp_mult"] += effect.data["humanitiesXpBoost"]

    if "iron_conditioning" in unlocked_skills and is_exercise:
        effects["xp_mult"] += 0.15

    if "inner_stillness" in unlocked_skills and is_prayer:
        effects["xp_mult"] += 0.20

    if "resource_awareness" in unlocked_skills:
        effects["gold_mult"] += 0.10

    if "cognitive_supremacy" in unlocked_skills:
        effects["gf_mult"] += 0.20
        effects["gc_mult"] += 0.20
        effects["ps_mult"] += 0.20
        effects["vm_mult"] += 0.20

    if "encyclopedia" in unlocked_skills:
        effects["gc_mult"] += 0.20

    if "apex_predator" in unlocked_skills:
        effects["boss_dmg_mult"] += 0.30

    if "flow_state" in unlocked_skills:
        today = timezone.now().date()
        if profile.last_training_at != today:
            effects["xp_mult"] += 0.50
            # Flow state profile update happens in view if needed, but we can't update it here purely
            # without side effects. We'll leave the profile save up to the caller.

    if "polymath" in unlocked_skills:
        stats = getattr(profile.user, "stats", None)
        if stats:
            unique_today = get_unique_subjects_today(stats)
            if len(unique_today) >= 3:
                effects["flat_xp"] += 20

    # BATCH 1 SKILLS
    if "combat_reflexes" in unlocked_skills:
        effects["crit_chance_bonus"] += 0.10

    if "fortunes_pull" in unlocked_skills or "loot_magnetism" in unlocked_skills:
        effects["drop_chance_bonus"] += 0.03

    if "resilience" in unlocked_skills:
        effects["mana_regen_mult"] += 0.25

    if "aura_of_focus" in unlocked_skills:
        effects["ally_stat_mult"] += 0.10

    if "deep_concentration" in unlocked_skills:
        effects["min_focus"] = 7.0

    if "neural_expansion" in unlocked_skills:
        effects["gf_ceiling_flat"] += 20.0

    # BATCH 2 SKILLS
    if "unbreakable" in unlocked_skills:
        effects["daily_hp_regen"] += 3.0

    if "golden_mind" in unlocked_skills:
        hours = context.get("hours", 0.0)
        if hours >= 2.0:
            effects["guaranteed_loot_drop"] = True

    # ALLIES
    ally_mult = effects["ally_stat_mult"]

    kira_level = recruited_allies.get("kira", 0)
    if kira_level >= 1 and is_science:
        effects["xp_mult"] += (0.05 if kira_level == 1 else 0.10) * ally_mult
    if kira_level >= 3 and is_science:
        effects["gf_flat_bonus"] += 0.002 * ally_mult

    neko_level = recruited_allies.get("neko", 0)
    if neko_level >= 1 and task_type == "daily":
        effects["gold_mult"] += 0.05 * ally_mult
    if neko_level >= 5:
        effects["gold_mult"] += 0.15 * ally_mult

    void_level = recruited_allies.get("void", 0)
    if void_level >= 1:
        effects["boss_dmg_mult"] += 0.10 * ally_mult

    luna_level = recruited_allies.get("luna", 0)
    if luna_level >= 1 and is_exercise:
        effects["xp_mult"] += 0.08 * ally_mult

    sakura_level = recruited_allies.get("sakura", 0)
    if sakura_level >= 1 and is_language:
        effects["xp_mult"] += 0.10 * ally_mult
    if sakura_level >= 2:
        effects["gc_mult"] += 0.10 * ally_mult
        effects["vm_mult"] += 0.10 * ally_mult
    if sakura_level >= 4:
        effects["xp_mult"] += 0.08 * ally_mult

    yuki_level = recruited_allies.get("yuki", 0)
    if yuki_level >= 1:
        effects["xp_mult"] += 0.08 * ally_mult

    nene_level = recruited_allies.get("nene", 0)
    if nene_level >= 1 and is_prayer:
        effects["xp_mult"] += 0.15 * ally_mult
    if nene_level >= 4:
        effects["gf_mult"] += 0.10 * ally_mult
        effects["gc_mult"] += 0.10 * ally_mult
        effects["ps_mult"] += 0.10 * ally_mult
        effects["vm_mult"] += 0.10 * ally_mult

    return effects
