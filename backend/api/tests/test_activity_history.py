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


@pytest.mark.django_db
def test_habit_completion_via_api_and_backfill():
    user2 = User.objects.create_user(username="habituser", password="password123")
    client = APIClient()
    client.force_authenticate(user=user2)

    # 1. Create a habit
    habit = Task.objects.create(
        user=user2,
        task_type=Task.TaskType.HABIT,
        title="Drink 2L Water",
        category="Health & Fitness",
        difficulty="easy",
    )

    # 2. Complete via POST /api/tasks/{id}/complete/
    res = client.post(f"/api/tasks/{habit.id}/complete/", {"is_positive": True}, format="json")
    assert res.status_code == 200
    habit.refresh_from_db()
    assert habit.pos_streak == 1
    assert habit.completion_count == 1
    assert habit.last_completed_at is not None

    # Check UserActivityLog
    logs = UserActivityLog.objects.filter(user=user2, task=habit)
    assert logs.count() == 1
    log = logs.first()
    assert log.activity_type == UserActivityLog.ActivityType.HABIT_POS
    assert log.title == "Drink 2L Water"
    assert log.category == "Health & Fitness"
    assert log.streak_value == 1

    # 3. Complete negative via API
    res_neg = client.post(f"/api/tasks/{habit.id}/complete/", {"is_positive": False}, format="json")
    assert res_neg.status_code == 200
    logs_all = UserActivityLog.objects.filter(user=user2, task=habit)
    assert logs_all.count() == 2
    assert logs_all.filter(activity_type=UserActivityLog.ActivityType.HABIT_NEG).exists()

    # 4. Test backfill scenario: user with pre-existing completed habit but 0 logs
    user3 = User.objects.create_user(username="preexisting_user", password="password123")
    client3 = APIClient()
    client3.force_authenticate(user=user3)

    Task.objects.create(
        user=user3,
        task_type=Task.TaskType.HABIT,
        title="Read 10 pages",
        category="Reading & Writing",
        difficulty="medium",
        completion_count=2,
        pos_streak=2,
    )

    # User3 has 0 logs currently
    assert UserActivityLog.objects.filter(user=user3).count() == 0

    # Querying /api/history/ triggers automatic backfill
    res_history = client3.get("/api/history/")
    assert res_history.status_code == 200
    history_data = res_history.json()
    assert len(history_data["results"]) >= 1
    assert history_data["stats"]["habits_count"] >= 1
    assert UserActivityLog.objects.filter(user=user3).count() >= 1


