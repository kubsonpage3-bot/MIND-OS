import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import (
    UserProfile, Task, TrainingSession, RecruitedAlly,
    InventoryItem, UserAchievement,
    ActiveEffect, SkillCooldown, BossEncounter
)

@pytest.mark.django_db
class TestResetDataEndpoints:
    def setup_method(self):
        self.user = User.objects.create_user(username="reset_tester", password="Password123!")
        self.profile = UserProfile.objects.get(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_reset_training(self):
        TrainingSession.objects.create(
            user_profile=self.profile,
            activity_key="python_study",
            hours=1.5,
            focus_rating=8,
            xp_earned=50
        )
        self.profile.humanities_xp = 100.0
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "training"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.humanities_xp == 0.0
        assert TrainingSession.objects.filter(user_profile=self.profile).count() == 0

    def test_reset_streak(self):
        self.profile.streak = 15
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "streak"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.streak == 0

    def test_reset_tasks(self):
        Task.objects.create(user=self.user, title="Habit 1", task_type="habit")
        Task.objects.create(user=self.user, title="Daily 1", task_type="daily")
        self.profile.rank_xp = 500
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "tasks"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.rank_xp == 0
        assert Task.objects.filter(user=self.user).count() == 0

    def test_reset_allies(self):
        RecruitedAlly.objects.create(
            user_profile=self.profile,
            ally_code="aethelgard",
            level=2
        )
        self.profile.active_allies = ["aethelgard"]
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "allies"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.active_allies == []
        assert RecruitedAlly.objects.filter(user_profile=self.profile).count() == 0

    def test_reset_stats(self):
        self.profile.gold = 500
        self.profile.level = 10
        self.profile.character_class = "warlord"
        self.profile.rank_xp = 2500
        self.profile.weekly_xp = 495
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "stats"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.gold == 0
        assert self.profile.level == 1
        assert self.profile.character_class == ""
        assert self.profile.rank_xp == 0
        assert self.profile.weekly_xp == 0
        assert self.profile.gf == 100.0

    def test_reset_nuclear(self):
        Task.objects.create(user=self.user, title="Task To Delete", task_type="todo")
        self.profile.gold = 999
        self.profile.weekly_xp = 750
        self.profile.save()

        res = self.client.post("/api/profile/reset/", {"reset_type": "nuclear"}, format="json")
        assert res.status_code == 200

        self.profile.refresh_from_db()
        assert self.profile.gold == 0
        assert self.profile.weekly_xp == 0
        assert Task.objects.filter(user=self.user).count() == 0

    def test_user_profile_view_auto_heals_weekly_xp(self):
        self.profile.level = 1
        self.profile.xp = 18
        self.profile.weekly_xp = 495
        self.profile.save()

        res = self.client.get("/api/profile/")
        assert res.status_code == 200
        assert res.data["weekly_xp"] == 18

        self.profile.refresh_from_db()
        assert self.profile.weekly_xp == 18

