import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import ActivePomodoroSession, PomodoroSession, UserProfile

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="timerhero", password="pass")
    UserProfile.objects.get_or_create(user=u)
    return u


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_active_session_start_and_get(auth_client, user):
    res = auth_client.get("/api/pomodoro/sessions/active-session/")
    assert res.status_code == 200
    assert res.json()["active"] is False

    start_res = auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "math", "duration_minutes": 30, "mode": "work"},
        format="json",
    )
    assert start_res.status_code == 200
    data = start_res.json()
    assert data["active"] is True
    assert data["linked_activity_key"] == "math"
    assert data["duration_minutes"] == 30

    # Get active session
    get_res = auth_client.get("/api/pomodoro/sessions/active-session/")
    assert get_res.status_code == 200
    assert get_res.json()["active"] is True
    assert get_res.json()["linked_activity_key"] == "math"


@pytest.mark.django_db
def test_active_session_pause_resume(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "coding", "duration_minutes": 30},
        format="json",
    )

    # Pause
    pause_res = auth_client.post("/api/pomodoro/sessions/active-session/pause/")
    assert pause_res.status_code == 200
    assert pause_res.json()["is_paused"] is True

    # Resume
    resume_res = auth_client.post("/api/pomodoro/sessions/active-session/pause/")
    assert resume_res.status_code == 200
    assert resume_res.json()["is_paused"] is False


@pytest.mark.django_db
def test_active_session_complete_with_rating(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "reading", "duration_minutes": 30},
        format="json",
    )

    complete_res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/",
        {"rating": 4},
        format="json",
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["success"] is True

    # Check active session deleted
    assert ActivePomodoroSession.objects.filter(user=user).count() == 0
    # Check PomodoroSession created
    assert PomodoroSession.objects.filter(user=user).count() == 1
    # Check Gold awarded
    profile = UserProfile.objects.get(user=user)
    assert profile.gold >= 60  # 30 * 2
