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
# Each tier's target_avg_xp is the intended long-run OVERALL daily average
# (including skip days as 0 and surge days' bonus) -- Easy ~50, Normal ~80,
# Hard ~150, Extreme ~300. daily_xp_range is the range rolled on an ACTIVE
# day (see calc_johan_daily_xp) and is derived, not hand-picked: skip days
# pull the overall average down and surge days pull it up, so the active-day
# range has to sit above target_avg_xp by however much those two cancel out,
# or e.g. Easy's 28% skip rate alone would drag a naive 40-60 active range
# down to ~37 overall instead of 50.
def _active_day_range(target_avg_xp, skip_chance, surge_chance, spread_pct=0.20):
    # E[daily] = (1 - skip_chance) * E[active_day] and E[active_day] itself
    # gets a further (1 + 0.3*surge_chance) lift from the x1.3 surge bonus a
    # fraction of active days receive -- solve for the active-day midpoint
    # that makes the overall expectation land on target_avg_xp, then spread
    # +/-spread_pct around it for day-to-day variance.
    denom = (1 - skip_chance) * (1 + 0.3 * surge_chance)
    mid = target_avg_xp / denom
    return (round(mid * (1 - spread_pct), 1), round(mid * (1 + spread_pct), 1))


JOHAN_DIFFICULTIES = {
    "EASY": {
        "target_avg_xp": 50,
        "surge_mult": 1.2,
        "hours_range": (0.5, 1.5),
        "focus_range": (3.0, 5.0),
        "skip_chance": 0.28,
        "surge_chance": 0.05,
    },
    "NORMAL": {
        "target_avg_xp": 80,
        "surge_mult": 1.5,
        "hours_range": (1.0, 2.5),
        "focus_range": (5.0, 7.0),
        "skip_chance": 0.12,
        "surge_chance": 0.10,
    },
    "HARD": {
        "target_avg_xp": 150,
        "surge_mult": 1.8,
        "hours_range": (2.0, 4.0),
        "focus_range": (6.0, 8.0),
        "skip_chance": 0.05,
        "surge_chance": 0.20,
    },
    "EXTREME": {
        "target_avg_xp": 300,
        "surge_mult": 2.0,
        "hours_range": (3.0, 6.0),
        "focus_range": (7.0, 9.5),
        "skip_chance": 0.015,
        "surge_chance": 0.35,
    },
}
for _cfg in JOHAN_DIFFICULTIES.values():
    _cfg["daily_xp_range"] = _active_day_range(
        _cfg["target_avg_xp"], _cfg["skip_chance"], _cfg["surge_chance"]
    )
DEFAULT_DIFFICULTY = "NORMAL"

# ── Continuous difficulty slider ────────────────────────────────────────────
# Replaces the 4 discrete buttons with one 0-130 slider. The 4 named tiers
# above are just anchor points on it; everything in between (and slightly
# beyond either end) is linearly interpolated/extrapolated from them, so
# e.g. "80" lands honestly between Hard(90) and Normal(60) rather than
# forcing a pick of one preset or the other.
SLIDER_MIN = 0
SLIDER_MAX = 130
SLIDER_POSITION_BY_LABEL = {"EASY": 30, "NORMAL": 60, "HARD": 90, "EXTREME": 115}
SLIDER_ANCHORS = sorted(
    ((pos, JOHAN_DIFFICULTIES[label]) for label, pos in SLIDER_POSITION_BY_LABEL.items()),
    key=lambda pair: pair[0],
)


def get_slider_position(stored_rival_data: dict) -> float:
    """Numeric slider position (0-130) for this profile's stored rival data.
    Falls back to the legacy string rivalDifficulty (EASY/NORMAL/HARD/EXTREME)
    for profiles saved before the slider existed, then to Normal (60)."""
    raw = stored_rival_data.get("rivalDifficultySlider")
    if raw is not None:
        try:
            return max(SLIDER_MIN, min(SLIDER_MAX, float(raw)))
        except (TypeError, ValueError):
            pass
    legacy_label = stored_rival_data.get("rivalDifficulty")
    if legacy_label in SLIDER_POSITION_BY_LABEL:
        return SLIDER_POSITION_BY_LABEL[legacy_label]
    return SLIDER_POSITION_BY_LABEL[DEFAULT_DIFFICULTY]


def nearest_difficulty_label(slider_pos: float) -> str:
    """Nearest named tier to a slider position -- kept only so old code/UI
    that still expects a rivalDifficulty string has something sane to show."""
    return min(
        SLIDER_POSITION_BY_LABEL,
        key=lambda label: abs(SLIDER_POSITION_BY_LABEL[label] - slider_pos),
    )


