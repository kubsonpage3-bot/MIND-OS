"""
Rival ("Johan") difficulty rework:
  1. Johan's XP used to come from an unrelated formula (hours*focus*5) that
     paid out ~1.6x-5.4x more than a real player earns for equivalent
     hours/focus at every tier -- replaced with an explicit daily_xp_range
     per tier, tuned to fixed daily averages (Easy ~50, Normal ~80, Hard
     ~150, Extreme ~300 XP/day), rolled per day for human-like variance
     instead of one flat number.
  2. The 4 discrete difficulty buttons are now anchor points (30/60/90/115)
     on a continuous 0-130 slider; everything between and slightly beyond
     them is interpolated/extrapolated from the same 4 tiers.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from api.services.rival_service import (
    JOHAN_DIFFICULTIES,
    SLIDER_POSITION_BY_LABEL,
    SLIDER_MIN,
    SLIDER_MAX,
    get_diff_cfg_for_slider,
    get_slider_position,
    nearest_difficulty_label,
    get_day_pattern,
    generate_daily_sessions,
    get_johan_specializations,
    calc_johan_daily_xp,
)


def simulate_daily_xp(diff_cfg, user_id, days=60):
    """Rolls `days` independent days (skip days included as 0) and returns
    the list of daily XP totals."""
    specs = get_johan_specializations(user_id)
    start = timezone.now().date()
    totals = []
    for i in range(days):
        d = start - timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        pattern = get_day_pattern(d_str, user_id, diff_cfg)
        sessions = generate_daily_sessions(d_str, user_id, pattern, specs, diff_cfg)
        totals.append(calc_johan_daily_xp(sessions, diff_cfg))
    return totals


@pytest.mark.parametrize(
    "label,target_avg",
    [("EASY", 50), ("NORMAL", 80), ("HARD", 150), ("EXTREME", 300)],
)
def test_named_tier_daily_average_matches_target(label, target_avg):
    diff_cfg = JOHAN_DIFFICULTIES[label]
    totals = simulate_daily_xp(diff_cfg, user_id=f"sim_{label}", days=90)
    avg = sum(totals) / len(totals)
    # _active_day_range() solves for the exact midpoint that should hit
    # target_avg_xp analytically; 90 days of PRNG noise is the only slack
    # this needs.
    assert avg == pytest.approx(target_avg, rel=0.20), (
        f"{label}: 90-day avg {avg:.1f} strayed too far from target {target_avg}"
    )


@pytest.mark.parametrize("label", ["EASY", "NORMAL", "HARD", "EXTREME"])
def test_active_day_xp_never_exceeds_range_plus_surge_bonus(label):
    diff_cfg = JOHAN_DIFFICULTIES[label]
    lo, hi = diff_cfg["daily_xp_range"]
    totals = simulate_daily_xp(diff_cfg, user_id=f"bounds_{label}", days=120)
    for t in totals:
        if t == 0:
            continue  # skip day
        # Surge days get a further x1.3 on top of the range; weak days get
        # a further x0.6 below it.
        assert lo * 0.6 - 0.01 <= t <= hi * 1.3 + 0.01, f"{label}: {t} outside [{lo*0.6}, {hi*1.3}]"


def test_slider_at_anchor_matches_named_tier_exactly():
    for label, pos in SLIDER_POSITION_BY_LABEL.items():
        cfg = get_diff_cfg_for_slider(pos)
        expected = JOHAN_DIFFICULTIES[label]
        assert cfg["daily_xp_range"] == pytest.approx(expected["daily_xp_range"])
        assert cfg["skip_chance"] == pytest.approx(expected["skip_chance"])
        assert cfg["surge_chance"] == pytest.approx(expected["surge_chance"])


def test_slider_midpoint_between_two_anchors_is_the_average():
    # Halfway between Normal(60) and Hard(90) = 75.
    cfg = get_diff_cfg_for_slider(75)
    normal, hard = JOHAN_DIFFICULTIES["NORMAL"], JOHAN_DIFFICULTIES["HARD"]
    expected_lo = (normal["daily_xp_range"][0] + hard["daily_xp_range"][0]) / 2
    expected_hi = (normal["daily_xp_range"][1] + hard["daily_xp_range"][1]) / 2
    assert cfg["daily_xp_range"][0] == pytest.approx(expected_lo)
    assert cfg["daily_xp_range"][1] == pytest.approx(expected_hi)


def test_slider_extrapolates_sanely_past_both_ends():
    below = get_diff_cfg_for_slider(SLIDER_MIN)  # 0 -- below Easy(30)
    above = get_diff_cfg_for_slider(SLIDER_MAX)  # 130 -- above Extreme(115)

    easy, extreme = JOHAN_DIFFICULTIES["EASY"], JOHAN_DIFFICULTIES["EXTREME"]
    # Extrapolated below Easy must be easier still (lower XP, higher skip).
    assert below["daily_xp_range"][1] < easy["daily_xp_range"][1]
    assert below["skip_chance"] > easy["skip_chance"]
    # Extrapolated above Extreme must be harder still.
    assert above["daily_xp_range"][0] > extreme["daily_xp_range"][0]
    assert above["skip_chance"] < extreme["skip_chance"]

    # Clamps must hold even at the absolute extremes.
    assert below["hours_range"][0] >= 0.25
    assert 0.0 <= below["skip_chance"] <= 0.6
    assert 0.0 <= above["skip_chance"] <= 0.6
    assert above["focus_range"][1] <= 10.0


def test_slider_out_of_bounds_input_is_clamped():
    assert get_diff_cfg_for_slider(-999) == get_diff_cfg_for_slider(SLIDER_MIN)
    assert get_diff_cfg_for_slider(9999) == get_diff_cfg_for_slider(SLIDER_MAX)


def test_legacy_string_difficulty_maps_to_its_anchor_position():
    for label, pos in SLIDER_POSITION_BY_LABEL.items():
        assert get_slider_position({"rivalDifficulty": label}) == pos
    # No data at all -> Normal's anchor.
    assert get_slider_position({}) == SLIDER_POSITION_BY_LABEL["NORMAL"]


def test_numeric_slider_field_takes_priority_over_legacy_string():
    stored = {"rivalDifficulty": "EASY", "rivalDifficultySlider": 100}
    assert get_slider_position(stored) == 100


def test_nearest_difficulty_label_rounds_to_closest_tier():
    assert nearest_difficulty_label(30) == "EASY"
    assert nearest_difficulty_label(44) == "EASY"  # closer to 30 than 60
    assert nearest_difficulty_label(46) == "NORMAL"  # closer to 60 than 30
    assert nearest_difficulty_label(115) == "EXTREME"
    assert nearest_difficulty_label(130) == "EXTREME"
