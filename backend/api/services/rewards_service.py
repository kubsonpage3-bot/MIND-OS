BASE_XP = 3
TIER_MULTIPLIER = {
    "trivial": 1,
    "easy": 3,
    "medium": 5,
    "hard": 10,
}
DMG_PER_XP = 3.33
GOLD_PER_XP = 0.5

TRAINING_MULTIPLIER = 2.5
MAX_SESSION_HOURS = 16.0
MIN_FOCUS_FACTOR = 0.7
MAX_FOCUS_FACTOR = 1.3


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


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
    """Training reward = Task reward * TRAINING_MULTIPLIER * hours * focus_factor.
    hours and focus MUST be clamped here, never trusted from client input upstream."""
    hours = clamp(hours, 0, MAX_SESSION_HOURS)
    focus_factor = clamp(focus / 10.0, MIN_FOCUS_FACTOR, MAX_FOCUS_FACTOR)
    base = task_rewards(tier)
    scale = TRAINING_MULTIPLIER * hours * focus_factor
    return {
        "xp": round(base["xp"] * scale),
        "gold": round(base["gold"] * scale),
        "dmg": round(base["dmg"] * scale),
    }


# HP penalty on task miss — keep as an explicit, separately documented curve,
# not derived from the XP formula (penalty severity is a distinct design axis).
MISS_PENALTY = {
    "trivial": 5,
    "easy": 10,
    "medium": 20,
    "hard": 40,
}
