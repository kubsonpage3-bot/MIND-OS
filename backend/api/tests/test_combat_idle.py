"""
Idle DPS system was REMOVED on 2026-08-20.
These tests confirm the system is properly gone.
"""

import pytest
from api.services import combat_service


def test_idle_dps_functions_removed():
    """apply_idle_damage and get_user_idle_dps must not exist."""
    assert not hasattr(
        combat_service, "apply_idle_damage"
    ), "apply_idle_damage should have been removed when idle DPS was deleted"
    assert not hasattr(
        combat_service, "get_user_idle_dps"
    ), "get_user_idle_dps should have been removed when idle DPS was deleted"


@pytest.mark.django_db
def test_calculate_damage_exists_and_is_callable():
    """calculate_damage should still be importable and callable."""
    from api.services.combat_service import calculate_damage

    assert callable(calculate_damage)
