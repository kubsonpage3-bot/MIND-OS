import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, Boss, BossEncounter, Item, InventoryItem, Task, UserActivityLog
from api.services.mechanics import apply_boss_damage
from api.services.task_service import complete_task


@pytest.fixture
def boss_loot_user(db):
    user = User.objects.create_user(username="loot_hunter", password="password")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.gold = 100
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_boss_defeat_grants_unique_item_and_stats(boss_loot_user):
    """
    Test that defeating a boss via apply_boss_damage awards the unique drop
    to InventoryItem with rolled stat_bonuses and returns the item in rewards.
    """
    user, profile = boss_loot_user

    # Ensure drop item exists in Item table
    item, _ = Item.objects.get_or_create(
        code="heralds_fang",
        defaults={
            "name": "Herald's Fang",
            "item_type": "equipment",
            "slot_type": "neural_link",
            "boss_rank": "D",
            "source": "boss_drop",
            "is_purchasable": False,
        }
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="herald_jackal",
        defaults={
            "name": "Herald Jackal",
            "hp_max": 100,
            "level": 2,
            "reward_gold": 250,
            "reward_xp": 35,
            "drop_item_id": "heralds_fang",
        }
    )

    encounter = BossEncounter.objects.create(
        user=user,
        boss=boss,
        hp_current=50,
        reward_multiplier=1.0,
    )

    # Apply 100 damage to defeat the boss
    combat = apply_boss_damage(user, 100, is_crit=False)

    assert combat["boss_defeated"] is True
    assert combat["boss_hp_remaining"] == 0
    assert combat["rewards"]["item_dropped"] == "heralds_fang"
    assert combat["rewards"]["item_name"] == "Herald's Fang"
    assert len(combat["rewards"]["item_stat_bonuses"]) > 0

    # Verify InventoryItem exists
    inv_item = InventoryItem.objects.filter(user_profile=profile, item=item).first()
    assert inv_item is not None
    assert inv_item.quantity == 1
    assert isinstance(inv_item.stat_bonuses, dict)
    assert len(inv_item.stat_bonuses) > 0

    # Verify encounter is marked defeated and expired
    encounter.refresh_from_db()
    assert encounter.is_defeated is True
    assert encounter.expires_at is not None

    # Verify UserActivityLog has metadata
    log = UserActivityLog.objects.filter(
        user=user, activity_type=UserActivityLog.ActivityType.BOSS_DEFEAT
    ).first()
    assert log is not None
    assert log.metadata.get("item_dropped") == "heralds_fang"
    assert log.metadata.get("item_name") == "Herald's Fang"


@pytest.mark.django_db
def test_repeated_boss_defeat_increments_quantity(boss_loot_user):
    """
    Test that defeating the same boss a second time increments the quantity of the item.
    """
    user, profile = boss_loot_user

    item, _ = Item.objects.get_or_create(
        code="wanderers_hood",
        defaults={
            "name": "Wanderer's Hood",
            "item_type": "equipment",
            "slot_type": "headware",
            "boss_rank": "E",
            "source": "boss_drop",
            "is_purchasable": False,
        }
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="misted_wanderer",
        defaults={
            "name": "Misted Wanderer",
            "hp_max": 100,
            "level": 1,
            "reward_gold": 100,
            "reward_xp": 12,
            "drop_item_id": "wanderers_hood",
        }
    )

    # First encounter
    enc1 = BossEncounter.objects.create(user=user, boss=boss, hp_current=20)
    apply_boss_damage(user, 50)
    enc1.refresh_from_db()
    assert enc1.is_defeated is True

    inv_item = InventoryItem.objects.get(user_profile=profile, item=item)
    assert inv_item.quantity == 1

    # Second encounter
    enc2 = BossEncounter.objects.create(user=user, boss=boss, hp_current=20)
    apply_boss_damage(user, 50)
    enc2.refresh_from_db()
    assert enc2.is_defeated is True

    inv_item.refresh_from_db()
    assert inv_item.quantity == 2


@pytest.mark.django_db
def test_nameless_god_drop_mask_nameless(boss_loot_user):
    """
    Test that nameless_god correctly awards mask_nameless even if an alias exists.
    """
    user, profile = boss_loot_user

    item, _ = Item.objects.get_or_create(
        code="mask_nameless",
        defaults={
            "name": "Mask of the Nameless",
            "item_type": "equipment",
            "slot_type": "headware",
            "gear_class": "SSS",
            "boss_rank": "SSS",
            "source": "boss_drop",
            "is_purchasable": False,
        }
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="nameless_god",
        defaults={
            "name": "Nameless God",
            "hp_max": 100,
            "level": 8,
            "reward_gold": 20000,
            "reward_xp": 2400,
            "drop_item_id": "mask_nameless",
        }
    )

    encounter = BossEncounter.objects.create(user=user, boss=boss, hp_current=10)
    combat = apply_boss_damage(user, 100)

    assert combat["boss_defeated"] is True
    assert combat["rewards"]["item_dropped"] == "mask_nameless"

    inv = InventoryItem.objects.filter(user_profile=profile, item__code="mask_nameless").first()
    assert inv is not None
    # SSS rank gets 4 stats rolled
    assert len(inv.stat_bonuses) == 4


@pytest.mark.django_db
def test_task_completion_boss_defeat_grants_item(boss_loot_user):
    """
    Test that completing a task via complete_task that finishes off a boss
    includes the unique loot in the task result's combat rewards.
    """
    user, profile = boss_loot_user

    Item.objects.get_or_create(
        code="bone_bracelet",
        defaults={
            "name": "Bone Bracelet",
            "item_type": "equipment",
            "slot_type": "ring1",
            "boss_rank": "E",
            "source": "boss_drop",
            "is_purchasable": False,
        }
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="nameless_bones",
        defaults={
            "name": "Nameless Bones",
            "hp_max": 50,
            "level": 1,
            "reward_gold": 120,
            "reward_xp": 15,
            "drop_item_id": "bone_bracelet",
        }
    )

    BossEncounter.objects.create(user=user, boss=boss, hp_current=5)

    task = Task.objects.create(
        user=user,
        title="Defeat Boss Daily",
        task_type=Task.TaskType.DAILY,
        difficulty=Task.Difficulty.HARD,
    )

    result = complete_task(user, task.id, is_positive=True)

    combat = result.get("combat")
    assert combat is not None
    assert combat["boss_defeated"] is True
    assert combat["rewards"]["item_dropped"] == "bone_bracelet"
    assert combat["rewards"]["item_name"] == "Bone Bracelet"

    # InventoryItem must be present
    assert InventoryItem.objects.filter(user_profile=profile, item__code="bone_bracelet").exists()
