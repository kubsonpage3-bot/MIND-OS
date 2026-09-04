import pytest
from unittest.mock import patch
from django.contrib.auth.models import User
from api.models import UserProfile, Task
from api.services.mechanics import get_passive_multipliers, resolve_mastery_category
from api.services.task_service import complete_task


@pytest.fixture
def user():
    u = User.objects.create(username="passivetestuser", password="testpassword")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.mana = 100
    p.hp = 100
    p.gold = 100
    p.save()
    return p


def test_resolve_mastery_category():
    # Test task_mastery_category mapping (precedence)
    assert resolve_mastery_category(task_mastery_category="sciences") == "sciences"
    assert resolve_mastery_category(task_mastery_category="BODY ") == "body"
    assert resolve_mastery_category(task_mastery_category="invalid") == ""

    # Test activity_key mapping
    assert resolve_mastery_category(activity="exercise") == "body"
    assert resolve_mastery_category(activity="coding") == "sciences"
    assert resolve_mastery_category(activity="chess") == "sciences"
    assert resolve_mastery_category(activity="creative_answers") == "sciences"
    assert resolve_mastery_category(activity="english") == "languages"
    assert resolve_mastery_category(activity="vocabulary") == "languages"
    assert resolve_mastery_category(activity="meditation") == "spirit"
    assert resolve_mastery_category(activity="history") == "humanities"
    assert resolve_mastery_category(activity="unknown") == ""

    # Test task_category mapping fallback
    assert resolve_mastery_category(task_category="STEM") == "sciences"
    assert resolve_mastery_category(task_category="Work & Career") == "sciences"
    assert resolve_mastery_category(task_category="Health & Fitness") == "body"
    assert resolve_mastery_category(task_category="Rest & Recovery") == "body"
    assert resolve_mastery_category(task_category="English") == "languages"
    assert (
        resolve_mastery_category(task_category="Social & Communication") == "languages"
    )
    assert resolve_mastery_category(task_category="Mindfulness") == "spirit"
    assert resolve_mastery_category(task_category="Humanities & Arts") == "humanities"
    assert resolve_mastery_category(task_category="Random") == ""

    # Test empty/null edge cases
    assert resolve_mastery_category() == ""
    assert resolve_mastery_category(activity=None, task_category=None) == ""


@pytest.mark.django_db
def test_class_passive_multipliers(profile):
    # Test Warlord (+20% on Body)
    profile.character_class = "warlord"
    profile.save()

    context_body = {"activity": "exercise"}
    effects = get_passive_multipliers(profile, context_body)
    assert effects["xp_mult"] == 1.20

    context_sciences = {"activity": "coding"}
    effects = get_passive_multipliers(profile, context_sciences)
    assert effects["xp_mult"] == 1.0

    # Test Architect (+20% on Sciences)
    profile.character_class = "Architect"
    profile.save()
    effects = get_passive_multipliers(profile, context_sciences)
    assert effects["xp_mult"] == 1.20

    # Test Linguist (+20% on Languages)
    profile.character_class = "linguist "
    profile.save()
    context_languages = {"activity": "english"}
    effects = get_passive_multipliers(profile, context_languages)
    assert effects["xp_mult"] == 1.20

    # Test Ascetic (+20% on Spirit)
    profile.character_class = "ascetic"
    profile.save()
    context_spirit = {"activity": "meditation"}
    effects = get_passive_multipliers(profile, context_spirit)
    assert effects["xp_mult"] == 1.20

    # Test Humanities has NO specialized class (always 1.0)
    context_humanities = {"activity": "history"}
    effects = get_passive_multipliers(profile, context_humanities)
    assert effects["xp_mult"] == 1.0

    # Test Wanderer / No class gets 1.0
    profile.character_class = "Wanderer"
    profile.save()
    effects = get_passive_multipliers(profile, context_body)
    assert effects["xp_mult"] == 1.0


@pytest.mark.django_db
@patch("random.random", return_value=0.99)
def test_complete_task_with_class_passive(mock_random, user, profile):
    # Setup Architect profile
    profile.character_class = "architect"
    profile.save()

    # Task in Science category
    task_sci = Task.objects.create(
        user=user,
        title="Science Task",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
        category="STEM",  # Maps to sciences
    )

    # Task in other category (e.g. Body)
    task_body = Task.objects.create(
        user=user,
        title="Body Task",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
        category="Health & Fitness",  # Maps to body
    )

    # Complete non-class task
    initial_xp = profile.xp
    complete_task(user, task_body.id, True)
    profile.refresh_from_db()
    xp_gained_non_class = profile.xp - initial_xp

    # Complete matching class task
    profile.xp = 0
    profile.save()
    complete_task(user, task_sci.id, True)
    profile.refresh_from_db()
    xp_gained_class = profile.xp

    # The class matching task should yield more XP (+20% passive bonus)
    assert xp_gained_class > xp_gained_non_class
    # Since base reward is the same, xp_gained_class should be exactly 1.2x xp_gained_non_class (within integer rounding)
    assert abs(xp_gained_class - int(xp_gained_non_class * 1.2)) <= 1


