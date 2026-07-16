from datetime import datetime, timezone, timedelta
from api.services.mechanics import calculate_base_training_xp

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
JOHAN_DIFFICULTIES = {
    "EASY": {
        "xp_mult": 0.60,
        "surge_mult": 1.2,
        "hours_range": (0.5, 1.5),
        "focus_range": (3.0, 5.0),
        "skip_chance": 0.28,
        "surge_chance": 0.05,
    },
    "NORMAL": {
        "xp_mult": 0.90,
        "surge_mult": 1.5,
        "hours_range": (1.0, 2.5),
        "focus_range": (5.0, 7.0),
        "skip_chance": 0.12,
        "surge_chance": 0.10,
    },
    "HARD": {
        "xp_mult": 1.20,
        "surge_mult": 1.8,
        "hours_range": (2.0, 4.0),
        "focus_range": (6.0, 8.0),
        "skip_chance": 0.05,
        "surge_chance": 0.20,
    },
    "EXTREME": {
        "xp_mult": 1.60,
        "surge_mult": 2.0,
        "hours_range": (3.0, 6.0),
        "focus_range": (7.0, 9.5),
        "skip_chance": 0.015,
        "surge_chance": 0.35,
    },
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


def get_day_pattern(date_str, user_id, diff_cfg):
    d = datetime.strptime(date_str, "%Y-%m-%d")
    day_of_month = d.day

    rand = make_prng(f"{date_str}_{user_id}_pattern")

    if rand() < diff_cfg["skip_chance"]:
        return {"type": "skip", "msg": "Johan skipped training today."}

    if rand() < diff_cfg["surge_chance"]:
        return {"type": "surge", "msg": "JOHAN: intensive session today."}

    if (1 <= day_of_month <= 7) or (15 <= day_of_month <= 21):
        return {"type": "morning", "msg": "Early session logged."}

    return {"type": "night", "msg": "Late night grind."}


def get_session_time_range(pattern):
    ptype = pattern["type"]
    if ptype == "morning":
        return 7, 10
    if ptype == "night":
        return 21, 23
    return 8, 20


def get_johan_specializations(user_id) -> list:
    """Seed 3 specialization subjects from user_id — stable per user."""
    rand = make_prng(f"{user_id}_spec")
    pool = ALL_SUBJECTS[:]
    specs = []
    for _ in range(3):
        idx = int(rand() * len(pool))
        specs.append(pool[idx])
        pool.pop(idx)
    return specs


def generate_daily_sessions(date_str, user_id, pattern, specializations, diff_cfg):
    if pattern["type"] == "skip":
        return []

    rand = make_prng(f"{date_str}_{user_id}_sessions")

    # 1-3 sessions, weighted towards 1-2
    roll = rand()
    if roll < 0.5:
        count = 1
    elif roll < 0.85:
        count = 2
    else:
        count = 3

    if pattern["type"] == "surge":
        count += 1

    start_h, end_h = get_session_time_range(pattern)
    sessions = []
    scheduled_minutes = (start_h * 60) + int(rand() * 30)

    for _ in range(count):
        if specializations and rand() < 0.6:
            subject = specializations[int(rand() * len(specializations))]
        else:
            subject = ALL_SUBJECTS[int(rand() * len(ALL_SUBJECTS))]

        h_min, h_max = diff_cfg["hours_range"]
        f_min, f_max = diff_cfg["focus_range"]

        hours = h_min + rand() * (h_max - h_min)
        if pattern["type"] == "surge" and count == 1:
            hours *= diff_cfg["surge_mult"]

        hours = round(hours * 2.0) / 2.0
        focus = round((f_min + rand() * (f_max - f_min)) * 10) / 10.0

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


def calc_johan_daily_xp(sessions: list, diff_cfg: dict) -> float:
    """Daily XP Johan earns based on his actual generated sessions."""
    total_base_xp = 0.0
    for s in sessions:
        total_base_xp += calculate_base_training_xp(s["hours"], s["focus"])
    return round(total_base_xp * diff_cfg["xp_mult"], 1)


# ponytail: kept for test_batch5 compatibility
def calc_johan_xp(sessions, day_number=None):
    diff_cfg = JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]
    return calc_johan_daily_xp(sessions, diff_cfg)


def calc_johan_streak(today_str: str, user_id, diff_cfg) -> int:
    """Count consecutive non-skip days backward from today."""
    streak = 0
    today = datetime.strptime(today_str, "%Y-%m-%d")
    for i in range(30):
        d = today - timedelta(days=i)
        pat = get_day_pattern(d.strftime("%Y-%m-%d"), user_id, diff_cfg)
        if pat["type"] == "skip":
            break
        streak += 1
    return max(1, streak)


