# ──────────────────────────────────────────────────────────────────────────────
# MIND OS — Reward Constants (Single Source of Truth)
#
# BALANCE ANCHOR (verified): Training hard / 1h / focus=8 → exactly 50 XP
#   base_xp      = BASE_XP(5) × TIER_MULT("hard"=10) = 50
#   focus_factor = clamp(8/10 + 0.2, 0.5, 1.3)       = 1.0
#   scale        = TRAINING_MULTIPLIER(1.0) × hours(1) × focus_factor(1.0) = 1.0
#   xp           = round(50 × 1.0) = 50 ✓
# ──────────────────────────────────────────────────────────────────────────────

BASE_XP = 5
TIER_MULTIPLIER = {
    "trivial": 1,
    "easy": 3,
    "medium": 5,
    "hard": 10,
}
DMG_PER_XP = 3.33
GOLD_PER_XP = 0.5

# Training: TRAINING_MULTIPLIER is now 1.0 — all scaling comes from
# hours × focus_factor, keeping the formula transparent and auditable.
TRAINING_MULTIPLIER = 1.0
MAX_SESSION_HOURS = 16.0
MIN_FOCUS_FACTOR = 0.5
MAX_FOCUS_FACTOR = 1.3

# DIS-3: Daily cap on cumulative Habit boss damage per daily-reset window.
# = 3 × hard tier base_dmg = 3 × round(50 × 3.33) = 3 × 166 = 498.
# At 3h Hard Training focus=8 → 498 dmg, achieving exact parity with the cap.
# Resets on the same window as process_missed_tasks (user local time).
DAILY_HABIT_DMG_CAP = 3 * round(BASE_XP * TIER_MULTIPLIER["hard"] * DMG_PER_XP)


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


def focus_factor(focus: float) -> float:
    """
    Maps a 0–10 focus rating to a [0.5, 1.3] multiplier.
    Calibrated so focus=8 → exactly 1.0 (the balance anchor).

    focus  factor
    1–3    0.5   (floor)
    5      0.7
    7      0.9
    8      1.0  ← anchor
    9      1.1
    10     1.2
    >10    1.3  (ceiling)
    """
    return clamp(focus / 10.0 + 0.2, MIN_FOCUS_FACTOR, MAX_FOCUS_FACTOR)


def task_rewards(tier: str) -> dict:
    """Single source of truth for regular Task rewards (Habit/Daily/To-Do)."""
    if tier not in TIER_MULTIPLIER:
        raise ValueError(f"Unknown tier: {tier}")
    xp = BASE_XP * TIER_MULTIPLIER[tier]
    return {
        "xp": xp,
        "gold": round(xp * GOLD_PER_XP),
        "dmg": round(xp * DMG_PER_XP),
    }


def training_rewards(tier: str, hours: float, focus: float) -> dict:
    """
    Training reward = BASE_XP × TIER × TRAINING_MULTIPLIER × hours × focus_factor(focus).
    hours and focus MUST be clamped here, never trusted from client input upstream.

    Anchor: tier="hard", hours=1.0, focus=8 → 50 XP exactly.
    """
    hours = clamp(hours, 0, MAX_SESSION_HOURS)
    ff = focus_factor(focus)
    base = task_rewards(tier)
    scale = TRAINING_MULTIPLIER * hours * ff
    return {
        "xp": round(base["xp"] * scale),
        "gold": round(base["gold"] * scale),
        "dmg": round(base["dmg"] * scale),
    }


# HP penalty on task miss — explicitly documented curve, NOT derived from
# XP formula (penalty severity is a separate design axis).
MISS_PENALTY = {
    "trivial": 5,
    "easy": 10,
    "medium": 20,
    "hard": 40,
}
