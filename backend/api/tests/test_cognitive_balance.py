import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import UserProfile, Task
from api.services.mechanics import calculate_cognitive_gains

@pytest.mark.django_db
class TestCognitiveMetricsBalance:
    def setup_method(self):
        self.user = User.objects.create_user(username="iq_balance_tester", password="Password123!")
        self.profile = UserProfile.objects.get(user=self.user)
        self.profile.gf = 100.0
        self.profile.gc = 100.0
        self.profile.ps = 100.0
        self.profile.vm = 100.0
        self.profile.gf_ceiling = 105.0
        self.profile.gc_ceiling = 105.0
        self.profile.ps_ceiling = 105.0
        self.profile.vm_ceiling = 105.0
        self.profile.save()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_physics_ten_hours_yields_approx_point_fourteen_gf(self):
        """Verify 10 hours of Physics yields ~0.14 Gf (not runaway whole points)."""
        gains_10h = calculate_cognitive_gains(
            activity="physics",
            hours=10.0,
            eff_total=1.07,
            profile=self.profile,
        )
        gf_gain = gains_10h["gf"]
        # Expected: 0.140 * 10 * 1.07 * (1 - (100/105)^2) = 0.140 * 10 * 1.07 * 0.09297 = 0.139
        assert 0.13 <= gf_gain <= 0.15, f"Expected Gf gain ~0.14 for 10h Physics, got {gf_gain}"

    def test_custom_sciences_activity_matches_physics_balance(self):
        """Verify custom task in Sciences category gets balanced STEM gains."""
        custom_task = Task.objects.create(
            user=self.user,
            title="Quantum Computing",
            task_type="button",
            mastery_category="sciences"
        )
        gains = calculate_cognitive_gains(
            activity="custom_task_999",
            hours=10.0,
            eff_total=1.07,
            profile=self.profile,
            mastery_category=custom_task.mastery_category
        )
        assert 0.13 <= gains["gf"] <= 0.15
        assert 0.09 <= gains["ps"] <= 0.11
        assert gains["vm"] == 0.0

    def test_humanities_and_psychology_balance(self):
        """Verify Humanities activities (History/Psychology) train Gc and Vm without runaway inflation."""
        gains = calculate_cognitive_gains(
            activity="history",
            hours=10.0,
            eff_total=1.0,
            profile=self.profile,
        )
        # Expected Gc: 0.180 * 10 * 1.0 * 0.09297 = 0.167
        assert 0.15 <= gains["gc"] <= 0.18
        assert gains["gf"] < 0.03

        # Custom task tagged as humanities
        custom_task = Task.objects.create(
            user=self.user,
            title="Psychology Reading",
            task_type="button",
            mastery_category="humanities"
        )
        custom_gains = calculate_cognitive_gains(
            activity=f"custom_task_{custom_task.id}",
            hours=10.0,
            eff_total=1.0,
            profile=self.profile,
            mastery_category=custom_task.mastery_category
        )
        assert 0.13 <= custom_gains["gc"] <= 0.17
        assert 0.03 <= custom_gains["gf"] <= 0.06

    def test_languages_balance(self):
        """Verify Languages activities train Vm and Gc."""
        custom_task = Task.objects.create(
            user=self.user,
            title="Japanese Kanji",
            task_type="button",
            mastery_category="languages"
        )
        gains = calculate_cognitive_gains(
            activity=f"custom_task_{custom_task.id}",
            hours=10.0,
            eff_total=1.0,
            profile=self.profile,
            mastery_category=custom_task.mastery_category
        )
        assert 0.15 <= gains["vm"] <= 0.19
        assert 0.10 <= gains["gc"] <= 0.13
        assert gains["gf"] == 0.0

    def test_body_balance(self):
        """Verify Body activities train Ps and mild Gf."""
        custom_task = Task.objects.create(
            user=self.user,
            title="HIIT Workout",
            task_type="button",
            mastery_category="body"
        )
        gains = calculate_cognitive_gains(
            activity=f"custom_task_{custom_task.id}",
            hours=10.0,
            eff_total=1.0,
            profile=self.profile,
            mastery_category=custom_task.mastery_category
        )
        assert 0.10 <= gains["ps"] <= 0.13
        assert 0.04 <= gains["gf"] <= 0.07
        assert gains["gc"] == 0.0
        assert gains["vm"] == 0.0
