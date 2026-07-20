import logging
from typing import Dict, Any
from django.utils import timezone

logger = logging.getLogger(__name__)

TITLES_CATALOG = [
    # ── 🌙 TIME & RHYTHM (6) ──────────────────────────────────────────────────
    {
        "id": "night_owl",
        "name": "Night Owl",
        "icon": "🌙",
        "category": "time",
        "color": "#a855f7",
        "description": "Complete 5+ night tasks (23:00 – 05:00)",
        "priority": 85,
    },
    {
        "id": "early_bird",
        "name": "Early Bird",
        "icon": "🌅",
        "category": "time",
        "color": "#f59e0b",
        "description": "Complete 5+ morning tasks (05:00 – 08:00)",
        "priority": 85,
    },
    {
        "id": "noonday_sentinel",
        "name": "Noonday Sentinel",
        "icon": "☀️",
        "category": "time",
        "color": "#eab308",
        "description": "Complete 10+ lunchtime tasks (12:00 – 14:00)",
        "priority": 60,
    },
    {
        "id": "twilight_hunter",
        "name": "Twilight Hunter",
        "icon": "🌆",
        "category": "time",
        "color": "#f97316",
        "description": "Complete 15+ evening tasks (18:00 – 21:00)",
        "priority": 65,
    },
    {
        "id": "weekend_warrior",
        "name": "Weekend Warrior",
        "icon": "🍷",
        "category": "time",
        "color": "#ec4899",
        "description": "Complete 10+ weekend tasks",
        "priority": 70,
    },
    {
        "id": "midnight_alchemist",
        "name": "Midnight Alchemist",
        "icon": "🌌",
        "category": "time",
        "color": "#8b5cf6",
        "description": "Complete a task or session right at midnight (00:00 - 01:00)",
        "priority": 90,
    },
    # ── 🔥 STREAK & CONSISTENCY (6) ───────────────────────────────────────────
    {
        "id": "ignited",
        "name": "Ignited",
        "icon": "🔥",
        "category": "streak",
        "color": "#f97316",
        "description": "Maintain a daily streak for 7+ days",
        "priority": 40,
    },
    {
        "id": "marathoner",
        "name": "Marathoner",
        "icon": "🏃",
        "category": "streak",
        "color": "#eab308",
        "description": "Maintain a daily streak for 30+ days",
        "priority": 80,
    },
    {
        "id": "iron_will",
        "name": "Iron Will",
        "icon": "🛡️",
        "category": "streak",
        "color": "#3b82f6",
        "description": "Maintain a daily streak for 60+ days",
        "priority": 95,
    },
    {
        "id": "unbroken",
        "name": "Unbroken",
        "icon": "⚡",
        "category": "streak",
        "color": "#a855f7",
        "description": "Maintain a daily streak for 90+ days",
        "priority": 110,
    },
    {
        "id": "time_legend",
        "name": "Time Legend",
        "icon": "👑",
        "category": "streak",
        "color": "#ef4444",
        "description": "Maintain a daily streak for 180+ days",
        "priority": 150,
    },
    {
        "id": "phoenix",
        "name": "Phoenix",
        "icon": "🔥",
        "category": "streak",
        "color": "#f43f5e",
        "description": "Protect or restore a streak using streak shield",
        "priority": 75,
    },
    # ── 🔬 SPECIALIZATIONS & XP DOMAINS (8) ───────────────────────────────────
    {
        "id": "bookworm",
        "name": "Bookworm",
        "icon": "📚",
        "category": "spec",
        "color": "#10b981",
        "description": "Earn 100+ Gc (Language/Humanities) XP in a week",
        "priority": 70,
    },
    {
        "id": "polyglot",
        "name": "Polyglot",
        "icon": "🌐",
        "category": "spec",
        "color": "#06b6d4",
        "description": "Reach Gc (Crystallized Intellect) rating ≥ 115",
        "priority": 85,
    },
    {
        "id": "architect_mind",
        "name": "Mind Architect",
        "icon": "🏛️",
        "category": "spec",
        "color": "#3b82f6",
        "description": "Earn 100+ Gf (Science/Logic) XP in a week",
        "priority": 70,
    },
    {
        "id": "neuro_surgeon",
        "name": "Neuro-Surgeon",
        "icon": "🧠",
        "category": "spec",
        "color": "#6366f1",
        "description": "Reach Processing Speed (Ps) rating ≥ 115",
        "priority": 85,
    },
    {
        "id": "archive_keeper",
        "name": "Archive Keeper",
        "icon": "📜",
        "category": "spec",
        "color": "#8b5cf6",
        "description": "Reach Verbal Memory (Vm) rating ≥ 115",
        "priority": 85,
    },
    {
        "id": "ascetic_scholar",
        "name": "Ascetic Scholar",
        "icon": "🧘",
        "category": "spec",
        "color": "#10b981",
        "description": "Choose Ascetic class and complete 10+ tasks",
        "priority": 65,
    },
    {
        "id": "linguist_sovereign",
        "name": "Linguist Sovereign",
        "icon": "✍️",
        "category": "spec",
        "color": "#06b6d4",
        "description": "Choose Linguist class and complete 25+ tasks",
        "priority": 75,
    },
    {
        "id": "warlord_guard",
        "name": "Warlord Guard",
        "icon": "🗡️",
        "category": "spec",
        "color": "#ef4444",
        "description": "Choose Warlord class and land 10+ boss damage attacks",
        "priority": 75,
    },
    # ── 🧪 MUTATORS & CRAFTING (6) ───────────────────────────────────────────
    {
        "id": "alchemist",
        "name": "Alchemist",
        "icon": "🧪",
        "category": "craft",
        "color": "#a855f7",
        "description": "Unlock 3+ mutators",
        "priority": 65,
    },
    {
        "id": "grand_alchemist",
        "name": "Grand Alchemist",
        "icon": "⚗️",
        "category": "craft",
        "color": "#c084fc",
        "description": "Unlock 7+ mutators",
        "priority": 100,
    },
    {
        "id": "experimentalist",
        "name": "Experimentalist",
        "icon": "🧫",
        "category": "craft",
        "color": "#e879f9",
        "description": "Enable 2+ active mutators simultaneously",
        "priority": 80,
    },
    {
        "id": "rune_smith",
        "name": "Rune Smith",
        "icon": "🔨",
        "category": "craft",
        "color": "#f59e0b",
        "description": "Craft 3+ items in the forge",
        "priority": 70,
    },
    {
        "id": "potion_master",
        "name": "Potion Master",
        "icon": "🍷",
        "category": "craft",
        "color": "#f43f5e",
        "description": "Consume 5+ potions from inventory",
        "priority": 60,
    },
    {
        "id": "relic_collector",
        "name": "Relic Collector",
        "icon": "💎",
        "category": "craft",
        "color": "#38bdf8",
        "description": "Own 5+ inventory items",
        "priority": 65,
    },
    # ── ⚔️ COMBAT & BOSS BATTLES (7) ───────────────────────────────────────────
    {
        "id": "boss_slayer",
        "name": "Boss Slayer",
        "icon": "⚔️",
        "category": "combat",
        "color": "#ef4444",
        "description": "Defeat at least 1 raid boss",
        "priority": 70,
    },
    {
        "id": "giant_executioner",
        "name": "Giant Executioner",
        "icon": "🪓",
        "category": "combat",
        "color": "#b91c1c",
        "description": "Defeat 5+ raid bosses",
        "priority": 110,
    },
    {
        "id": "critical_striker",
        "name": "Critical Striker",
        "icon": "💥",
        "category": "combat",
        "color": "#f97316",
        "description": "Land 10+ critical hits",
        "priority": 65,
    },
    {
        "id": "darkness_bane",
        "name": "Bane of Darkness",
        "icon": "🔱",
        "category": "combat",
        "color": "#8b5cf6",
        "description": "Deal 500+ total damage to bosses",
        "priority": 90,
    },
    {
        "id": "tactician",
        "name": "Battle Tactician",
        "icon": "🎯",
        "category": "combat",
        "color": "#0284c7",
        "description": "Use an active combat skill",
        "priority": 50,
    },
    {
        "id": "dark_receptionist",
        "name": "Dark Reaper",
        "icon": "🦇",
        "category": "combat",
        "color": "#4c1d95",
        "description": "Use Vivian's Dark Sacrifice skills",
        "priority": 85,
    },
    {
        "id": "chaos_lord",
        "name": "Chaos Lord",
        "icon": "🌀",
        "category": "combat",
        "color": "#d946ef",
        "description": "Activate Rhea's Chaos Control skills",
        "priority": 85,
    },
    # ── ⏱️ POMODORO & PRODUCTIVITY (5) ───────────────────────────────────────
    {
        "id": "deep_work_master",
        "name": "Deep Work Master",
        "icon": "⏱️",
        "category": "focus",
        "color": "#10b981",
        "description": "Complete 5+ Pomodoro sessions",
        "priority": 60,
    },
    {
        "id": "zen_meditator",
        "name": "Zen Meditator",
        "icon": "🧘‍♂️",
        "category": "focus",
        "color": "#06b6d4",
        "description": "Complete 20+ Pomodoro sessions",
        "priority": 95,
    },
    {
        "id": "chronomancer",
        "name": "Chronomancer",
        "icon": "⏳",
        "category": "focus",
        "color": "#6366f1",
        "description": "Log 25+ hours of focused tasks",
        "priority": 100,
    },
    {
        "id": "sprint_champion",
        "name": "Sprint Champion",
        "icon": "⚡",
        "category": "focus",
        "color": "#eab308",
        "description": "Complete 5+ tasks in a single day",
        "priority": 65,
    },
    {
        "id": "unstoppable",
        "name": "Unstoppable",
        "icon": "🚀",
        "category": "focus",
        "color": "#ec4899",
        "description": "Complete 15+ tasks in a single day",
        "priority": 105,
    },
    # ── 🤝 PARTY & COMPANIONS (5) ─────────────────────────────────────────────
    {
        "id": "squad_commander",
        "name": "Squad Commander",
        "icon": "🛡️",
        "category": "social",
        "color": "#3b82f6",
        "description": "Join or create a Party",
        "priority": 50,
    },
    {
        "id": "ally_patron",
        "name": "Ally Patron",
        "icon": "🤝",
        "category": "social",
        "color": "#8b5cf6",
        "description": "Recruit at least 1 companion",
        "priority": 55,
    },
    {
        "id": "beast_master",
        "name": "Beast Master",
        "icon": "🐾",
        "category": "social",
        "color": "#10b981",
        "description": "Recruit 3+ companions",
        "priority": 85,
    },
    {
        "id": "inspiring_leader",
        "name": "Inspiring Leader",
        "icon": "📣",
        "category": "social",
        "color": "#f59e0b",
        "description": "Apply party buffs or reactions",
        "priority": 60,
    },
    {
        "id": "dynamic_duo",
        "name": "Dynamic Duo",
        "icon": "👥",
        "category": "social",
        "color": "#06b6d4",
        "description": "Be in a Party with 2+ members",
        "priority": 65,
    },
    # ── 💰 ECONOMY & WEALTH (4) ───────────────────────────────────────────────
    {
        "id": "gold_digger",
        "name": "Gold Digger",
        "icon": "🪙",
        "category": "wealth",
        "color": "#eab308",
        "description": "Earn 250+ gold lifetime",
        "priority": 55,
    },
    {
        "id": "tycoon",
        "name": "MIND OS Tycoon",
        "icon": "🏛️",
        "category": "wealth",
        "color": "#f59e0b",
        "description": "Earn 1,500+ gold lifetime",
        "priority": 95,
    },
    {
        "id": "big_spender",
        "name": "Big Spender",
        "icon": "🛍️",
        "category": "wealth",
        "color": "#ec4899",
        "description": "Purchase 5+ items from the shop",
        "priority": 65,
    },
    {
        "id": "treasure_hunter",
        "name": "Treasure Hunter",
        "icon": "📦",
        "category": "wealth",
        "color": "#a855f7",
        "description": "Open at least 1 loot chest",
        "priority": 60,
    },
    # ── 🌟 RANKS & PRESTIGE (5) ───────────────────────────────────────────────
    {
        "id": "awakened_one",
        "name": "Awakened One",
        "icon": "✨",
        "category": "rank",
        "color": "#94a3b8",
        "description": "Complete MIND OS profile setup",
        "priority": 10,
    },
    {
        "id": "mind_over_matter",
        "name": "Mind Over Matter",
        "icon": "⚛️",
        "category": "rank",
        "color": "#38bdf8",
        "description": "Complete 50+ total tasks",
        "priority": 75,
    },
    {
        "id": "pioneer",
        "name": "Pioneer",
        "icon": "🔱",
        "category": "rank",
        "color": "#60a5fa",
        "description": "Reach Rank C or higher",
        "priority": 70,
    },
    {
        "id": "grandmaster",
        "name": "Grandmaster",
        "icon": "👑",
        "category": "rank",
        "color": "#f59e0b",
        "description": "Reach Rank S or higher",
        "priority": 120,
    },
    {
        "id": "apex_sovereign",
        "name": "Apex Sovereign",
        "icon": "🌌",
        "category": "rank",
        "color": "#c084fc",
        "description": "Perform at least 1 Prestige reset",
        "priority": 150,
    },
]


