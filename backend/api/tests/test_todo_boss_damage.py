import pytest
from django.contrib.auth import get_user_model
from api.models import Task, Boss, BossEncounter
from api.services.task_service import complete_task

User = get_user_model()


@pytest.fixture
def test_user(db):
    user = User.objects.create_user(username="todo_boss_hero", password="password123")
    user.refresh_from_db()
    profile = user.profile
    profile.hp = 100
    profile.base_pwr = 10
    profile.base_def = 10
    profile.timezone = "UTC"
    profile.save()
    user.refresh_from_db()
    return user


@pytest.fixture
def test_boss(db):
    return Boss.objects.create(
        name="Abyssal Behemoth",
        level=3,
        hp_max=1000,
        reward_xp=100,
        reward_gold=50,
    )


@pytest.fixture
def active_encounter(db, test_user, test_boss):
    return BossEncounter.objects.create(
        user=test_user,
        boss=test_boss,
        hp_current=test_boss.hp_max,
        is_defeated=False,
    )


@pytest.mark.django_db
def test_todo_deals_boss_damage_standard(test_user, active_encounter):
    """
    Verifies that a standard To-Do with default value deals full base boss damage + stat damage.
    """
    initial_hp = active_encounter.hp_current

    todo = Task.objects.create(
        user=test_user,
        title="Review PR",
        task_type=Task.TaskType.TODO,
        difficulty="medium",  # base dmg = 40
        value=1.0,
    )

    res = complete_task(test_user, todo.id, is_positive=True)
    combat = res.get("combat")

    assert combat is not None, "Combat result must be returned when an active boss exists."
    assert combat["damage_dealt"] >= 40, f"Damage dealt should be >= 40, got {combat['damage_dealt']}"

    active_encounter.refresh_from_db()
    assert active_encounter.hp_current == initial_hp - combat["damage_dealt"]
    assert not active_encounter.is_defeated


@pytest.mark.django_db
def test_todo_deals_full_damage_with_zero_or_negative_value(test_user, active_encounter):
    """
    Regression test: ensures that To-Dos with value=0.0 or value <= 0 (e.g. overdue)
    do NOT have their base damage zeroed out.
    """
    todo_zero = Task.objects.create(
        user=test_user,
        title="Zero Value Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",  # base dmg = 40
        value=0.0,
    )

    res = complete_task(test_user, todo_zero.id, is_positive=True)
    combat = res.get("combat")

    assert combat is not None
    assert combat["damage_dealt"] >= 40, f"Expected at least 40 damage, got {combat['damage_dealt']}"


@pytest.mark.django_db
def test_todo_hours_bonus_scales_boss_damage(test_user, active_encounter):
    """
    Verifies that default_hours on a To-Do grants hours_bonus to boss damage.
    """
    todo_standard = Task.objects.create(
        user=test_user,
        title="Quick Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
        default_hours=0,
    )
    res_standard = complete_task(test_user, todo_standard.id, is_positive=True)
    dmg_standard = res_standard["combat"]["damage_dealt"]

    # Revert to reset
    complete_task(test_user, todo_standard.id, is_positive=False)

    todo_long = Task.objects.create(
        user=test_user,
        title="Long 4-Hour Project",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
        default_hours=4.0,  # 1.0 + 4*0.15 = 1.6x bonus on base damage
    )
    res_long = complete_task(test_user, todo_long.id, is_positive=True)
    dmg_long = res_long["combat"]["damage_dealt"]

    assert dmg_long > dmg_standard, f"Expected long task damage ({dmg_long}) > standard ({dmg_standard})"


@pytest.mark.django_db
def test_todo_can_defeat_boss(test_user, active_encounter):
    """
    Verifies that lethal damage from a To-Do marks the boss as defeated and distributes boss rewards.
    """
    # Lower boss HP to 20
    active_encounter.hp_current = 20
    active_encounter.save()

    todo = Task.objects.create(
        user=test_user,
        title="Finishing Blow Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )

    res = complete_task(test_user, todo.id, is_positive=True)
    combat = res.get("combat")

    assert combat["boss_defeated"] is True
    assert combat["boss_hp_remaining"] == 0

    active_encounter.refresh_from_db()
    assert active_encounter.is_defeated is True
    assert active_encounter.hp_current == 0
