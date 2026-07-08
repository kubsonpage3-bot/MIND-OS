from django.test import TestCase
from api.models import UserProfile, User
from api.serializers.training import TrainingLogSerializer
from api.services.mechanics import calculate_training_efficiency


class TrainingLogSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.profile = UserProfile.objects.get(user=self.user)
        self.profile.streak = 15
        self.profile.save()

    def test_efficiency_validation_accepts_correct_efficiency(self):
        # Calculate correct efficiency on the server
        expected_eff = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=2.0,
            streak_days=15,
            hours_today=0.0,
            subject_hours_today=0.0,
        )

        class MockRequest:
            user = self.user

        serializer = TrainingLogSerializer(
            data={
                "hours": 2.0,
                "focus_rating": 7,
                "efficiency": expected_eff,
                "activity": "programming",
            },
            context={"request": MockRequest()},
        )
        self.assertTrue(serializer.is_valid())

    def test_efficiency_validation_rejects_spoofed_efficiency(self):
        # Calculate correct efficiency on the server
        expected_eff = calculate_training_efficiency(
            self.profile,
            focus=7,
            hours=2.0,
            streak_days=15,
            hours_today=0.0,
            subject_hours_today=0.0,
        )

        class MockRequest:
            user = self.user

        spoofed_eff = expected_eff + 1.5  # Add artificial multiplier
        serializer = TrainingLogSerializer(
            data={
                "hours": 2.0,
                "focus_rating": 7,
                "efficiency": spoofed_eff,
                "activity": "programming",
            },
            context={"request": MockRequest()},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("efficiency", serializer.errors)
        self.assertTrue("Efficiency mismatch" in serializer.errors["efficiency"][0])
