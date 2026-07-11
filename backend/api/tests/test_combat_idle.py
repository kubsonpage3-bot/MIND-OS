import pytest
from datetime import timedelta
from django.utils import timezone
from api.models import Boss, BossEncounter, UserProfile
from django.contrib.auth.models import User
from api.services.combat_service import apply_idle_damage, calculate_damage

@pytest.fixture
def user_and_boss():
    user = User.objects.create_user(username="test_combat", password="pw")
    profile = UserProfile.objects.get(user=user)
    boss = Boss.objects.create(
        id_name="test_boss",
        name="Test Boss",
        hp_max=1000,
        level=1,
        reward_gold=100,
        reward_xp=100
    )
    encounter = BossEncounter.objects.create(
        user=user,
        boss=boss,
        hp_current=boss.hp_max,
        reward_multiplier=1.0,
        is_defeated=False
    )
    return user, profile, boss, encounter

@pytest.mark.django_db
def test_idle_damage_24h_cap(user_and_boss):
    user, profile, boss, encounter = user_and_boss
    
    # Simulate 48 hours passing
    now = timezone.now()
    encounter.last_idle_tick_at = now - timedelta(hours=48)
    encounter.save()
    
    damage_applied = apply_idle_damage(encounter)
    
    # 24 hours cap = 24 * 3600 seconds = 86400 seconds
    # DPS = 0.1 -> 8640 damage max.
    # Boss HP is 1000, so it will hit the 95% cap! 
    # Let's give the boss a massive HP pool to test purely the 24h cap
    boss.hp_max = 100000
    boss.save()
    encounter.hp_current = boss.hp_max
    encounter.last_idle_tick_at = now - timedelta(hours=48)
    encounter.save()
    
    damage_applied = apply_idle_damage(encounter)
    
    assert damage_applied == 8640 # exactly 24 hours of damage
    assert encounter.hp_current == 100000 - 8640

@pytest.mark.django_db
def test_idle_damage_95_percent_cap(user_and_boss):
    user, profile, boss, encounter = user_and_boss
    
    # Boss HP max = 1000
    # 95% cap means boss cannot drop below 50 HP.
    now = timezone.now()
    encounter.last_idle_tick_at = now - timedelta(hours=24) # 8640 damage
    encounter.save()
    
    damage_applied = apply_idle_damage(encounter)
    
    assert damage_applied == 950 # 1000 - 50 = 950
    assert encounter.hp_current == 50
    assert encounter.is_defeated is False

@pytest.mark.django_db
def test_manual_final_blow(user_and_boss):
    user, profile, boss, encounter = user_and_boss
    
    now = timezone.now()
    encounter.last_idle_tick_at = now - timedelta(hours=24)
    encounter.save()
    
    # This should bring HP down to 50
    calculate_damage(user, encounter.id, 0)
    encounter.refresh_from_db()
    assert encounter.hp_current == 50
    assert encounter.is_defeated is False
    
    # Active damage finishes it off
    result = calculate_damage(user, encounter.id, 100)
    encounter.refresh_from_db()
    assert encounter.hp_current == 0
    assert encounter.is_defeated is True
    assert result["boss_defeated"] is True
    assert result["rewards"] is not None

@pytest.mark.django_db
def test_double_counting_protection(user_and_boss):
    user, profile, boss, encounter = user_and_boss
    
    now = timezone.now()
    encounter.last_idle_tick_at = now - timedelta(hours=1) # 3600 seconds -> 360 damage
    encounter.save()
    
    # First call
    damage_1 = apply_idle_damage(encounter)
    assert damage_1 == 360
    assert encounter.hp_current == 640
    
    # Immediate second call
    damage_2 = apply_idle_damage(encounter)
    assert damage_2 == 0
    assert encounter.hp_current == 640

@pytest.mark.django_db
def test_offline_interval_tracking(user_and_boss):
    from rest_framework.test import APIClient
    user, profile, boss, encounter = user_and_boss
    client = APIClient()
    client.force_authenticate(user=user)
    
    # Simulate last seen 5 minutes ago
    now = timezone.now()
    profile.last_seen_at = now - timedelta(minutes=5)
    profile.save()
    
    response = client.get("/api/profile/")
    assert response.status_code == 200
    
    # offline_seconds should be approx 300
    offline_seconds = response.data.get("offline_seconds")
    assert offline_seconds is not None
    assert 299 <= offline_seconds <= 301
    
    # last_seen_at should be updated to now
    profile.refresh_from_db()
    new_seen = profile.last_seen_at
    assert (new_seen - now).total_seconds() < 2