def _lerp(a, b, t):
    return a + t * (b - a)


def get_diff_cfg_for_slider(slider_pos: float) -> dict:
    """Interpolates (or, past the outermost anchors, extrapolates along the
    same slope) a full diff_cfg for any slider position in [SLIDER_MIN,
    SLIDER_MAX]. Values are clamped to sane floors/ceilings so the
    extrapolated ends (0 and 130) can't produce nonsense (negative hours,
    >100% skip chance, etc)."""
    pos = max(SLIDER_MIN, min(SLIDER_MAX, slider_pos))

    if pos <= SLIDER_ANCHORS[0][0]:
        p0, c0 = SLIDER_ANCHORS[0]
        p1, c1 = SLIDER_ANCHORS[1]
    elif pos >= SLIDER_ANCHORS[-1][0]:
        p0, c0 = SLIDER_ANCHORS[-2]
        p1, c1 = SLIDER_ANCHORS[-1]
    else:
        p0, c0, p1, c1 = None, None, None, None
        for (pa, ca), (pb, cb) in zip(SLIDER_ANCHORS, SLIDER_ANCHORS[1:]):
            if pa <= pos <= pb:
                p0, c0, p1, c1 = pa, ca, pb, cb
                break

    t = (pos - p0) / (p1 - p0)

    return {
        "target_avg_xp": max(5.0, _lerp(c0["target_avg_xp"], c1["target_avg_xp"], t)),
        "daily_xp_range": (
            max(10.0, _lerp(c0["daily_xp_range"][0], c1["daily_xp_range"][0], t)),
            max(15.0, _lerp(c0["daily_xp_range"][1], c1["daily_xp_range"][1], t)),
        ),
        "surge_mult": max(1.0, _lerp(c0["surge_mult"], c1["surge_mult"], t)),
        "hours_range": (
            max(0.25, _lerp(c0["hours_range"][0], c1["hours_range"][0], t)),
            max(0.5, _lerp(c0["hours_range"][1], c1["hours_range"][1], t)),
        ),
        "focus_range": (
            max(1.0, min(10.0, _lerp(c0["focus_range"][0], c1["focus_range"][0], t))),
            max(1.0, min(10.0, _lerp(c0["focus_range"][1], c1["focus_range"][1], t))),
        ),
        "skip_chance": max(0.0, min(0.6, _lerp(c0["skip_chance"], c1["skip_chance"], t))),
        "surge_chance": max(0.0, min(0.6, _lerp(c0["surge_chance"], c1["surge_chance"], t))),
    }


