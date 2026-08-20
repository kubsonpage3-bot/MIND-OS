# ──────────────────────────────────────────────────────────────────────────────
# MIND OS — Reward Constants (Single Source of Truth)
#
# BALANCE ANCHOR (v2 — XP halved): Training hard / 1h / focus=8 → 24 XP
#   base_xp      = BASE_XP(3) × TIER_MULT("hard"=8) = 24
#   focus_factor = clamp(8/10 + 0.2, 0.5, 1.3)       = 1.0
#   scale        = TRAINING_MULTIPLIER(1.0) × hours(1) × focus_factor(1.0) = 1.0
#   xp           = round(24 × 1.0) = 24 ✓
#
# REBALANCE NOTE (2026-08-18): XP rewards reduced ~50% across all task tiers.
#   trivial: 5 → 3 | easy: 15 → 6 | medium: 25 → 12 | hard: 50 → 24
#   Gold and HP penalties are unchanged. Rank thresholds are unchanged.
#
# BOSS DAMAGE REBALANCE (2026-08-20):
#   - Idle DPS system REMOVED entirely.
#   - DMG_PER_XP (for Habits/Dailies/Todos) unchanged at 3.33.
#   - TRAINING_DMG_PER_XP = 6.0 — Training sessions deal ~1.8x more boss
#     damage than quick task clicks, rewarding sustained deep work.
#   - DEEP_WORK_BONUS applied when session >= DEEP_WORK_THRESHOLD_H (45m).
#     Deep Work multiplier: 1.8× on boss damage only (not XP/Gold).
# ──────────────────────────────────────────────────────────────────────────────

BASE_XP = 3
TIER_MULTIPLIER = {
    "trivial": 1,
    "easy": 2,
    "medium": 4,
    "hard": 8,
}
DMG_PER_XP = 3.33
TRAINING_DMG_PER_XP = 6.0  # Training sessions deal ~1.8x more boss dmg
DEEP_WORK_THRESHOLD_H = 0.75  # 45+ minutes = Deep Work bonus session
DEEP_WORK_DMG_MULTIPLIER = 1.8  # Multiplied on training boss dmg for 45+ min
GOLD_PER_XP = 0.5

# Training: TRAINING_MULTIPLIER is now 1.0 — all scaling comes from
# hours × focus_factor, keeping the formula transparent and auditable.
TRAINING_MULTIPLIER = 1.0
MAX_SESSION_HOURS = 16.0
MIN_FOCUS_FACTOR = 0.5
MAX_FOCUS_FACTOR = 1.3

# DIS-3: Daily cap on cumulative Habit boss damage per daily-reset window.
# = 3 × hard tier base_dmg = 3 × round(24 × 3.33) = 3 × 80 = 240.
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
    Boss damage uses TRAINING_DMG_PER_XP (6.0) instead of DMG_PER_XP (3.33).
    Sessions >= DEEP_WORK_THRESHOLD_H (45 min) get DEEP_WORK_DMG_MULTIPLIER (1.8×)
    on boss damage only — rewarding sustained focus over task-clicking.

    hours and focus MUST be clamped here, never trusted from client input upstream.
    Anchor: tier="hard", hours=1.0, focus=8 → 24 XP, ~259 boss DMG (with Deep Work).
    """
    hours = clamp(hours, 0, MAX_SESSION_HOURS)
    ff = focus_factor(focus)
    base_xp = BASE_XP * TIER_MULTIPLIER[tier]
    scale = TRAINING_MULTIPLIER * hours * ff

    raw_dmg = round(base_xp * TRAINING_DMG_PER_XP * scale)
    deep_work = hours >= DEEP_WORK_THRESHOLD_H
    final_dmg = round(raw_dmg * DEEP_WORK_DMG_MULTIPLIER) if deep_work else raw_dmg

    return {
        "xp": round(base_xp * scale),
        "gold": round(base_xp * GOLD_PER_XP * scale),
        "dmg": final_dmg,
    }


# HP penalty on task miss — explicitly documented curve, NOT derived from
# XP formula (penalty severity is a separate design axis).
MISS_PENALTY = {
    "trivial": 5,
    "easy": 10,
    "medium": 20,
    "hard": 40,
}
