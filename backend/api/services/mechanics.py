import random
from typing import Any
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
        return 0
    today_str = str(timezone.now().date())
    subjects = get_unique_subjects_today(stats)
    if subject not in subjects:
        subjects.append(subject)
        stats.unique_subjects_today = {"date": today_str, "subjects": subjects}
        stats.save(update_fields=["unique_subjects_today"])
    return len(subjects)


COGNITIVE_COEFFICIENTS = {
    "mathematics": {"gf": 1.60, "ps": 0.80, "gc": 0.20, "vm": 0.0},
    "physics": {"gf": 1.40, "ps": 1.00, "gc": 0.20, "vm": 0.0},
    "chemistry": {"gf": 1.00, "ps": 1.00, "gc": 0.60, "vm": 0.0},
    "biology": {"gf": 0.60, "ps": 0.40, "gc": 1.20, "vm": 0.80},
    "history": {"gf": 0.20, "ps": 0.00, "gc": 1.80, "vm": 0.40},
    "english": {"gf": 0.00, "ps": 0.40, "gc": 1.40, "vm": 2.00},
    "philosophy": {"gf": 0.40, "ps": 0.00, "gc": 1.60, "vm": 0.80},
    "vocabulary": {"gf": 0.00, "ps": 0.00, "gc": 1.00, "vm": 2.40},
    "languages": {"gf": 0.00, "ps": 0.60, "gc": 1.20, "vm": 1.40},
    "german": {"gf": 0.00, "ps": 0.60, "gc": 1.20, "vm": 1.40},
    "chess": {"gf": 1.80, "ps": 1.20, "gc": 0.00, "vm": 0.00},
    "coding": {"gf": 1.40, "ps": 1.60, "gc": 0.20, "vm": 0.00},
    "creative_answers": {"gf": 0.30, "gc": 0.20, "ps": 0.10, "vm": 0.16},
    "exercise": {"gf": 0.40, "ps": 1.00, "gc": 0.00, "vm": 0.00},
    "running": {"gf": 0.80, "ps": 1.00, "gc": 0.00, "vm": 0.00},
    "prayer": {"gf": 0.00, "ps": 0.00, "gc": 1.20, "vm": 1.20},
    "mindfulness": {"gf": 0.00, "ps": 0.00, "gc": 1.20, "vm": 1.20},
    "sleep": {"gf": 0.20, "ps": 0.20, "gc": 0.20, "vm": 0.20},
    "nutrition": {"gf": 0.20, "ps": 0.40, "gc": 0.40, "vm": 0.20},
    "reading": {"gf": 0.20, "ps": 0.00, "gc": 1.40, "vm": 1.00},
    "social": {"gf": 0.20, "ps": 0.60, "gc": 0.60, "vm": 1.00},
    "music": {"gf": 0.60, "ps": 0.80, "gc": 0.60, "vm": 0.60},
    "art": {"gf": 0.80, "ps": 0.60, "gc": 0.60, "vm": 0.40},
    "other": {"gf": 0.40, "ps": 0.40, "gc": 0.40, "vm": 0.40},
}


