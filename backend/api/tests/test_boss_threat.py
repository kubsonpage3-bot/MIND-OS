import pytest
from django.utils import timezone
from api.models import (
    User,
    UserProfile,
    Task,
    Boss,
    BossEncounter,
    ActiveEffect,
    UserActivityLog,
)
from api.serializers.tasks import TaskSerializer
from api.serializers.combat import BossEncounterSerializer
from api.services.combat_service import (
    calculate_habit_fail_hp,
    calculate_boss_daily_damage,
)
from api.services.task_service import complete_task, process_missed_tasks


@pytest.fixture
def test_user(db):
    user = User.objects.create_user(username="threat_hero", password="password123")
    user.refresh_from_db()
    profile = user.profile
    profile.hp = 100
    profile.base_def = 10
    profile.base_pwr = 10
    profile.timezone = "UTC"
    if "total_stats" in profile.__dict__:
        del profile.__dict__["total_stats"]
    profile.save()
    user.refresh_from_db()
    return user


@pytest.mark.django_db
def test_habit_hp_loss_synchronization(test_user):
    """
    Verifies that the preview on the habit card (next_fail_hp in TaskSerializer)
    EXACTLY equals the actual HP lost when the negative button (-) is pressed.
    """
    profile = test_user.profile
    task = Task.objects.create(
        user=test_user,
        title="Работа",
        task_type=Task.TaskType.HABIT,
        difficulty="hard",
        value=-1.0,
        pos_streak=0,
        neg_streak=1,
    )

    # 1. Preview from TaskSerializer
    serializer_data = TaskSerializer(task).data
    expected_next_hp = serializer_data["next_fail_hp"]
    assert expected_next_hp > 0, "next_fail_hp should be calculated and > 0"

    # 2. Direct SSOT function call with for_next=True
    calc_preview = calculate_habit_fail_hp(task, profile, for_next=True)
    assert expected_next_hp == calc_preview

    hp_before = profile.hp

    # 3. Simulate user clicking negative (-) button
    res = complete_task(test_user, task.id, is_positive=False)
    profile.refresh_from_db()
    task.refresh_from_db()

    actual_hp_lost = res["penalty"]["hp"]  # e.g. -4
    # The actual deducted HP must match the exact preview!
    assert actual_hp_lost == -expected_next_hp, (
        f"Desynchronization detected! Preview was -{expected_next_hp} HP, "
        f"but actual penalty was {actual_hp_lost} HP"
    )
    assert profile.hp == hp_before - expected_next_hp


@pytest.mark.django_db
def test_boss_daily_damage_scaling_e_to_sss(test_user):
    """
    Verifies the balance curve:
    - E boss has base 10 HP/day (urgent short sprint)
    - SSS boss has base 5 HP/day (sustainable multi-week marathon)
    - DEF from gear/stats reduces the damage via 100 / (100 + DEF).
    """
    profile = test_user.profile

    # Rank E Boss
    boss_e = Boss.objects.create(
        id_name="misted_wanderer",
        name="Misted Wanderer",
        level=1,
        hp_max=500,
        reward_gold=100,
        reward_xp=12,
    )
    enc_e = BossEncounter.objects.create(
        user=test_user, boss=boss_e, hp_current=500, is_defeated=False
    )

    # With base DEF = 10 (def_multiplier = 100/110 = ~0.91):
    dmg_e = calculate_boss_daily_damage(enc_e, profile)
    assert dmg_e["base_damage"] == 10
    assert dmg_e["damage"] == round(10 * (100 / 110))  # 9 HP
    assert dmg_e["boss_rank"] == "E"

    # Now test with high gear DEF = 90 (def_multiplier = 100/200 = 0.5):
    profile.base_def = 90
    if "total_stats" in profile.__dict__:
        del profile.__dict__["total_stats"]
    profile.save()

    dmg_e_geared = calculate_boss_daily_damage(enc_e, profile)
    assert dmg_e_geared["damage"] == 5  # 10 * 0.5 = 5 HP
    assert dmg_e_geared["mitigated_by_def"] == 5

    # Rank SSS Boss
    boss_sss = Boss.objects.create(
        id_name="nameless_god",
        name="Nameless God",
        level=8,
        hp_max=600000,
        reward_gold=20000,
        reward_xp=2400,
    )
    enc_sss = BossEncounter.objects.create(
        user=test_user, boss=boss_sss, hp_current=600000, is_defeated=False
    )

    dmg_sss = calculate_boss_daily_damage(enc_sss, profile)
    assert dmg_sss["base_damage"] == 5
    # Base 5 with DEF 90 -> 5 * (100 / 190) = 2.6 -> 3 HP
    assert dmg_sss["damage"] in [2, 3]
    assert dmg_sss["boss_rank"] == "SSS"


@pytest.mark.django_db
def test_boss_stun_and_player_invulnerability(test_user):
    """
    Verifies that skills like war_cry / decoy_shadow_stun (stun boss)
    and iron_fast / elixir (player invulnerable) nullify daily boss damage.
    """
    profile = test_user.profile
    boss = Boss.objects.create(
        id_name="herald_jackal",
        name="Herald Jackal",
        level=2,
        hp_max=1500,
        reward_gold=250,
        reward_xp=35,
    )
    enc = BossEncounter.objects.create(
        user=test_user, boss=boss, hp_current=1500, is_defeated=False
    )

    # Normal attack: base damage = 9
    dmg_normal = calculate_boss_daily_damage(enc, profile)
    assert dmg_normal["damage"] > 0

    # 1. Boss Stunned by War Cry
    ActiveEffect.objects.create(
        user=test_user,
        skill_id="war_cry",
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    dmg_stunned = calculate_boss_daily_damage(enc, profile)
    assert dmg_stunned["damage"] == 0
    assert dmg_stunned["is_stunned"] is True

    ActiveEffect.objects.filter(user=test_user).delete()

    # 2. Player Invulnerable by Elixir
    ActiveEffect.objects.create(
        user=test_user,
        skill_id="elixir",
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    dmg_invuln = calculate_boss_daily_damage(enc, profile)
    assert dmg_invuln["damage"] == 0
    assert dmg_invuln["is_invulnerable"] is True


@pytest.mark.django_db
def test_daily_cron_applies_boss_damage(test_user):
    """
    Verifies that process_missed_tasks inflicts boss damage on day rollover.
    """
    profile = test_user.profile
    boss = Boss.objects.create(
        id_name="misted_wanderer",
        name="Misted Wanderer",
        level=1,
        hp_max=500,
        reward_gold=100,
        reward_xp=12,
    )
    BossEncounter.objects.create(
        user=test_user, boss=boss, hp_current=500, is_defeated=False
    )

    # Set last cron to yesterday so process_missed_tasks fires
    yesterday = timezone.now().date() - timezone.timedelta(days=1)
    profile.last_daily_cron_at = yesterday
    profile.save(update_fields=["last_daily_cron_at"])

    hp_start = profile.hp
    result = process_missed_tasks(test_user)
    profile.refresh_from_db()

    # Verify cron fired and logged boss attack
    assert result["fired"] is True
    boss_logs = [entry for entry in result["log"] if entry.get("type") == "boss_attack"]
    assert len(boss_logs) == 1
    boss_entry = boss_logs[0]
    assert boss_entry["boss_name"] == "Misted Wanderer"
    assert boss_entry["damage"] > 0
    assert profile.hp == hp_start - boss_entry["damage"]
