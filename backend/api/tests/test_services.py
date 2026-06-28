import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, Task
from api.services.task_service import complete_task
from api.services.skill_service import activate_skill
from rest_framework.exceptions import ValidationError

@pytest.fixture
def user():
    u = User.objects.create(username="testuser", password="testpassword")
    return u

@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "architect"
    p.mana = 100
    p.hp = 100
    p.gold = 0
    p.save()
    return p

@pytest.fixture
def task(user):
    return Task.objects.create(user=user, title="Test Task", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)

@pytest.mark.django_db
def test_complete_task_rewards(user, profile, task):
    initial_xp = profile.xp
    initial_gold = profile.gold
    
    result = complete_task(user, task.id, True)
    
    profile.refresh_from_db()
    task.refresh_from_db()
    
    assert task.is_completed is True
    assert profile.gold > initial_gold
    assert profile.xp > initial_xp
    assert result["detail"] == "Задача выполнена!"

@pytest.mark.django_db
def test_complete_task_twice_fails(user, profile, task):
    complete_task(user, task.id, True)
    with pytest.raises(ValidationError):
        complete_task(user, task.id, True)

@pytest.mark.django_db
def test_activate_skill_success(user, profile):
    # architect blueprint skill costs 40 mana
    initial_mana = profile.mana
    success, message, class_data, effects = activate_skill(user, "blueprint")
    
    profile.refresh_from_db()
    assert success is True
    assert profile.mana == initial_mana - 40
    assert len(effects) == 1
    assert effects[0]["effect_id"] == "blueprint_effect"

@pytest.mark.django_db
def test_activate_skill_no_mana(user, profile):
    profile.mana = 10
    profile.save()
    
    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is False
    assert "Недостаточно маны" in message

@pytest.mark.django_db
def test_blueprint_effect_cleanup(user, profile):
    from api.models import ActiveEffect
    # 1. Activate blueprint skill
    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is True
    assert ActiveEffect.objects.filter(user=user, skill_id="blueprint").count() == 1
    
    # Verify tasksRemaining is 3 initially
    effect = ActiveEffect.objects.get(user=user, skill_id="blueprint")
    assert effect.data["tasksRemaining"] == 3
    
    # 2. Complete first task
    t1 = Task.objects.create(user=user, title="T1", task_type=Task.TaskType.TODO)
    complete_task(user, t1.id, True)
    effect.refresh_from_db()
    assert effect.data["tasksRemaining"] == 2
    
    # 3. Complete second task
    t2 = Task.objects.create(user=user, title="T2", task_type=Task.TaskType.TODO)
    complete_task(user, t2.id, True)
    effect.refresh_from_db()
    assert effect.data["tasksRemaining"] == 1
    
    # 4. Complete third task (should trigger deletion)
    t3 = Task.objects.create(user=user, title="T3", task_type=Task.TaskType.TODO)
    complete_task(user, t3.id, True)
    assert ActiveEffect.objects.filter(user=user, skill_id="blueprint").count() == 0

