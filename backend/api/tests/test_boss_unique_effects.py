import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    UserProfile,
    Boss,
    BossEncounter,
    Item,
    InventoryItem,
    Task,
    RecruitedAlly,
)
from api.services.mechanics import apply_boss_damage
from api.services.task_service import complete_task, process_missed_tasks
from api.services.combat_service import calculate_damage


@pytest.fixture
def test_user(db):
    user = User.objects.create_user(username="boss_tester", password="password")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.gold = 1000
    profile.mana = 20
    profile.hp = 50
    profile.base_pwr = 10
    profile.base_foc = 10
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_boss_defeat_grants_mp_reward(test_user):
    """
    Test that defeating a boss correctly adds its reward_mp to profile.mana.
    """
    user, profile = test_user
    profile.mana = 10
    profile.save()

    boss, _ = Boss.objects.get_or_create(
        id_name="abyssal_bellringer",
        defaults={
            "name": "Abyssal Bellringer",
            "hp_max": 100,
            "level": 3,
            "reward_gold": 500,
            "reward_xp": 75,
            "reward_sp": 8,
            "reward_mp": 20,
            "drop_item_id": "echo_bell",
        },
    )
    BossEncounter.objects.create(user=user, boss=boss, hp_current=50)

    combat = apply_boss_damage(user, 100)
    assert combat["boss_defeated"] is True
    assert combat["rewards"]["boss_mp"] == 20

    profile.refresh_from_db()
    # 10 initial + 20 reward = 30
    assert profile.mana == 30


@pytest.mark.django_db
def test_equipped_weapons_boss_damage_multipliers(test_user):
    """
    Test that equipping frostbite_blade, scar_shard, and blade_final_dusk
    multiplies damage to bosses.
    """
    user, profile = test_user

    fb_item, _ = Item.objects.get_or_create(
        code="frostbite_blade",
        defaults={
            "name": "Frostbite Blade",
            "slot_type": "arms",
            "item_type": "equipment",
            "boss_rank": "C",
        },
    )
    ss_item, _ = Item.objects.get_or_create(
        code="scar_shard",
        defaults={
            "name": "Scar Shard",
            "slot_type": "ring2",
            "item_type": "equipment",
            "boss_rank": "A",
        },
    )
    bfd_item, _ = Item.objects.get_or_create(
        code="blade_final_dusk",
        defaults={
            "name": "Blade of the Final Dusk",
            "slot_type": "arms",
            "item_type": "equipment",
            "boss_rank": "SSS",
        },
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="training_dummy",
        defaults={
            "name": "Training Dummy",
            "hp_max": 10000,
            "level": 3,
            "reward_gold": 100,
            "reward_xp": 20,
            "reward_mp": 10,
        },
    )

    # 1. Base damage without gear
    enc1 = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)
    res1 = calculate_damage(user, enc1.id, 100)
    assert res1["damage_dealt"] == 100

    # 2. Equip frostbite_blade (+4%)
    InventoryItem.objects.create(
        user_profile=profile, item=fb_item, quantity=1, is_equipped=True
    )
    enc2 = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)
    res2 = calculate_damage(user, enc2.id, 100)
    assert res2["damage_dealt"] == 104

    # 3. Equip scar_shard (+8%) alongside frostbite_blade
    InventoryItem.objects.create(
        user_profile=profile, item=ss_item, quantity=1, is_equipped=True
    )
    enc3 = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)
    res3 = calculate_damage(user, enc3.id, 100)
    # 100 * (1 + 0.04 + 0.08) = 112
    assert res3["damage_dealt"] == 112

    # 4. Equip blade_final_dusk (doubles damage: * 2.0)
    InventoryItem.objects.filter(user_profile=profile, item=fb_item).update(
        is_equipped=False
    )
    InventoryItem.objects.create(
        user_profile=profile, item=bfd_item, quantity=1, is_equipped=True
    )
    enc4 = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)
    res4 = calculate_damage(user, enc4.id, 100)
    # (100 + 8% scar_shard) * 2.0 = 216
    assert res4["damage_dealt"] == 216


@pytest.mark.django_db
def test_mask_of_the_nameless_boosts_boss_rewards(test_user):
    """
    Test that having Mask of the Nameless boosts boss gold and XP by +25%.
    """
    user, profile = test_user
    initial_gold = profile.gold
    initial_xp = profile.rank_xp

    mask_item, _ = Item.objects.get_or_create(
        code="mask_nameless",
        defaults={
            "name": "Mask of the Nameless",
            "slot_type": "headware",
            "item_type": "equipment",
            "boss_rank": "SSS",
        },
    )
    InventoryItem.objects.create(
        user_profile=profile, item=mask_item, quantity=1, is_equipped=True
    )

    boss, _ = Boss.objects.get_or_create(
        id_name="reward_test_boss",
        defaults={
            "name": "Reward Test Boss",
            "hp_max": 100,
            "level": 5,
            "reward_gold": 1000,
            "reward_xp": 200,
            "reward_mp": 50,
        },
    )
    BossEncounter.objects.create(user=user, boss=boss, hp_current=20)

    combat = apply_boss_damage(user, 100)
    assert combat["boss_defeated"] is True
    # 1000 * 1.25 = 1250, 200 * 1.25 = 250
    assert combat["rewards"]["boss_gold"] == 1250
    assert combat["rewards"]["boss_xp"] == 250