def get_difficulty(stored_rival_data: dict) -> dict:
    return get_diff_cfg_for_slider(get_slider_position(stored_rival_data))


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
    """Daily XP Johan earns. Rolled within diff_cfg["daily_xp_range"] using a
    seed derived from the session list itself (so this stays deterministic
    for a given date+user without needing them as separate params here --
    `sessions` was itself generated from a date+user seed). Averages two
    independent rolls to bias toward the middle of the range (most days
    land near the average, only occasionally near an edge), mimicking a
    real person's day-to-day variance instead of a flat, robotic number.
    Empty `sessions` (a skip day) is always 0 XP.
    """
    if not sessions:
        return 0.0

    xp_range = diff_cfg.get("daily_xp_range")
    if not xp_range:
        # Legacy fallback, in case an old-shape diff_cfg (xp_mult, no
        # daily_xp_range) is ever passed directly.
        total_base_xp = sum(
            calculate_base_training_xp(s["hours"], s["focus"]) for s in sessions
        )
        return round(total_base_xp * diff_cfg.get("xp_mult", 1.0), 1)

    seed_str = "|".join(
        f"{s.get('subject')}:{s.get('hours')}:{s.get('focus')}:{s.get('scheduledTime')}"
        for s in sessions
    )
    roll = (make_prng(seed_str)() + make_prng(seed_str + "_b")()) / 2.0
    lo, hi = xp_range
    value = lo + roll * (hi - lo)

    # Surge day: detectable from the session's own patternMsg (set by
    # get_day_pattern) without needing pattern as a separate parameter here.
    is_surge = sessions[0].get("patternMsg") == "JOHAN: intensive session today."
    if is_surge:
        value *= 1.3

    return round(value, 1)


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

    slider_pos = get_slider_position(stored)
    diff_cfg = get_diff_cfg_for_slider(slider_pos)
    rival_difficulty = nearest_difficulty_label(slider_pos)

    if stored.get("lastUpdated") == today:
        return stored

    pattern = get_day_pattern(today, user_id, diff_cfg)
    specializations = get_johan_specializations(user_id)
    sessions = generate_daily_sessions(
        today, user_id, pattern, specializations, diff_cfg
    )

    # ── Persistent XP accumulation (offline-aware) ─────────────
    # Calculate XP for EVERY day missed since last login, not just today.
    prev_accumulated = stored.get("johanAccumulatedXP", 0.0) or 0.0
    last_updated_str = stored.get("lastUpdated")

    if last_updated_str:
        last_updated_dt = datetime.strptime(last_updated_str, "%Y-%m-%d")
        today_dt = datetime.strptime(today, "%Y-%m-%d")
        days_missed = (
            today_dt - last_updated_dt
        ).days  # e.g. 1 = yesterday, 5 = 5 days away
    else:
        days_missed = 1

    # Cap to avoid heavy loops for very long absences (30 days max)
    days_missed = min(max(1, days_missed), 30)

    # Sum XP for each missed day that was NOT accumulated yet + today
    accumulated_xp = prev_accumulated
    for i in range(days_missed):
        offset = days_missed - 1 - i  # for days_missed=1 -> offset=0 (today)
        day_dt = datetime.strptime(today, "%Y-%m-%d") - timedelta(days=offset)
        day_str = day_dt.strftime("%Y-%m-%d")
        day_pattern = get_day_pattern(day_str, user_id, diff_cfg)
        day_sessions = generate_daily_sessions(
            day_str, user_id, day_pattern, specializations, diff_cfg
        )
        accumulated_xp = round(
            accumulated_xp + calc_johan_daily_xp(day_sessions, diff_cfg), 1
        )

    johan_xp = accumulated_xp

    # ── Behavioral streak ──────────────────────────────────────
    johan_streak = calc_johan_streak(today, user_id, diff_cfg)

    from api.models import UnlockedSkill, ActiveEffect, TrainingSession
    from django.db.models import Sum
    from api.services.mechanics import get_passive_multipliers

    # "transcendence" is the old activation name for this skill --
    # activate_skill() resolves it through SKILL_ALIASES and always stores
    # the ActiveEffect under the canonical "enlightenment", so a literal
    # skill_id="transcendence" filter here could never match anything.
    transcendence_active = ActiveEffect.objects.filter(
        user=user_profile.user, skill_id__in=["transcendence", "enlightenment"]
    ).exists()

    # Get passive effects for rival reduction skills
    passive_effects = get_passive_multipliers(user_profile, {})
    rival_xp_reduction = passive_effects.get("rival_xp_reduction", 0.0)

    if transcendence_active:
        johan_xp = stored.get("johanAccumulatedXP", johan_xp)

    # Apply transcendent_will + living_library stacked reduction
    if rival_xp_reduction > 0:
        johan_xp = max(1.0, round(johan_xp * (1.0 - rival_xp_reduction), 1))

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

    # RivalTab's "Weekly Comparison / Head-to-Head" card reads
    # johanWeekHours/johanAvgFocus/johanSubjectsWeek/johanWeekRankXP directly
    # off the top-level payload — they were never populated (only the
    # differently-named weeklyStats.* keys were), so Johan's side of every
    # row silently defaulted to 0 (or 1 for subjects) and the player "won"
    # all four rows unconditionally. Regenerate this week's sessions (a pure
    # function of date+user+specializations, so recomputing is cheap and
    # always yields the same numbers already reflected in weekly_history) to
    # get the session-level detail needed for avg focus / distinct subjects.
    week_sessions = []
    for i in range(6, -1, -1):
        dt = end_date - timedelta(days=i)
        d_str = dt.strftime("%Y-%m-%d")
        d_pattern = get_day_pattern(d_str, user_id, diff_cfg)
        week_sessions.extend(
            generate_daily_sessions(d_str, user_id, d_pattern, specializations, diff_cfg)
        )
    johan_focus_values = [s["focus"] for s in week_sessions]
    johan_avg_focus = (
        round(sum(johan_focus_values) / len(johan_focus_values), 1)
        if johan_focus_values
        else 0.0
    )
    johan_subjects_week = len({s["subject"] for s in week_sessions})

    new_data = {
        "johanAccumulatedXP": johan_xp,
        "totalXP": johan_xp,
        "streak": johan_streak,
        "dailySessions": sessions,
        "lastUpdated": today,
        "rivalDifficulty": rival_difficulty,
        "rivalDifficultySlider": slider_pos,
        "behindDays": behind_days,
        "weeklyHistory": weekly_history,
        "specializations": specializations,
        "johanWeekHours": j_week_hours,
        "johanAvgFocus": johan_avg_focus,
        "johanSubjectsWeek": johan_subjects_week,
        "johanWeekRankXP": j_week_xp,
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
