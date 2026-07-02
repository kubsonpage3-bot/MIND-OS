import math
from datetime import datetime, timezone

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
    # Convert to JS format: (d.weekday() + 1) % 7
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


def generate_daily_sessions(date_str, pattern):
    rand = make_prng(date_str + "sessions")
    count = 1 if pattern["type"] == "weak" else 1 + int(rand() * 2) + 1
    start_h, end_h = get_session_time_range(pattern)

    sessions = []
    scheduled_minutes = (start_h * 60) + int(rand() * 30)

    for _ in range(count):
        subject = ALL_SUBJECTS[int(rand() * len(ALL_SUBJECTS))]

        base_hours = 0.5 + rand() * 2.0
        hours = round((base_hours * pattern["multiplier"] * 2)) / 2.0
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


def calc_johan_xp(player_rank_xp, day_number):
    # Fallback playerAvg approximation since we don't track daily XP history yet
    player_avg = player_rank_xp * 0.1

    base_xp = player_rank_xp * (0.85 + 0.30 * math.sin(day_number * 0.8))
    clamped_xp = max(player_rank_xp * 0.75, min(player_rank_xp * 1.20, base_xp))

    offset = ((day_number % 7) - 3) * 0.5
    return max(1.0, round((clamped_xp + offset) * 10) / 10.0)


def compute_rival_data(user_profile):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_num = get_day_number()

    # rival_data stored on profile
    stored = user_profile.rival_data or {}
    if stored.get("lastUpdated") == today:
        return stored

    pattern = get_day_pattern(today)
    sessions = generate_daily_sessions(today, pattern)

    player_rank_xp = user_profile.rank_xp or 0.0
    # Assuming player streak isn't perfectly mirrored without the local streak system anymore
    # We'll just generate Johan's streak based on day_number
    johan_streak = max(1, min(5 + int(make_prng(today)() * 5), 10))

    johan_xp = calc_johan_xp(player_rank_xp, day_num)

    from api.models import UnlockedSkill

    if UnlockedSkill.objects.filter(
        user_profile=user_profile, skill_code="transcendent_will"
    ).exists():
        johan_xp = max(1.0, round(johan_xp * 0.9, 1))

    new_data = {
        "totalXP": johan_xp,
        "streak": johan_streak,
        "todaySessions": sessions,
        "currentPattern": pattern["type"],
        "weeklyHistory": [],
        "lastUpdated": today,
    }

    user_profile.rival_data = new_data
    user_profile.save(update_fields=["rival_data"])

    return new_data