def _evaluate_title_unlock(
    user, title_id: str, stats, profile, task_stats: Dict[str, Any]
) -> tuple[bool, float, str]:
    """
    Evaluates whether a specific title is unlocked for the user.
    Returns (is_unlocked, progress_pct, progress_text).
    """
    streak = profile.streak or 0
    total_tasks = stats.total_tasks_completed if stats else 0
    total_gold = stats.total_gold_earned if stats else 0
    bosses_def = stats.bosses_defeated if stats else 0
    boss_damage = stats.total_boss_damage if stats else 0
    crits = stats.total_crits if stats else 0

    if title_id == "awakened_one":
        return True, 100, "1 / 1"

    if title_id == "ignited":
        pct = min(100, (streak / 7) * 100)
        return streak >= 7, pct, f"{streak} / 7 days"

    if title_id == "marathoner":
        pct = min(100, (streak / 30) * 100)
        return streak >= 30, pct, f"{streak} / 30 days"

    if title_id == "iron_will":
        pct = min(100, (streak / 60) * 100)
        return streak >= 60, pct, f"{streak} / 60 days"

    if title_id == "unbroken":
        pct = min(100, (streak / 90) * 100)
        return streak >= 90, pct, f"{streak} / 90 days"

    if title_id == "time_legend":
        pct = min(100, (streak / 180) * 100)
        return streak >= 180, pct, f"{streak} / 180 days"

    if title_id == "night_owl":
        count = task_stats.get("night_count", 0)
        pct = min(100, (count / 5) * 100)
        return count >= 5, pct, f"{count} / 5 night tasks"

    if title_id == "early_bird":
        count = task_stats.get("morning_count", 0)
        pct = min(100, (count / 5) * 100)
        return count >= 5, pct, f"{count} / 5 morning tasks"

    if title_id == "noonday_sentinel":
        count = task_stats.get("noon_count", 0)
        pct = min(100, (count / 10) * 100)
        return count >= 10, pct, f"{count} / 10 noon tasks"

    if title_id == "twilight_hunter":
        count = task_stats.get("evening_count", 0)
        pct = min(100, (count / 15) * 100)
        return count >= 15, pct, f"{count} / 15 evening tasks"

    if title_id == "weekend_warrior":
        count = task_stats.get("weekend_count", 0)
        pct = min(100, (count / 10) * 100)
        return count >= 10, pct, f"{count} / 10 weekend tasks"

    if title_id == "midnight_alchemist":
        count = task_stats.get("midnight_exact", 0)
        return count >= 1, (100 if count >= 1 else 0), f"{count} / 1 midnight task"

    if title_id == "bookworm":
        from django.utils import timezone
        from datetime import timedelta
        from api.models import TrainingSession
        from api.services.mechanics import resolve_mastery_category

        seven_days_ago = timezone.now() - timedelta(days=7)
        sessions = TrainingSession.objects.filter(
            user_profile=profile, created_at__gte=seven_days_ago
        )
        val = 0
        for s in sessions:
            cat = resolve_mastery_category(activity=s.activity_key)
            if cat in ("languages", "humanities"):
                val += s.xp_earned or 0
        return val >= 100, min(100, (val / 100) * 100), f"{val} / 100 Gc XP"

    if title_id == "polyglot":
        val = profile.gc or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Gc"

    if title_id == "architect_mind":
        from django.utils import timezone
        from datetime import timedelta
        from api.models import TrainingSession
        from api.services.mechanics import resolve_mastery_category

        seven_days_ago = timezone.now() - timedelta(days=7)
        sessions = TrainingSession.objects.filter(
            user_profile=profile, created_at__gte=seven_days_ago
        )
        val = 0
        for s in sessions:
            cat = resolve_mastery_category(activity=s.activity_key)
            if cat == "sciences":
                val += s.xp_earned or 0
        return val >= 100, min(100, (val / 100) * 100), f"{val} / 100 Gf XP"

    if title_id == "neuro_surgeon":
        val = profile.ps or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Ps"

    if title_id == "archive_keeper":
        val = profile.vm or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Vm"

    if title_id == "ascetic_scholar":
        is_asc = str(profile.character_class).lower().strip() == "ascetic"
        count = total_tasks if is_asc else 0
        return (
            is_asc and count >= 10,
            min(100, (count / 10) * 100),
            f"{count} / 10 Ascetic tasks",
        )

    if title_id == "linguist_sovereign":
        is_ling = str(profile.character_class).lower().strip() == "linguist"
        count = total_tasks if is_ling else 0
        return (
            is_ling and count >= 25,
            min(100, (count / 25) * 100),
            f"{count} / 25 Linguist tasks",
        )

    if title_id == "warlord_guard":
        is_war = str(profile.character_class).lower().strip() == "warlord"
        count = stats.boss_attacks_count if stats else 0
        return (
            is_war and count >= 10,
            min(100, (count / 10) * 100),
            f"{count} / 10 attacks",
        )

    if title_id == "alchemist":
        purchased = (
            profile.active_mutators.get("purchased", [])
            if isinstance(profile.active_mutators, dict)
            else []
        )
        mut_count = len(purchased)
        return (
            mut_count >= 3,
            min(100, (mut_count / 3) * 100),
            f"{mut_count} / 3 mutators",
        )

    if title_id == "grand_alchemist":
        purchased = (
            profile.active_mutators.get("purchased", [])
            if isinstance(profile.active_mutators, dict)
            else []
        )
        mut_count = len(purchased)
        return (
            mut_count >= 7,
            min(100, (mut_count / 7) * 100),
            f"{mut_count} / 7 mutators",
        )

    if title_id == "experimentalist":
        active_list = (
            profile.active_mutators.get("active", [])
            if isinstance(profile.active_mutators, dict)
            else []
        )
        mut_count = len(active_list)
        return (
            mut_count >= 2,
            (100 if mut_count >= 2 else 50 if mut_count == 1 else 0),
            f"{mut_count} / 2 mutators",
        )

    if title_id == "rune_smith":
        crafted = stats.items_crafted if stats else 0
        return (
            crafted >= 3,
            min(100, (crafted / 3) * 100),
            f"{crafted} / 3 crafted",
        )

    if title_id == "potion_master":
        consumed = stats.potions_consumed if stats else 0
        return (
            consumed >= 5,
            min(100, (consumed / 5) * 100),
            f"{consumed} / 5 potions",
        )

    if title_id == "relic_collector":
        from api.models import InventoryItem

        inv_count = InventoryItem.objects.filter(user_profile=profile).count()
        return (
            inv_count >= 5,
            min(100, (inv_count / 5) * 100),
            f"{inv_count} / 5 items",
        )

    if title_id == "boss_slayer":
        return (
            bosses_def >= 1,
            (100 if bosses_def >= 1 else 0),
            f"{bosses_def} / 1 boss",
        )

    if title_id == "giant_executioner":
        return (
            bosses_def >= 5,
            min(100, (bosses_def / 5) * 100),
            f"{bosses_def} / 5 bosses",
        )

    if title_id == "critical_striker":
        return (
            crits >= 10 or boss_damage >= 100,
            min(100, (boss_damage / 100) * 100),
            f"{boss_damage} / 100 damage",
        )

    if title_id == "darkness_bane":
        return (
            boss_damage >= 500,
            min(100, (boss_damage / 500) * 100),
            f"{boss_damage} / 500 damage",
        )

    if title_id == "tactician":
        from api.models import SkillCooldown

        used_skill = SkillCooldown.objects.filter(user=user).exists()
        return (
            used_skill,
            100 if used_skill else 0,
            "Use any active skill",
        )

    if title_id == "dark_receptionist":
        active_codes = profile.active_allies or []
        recruited = {
            a.ally_code: a.level
            for a in profile.recruited_allies.filter(ally_code__in=active_codes)
        }
        vivian_level = recruited.get("vivian", 0)
        return (
            vivian_level >= 1,
            min(100, (vivian_level / 1) * 100),
            "Recruit Vivian",
        )

    if title_id == "chaos_lord":
        active_codes = profile.active_allies or []
        recruited = {
            a.ally_code: a.level
            for a in profile.recruited_allies.filter(ally_code__in=active_codes)
        }
        rhea_level = recruited.get("rhea", 0)
        return (
            rhea_level >= 1,
            min(100, (rhea_level / 1) * 100),
            "Recruit Rhea",
        )

    if title_id == "deep_work_master":
        from api.models import PomodoroSession

        pomo_count = PomodoroSession.objects.filter(user=user).count()
        return (
            pomo_count >= 5,
            min(100, (pomo_count / 5) * 100),
            f"{pomo_count} / 5 Pomodoro sessions",
        )

    if title_id == "zen_meditator":
        from api.models import PomodoroSession

        pomo_count = PomodoroSession.objects.filter(user=user).count()
        return (
            pomo_count >= 20,
            min(100, (pomo_count / 20) * 100),
            f"{pomo_count} / 20 Pomodoro sessions",
        )

    if title_id == "chronomancer":
        from api.models import PomodoroSession
        from django.db.models import Sum

        total_minutes = (
            PomodoroSession.objects.filter(user=user).aggregate(total=Sum("duration"))[
                "total"
            ]
            or 0
        )
        total_hours = total_minutes / 60
        return (
            total_hours >= 25,
            min(100, (total_hours / 25) * 100),
            f"{total_hours:.1f} / 25 hours focused",
        )

    if title_id == "sprint_champion":
        max_day = task_stats.get("max_day_tasks", 0)
        return (
            max_day >= 5,
            min(100, (max_day / 5) * 100),
            f"{max_day} / 5 tasks in one day",
        )

    if title_id == "unstoppable":
        max_day = task_stats.get("max_day_tasks", 0)
        return (
            max_day >= 15,
            min(100, (max_day / 15) * 100),
            f"{max_day} / 15 tasks in one day",
        )

    if title_id == "squad_commander":
        from api.models import PartyMembership

        in_party = PartyMembership.objects.filter(user=user).exists()
        return in_party, 100 if in_party else 0, "Join or create a Party"

    if title_id == "ally_patron":
        count = profile.recruited_allies.count()
        return (
            count >= 1,
            100 if count >= 1 else 0,
            f"{count} / 1 companion",
        )

    if title_id == "beast_master":
        count = profile.recruited_allies.count()
        return (
            count >= 3,
            min(100, (count / 3) * 100),
            f"{count} / 3 companions",
        )

    if title_id == "inspiring_leader":
        from api.models import PartyMembership

        membership = (
            PartyMembership.objects.filter(user=user).select_related("party").first()
        )
        has_buff = membership is not None and membership.last_buff_sent_at is not None
        return has_buff, 100 if has_buff else 0, "Send a party buff"

    if title_id == "dynamic_duo":
        from api.models import PartyMembership

        membership = (
            PartyMembership.objects.filter(user=user).select_related("party").first()
        )
        member_count = membership.party.memberships.count() if membership else 0
        return (
            member_count >= 2,
            min(100, (member_count / 2) * 100),
            f"{member_count} / 2 members",
        )

    if title_id == "gold_digger":
        return (
            total_gold >= 250,
            min(100, (total_gold / 250) * 100),
            f"{total_gold} / 250 gold",
        )

    if title_id == "tycoon":
        return (
            total_gold >= 1500,
            min(100, (total_gold / 1500) * 100),
            f"{total_gold} / 1500 gold",
        )

    if title_id == "big_spender":
        purchased = stats.items_purchased if stats else 0
        return (
            purchased >= 5,
            min(100, (purchased / 5) * 100),
            f"{purchased} / 5 purchases",
        )

    if title_id == "treasure_hunter":
        opened = stats.chests_opened if stats else 0
        return (
            opened >= 1,
            100 if opened >= 1 else 0,
            f"{opened} / 1 chest opened",
        )

    if title_id == "mind_over_matter":
        return (
            total_tasks >= 50,
            min(100, (total_tasks / 50) * 100),
            f"{total_tasks} / 50 tasks",
        )

    if title_id == "pioneer":
        from api.services.profile_service import get_rank_info

        rank_info = get_rank_info(profile)
        rank_id = rank_info.get("current_id", "E")
        return (
            rank_id in ["C", "B", "A", "S", "SS", "SSS"],
            100 if rank_id in ["C", "B", "A", "S", "SS", "SSS"] else 30,
            "Rank C",
        )

    if title_id == "grandmaster":
        from api.services.profile_service import get_rank_info

        rank_info = get_rank_info(profile)
        rank_id = rank_info.get("current_id", "E")
        return (
            rank_id in ["S", "SS", "SSS"],
            100 if rank_id in ["S", "SS", "SSS"] else 10,
            "Rank S",
        )

    if title_id == "apex_sovereign":
        p_count = profile.prestige_count or 0
        return p_count >= 1, (100 if p_count >= 1 else 0), f"{p_count} / 1 Prestige"

    if title_id == "phoenix":
        consumed = stats.potions_consumed if stats else 0
        shield_used = consumed >= 1 and streak >= 1
        return shield_used, 100 if shield_used else 0, "Use streak shield item"

    # Default fallback
    return True, 100, "Unlocked"