def calculate_training_efficiency(
    profile, focus, hours, streak_days, hours_today, subject_hours_today
):
    """
    Computes the training efficiency on the server, replicating cognitiveEngine.js.
    Uses real calculated stats (FOC, MEM) for accurate boundaries.
    """
    stats = profile.total_stats
    stat_foc = stats.get("foc", 5)
    stat_mem = stats.get("mem", 5)

    # Base Focus
    if focus <= 3:
        focus_mult = 0.4
    elif focus <= 6:
        focus_mult = 0.8
    elif focus <= 8:
        focus_mult = 1.0
    else:
        focus_mult = 1.3

    # Base Streak
    if streak_days <= 7:
        streak_mult = 1.0
    elif streak_days <= 14:
        streak_mult = 1.1
    elif streak_days <= 21:
        streak_mult = 1.2
    elif streak_days <= 30:
        streak_mult = 1.35
    else:
        streak_mult = 1.5

    # Base Fatigue
    if hours_today <= 2:
        raw_fatigue = 1.0
    elif hours_today <= 4:
        raw_fatigue = 0.9
    elif hours_today <= 6:
        raw_fatigue = 0.75
    else:
        raw_fatigue = 0.5

    # Diminishing Returns
    if subject_hours_today < 1:
        dimin_mult = 1.0
    elif subject_hours_today < 2:
        dimin_mult = 0.8
    elif subject_hours_today < 3:
        dimin_mult = 0.5
    else:
        dimin_mult = 0.2

    # Stat boosts
    foc_stat_bonus = 1.0 + (stat_foc - 5) * 0.01
    mem_fatigue_bonus = 1.0 + (stat_mem - 5) * 0.015

    focus_mult = focus_mult * foc_stat_bonus
    fatigue_mult = min(1.0, raw_fatigue * mem_fatigue_bonus)

    total = focus_mult * streak_mult * fatigue_mult * dimin_mult
    return round(total, 3)


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
    mutator_effects=None,
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
        if passive_effects.get("kage_halve_crit", False):
            crit_chance *= 0.5
        if passive_effects.get("always_crit", False) or random.random() < crit_chance:
            result["is_crit"] = True
            crit_mult = passive_effects.get("crit_damage_mult", 2.0)
            final_xp *= crit_mult
            final_gold *= crit_mult
            damage_dealt *= crit_mult

        # Luck (LCK): Acts as a multiplier for Gold. Formula: Final_Gold * (1 + (LCK / 100))  # noqa: E501
        final_gold = final_gold * (1 + (lck / 100.0))

        # Drop chance: LCK * 0.2% to find a random item.
        drop_chance = lck * 0.002 + passive_effects.get("drop_chance_bonus", 0.0)
        guaranteed_drop = passive_effects.get("guaranteed_loot_drop", False)
        if guaranteed_drop or random.random() < drop_chance:
            items = list(Item.objects.all())
            if items:
                dropped_item = random.choice(items)
                result["item_dropped"] = dropped_item.code  # type: ignore

        result["xp_earned"] = int(final_xp)
        result["gold_earned"] = int(final_gold)
        result["damage_dealt"] = int(damage_dealt)
    else:
        # Check if boss is stunned via war_cry or decoy shadow
        from api.models import ActiveEffect
        from django.db.models import Q

        war_cry_active = ActiveEffect.objects.filter(
            user=user, skill_id="war_cry"
        ).exists()

        decoy_shadow_stun = (
            ActiveEffect.objects.filter(user=user, skill_id="decoy_shadow_stun")
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
            .exists()
        )

        if war_cry_active or decoy_shadow_stun:
            print("[Mechanics] Boss is stunned! Nullifying base HP lost.")
            base_hp_lost = 0

        # For negative habits/missed dailies: DEF reduces HP damage taken by (100 / (100 + DEF))  # noqa: E501
        def_multiplier = 100.0 / (100.0 + def_stat)

        # Check unlocked skills and recruited allies for HP loss reduction
        hp_loss_reduction = 1.0
        if profile.unlocked_skills.filter(skill_code="pain_threshold").exists():  # type: ignore
            hp_loss_reduction -= 0.25  # 25% reduction

        luna_ally = profile.recruited_allies.filter(ally_code="luna").first()  # type: ignore
        if luna_ally and luna_ally.level >= 2:
            hp_loss_reduction -= 0.10  # 10% reduction

        # Ensure we don't reduce below 0
        hp_loss_reduction = max(0.0, hp_loss_reduction)

        final_hp_lost = base_hp_lost * def_multiplier * hp_loss_reduction

        if mutator_effects:
            final_hp_lost *= mutator_effects.get("damage_taken_mult", 1.0)

            # Mirror mutator: 30% chance to negate damage and convert to XP
            if mutator_effects.get("trigger_mirror") and final_hp_lost > 0:
                if random.random() < 0.30:
                    result["xp_earned"] += int(final_hp_lost)
                    final_hp_lost = 0

        # Grier L2: Shield slam
        grier_ally = profile.recruited_allies.filter(ally_code="grier").first()  # type: ignore
        if grier_ally and grier_ally.level >= 2 and profile.mana >= 5:
            result["grier_shield_slam"] = True
            result["grier_shield_slam_dmg"] = int(final_hp_lost)
            final_hp_lost = int(final_hp_lost * 0.5)

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
    if profile.unlocked_skills.filter(skill_code="apex_predator").exists():  # type: ignore
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
    if boss_defeated and boss is not None:
        profile = UserProfile.objects.select_for_update().get(user=user)
        xp_reward = int(boss.reward_xp * active_encounter.reward_multiplier)
        gold_reward = int(boss.reward_gold * active_encounter.reward_multiplier)

        final_xp = max(0, int(xp_reward * profile.xp_multiplier))
        final_gold = max(0, int(gold_reward * profile.gold_multiplier))

        # Check for boss kill mana and HP restores
        from api.services.mechanics import get_passive_multipliers

        passives = get_passive_multipliers(profile, {})
        mana_restore = passives.get("boss_kill_mana_restore", 0)
        if mana_restore > 0:
            profile.mana = min(profile.max_mana, profile.mana + mana_restore)

        hp_heal = passives.get("boss_kill_hp_heal", 0)
        if hp_heal > 0:
            profile.hp = min(profile.max_hp, profile.hp + hp_heal)

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
    update_fields = ["total_boss_damage", "total_crits", "bosses_defeated"]
    if final_damage_dealt > 0:
        stats.boss_attacks_count += 1
        update_fields.append("boss_attacks_count")
    stats.save(update_fields=update_fields)

    return {
        "encounter_id": active_encounter.id,  # type: ignore
        "damage_dealt": final_damage_dealt,
        "boss_hp_remaining": active_encounter.hp_current,
        "boss_defeated": boss_defeated,
        "boss_name": boss.name if boss is not None else None,
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


def check_and_expire_mutators(profile):
    """
    Checks if active mutators have expired based on their durationDays.
    If yes, removes them. If Meldor L4 is active, deals 200 boss damage at cost of 15 mana.
    """
    import time

    active_mutators = profile.active_mutators or {}
    active_list = (
        active_mutators.get("active", []) if isinstance(active_mutators, dict) else []
    )

    if not active_list:
        return

    active_codes = profile.active_allies or []
    recruited_allies = {
        a.ally_code: a.level
        for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore
    }
    meldor_level = recruited_allies.get("meldor", 0)

    now_ms = time.time() * 1000
    new_active_list = []
    mutators_changed = False

    for m in active_list:
        if not isinstance(m, dict):
            new_active_list.append(m)
            continue

        activated_at = m.get("activatedAt")
        duration_days = m.get("duration")

        if activated_at is not None and duration_days is not None:
            duration_ms = duration_days * 24 * 3600 * 1000
            if now_ms - activated_at >= duration_ms:
                mutators_changed = True
                if meldor_level >= 4 and profile.mana >= 15:
                    profile.mana -= 15
                    from api.services.mechanics import apply_boss_damage

                    apply_boss_damage(profile.user, 200)
                continue

        new_active_list.append(m)

    if mutators_changed:
        active_mutators["active"] = new_active_list
        profile.active_mutators = active_mutators
        profile.save(update_fields=["active_mutators", "mana"])


def apply_active_mutators(profile, context: dict, trigger_side_effects: bool = True):
    """
    Applies active mutators on the profile and handles immediate drawbacks like Tithe.
    Returns a dictionary with multipliers and flags.
    context keys: is_science (bool), is_language (bool), hours (float), task_category (str)
    """
    if trigger_side_effects:
        check_and_expire_mutators(profile)

    from api.services.profile_service import check_death
    import random
    from django.utils import timezone
    import zoneinfo

    active_mutators = profile.active_mutators or {}
    active_list = (
        active_mutators.get("active", []) if isinstance(active_mutators, dict) else []
    )
    active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]

    def get_mutator_data(mutator_id):
        for m in active_list:
            if isinstance(m, dict) and m.get("id") == mutator_id:
                return m.get("data", {})
        return {}

    is_science = context.get("is_science", False)
    is_language = context.get("is_language", False)
    hours = context.get("hours", 0)
    task_category = context.get("task_category", "")

    effects = {
        "xp_mult": 1.0,
        "gold_mult": 1.0,
        "final_xp_mult": 1.0,
        "final_gold_mult": 1.0,
        "damage_taken_mult": 1.0,
        "flat_xp": 0,
        "gc_flat": 0.0,
        "shop_cost_mult": 1.0,
        "is_dead": False,
        "trigger_volatile": False,
        "trigger_echo": False,
        "trigger_mirror": False,
        "silent_mode": False,
        "streak_xp_bonus": 0,
    }

    user_tz_str = profile.timezone if profile.timezone else "UTC"
    try:
        user_tz = zoneinfo.ZoneInfo(user_tz_str)
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")

    current_hour = timezone.now().astimezone(user_tz).hour

    # ── AMPLIFIERS ──
    if "bloodwork" in active_ids:
        if is_science:
            effects["xp_mult"] += 0.20
        else:
            effects["xp_mult"] -= 0.05

    if "monks_path" in active_ids and (
        context.get("is_prayer")
        or task_category == "Prayer/Meditation"
        or task_category == "Prayer"
        or task_category == "Mindfulness"
    ):
        effects["xp_mult"] += 0.40
        effects["flat_xp"] += 2 * context.get("task_streak", 0)

    if "iron_routine" in active_ids and (
        context.get("is_exercise") or task_category == "Exercise"
    ):
        data = get_mutator_data("iron_routine")
        penalty_until_str = data.get("penalty_until")
        penalty_active = False
        if penalty_until_str:
            from dateutil.parser import parse  # type: ignore

            try:
                penalty_until = parse(penalty_until_str)
                if timezone.now() < penalty_until:
                    penalty_active = True
            except Exception:
                pass

        if not penalty_active:
            effects["xp_mult"] += 0.25

    if "lexicon" in active_ids:
        if is_language:
            effects["xp_mult"] += 0.20
        effects["gc_flat"] += 0.01

    if "night_owl" in active_ids:
        if current_hour >= 21 or current_hour < 9:
            effects["xp_mult"] += 0.30
        else:
            effects["xp_mult"] -= 0.10

    if "early_riser" in active_ids:
        if 4 <= current_hour < 9:
            effects["xp_mult"] += 0.30
        elif current_hour >= 21 or current_hour < 4:
            effects["xp_mult"] -= 0.10

    if "tunnel_vision" in active_ids:
        stats = getattr(profile.user, "stats", None)
        unique_today = set(get_unique_subjects_today(stats))
        current_cat = context.get("task_category")
        if current_cat:
            unique_today.add(current_cat)
        if len(unique_today) <= 1:
            effects["xp_mult"] += 0.50

    if "time_dilation" in active_ids:
        effects["final_xp_mult"] *= 3.0
        effects["final_gold_mult"] *= 3.0

    if "inversion" in active_ids:
        # focus_rating inversion is handled inside views.py
        pass

    # ── ECONOMY ──
    if "loan_shark" in active_ids:
        effects["gold_mult"] += 0.40

    if "miser" in active_ids:
        effects["shop_cost_mult"] *= 0.80

    if "tithe" in active_ids:
        effects["xp_mult"] += 0.15
        if trigger_side_effects:
            if profile.gold >= 3:
                profile.gold -= 3
            else:
                profile.hp = max(0, profile.hp - 5)
                if check_death(profile):
                    effects["is_dead"] = True

    # ── STREAK ──
    if "momentum" in active_ids:
        momentum_days = get_mutator_data("momentum").get("days", 0)
        bonus = min(0.20, momentum_days * 0.02)
        effects["xp_mult"] += bonus

    if "ascetic_loop" in active_ids and context.get("task_type") == "daily":
        effects["flat_xp"] += 5

    # ── CHALLENGE ──
    if "diversity_lock" in active_ids:
        if task_category and profile.last_completed_category == task_category:
            effects["final_xp_mult"] = 0.0
        else:
            effects["xp_mult"] += 0.20

    if "silence" in active_ids:
        effects["silent_mode"] = True

    if "ironman" in active_ids:
        effects["xp_mult"] += 0.15

    if "glass_cannon" in active_ids:
        effects["xp_mult"] += 0.25
        effects["damage_taken_mult"] += 0.60

    if "zero_hour" in active_ids:
        effects["final_gold_mult"] = 0.0

    # ── SYNERGY ──
    if "catalyst" in active_ids:
        other_mutators = len(active_ids) - 1
        if other_mutators > 0:
            effects["xp_mult"] += 0.08 * other_mutators

    if "echo" in active_ids:
        if (
            task_category
            and profile.last_completed_category
            and profile.last_completed_category != task_category
        ):
            effects["final_xp_mult"] *= 2.0
            effects["final_gold_mult"] *= 2.0

    if "mirror" in active_ids:
        if task_category and profile.last_completed_category == task_category:
            effects["trigger_mirror"] = True

    # ── WILD ──
    if "gambler" in active_ids:
        roll = random.random()
        if roll < 0.20:
            effects["final_xp_mult"] *= 2.0
            effects["final_gold_mult"] *= 2.0
        elif roll < 0.40:
            effects["final_xp_mult"] = 0.0
            effects["final_gold_mult"] = 0.0

    if "double_nothing" in active_ids:
        streak = context.get("task_streak", 0)
        if streak in [3, 7, 14, 30, 50, 100, 365]:
            effects["final_xp_mult"] *= 2.0
            effects["final_gold_mult"] *= 2.0

    if "phantom_load" in active_ids:
        yesterday_hours = get_mutator_data("phantom_load").get("yesterday_hours", 0.0)
        effects["xp_mult"] += yesterday_hours * 0.30

    if "cursed_clock" in active_ids:
        effects["flat_xp"] += int(hours * 1)

    if "deja_vu" in active_ids:
        if (
            profile.same_category_streak == 2
            and task_category == profile.last_completed_category
        ):
            effects["xp_mult"] += 0.50

    if "volatile" in active_ids:
        tasks_today = profile.tasks_completed_today
        if tasks_today == 0:
            effects["final_xp_mult"] *= 2.0
            effects["final_gold_mult"] *= 2.0
        elif tasks_today >= 4:
            effects["final_xp_mult"] *= 1.5
            effects["final_gold_mult"] *= 1.5
        else:
            effects["final_xp_mult"] *= 0.90
            effects["final_gold_mult"] *= 0.90

    if "weight_of_history" in active_ids:
        total_hours = profile.total_hours_logged
        if total_hours > 0:
            effects["xp_mult"] += (total_hours // 100) * 0.01

    # Resonance: If 2+ active mutators share a category, +10% to ALL their effects.
    # To implement this easily without hardcoding categories, we'll give a global 10% multiplier to the final multiplier if there are duplicates in the categories
    mutator_cats = {
        "amplifier": [
            "bloodwork",
            "monks_path",
            "iron_routine",
            "lexicon",
            "night_owl",
            "early_riser",
            "tunnel_vision",
            "time_dilation",
            "inversion",
        ],
        "economy": [
            "loan_shark",
            "compound",
            "miser",
            "tithe",
            "alchemist",
            "gamblers_ledger",
        ],
        "streak": ["ascetic_loop", "double_nothing", "momentum"],
        "challenge": [
            "diversity_lock",
            "silence",
            "ironman",
            "glass_cannon",
            "zero_hour",
            "null_zone",
        ],
        "synergy": [
            "catalyst",
            "echo",
            "mirror",
            "resonance",
            "mirror_match",
            "twin_souls",
        ],
        "wild": [
            "gambler",
            "phantom_load",
            "cursed_clock",
            "deja_vu",
            "volatile",
            "weight_of_history",
            "sacrificial_altar",
            "parasite",
            "chronomancer",
        ],
    }

    amp = 1.0
    if "resonance" in active_ids:
        active_cats = []
        for mut_id in active_ids:
            for cat, muts in mutator_cats.items():
                if mut_id in muts:
                    active_cats.append(cat)
                    break
        from collections import Counter

        counts = Counter(active_cats)
        if any(c >= 2 for c in counts.values()):
            amp += 0.10

    if amp > 1.0:
        if effects["xp_mult"] > 1.0:
            effects["xp_mult"] = 1.0 + (effects["xp_mult"] - 1.0) * amp
        if effects["gold_mult"] > 1.0:
            effects["gold_mult"] = 1.0 + (effects["gold_mult"] - 1.0) * amp

    active_codes = profile.active_allies or []
    recruited_allies = {
        a.ally_code: a.level
        for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore
    }
    meldor_level = recruited_allies.get("meldor", 0)

    mutator_amp = 1.0
    if "parasite" in active_ids:
        mutator_amp += 1.0
    if meldor_level >= 2:
        mutator_amp += 0.25

    if mutator_amp > 1.0:
        effects["xp_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["xp_mult"] - 1.0) * mutator_amp)
        )
        effects["gold_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["gold_mult"] - 1.0) * mutator_amp)
        )
        effects["flat_xp"] = int(effects["flat_xp"] * mutator_amp)
        effects["gc_flat"] = effects["gc_flat"] * mutator_amp
        effects["final_xp_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["final_xp_mult"] - 1.0) * mutator_amp)
        )
        effects["final_gold_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["final_gold_mult"] - 1.0) * mutator_amp)
        )
        effects["shop_cost_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["shop_cost_mult"] - 1.0) * mutator_amp)
        )
        effects["damage_taken_mult"] = max(
            0.0, min(5.0, 1.0 + (effects["damage_taken_mult"] - 1.0) * mutator_amp)
        )

    return effects


def resolve_mastery_category(
    activity: str | None = None,
    task_category: str | None = None,
    task_mastery_category: str | None = None,
) -> str:
    """
    Resolves an activity key, task category, and/or task mastery category
    to one of the 5 canonical Mastery Radar categories:
    'body', 'sciences', 'languages', 'spirit', 'humanities'.
    Returns empty string if no category matches.
    """
    if task_mastery_category:
        cat = str(task_mastery_category).lower().strip()
        if cat in {"body", "sciences", "languages", "spirit", "humanities"}:
            return cat

    if activity:
        activity = str(activity).lower().strip()
        if activity in {"exercise", "running", "cold_shower", "nutrition", "sleep"}:
            return "body"
        if activity in {
            "mathematics",
            "physics",
            "chemistry",
            "biology",
            "computer_science",
            "coding",
            "chess",
            "creative_answers",
        }:
            return "sciences"
        if activity in {
            "english",
            "german",
            "other_languages",
            "languages",
            "vocabulary",
        }:
            return "languages"
        if activity in {
            "prayer_meditation",
            "prayer",
            "meditation",
            "mindfulness",
            "reading_philosophy",
        }:
            return "spirit"
        if activity in {"reading", "philosophy", "history", "humanities", "writing"}:
            return "humanities"

    if task_category:
        tc = str(task_category).lower().strip()
        if tc in {
            "body",
            "health & fitness",
            "rest & recovery",
            "recovery",
            "exercise",
            "running",
            "cold_shower",
            "nutrition",
            "sleep",
        }:
            return "body"
        if tc in {
            "sciences",
            "stem",
            "math",
            "physics",
            "chemistry",
            "biology",
            "computer_science",
            "coding",
            "work & career",
        }:
            return "sciences"
        if tc in {
            "languages",
            "english",
            "german",
            "other_languages",
            "social & communication",
            "vocabulary",
        }:
            return "languages"
        if tc in {
            "spirit",
            "prayer_meditation",
            "prayer",
            "meditation",
            "mindfulness",
            "reading_philosophy",
        }:
            return "spirit"
        if tc in {
            "humanities",
            "reading",
            "philosophy",
            "history",
            "humanities & arts",
            "reading & writing",
            "writing",
        }:
            return "humanities"

    return ""


def get_passive_multipliers(profile, context: dict):
    from django.utils import timezone

    unlocked_skills = set(profile.unlocked_skills.values_list("skill_code", flat=True))

    active_codes = profile.active_allies or []
    recruited_allies = {
        a.ally_code: a.level
        for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore
    }

    from api.models import ActiveEffect
    from django.db.models import Q

    active_effects = ActiveEffect.objects.filter(
        user=profile.user,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))

    effects: dict[str, Any] = {
        "xp_mult": 1.0,
        "humanities_xp_mult": 1.0,
        "gold_mult": 1.0,
        "flat_xp": 0,
        "gf_mult": 1.0,
        "gc_mult": 1.0,
        "ps_mult": 1.0,
        "vm_mult": 1.0,
        "crit_chance_bonus": 0.0,
        "crit_damage_mult": 2.0,
        "boss_dmg_mult": 1.0,
        "boss_kill_mana_restore": 0,
        "boss_kill_hp_heal": 0,
        "boss_hp_reduction": 0.0,
        "daily_hp_regen": 0.0,
        "missed_daily_hp_reduction": 0.0,
        "max_hp_bonus": 0,
        "max_mana_bonus": 0,
        "always_crit": False,
        "habit_shield": False,
        "rhea_cosmic_shuffle": False,
        "rhea_gravity_well": False,
        "rhea_void_pull": False,
        "rhea_singularity": False,
        "science_threshold_reduction": 0.0,
        "language_threshold_reduction": 0.0,
        "triple_subject_gold_bonus": 0,
        "weekly_free_mana": False,
        "cognitive_metric_multiplier": 0.0,
        "foc_mult": 1.0,
        "drop_chance_bonus": 0.0,
        "mana_regen_mult": 1.0,
        "ally_stat_mult": 1.0,
        "min_focus": 0.0,
        "gf_ceiling_flat": 0.0,
        "gf_flat_bonus": 0.0,
        "guaranteed_loot_drop": False,
        "cooldown_reduction": 0.0,
        "skill_mana_cost_reduction": 0,
        "skill_boss_damage": 0,
        "daily_free_skill": False,
        "prestige_bonus": 0.0,
        "skill_cost_reduction": 0.0,
        "prestige_start_rank": "E",
        "daily_gold_mult": 1.0,
        "daily_completed_hp_heal": 0,
        "streak_xp_mult": 0.0,
        "mana_flat_bonus": 0,
        "pwr_stat_bonus": 0,
        "def_stat_bonus": 0,
        "foc_stat_bonus": 0,
        "mem_stat_bonus": 0,
        "spd_stat_bonus": 0,
        "lck_stat_bonus": 0,
        "double_sell_gold": False,
        "bran_ingredient_chance": 0.0,
        "meldor_salvage_ingredient_chance": 0.0,
        "shop_cost_mult": 1.0,
    }

    focus_rating = context.get("focus_rating", 0.0)
    is_exercise = context.get("is_exercise", False)
    is_prayer = context.get("is_prayer", False)
    is_meditation = context.get("is_meditation", False)
    is_science = context.get("is_science", False)
    is_language = context.get("is_language", False)

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
        effects["xp_mult"] += 0.05 * ally_mult
    if kira_level >= 2 and is_science:
        effects["xp_mult"] += 0.05 * ally_mult
    if kira_level >= 3 and is_science:
        effects["gf_flat_bonus"] += 0.002 * ally_mult
    if kira_level >= 4 and is_science:
        effects["always_crit"] = True
    if kira_level >= 5:
        effects["science_threshold_reduction"] += 0.10 * ally_mult

    neko_level = recruited_allies.get("neko", 0)
    if neko_level >= 1:
        effects["daily_gold_mult"] += 0.05 * ally_mult
    if neko_level >= 2:
        effects["streak_xp_mult"] += 0.08 * ally_mult
    if neko_level >= 3:
        effects["mana_flat_bonus"] += int(3 * ally_mult)
    if neko_level >= 4:
        effects["habit_shield"] = True
    if neko_level >= 5:
        effects["gold_mult"] += 0.15 * ally_mult

    # VOID
    void_level = recruited_allies.get("void", 0)
    if void_level >= 1:
        if void_level >= 5:
            effects["boss_dmg_mult"] += 0.50 * ally_mult
        else:
            effects["boss_dmg_mult"] += 0.10 * ally_mult
    if void_level >= 2:
        effects["crit_damage_mult"] += 0.20 * ally_mult
    if void_level >= 3:
        effects["boss_kill_mana_restore"] += int(15 * ally_mult)
    if void_level >= 4:
        effects["boss_hp_reduction"] += 0.05 * ally_mult

    # LUNA
    luna_level = recruited_allies.get("luna", 0)
    if luna_level >= 1 and is_exercise:
        effects["xp_mult"] += 0.08 * ally_mult
    if luna_level >= 2:
        effects["missed_daily_hp_reduction"] += 0.10 * ally_mult
    if luna_level >= 3:
        effects["daily_completed_hp_heal"] += int(1.0 * ally_mult)
    if luna_level >= 4:
        effects["boss_kill_hp_heal"] += int(5 * ally_mult)
    if luna_level >= 5:
        effects["max_hp_bonus"] += int(20 * ally_mult)

    # SAKURA
    sakura_level = recruited_allies.get("sakura", 0)
    if sakura_level >= 1 and is_language:
        effects["xp_mult"] += 0.10 * ally_mult
    if sakura_level >= 2:
        effects["gc_mult"] += 0.10 * ally_mult
        effects["vm_mult"] += 0.10 * ally_mult
    if sakura_level >= 4:
        effects["xp_mult"] += 0.08 * ally_mult
    if sakura_level >= 5:
        effects["language_threshold_reduction"] += 0.20 * ally_mult

    # YUKI
    yuki_level = recruited_allies.get("yuki", 0)
    if yuki_level >= 1:
        effects["xp_mult"] += 0.08 * ally_mult
    if yuki_level >= 2:
        effects["max_mana_bonus"] += int(20 * ally_mult)
    if yuki_level >= 3:
        effects["prestige_bonus"] += 0.05 * ally_mult
    if yuki_level >= 4:
        effects["skill_cost_reduction"] += 0.25 * ally_mult
    if yuki_level >= 5:
        effects["prestige_start_rank"] = "C"

    # NENE
    nene_level = recruited_allies.get("nene", 0)
    if nene_level >= 1 and (is_meditation or is_prayer):
        effects["xp_mult"] += 0.15 * ally_mult
    if nene_level >= 2:
        effects["triple_subject_gold_bonus"] += int(30 * ally_mult)
    if nene_level >= 3:
        effects["daily_hp_regen"] += 2.0 * ally_mult
    if nene_level >= 4:
        effects["gf_mult"] += 0.10 * ally_mult
        effects["gc_mult"] += 0.10 * ally_mult
        effects["ps_mult"] += 0.10 * ally_mult
        effects["vm_mult"] += 0.10 * ally_mult
        effects["cognitive_metric_multiplier"] += 0.10 * ally_mult
    if nene_level >= 5:
        effects["weekly_free_mana"] = True

    hex_level = recruited_allies.get("hex", 0)
    if hex_level >= 1:
        effects["cooldown_reduction"] += 0.15 * ally_mult
    if hex_level >= 2:
        effects["skill_mana_cost_reduction"] += int(10 * ally_mult)
    if hex_level >= 3:
        effects["skill_boss_damage"] += int(20 * ally_mult)
    if hex_level >= 4:
        effects["cooldown_reduction"] += 0.20 * ally_mult
    if hex_level >= 5:
        effects["daily_free_skill"] = True

    # GRIER
    grier_level = recruited_allies.get("grier", 0)
    if grier_level >= 1:
        if focus_rating >= 9.0:
            effects["grier_l1_heal"] = True
            effects["gold_mult"] -= 0.25 * ally_mult
    if grier_level >= 3:
        effects["max_hp_bonus"] += int(40 * ally_mult)
        effects["spd_stat_bonus"] -= int(4 * ally_mult)
    if grier_level >= 5:
        effects["grier_unbreakable_will"] = True

    # LYRA
    lyra_level = recruited_allies.get("lyra", 0)
    if lyra_level >= 3:
        effects["decaying_focus"] = True
    if lyra_level >= 4:
        effects["reduce_cooldowns_by_hours"] = True
    if lyra_level >= 5:
        effects["lyra_time_paradox"] = True

    # MELDOR
    meldor_level = recruited_allies.get("meldor", 0)
    if meldor_level >= 3:
        effects["meldor_salvage_ingredient_chance"] = 0.10 * ally_mult

    # KAGE
    kage_level = recruited_allies.get("kage", 0)
    if kage_level >= 1:
        effects["crit_damage_mult"] = 3.0
        effects["kage_halve_crit"] = True
    if kage_level >= 3:
        effects["kage_flesh_rip"] = True
    if kage_level >= 5:
        effects["kage_executioner"] = True

    # ZEPHYR
    zephyr_level = recruited_allies.get("zephyr", 0)
    if zephyr_level >= 2:
        if profile.streak >= 10:
            effects["pwr_stat_bonus"] += int(2 * ally_mult)
            effects["def_stat_bonus"] += int(2 * ally_mult)
            effects["foc_stat_bonus"] += int(2 * ally_mult)
            effects["mem_stat_bonus"] += int(2 * ally_mult)
            effects["spd_stat_bonus"] += int(2 * ally_mult)
            effects["lck_stat_bonus"] += int(2 * ally_mult)
    if zephyr_level >= 3:
        effects["ally_stat_mult"] += 0.15 * ally_mult
    if zephyr_level >= 5:
        effects["zephyr_grand_finale"] = True

    # BRAN
    bran_level = recruited_allies.get("bran", 0)
    if bran_level >= 1:
        effects["drop_chance_bonus"] += 0.08 * ally_mult
        effects["xp_mult"] -= 0.10 * ally_mult
    if bran_level >= 2:
        effects["shop_cost_mult"] -= 0.15 * ally_mult
    if bran_level >= 3:
        effects["double_sell_gold"] = True
        effects["bran_ingredient_chance"] = 0.20 * ally_mult
    if bran_level >= 4:
        effects["bran_overdrive"] = True
    if bran_level >= 5:
        effects["bran_jackpot"] = True

    # VIVIAN
    vivian_level = recruited_allies.get("vivian", 0)
    if vivian_level >= 1:
        effects["vivian_blood_magic"] = True
    if vivian_level >= 3:
        effects["vivian_crimson_surge"] = True
    if vivian_level >= 4:
        effects["vivian_life_drain"] = True
    if vivian_level >= 5 and profile.hp == 1:
        effects["always_crit"] = True
        effects["xp_mult"] += 1.0 * ally_mult

    # RHEA
    rhea_level = recruited_allies.get("rhea", 0)
    if rhea_level >= 1:
        effects["rhea_cosmic_shuffle"] = True
    if rhea_level >= 3:
        effects["rhea_gravity_well"] = True
    if rhea_level >= 4:
        effects["rhea_void_pull"] = True
    if rhea_level >= 5:
        effects["rhea_singularity"] = True
        effects["max_hp_bonus"] -= int(30 * ally_mult)

    # Apply class-specific passive XP bonus (+20% XP for matching mastery category)
    char_class = getattr(profile, "character_class", "")
    if char_class:
        class_key = char_class.lower().strip()
        CLASS_MASTERY_MAP = {
            "linguist": "languages",
            "architect": "sciences",
            "warlord": "body",
            "ascetic": "spirit",
        }
        if class_key in CLASS_MASTERY_MAP:
            target_mastery = CLASS_MASTERY_MAP[class_key]
            activity = context.get("activity")
            task_category = context.get("task_category")
            task_mastery_category = context.get("task_mastery_category")

            resolved_cat = resolve_mastery_category(
                activity=activity,
                task_category=task_category,
                task_mastery_category=task_mastery_category,
            )
            if resolved_cat == target_mastery:
                effects["xp_mult"] += 0.20

    return effects


def calculate_base_training_xp(
    hours: float, focus_rating: float, flat_xp_bonus: int = 0, xp_mult: float = 1.0
) -> float:
    """Shared formula for player and rival training session base XP."""
    return ((hours * focus_rating * 5) + flat_xp_bonus) * xp_mult