@pytest.mark.django_db
def test_task_revert_sync_with_activity_history():
    user4 = User.objects.create_user(username="revertuser", password="password123")
    client4 = APIClient()
    client4.force_authenticate(user=user4)

    # 1. Create a Daily task
    daily = Task.objects.create(
        user=user4,
        task_type=Task.TaskType.DAILY,
        title="Workout Routine",
        category="Health & Fitness",
        difficulty="medium",
    )

    # 2. Complete Daily
    res_comp = client4.post(f"/api/tasks/{daily.id}/complete/", {"is_positive": True}, format="json")
    assert res_comp.status_code == 200
    xp_earned = res_comp.json()["xp_earned"]
    assert xp_earned > 0

    # Verify history before revert
    res_hist1 = client4.get("/api/history/")
    assert res_hist1.status_code == 200
    h1_data = res_hist1.json()
    assert h1_data["stats"]["dailies_count"] == 1
    assert h1_data["stats"]["total_xp"] == xp_earned
    assert len(h1_data["results"]) == 1

    # 3. Uncomplete/Revert Daily
    res_rev = client4.post(f"/api/tasks/{daily.id}/complete/", {"is_positive": False}, format="json")
    assert res_rev.status_code == 200

    # Verify history after revert: log is cleanly deleted, XP/count back to 0
    res_hist2 = client4.get("/api/history/")
    assert res_hist2.status_code == 200
    h2_data = res_hist2.json()
    assert h2_data["stats"]["dailies_count"] == 0
    assert h2_data["stats"]["total_xp"] == 0
    assert len(h2_data["results"]) == 0
    # 4. Re-complete Daily: should create exactly 1 log without duplicates
    res_comp2 = client4.post(f"/api/tasks/{daily.id}/complete/", {"is_positive": True}, format="json")
    assert res_comp2.status_code == 200
    xp_earned2 = res_comp2.json()["xp_earned"]
    res_hist3 = client4.get("/api/history/")
    assert res_hist3.status_code == 200
    h3_data = res_hist3.json()
    assert h3_data["stats"]["dailies_count"] == 1
    assert h3_data["stats"]["total_xp"] == xp_earned2
    assert len(h3_data["results"]) == 1

    # 5. Test Todo toggle revert
    todo = Task.objects.create(
        user=user4,
        task_type=Task.TaskType.TODO,
        title="Submit report",
        category="STEM",
        difficulty="hard",
    )
    res_todo_comp = client4.post(f"/api/tasks/{todo.id}/toggle/")
    assert res_todo_comp.status_code == 200
    assert res_todo_comp.json()["completed"] is True
    assert UserActivityLog.objects.filter(user=user4, task=todo).count() == 1

    # Uncomplete todo
    res_todo_uncomp = client4.post(f"/api/tasks/{todo.id}/toggle/")
    assert res_todo_uncomp.status_code == 200
    assert res_todo_uncomp.json()["completed"] is False
    assert UserActivityLog.objects.filter(user=user4, task=todo).count() == 0


@pytest.mark.django_db
def test_self_healing_history_reconciliation():
    user5 = User.objects.create_user(username="healinguser", password="password123")
    client5 = APIClient()
    client5.force_authenticate(user=user5)

    # 1. Simulate an uncompleted Daily that has 2 orphaned/duplicate legacy logs
    daily_uncompleted = Task.objects.create(
        user=user5,
        task_type=Task.TaskType.DAILY,
        title="Uncompleted Daily",
        category="Mindfulness",
        is_completed=False,
        last_completed_at=None,
    )
    UserActivityLog.objects.create(
        user=user5,
        task=daily_uncompleted,
        activity_type=UserActivityLog.ActivityType.DAILY,
        title="Uncompleted Daily",
        xp_earned=28,
        gold_earned=14,
    )
    UserActivityLog.objects.create(
        user=user5,
        task=daily_uncompleted,
        activity_type=UserActivityLog.ActivityType.DAILY,
        title="Uncompleted Daily",
        xp_earned=22,
        gold_earned=11,
    )

    # 2. Simulate a completed Daily that has 3 duplicate logs for today
    daily_completed = Task.objects.create(
        user=user5,
        task_type=Task.TaskType.DAILY,
        title="Completed Daily",
        category="STEM",
        is_completed=True,
    )
    for i in range(3):
        UserActivityLog.objects.create(
            user=user5,
            task=daily_completed,
            activity_type=UserActivityLog.ActivityType.DAILY,
            title="Completed Daily",
            xp_earned=15,
            gold_earned=7,
        )

    # Initial state before calling /api/history/: 5 daily logs exist
    assert UserActivityLog.objects.filter(user=user5).count() == 5

    # Querying /api/history/ triggers automatic self-healing reconciliation
    res = client5.get("/api/history/")
    assert res.status_code == 200
    data = res.json()

    # The 2 orphaned logs of uncompleted daily are deleted
    # The 3 duplicate logs of completed daily are deduplicated to 1
    assert data["stats"]["dailies_count"] == 1
    assert data["stats"]["total_xp"] == 15
    assert len(data["results"]) == 1
    assert data["results"][0]["title"] == "Completed Daily"
    assert UserActivityLog.objects.filter(user=user5).count() == 1



