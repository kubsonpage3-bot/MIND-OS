import math
from datetime import datetime, timezone, timedelta

# Mirrors the frontend ACTIVITIES config for picking rival subjects
ACTIVITIES = {
    "reading": "Reading",
    "math": "Math",
    "coding": "Coding",
    "language": "Language",
    "physics": "Physics",
    "music": "Music",
    "art": "Art",
    "writing": "Writing",
    "exercise": "Exercise",
    "meditation": "Meditation",
}

ALL_SUBJECTS = list(ACTIVITIES.keys())

# ── Difficulty config ──────────────────────────────────────────────────────────
# xp_mult: multiplier applied to Johan's daily XP
# surge_mult: how much stronger surge days are
# catch_up_threshold: days behind before cooldown activates
JOHAN_DIFFICULTIES = {
    "EASY": {"xp_mult": 0.60, "surge_mult": 1.2, "catch_up_threshold": 3},
    "NORMAL": {"xp_mult": 0.90, "surge_mult": 1.5, "catch_up_threshold": 7},
    "HARD": {"xp_mult": 1.20, "surge_mult": 1.8, "catch_up_threshold": 10},
    "EXTREME": {"xp_mult": 1.60, "surge_mult": 2.2, "catch_up_threshold": 99},
}
DEFAULT_DIFFICULTY = "NORMAL"


def get_difficulty(stored_rival_data: dict) -> dict:
    key = stored_rival_data.get("rivalDifficulty", DEFAULT_DIFFICULTY)
    return JOHAN_DIFFICULTIES.get(key, JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY])


def make_prng(seed_str):
    s = 0
    for char in str(seed_str):
        s = ((s * 31) + ord(char)) & 0xFFFFFFFF

    def rand():
        nonlocal s
        s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF
        return s / 0xFFFFFFFF

    return rand


def get_day_number():
    return int(datetime.now(timezone.utc).timestamp() * 1000) // 86400000


def get_day_pattern(date_str):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    day_of_month = d.day
    # JS getDay() returns 0 for Sunday. Python weekday() returns 0 for Monday.
    day_of_week = (d.weekday() + 1) % 7

    rand = make_prng(date_str + "pattern")

    surge_day = int(rand() * 7)
    weak_day1 = int(rand() * 7)
    weak_day2 = (weak_day1 + 2) % 7

    if day_of_week == surge_day:
        return {
            "type": "surge",
            "multiplier": 1.5,
            "msg": "JOHAN: intensive session today.",
        }
    if day_of_week in (weak_day1, weak_day2):
        return {"type": "weak", "multiplier": 0.5, "msg": "Short session today."}
    if (1 <= day_of_month <= 7) or (15 <= day_of_month <= 21):
        return {"type": "morning", "multiplier": 1.0, "msg": "Early session logged."}

    return {"type": "night", "multiplier": 1.0, "msg": "Late night grind."}


def get_session_time_range(pattern):
    ptype = pattern["type"]
    if ptype == "morning":
        return 7, 10
    if ptype == "night":
        return 21, 23
    return 8, 20


def get_johan_specializations(user_profile) -> list:
    """Seed 3 specialization subjects from username — stable per user."""
    rand = make_prng(user_profile.user.username + "spec")
    pool = ALL_SUBJECTS[:]
    specs = []
    for _ in range(3):
        idx = int(rand() * len(pool))
        specs.append(pool[idx])
        pool.pop(idx)
    return specs


def generate_daily_sessions(date_str, pattern, specializations=None, diff_cfg=None):
    rand = make_prng(date_str + "sessions")
    surge_mult = diff_cfg["surge_mult"] if diff_cfg else 1.5
    count = 1 if pattern["type"] == "weak" else 1 + int(rand() * 2) + 1
    start_h, end_h = get_session_time_range(pattern)

    # Apply stronger surges on hard/extreme
    effective_mult = pattern["multiplier"]
    if pattern["type"] == "surge":
        effective_mult = surge_mult

    sessions = []
    scheduled_minutes = (start_h * 60) + int(rand() * 30)

    for _ in range(count):
        # 60% chance of specialization subject if provided
        if specializations and rand() < 0.6:
            subject = specializations[int(rand() * len(specializations))]
        else:
            subject = ALL_SUBJECTS[int(rand() * len(ALL_SUBJECTS))]

        base_hours = 0.5 + rand() * 2.0
        hours = round((base_hours * effective_mult * 2)) / 2.0
        focus = round((6.0 + rand() * 3.5) * 10) / 10.0

        hh = scheduled_minutes // 60
        mm = scheduled_minutes % 60
        clamped_h = min(hh, end_h)
        scheduled_time = f"{clamped_h:02d}:{mm:02d}"

        template_idx = int(rand() * 3)
        subject_label = ACTIVITIES.get(subject, subject)

        if template_idx == 0:
            display_text = f"{subject_label} · {hours}h · Focus {focus}"
        elif template_idx == 1:
            display_text = f"{subject_label} session · {hours}h"
        else:
            display_text = f"Deep work: {subject_label} · {hours}h · {focus} focus"

        sessions.append(
            {
                "subject": subject,
                "hours": hours,
                "focus": focus,
                "scheduledTime": scheduled_time,
                "displayText": display_text,
                "patternMsg": pattern["msg"],
            }
        )
        scheduled_minutes += int(hours * 60) + 15 + int(rand() * 30)

    return sessions