def compute_rival_data(user_profile):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_id = user_profile.user.id

    stored = user_profile.rival_data or {}

    rival_difficulty = stored.get("rivalDifficulty", DEFAULT_DIFFICULTY)
    diff_cfg = JOHAN_DIFFICULTIES.get(
        rival_difficulty, JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]
    )

    if stored.get("lastUpdated") == today:
        return stored

    pattern = get_day_pattern(today, user_id, diff_cfg)
    specializations = get_johan_specializations(user_id)
    sessions = generate_daily_sessions(
        today, user_id, pattern, specializations, diff_cfg
    )

    # ── Persistent XP accumulation ─────────────────────────────
    prev_accumulated = stored.get("johanAccumulatedXP", None)
    today_daily_xp = calc_johan_daily_xp(sessions, diff_cfg)

    if prev_accumulated is not None:
        johan_xp = round(prev_accumulated + today_daily_xp, 1)
    else:
        johan_xp = today_daily_xp

    # ── Behavioral streak ──────────────────────────────────────
    johan_streak = calc_johan_streak(today, user_id, diff_cfg)

    from api.models import UnlockedSkill, ActiveEffect, TrainingSession
    from django.db.models import Sum

    transcendence_active = ActiveEffect.objects.filter(
        user=user_profile.user, skill_id="transcendence"
    ).exists()

    has_transcendent_will = UnlockedSkill.objects.filter(
        user_profile=user_profile, skill_code="transcendent_will"
    ).exists()

    if transcendence_active:
        johan_xp = stored.get("johanAccumulatedXP", johan_xp)

    if has_transcendent_will:
        johan_xp = max(1.0, round(johan_xp * 0.9, 1))

    # ── Rolling weekly history (never retroactively rewritten) ─
    prev_history = stored.get("weeklyHistory", [])
    end_date = datetime.now(timezone.utc)
    existing_by_date = {d["date"]: d for d in prev_history}

    weekly_history = []
    for i in range(6, -1, -1):
        dt = end_date - timedelta(days=i)
        d_str = dt.strftime("%Y-%m-%d")

        if d_str in existing_by_date and d_str != today:
            weekly_history.append(existing_by_date[d_str])
        else:
            daily_sessions = TrainingSession.objects.filter(
                user_profile=user_profile, created_at__date=dt.date()
            ).aggregate(total_hours=Sum("hours"), total_xp=Sum("xp_earned"))
            p_hours = round(daily_sessions["total_hours"] or 0, 1)
            p_xp = daily_sessions["total_xp"] or 0

            j_pattern = get_day_pattern(d_str, user_id, diff_cfg)
            j_sessions = generate_daily_sessions(
                d_str, user_id, j_pattern, specializations, diff_cfg
            )
            j_hours = round(sum(s["hours"] for s in j_sessions), 1)
            j_xp = round(calc_johan_daily_xp(j_sessions, diff_cfg), 1)

            weekly_history.append(
                {
                    "date": d_str,
                    "patternType": j_pattern["type"],
                    "player": {"hours": p_hours, "rank_xp_gained": p_xp},
                    "johan": {"hours": j_hours, "rank_xp_gained": j_xp},
                }
            )

    player_rank_xp = user_profile.rank_xp or 0.0

    # ── behindDays counter (escalating taunts) ─────────────────
    prev_behind_days = stored.get("behindDays", 0)
    if johan_xp > player_rank_xp:
        behind_days = prev_behind_days + 1
    else:
        behind_days = 0

    # ── Weekly summary stats ───────────────────────────────────────────────────
    week_ago = end_date - timedelta(days=7)
    player_weekly_stats = TrainingSession.objects.filter(
        user_profile=user_profile, created_at__gte=week_ago
    ).aggregate(
        total_hours=Sum("hours"),
    )
    p_week_hours = round(player_weekly_stats["total_hours"] or 0, 1)

    j_week_hours = round(sum(d["johan"]["hours"] for d in weekly_history), 1)
    p_week_xp = sum(d["player"]["rank_xp_gained"] for d in weekly_history)
    j_week_xp = round(sum(d["johan"]["rank_xp_gained"] for d in weekly_history), 1)

    new_data = {
        "johanAccumulatedXP": johan_xp,
        "totalXP": johan_xp,
        "streak": johan_streak,
        "dailySessions": sessions,
        "lastUpdated": today,
        "rivalDifficulty": rival_difficulty,
        "behindDays": behind_days,
        "weeklyHistory": weekly_history,
        "specializations": specializations,
        "weeklyStats": {
            "playerHours": p_week_hours,
            "johanHours": j_week_hours,
            "playerXP": p_week_xp,
            "johanXP": j_week_xp,
        },
    }

    user_profile.rival_data = new_data
    user_profile.save(update_fields=["rival_data"])
    return new_data