def _get_user_task_stats(user) -> Dict[str, int]:
    """Helper to calculate task distribution stats by hour/day for time-based titles."""
    try:
        from api.models import Task

        completed_tasks = Task.objects.filter(user=user, is_completed=True).values_list(
            "last_completed_at", flat=True
        )

        night_count = 0
        morning_count = 0
        noon_count = 0
        evening_count = 0
        weekend_count = 0
        midnight_exact = 0

        tasks_per_day = {}

        for dt in completed_tasks:
            if not dt:
                continue
            local_dt = timezone.localtime(dt)
            h = local_dt.hour

            if h >= 23 or h < 5:
                night_count += 1
            if 5 <= h < 8:
                morning_count += 1
            if 12 <= h < 14:
                noon_count += 1
            if 18 <= h < 21:
                evening_count += 1
            if local_dt.weekday() in [5, 6]:
                weekend_count += 1
            if h == 0:
                midnight_exact += 1

            day_str = local_dt.strftime("%Y-%m-%d")
            tasks_per_day[day_str] = tasks_per_day.get(day_str, 0) + 1

        max_day_tasks = max(tasks_per_day.values()) if tasks_per_day else 0

        return {
            "night_count": night_count,
            "morning_count": morning_count,
            "noon_count": noon_count,
            "evening_count": evening_count,
            "weekend_count": weekend_count,
            "midnight_exact": midnight_exact,
            "max_day_tasks": max_day_tasks,
        }
    except Exception as e:
        logger.error(f"Error computing task stats for titles: {e}")
        return {
            "night_count": 0,
            "morning_count": 0,
            "noon_count": 0,
            "evening_count": 0,
            "weekend_count": 0,
            "midnight_exact": 0,
            "max_day_tasks": 0,
        }


