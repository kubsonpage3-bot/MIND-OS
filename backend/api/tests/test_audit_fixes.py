import pytest
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    UserProfile,
    Item,
    InventoryItem,
    Task,
    RecruitedAlly,
)
from api.services.daily_service import process_daily_login
from api.services.task_service import complete_task
from api.services.combat_service import calculate_fail_damage, calculate_habit_fail_hp
from api.services.mechanics import apply_active_mutators


@pytest.fixture
def test_player(db):
    user = User.objects.create_user(username="audit_tester", password="password")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.gold = 1000
    profile.mana = 50
    profile.hp = 80
    profile.base_pwr = 10
    profile.base_foc = 20
    profile.base_def = 10
    profile.base_mem = 10
    profile.base_spd = 10
    profile.base_lck = 10
    profile.character_class = "architect"
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_invalidate_cached_stats(test_player):
    user, profile = test_player
    # Access total_stats and equip_stats to populate @cached_property
    _ = profile.total_stats
    _ = profile.equip_stats
    assert "total_stats" in profile.__dict__
    assert "equip_stats" in profile.__dict__

    profile.invalidate_cached_stats()
    assert "total_stats" not in profile.__dict__
    assert "equip_stats" not in profile.__dict__


@pytest.mark.django_db
def test_bran_l4_gear_stat_bonus(test_player):
    user, profile = test_player
    item = Item.objects.create(
        code="iron_sword",
        name="Iron Sword",
        slot_type="weapon",
    )
    InventoryItem.objects.create(
        user_profile=profile,
        item=item,
        is_equipped=True,
        stat_bonuses={"pwr": 10},
    )
    profile.invalidate_cached_stats()
    base_pwr_with_gear = profile.total_stats["pwr"]

    # Recruit Bran at Level 4 and set as active ally
    RecruitedAlly.objects.create(
        user_profile=profile,
        ally_code="bran",
        level=4,
    )
    profile.active_allies = ["bran"]
    profile.save(update_fields=["active_allies"])
    profile.invalidate_cached_stats()
    boosted_pwr = profile.total_stats["pwr"]
    # 10 equip pwr * 1.30 = 13 (+3 pwr boost)
    assert boosted_pwr == base_pwr_with_gear + 3


@pytest.mark.django_db
def test_echo_bell_foc_mult_in_total_stats(test_player):
    user, profile = test_player
    profile.invalidate_cached_stats()
    base_foc = profile.total_stats["foc"]

    bell_item, _ = Item.objects.get_or_create(
        code="echo_bell",
        defaults={"name": "Echo Bell", "slot_type": "offhand"},
    )
    InventoryItem.objects.create(
        user_profile=profile,
        item=bell_item,
        is_equipped=True,
    )
    profile.invalidate_cached_stats()
    boosted_foc = profile.total_stats["foc"]
    # Echo Bell grants +4% FOC gain
    assert boosted_foc == int(base_foc * 1.04)


@pytest.mark.django_db
def test_loan_shark_and_compound_daily_cycle(test_player):
    user, profile = test_player
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    # 1. Lone loan_shark: loses 30G at midnight
    profile.active_mutators = {"active": [{"id": "loan_shark"}]}
    profile.gold = 500
    profile.last_login_date = yesterday
    profile.save()

    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.gold == 470  # 500 - 30

    # 2. Lone compound: generates +1G per 100G owned
    profile.active_mutators = {"active": [{"id": "compound"}]}
    profile.gold = 500
    profile.last_login_date = yesterday
    profile.save()

    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.gold == 505  # 500 + 5

    # 3. Synergy loan_shark + compound: penalty reduced to 15G, interest rate 2G per 100G
    profile.active_mutators = {"active": [{"id": "loan_shark"}, {"id": "compound"}]}
    profile.gold = 500
    profile.last_login_date = yesterday
    profile.save()

    process_daily_login(user)
    profile.refresh_from_db()
    # 500 - 15 = 485; interest on 485 = (485 // 100) * 2 = 8; total = 493
    assert profile.gold == 493

    # Synergy task multiplier: +40% + 15% = +55%
    effects = apply_active_mutators(profile, {})
    assert effects["gold_mult"] == pytest.approx(1.55)


@pytest.mark.django_db
def test_glass_tear_heals_on_task_completion(test_player):
    user, profile = test_player
    profile.hp = 50
    profile.save()

    glass_tear, _ = Item.objects.get_or_create(
        code="glass_tear",
        defaults={"name": "Glass Tear", "slot_type": "amulet"},
    )
    InventoryItem.objects.create(
        user_profile=profile,
        item=glass_tear,
        is_equipped=True,
    )

    task = Task.objects.create(
        user=user,
        title="Heal Task",
        task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.EASY,
    )
    complete_task(user, task.id, True)

    profile.refresh_from_db()
    # 50 + 2 from glass_tear = 52
    assert profile.hp == 52


@pytest.mark.django_db
def test_winter_plate_reduces_damage(test_player):
    user, profile = test_player
    task = Task.objects.create(
        user=user,
        title="Failing Critical Daily",
        task_type=Task.TaskType.DAILY,
        difficulty="critical",
        value=-30.0,
    )
    base_fail_dmg = calculate_fail_damage(task, profile)

    plate, _ = Item.objects.get_or_create(
        code="winter_plate",
        defaults={"name": "Winter Plate", "slot_type": "armor"},
    )
    InventoryItem.objects.create(
        user_profile=profile,
        item=plate,
        is_equipped=True,
    )
    profile.invalidate_cached_stats()
    reduced_dmg = calculate_fail_damage(task, profile)
    assert reduced_dmg < base_fail_dmg