def calc_johan_daily_xp(
    player_rank_xp: float, day_number: int, diff_cfg: dict
) -> float:
    """Daily XP Johan earns — scaled by difficulty multiplier."""
    base_xp = player_rank_xp * (0.85 + 0.30 * math.sin(day_number * 0.8))
    clamped_xp = max(player_rank_xp * 0.75, min(player_rank_xp * 1.20, base_xp))
    offset = ((day_number % 7) - 3) * 0.5
    raw = max(1.0, round((clamped_xp + offset) * 10) / 10.0)
    return round(raw * diff_cfg["xp_mult"], 1)


# ponytail: kept for test_batch5 compatibility
def calc_johan_xp(player_rank_xp, day_number):
    diff_cfg = JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]
    return calc_johan_daily_xp(player_rank_xp, day_number, diff_cfg)


def calc_johan_streak(today_str: str) -> int:
    """Count consecutive non-weak days backward from today."""
    streak = 0
    today = datetime.strptime(today_str, "%Y-%m-%d")
    for i in range(30):
        d = today - timedelta(days=i)
        pat = get_day_pattern(d.strftime("%Y-%m-%d"))
        if pat["type"] == "weak":
            break
        streak += 1
    return max(1, streak)


def compute_rival_data(user_profile):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_num = get_day_number()

    stored = user_profile.rival_data or {}

    # Preserve difficulty selection across updates
    rival_difficulty = stored.get("rivalDifficulty", DEFAULT_DIFFICULTY)
    diff_cfg = JOHAN_DIFFICULTIES.get(
        rival_difficulty, JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]
    )

    if stored.get("lastUpdated") == today:
        return stored

    pattern = get_day_pattern(today)
    specializations = get_johan_specializations(user_profile)
    sessions = generate_daily_sessions(today, pattern, specializations, diff_cfg)

    player_rank_xp = user_profile.rank_xp or 0.0

    # ── Improvement 1: Persistent XP accumulation ─────────────────────────────
    # Accumulate from yesterday's stored total + today's earned XP
    prev_accumulated = stored.get("johanAccumulatedXP", None)
    today_daily_xp = calc_johan_daily_xp(player_rank_xp, day_num, diff_cfg)

    if prev_accumulated is not None:
        johan_xp = round(prev_accumulated + today_daily_xp, 1)
    else:
        # Bootstrap: estimate from current player XP
        johan_xp = calc_johan_daily_xp(player_rank_xp, day_num, diff_cfg)

    # ── Improvement 2: Behavioral streak ──────────────────────────────────────
    johan_streak = calc_johan_streak(today)

    from api.models import UnlockedSkill, ActiveEffect, TrainingSession
    from django.db.models import Sum, Avg, Count

    # ── Skill effects applied to daily XP before accumulation ─────────────────
    transcendence_active = ActiveEffect.objects.filter(
        user=user_profile.user, skill_id="transcendence"
    ).exists()

    has_transcendent_will = UnlockedSkill.objects.filter(
        user_profile=user_profile, skill_code="transcendent_will"
    ).exists()

    # ── Improvement 1: Persistent XP accumulation ─────────────────────────────
    if prev_accumulated is not None:
        johan_xp = round(prev_accumulated + today_daily_xp, 1)
    else:
        johan_xp = today_daily_xp

    if transcendence_active:
        # Freeze XP — don't accumulate today
        johan_xp = stored.get("johanAccumulatedXP", johan_xp)

    # transcendent_will: 10% debuff to Johan's total XP
    if has_transcendent_will:
        johan_xp = max(1.0, round(johan_xp * 0.9, 1))

    # ── Improvement 6: Rolling weekly history (never retroactively rewritten) ─
    prev_history = stored.get("weeklyHistory", [])
    end_date = datetime.now(timezone.utc)

    # Build a map of existing history by date for O(1) lookup
    existing_by_date = {d["date"]: d for d in prev_history}

    weekly_history = []
    for i in range(6, -1, -1):
        dt = end_date - timedelta(days=i)
        d_str = dt.strftime("%Y-%m-%d")
        d_num = int(dt.timestamp() * 1000) // 86400000

        if d_str in existing_by_date and d_str != today:
            # Keep historical snapshot — never rewrite past data
            weekly_history.append(existing_by_date[d_str])
        else:
            # Today or missing day: compute fresh
            daily_sessions = TrainingSession.objects.filter(
                user_profile=user_profile, created_at__date=dt.date()
            ).aggregate(total_hours=Sum("hours"), total_xp=Sum("xp_earned"))
            p_hours = round(daily_sessions["total_hours"] or 0, 1)
            p_xp = daily_sessions["total_xp"] or 0

            j_pattern = get_day_pattern(d_str)
            j_sessions = generate_daily_sessions(
                d_str, j_pattern, specializations, diff_cfg
            )
            j_hours = round(sum(s["hours"] for s in j_sessions), 1)
            j_xp = round(calc_johan_daily_xp(player_rank_xp, d_num, diff_cfg), 1)

            weekly_history.append(
                {
                    "date": d_str,
                    "patternType": j_pattern["type"],
                    "player": {"hours": p_hours, "rank_xp_gained": p_xp},
                    "johan": {"hours": j_hours, "rank_xp_gained": j_xp},
                }
            )

    # ── Improvement 4: behindDays counter (escalating taunts) ─────────────────
    prev_behind_days = stored.get("behindDays", 0)
    if johan_xp > player_rank_xp:
        behind_days = prev_behind_days + 1
    else:
        behind_days = 0

    # ── Improvement 5: Comeback arc (Johan cooldown after threshold) ───────────
    threshold = diff_cfg["catch_up_threshold"]
    prev_cooldown = stored.get("johanCooldownDays", 0)

    if prev_cooldown > 0:
        # Still in cooldown — apply 30% reduction and count down
        johan_xp = max(1.0, round(johan_xp * 0.7, 1))
        johan_cooldown_days = prev_cooldown - 1
    elif behind_days >= threshold:
        # Activate cooldown window (3 days)
        johan_xp = max(1.0, round(johan_xp * 0.7, 1))
        johan_cooldown_days = 3
        behind_days = 0  # reset after cooldown triggers
    else:
        johan_cooldown_days = 0

    # ── Weekly summary stats ───────────────────────────────────────────────────
    week_ago = end_date - timedelta(days=7)
    player_weekly_stats = TrainingSession.objects.filter(
        user_profile=user_profile, created_at__gte=week_ago
    ).aggregate(
        avg_focus=Avg("focus_rating"),
        total_subjects=Count("activity_key", distinct=True),
    )

    p_avg_focus = player_weekly_stats["avg_focus"] or 5.0
    p_subjects = player_weekly_stats["total_subjects"] or 0

    johan_avg_focus = (
        round((p_avg_focus + (math.sin(day_num * 0.4) * 0.5 - 0.1)) * 10) / 10.0
    )
    johan_subjects_week = max(1, p_subjects + (day_num % 3) - 1)

    johan_week_hours = round(sum(d["johan"]["hours"] for d in weekly_history), 1)
    johan_week_rank_xp = round(
        sum(d["johan"]["rank_xp_gained"] for d in weekly_history), 1
    )

    new_data = {
        "rivalDifficulty": rival_difficulty,
        "johanAccumulatedXP": johan_xp,
        "totalXP": johan_xp,
        "streak": johan_streak,
        "todaySessions": sessions,
        "currentPattern": pattern["type"],
        "weeklyHistory": weekly_history,
        "lastUpdated": today,
        "johanWeekHours": johan_week_hours,
        "johanWeekRankXP": johan_week_rank_xp,
        "johanAvgFocus": johan_avg_focus,
        "johanSubjectsWeek": johan_subjects_week,
        "behindDays": behind_days,
        "johanCooldownDays": johan_cooldown_days,
    }

    user_profile.rival_data = new_data
    user_profile.save(update_fields=["rival_data"])

    return new_data