@pytest.mark.django_db
@patch("random.random", return_value=0.99)
def test_custom_mastery_category_class_passive(mock_random, user, profile):
    # Setup Linguist profile (+20% on languages)
    profile.character_class = "linguist"
    profile.save()

    # Create task with explicit mastery_category="languages"
    task_custom_lang = Task.objects.create(
        user=user,
        title="Custom Japanese Activity",
        task_type=Task.TaskType.BUTTON,
        category="Other",
        mastery_category="languages",
    )

    # Create task with explicit mastery_category="body"
    task_custom_body = Task.objects.create(
        user=user,
        title="Custom Workout Activity",
        task_type=Task.TaskType.BUTTON,
        category="Other",
        mastery_category="body",
    )

    initial_xp = profile.xp
    complete_task(user, task_custom_body.id, True)
    profile.refresh_from_db()
    xp_body = profile.xp - initial_xp

    profile.xp = 0
    profile.save()
    complete_task(user, task_custom_lang.id, True)
    profile.refresh_from_db()
    xp_lang = profile.xp

    # Linguist gets +20% bonus on languages mastery_category
    assert xp_lang > xp_body
    assert abs(xp_lang - int(xp_body * 1.2)) <= 1


@pytest.mark.django_db
@patch("random.random", return_value=0.99)
def test_all_classes_training_log_passives(mock_random, user, profile):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)

    # 1. Wanderer baseline (no class bonus)
    profile.character_class = "Wanderer"
    profile.save()

    res_w_sci = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "mathematics", "efficiency": 1.0},
        format="json",
    )
    assert res_w_sci.status_code == 200
    xp_w_sci = res_w_sci.data["xp_earned"]

    res_w_body = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "exercise", "efficiency": 1.0},
        format="json",
    )
    assert res_w_body.status_code == 200
    xp_w_body = res_w_body.data["xp_earned"]

    res_w_lang = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "english", "efficiency": 1.0},
        format="json",
    )
    assert res_w_lang.status_code == 200
    xp_w_lang = res_w_lang.data["xp_earned"]

    res_w_spirit = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "prayer", "efficiency": 1.0},
        format="json",
    )
    assert res_w_spirit.status_code == 200
    xp_w_spirit = res_w_spirit.data["xp_earned"]

    # 2. Architect (+20% on Sciences)
    profile.character_class = "Architect"
    profile.save()

    res_arch_sci = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "mathematics", "efficiency": 1.0},
        format="json",
    )
    xp_arch_sci = res_arch_sci.data["xp_earned"]
    assert xp_arch_sci > xp_w_sci
    assert abs(xp_arch_sci - int(xp_w_sci * 1.2)) <= 1

    # Architect on non-science (Body) gets baseline
    res_arch_body = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "exercise", "efficiency": 1.0},
        format="json",
    )
    assert res_arch_body.data["xp_earned"] == xp_w_body

    # 3. Warlord (+20% on Body)
    profile.character_class = "Warlord"
    profile.save()

    # Warlord on matching category (Body) gets +20% passive bonus
    res_warlord_body = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "exercise", "efficiency": 1.0},
        format="json",
    )
    xp_warlord_body = res_warlord_body.data["xp_earned"]

    # Warlord on non-matching category (Sciences) does not get passive bonus
    res_warlord_sci = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "mathematics", "efficiency": 1.0},
        format="json",
    )
    xp_warlord_sci = res_warlord_sci.data["xp_earned"]
    assert xp_warlord_body > xp_warlord_sci
    assert abs(xp_warlord_body - int(xp_warlord_sci * 1.2)) <= 1

    # 4. Linguist (+20% on Languages)
    profile.character_class = "Linguist"
    profile.save()

    res_ling_lang = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "english", "efficiency": 1.0},
        format="json",
    )
    xp_ling_lang = res_ling_lang.data["xp_earned"]
    assert xp_ling_lang > xp_w_lang
    assert abs(xp_ling_lang - int(xp_w_lang * 1.2)) <= 1

    # 5. Ascetic (+20% on Spirit)
    profile.character_class = "Ascetic"
    profile.save()

    res_asc_spirit = client.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 7.0, "activity": "prayer", "efficiency": 1.0},
        format="json",
    )
    xp_asc_spirit = res_asc_spirit.data["xp_earned"]
    assert xp_asc_spirit > xp_w_spirit
    assert abs(xp_asc_spirit - int(xp_w_spirit * 1.2)) <= 1

