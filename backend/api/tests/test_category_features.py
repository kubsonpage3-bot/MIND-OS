from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from api.models import User, UserProfile
from api.services.mechanics import calculate_training_efficiency


class CategoryFeaturesTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client.force_authenticate(user=self.user)
        self.profile = UserProfile.objects.get(user=self.user)

    def test_calculate_training_efficiency_category_diminishing(self):
        # 1. No hours logged today -> efficiency should be base
        eff_base = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=1,
            hours_today=0.0,
            subject_hours_today=0.0,
            category_hours_today=0.0,
            category_streak_days=0,
        )

        # 2. Individual diminishing: 2 hours of Mathematics
        eff_indiv = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=1,
            hours_today=2.0,
            subject_hours_today=2.0,
            category_hours_today=2.0,
            category_streak_days=0,
        )
        # 3. Category diminishing: 0 hours of Physics, but 3.0 hours of Mathematics today (category total = 3.0)
        # Individual is 1.0 (subject_hours_today = 0.0), but category is 0.5 (category_hours_today = 3.0)
        eff_cat = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=1,
            hours_today=3.0,
            subject_hours_today=0.0,
            category_hours_today=3.0,
            category_streak_days=0,
        )

        self.assertLess(eff_indiv, eff_base)
        self.assertLess(eff_cat, eff_base)

    def test_calculate_training_efficiency_category_streak(self):
        # No category streak (0 days)
        eff_no_streak = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=1,
            hours_today=0.0,
            subject_hours_today=0.0,
            category_hours_today=0.0,
            category_streak_days=0,
        )

        # Category streak (2 days) -> +5% bonus
        eff_streak = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=1,
            hours_today=0.0,
            subject_hours_today=0.0,
            category_hours_today=0.0,
            category_streak_days=2,
        )

        self.assertAlmostEqual(eff_streak, eff_no_streak * 1.05, places=3)

    def test_training_view_updates_category_streaks(self):
        # Log a Mathematics session today (Sciences category)
        url = "/api/training/log/"
        data = {
            "hours": 1.0,
            "focus_rating": 7,
            "activity": "mathematics",
            "efficiency": 1.0,  # calculated client efficiency matching server
        }

        # Calculate correct client efficiency
        expected_eff = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=self.profile.streak,
            hours_today=0.0,
            subject_hours_today=0.0,
            category_hours_today=0.0,
            category_streak_days=0,
        )
        data["efficiency"] = expected_eff

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, 200)

        # Verify category streak was initialized
        self.profile.refresh_from_db()
        streaks = self.profile.category_streaks
        self.assertIn("sciences", streaks)
        self.assertEqual(streaks["sciences"]["days"], 1)

        # Now simulate consecutive day streak logic
        today = timezone.now().date()
        yesterday_str = str(today - timedelta(days=1))

        # Manually set streak last active date to yesterday to test incrementing
        self.profile.category_streaks = {
            "sciences": {"days": 1, "last_active_date": yesterday_str}
        }
        self.profile.save()

        # Log another Mathematics session
        expected_eff2 = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=1.0,
            streak_days=self.profile.streak,
            hours_today=0.0,
            subject_hours_today=0.0,
            category_hours_today=0.0,
            category_streak_days=1,  # streak_days is 1, but we get bonus on >= 2
        )
        data["efficiency"] = expected_eff2
        response2 = self.client.post(url, data, format="json")
        self.assertEqual(response2.status_code, 200)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.category_streaks["sciences"]["days"], 2)
