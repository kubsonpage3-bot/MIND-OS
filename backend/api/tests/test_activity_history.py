import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import Task, UserActivityLog, TrainingSession, UserProfile
from api.services.task_service import complete_task


@pytest.mark.django_db
def test_activity_history_endpoint_and_logging():
    # 1. Setup User and Profile
    user = User.objects.create_user(username="testrunner", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)

    # 2. Create tasks of different types
    habit = Task.objects.create(
        user=user,
        task_type=Task.TaskType.HABIT,
        title="100 Pushups",
        category="Health & Fitness",
        difficulty="medium",
    )
    daily = Task.objects.create(
        user=user,
        task_type=Task.TaskType.DAILY,
        title="Morning Meditation",
        category="Mindfulness",
        difficulty="easy",
    )
    todo = Task.objects.create(
        user=user,
        task_type=Task.TaskType.TODO,
        title="Read Quantum Mechanics Chapter 1",
        category="STEM",
        difficulty="hard",
    )

    # 3. Complete tasks
    complete_task(user, habit.id, is_positive=True)
    complete_task(user, habit.id, is_positive=False)
    complete_task(user, daily.id, is_positive=True)
    complete_task(user, todo.id, is_positive=True)

    # Verify logs created
    logs = UserActivityLog.objects.filter(user=user)
    assert logs.count() == 4
    assert logs.filter(activity_type=UserActivityLog.ActivityType.HABIT_POS).exists()
    assert logs.filter(activity_type=UserActivityLog.ActivityType.HABIT_NEG).exists()
    assert logs.filter(activity_type=UserActivityLog.ActivityType.DAILY).exists()
    assert logs.filter(activity_type=UserActivityLog.ActivityType.TODO).exists()

    # 4. Log a training session via API
    res_training = client.post(
        "/api/training/log/",
        {
            "activity": "mathematics",
            "hours": 2.5,
            "focus_rating": 8,
        },
        format="json",
    )
    assert res_training.status_code == 200
    assert logs.filter(activity_type=UserActivityLog.ActivityType.STUDY).exists()

    # 5. Query /api/history/
    res_all = client.get("/api/history/")
    assert res_all.status_code == 200
    data = res_all.json()
    assert "results" in data
    assert "stats" in data
    assert len(data["results"]) >= 5
    assert data["stats"]["total_hours"] == 2.5
    assert data["stats"]["tasks_completed_count"] >= 3
    assert data["stats"]["habits_count"] >= 2
    assert data["stats"]["dailies_count"] >= 1
    assert data["stats"]["todos_count"] >= 1
    assert data["stats"]["study_count"] >= 1

    # 6. Query with filter by type
    res_habits = client.get("/api/history/?type=habit")
    assert res_habits.status_code == 200
    habit_results = res_habits.json()["results"]
    assert len(habit_results) == 2
    for r in habit_results:
        assert r["activity_type"] in ["habit_pos", "habit_neg"]

    # 7. Query with search filter
    res_search = client.get("/api/history/?search=Quantum")
    assert res_search.status_code == 200
    search_results = res_search.json()["results"]
    assert len(search_results) == 1
    assert "Quantum" in search_results[0]["title"]