def get_user_playstyle_titles(profile) -> Dict[str, Any]:
    """
    Evaluates all 52 titles for the given UserProfile.
    Returns:
      - active_title: { id, name, icon, category, color, description, is_equipped }
      - unlocked_count: int
      - total_count: int
      - titles: list of all titles with unlock status & progress
    """
    user = profile.user
    stats = getattr(user, "stats", None)
    task_stats = _get_user_task_stats(user)

    # Option B: Permanent unlock list
    unlocked_list = list(profile.unlocked_playstyle_titles or [])
    newly_unlocked = False

    evaluated_titles = []
    unlocked_unpinned = []

    for item in TITLES_CATALOG:
        t_id = item["id"]
        if t_id in unlocked_list:
            unlocked, progress_pct, progress_text = True, 100.0, "Unlocked"
        else:
            unlocked, progress_pct, progress_text = _evaluate_title_unlock(
                user, t_id, stats, profile, task_stats
            )
            if unlocked:
                unlocked_list.append(t_id)
                newly_unlocked = True

        t_obj = {
            "id": t_id,
            "name": item["name"],
            "icon": item["icon"],
            "category": item["category"],
            "color": item["color"],
            "description": item["description"],
            "priority": item["priority"],
            "unlocked": unlocked,
            "progress_pct": round(progress_pct, 1),
            "progress_text": progress_text,
            "is_equipped": (profile.equipped_title == t_id),
        }
        evaluated_titles.append(t_obj)

        if unlocked:
            unlocked_unpinned.append(t_obj)

    if newly_unlocked:
        profile.unlocked_playstyle_titles = unlocked_list
        profile.save(update_fields=["unlocked_playstyle_titles"])

    # Sort unlocked by priority descending to pick the auto playstyle title
    unlocked_unpinned.sort(key=lambda x: x["priority"], reverse=True)
    auto_title = unlocked_unpinned[0] if unlocked_unpinned else evaluated_titles[0]

    # Check if user has an explicitly equipped title
    active_title = auto_title
    if profile.equipped_title:
        equipped_match = next(
            (
                t
                for t in evaluated_titles
                if t["id"] == profile.equipped_title and t["unlocked"]
            ),
            None,
        )
        if equipped_match:
            active_title = equipped_match

    unlocked_count = len(unlocked_unpinned)

    return {
        "active_title": active_title,
        "unlocked_count": unlocked_count,
        "total_count": len(TITLES_CATALOG),
        "titles": evaluated_titles,
    }