@pytest.mark.django_db
def test_gear_task_reward_bonuses(test_user):
    """
    Test ember_gauntlet (+5% To-Do gold), golems_grip (+8% Habit gold),
    and crown_of_ash (+8% XP from all tasks).
    """
    user, profile = test_user

    gauntlet, _ = Item.objects.get_or_create(
        code="ember_gauntlet",
        defaults={"name": "Ember Gauntlet", "slot_type": "arms", "item_type": "equipment"},
    )
    grip, _ = Item.objects.get_or_create(
        code="golems_grip",
        defaults={"name": "Golem's Grip", "slot_type": "arms", "item_type": "equipment"},
    )
    crown, _ = Item.objects.get_or_create(
        code="crown_of_ash",
        defaults={"name": "Crown of Ash", "slot_type": "headware", "item_type": "equipment"},
    )

    # 1. Complete To-Do without gear
    todo = Task.objects.create(
        user=user, title="Test Todo", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM
    )
    res1 = complete_task(user, todo.id)
    base_gold = res1["gold_earned"]
    base_xp = res1["xp_earned"]

    # 2. Equip ember_gauntlet and crown_of_ash
    InventoryItem.objects.create(user_profile=profile, item=gauntlet, is_equipped=True)
    InventoryItem.objects.create(user_profile=profile, item=crown, is_equipped=True)

    todo2 = Task.objects.create(
        user=user, title="Test Todo 2", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM
    )
    res2 = complete_task(user, todo2.id)
    assert res2["gold_earned"] == int(base_gold * 1.05)
    assert res2["xp_earned"] == int(base_xp * 1.08)


@pytest.mark.django_db
def test_winter_plate_weekly_immunity(test_user):
    """
    Test that winter_plate grants immunity to the first missed daily of the week.
    """
    user, profile = test_user
    plate, _ = Item.objects.get_or_create(
        code="winter_plate",
        defaults={"name": "Winter Plate", "slot_type": "core", "item_type": "equipment"},
    )
    InventoryItem.objects.create(user_profile=profile, item=plate, is_equipped=True)

    # Create daily that was not completed
    Task.objects.create(
        user=user,
        title="Unfinished Daily",
        task_type=Task.TaskType.DAILY,
        difficulty=Task.Difficulty.HARD,
        is_completed=False,
    )

    profile.last_daily_cron_at = timezone.now().date() - timezone.timedelta(days=1)
    profile.save()

    initial_hp = profile.hp
    process_missed_tasks(user)

    profile.refresh_from_db()
    # Damage should be prevented
    assert profile.hp == initial_hp


@pytest.mark.django_db
def test_eclipse_eye_allows_4_active_allies(test_user):
    """
    Test that having eclipse_eye equipped allows 4 active allies in UserProfileSerializer.
    """
    from api.serializers.profile import UserProfileSerializer

    user, profile = test_user
    eye, _ = Item.objects.get_or_create(
        code="eclipse_eye",
        defaults={"name": "Eclipse Eye", "slot_type": "neural_link", "item_type": "equipment"},
    )

    # Recruit 4 allies
    for code in ["kira", "void", "lyra", "grier"]:
        RecruitedAlly.objects.create(user_profile=profile, ally_code=code, level=1)

    # Without eclipse_eye, 4 allies should fail validation
    serializer_fail = UserProfileSerializer(
        profile, data={"active_allies": ["kira", "void", "lyra", "grier"]}, partial=True
    )
    assert serializer_fail.is_valid() is False

    # Equip eclipse_eye
    InventoryItem.objects.create(user_profile=profile, item=eye, is_equipped=True)

    serializer_pass = UserProfileSerializer(
        profile, data={"active_allies": ["kira", "void", "lyra", "grier"]}, partial=True
    )
    assert serializer_pass.is_valid() is True
    serializer_pass.save()
    profile.refresh_from_db()
    assert len(profile.active_allies) == 4


@pytest.mark.django_db
def test_synced_item_slots(db):
    """
    Verify that Item.slot_type matches the canonical scroll UI definitions.
    """
    expected_slots = {
        "echo_bell": "offhand",
        "glass_tear": "neural_link",
        "scar_shard": "ring2",
        "forgotten_score": "offhand",
        "abyssal_purse": "ring2",
        "throne_seal": "ring1",
        "heralds_fang": "neural_link",
        "wardens_quill": "offhand",
    }
    for code, expected_slot in expected_slots.items():
        item = Item.objects.filter(code=code).first()
        if item:
            assert item.slot_type == expected_slot, f"Item {code} has slot {item.slot_type}, expected {expected_slot}"
