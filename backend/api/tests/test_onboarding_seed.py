from django.test import TestCase
from django.contrib.auth.models import User
from django.core import mail
from rest_framework.test import APIClient
from api.models import Task, UserProfile
from api.services.task_service import seed_starter_tasks


class OnboardingSeedTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="operative_neo",
            email="neo@matrix.io",
            password="StrongPassword123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_seed_starter_tasks_creates_three_tasks(self):
        tasks = seed_starter_tasks(self.user, lang="en")
        self.assertEqual(len(tasks), 3)

        dailies = Task.objects.filter(user=self.user, task_type=Task.TaskType.DAILY)
        habits = Task.objects.filter(user=self.user, task_type=Task.TaskType.HABIT)
        self.assertEqual(dailies.count(), 2)
        self.assertEqual(habits.count(), 1)

        # Check titles
        titles = set(t.title for t in tasks)
        self.assertIn("Read for 30 minutes", titles)
        self.assertIn("Morning workout", titles)
        self.assertIn("Drink a glass of water", titles)

    def test_seed_starter_tasks_russian(self):
        tasks = seed_starter_tasks(self.user, lang="ru")
        self.assertEqual(len(tasks), 3)
        titles = set(t.title for t in tasks)
        self.assertIn("Прочитай 30 минут", titles)
        self.assertIn("Сделай зарядку", titles)
        self.assertIn("Выпей стакан воды", titles)

    def test_seed_starter_tasks_does_not_duplicate_if_tasks_exist(self):
        seed_starter_tasks(self.user, lang="en")
        second_run = seed_starter_tasks(self.user, lang="en")
        self.assertEqual(len(second_run), 0)
        self.assertEqual(Task.objects.filter(user=self.user).count(), 3)

    def test_profile_update_class_triggers_seed_and_starter_gold(self):
        profile = self.user.profile
        self.assertEqual(profile.character_class, "Wanderer")
        self.assertEqual(profile.gold, 0)
        self.assertEqual(Task.objects.filter(user=self.user).count(), 0)

        # Update class via API
        response = self.client.patch(
            "/api/profile/",
            {"character_class": "architect", "lang": "ru"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        profile.refresh_from_db()
        self.assertEqual(profile.character_class, "architect")
        self.assertEqual(profile.gold, 20)  # Onboarding starter gold

        # Check seeded tasks
        tasks = Task.objects.filter(user=self.user)
        self.assertEqual(tasks.count(), 3)
        self.assertTrue(tasks.filter(title="Прочитай 30 минут").exists())

    def test_registration_sends_welcome_email(self):
        mail.outbox.clear()
        unauth_client = APIClient()
        response = unauth_client.post(
            "/api/auth/register/",
            {
                "username": "new_operative",
                "email": "agent@mindos.app",
                "password": "Password123!",
                "password2": "Password123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Welcome to the Protocol", mail.outbox[0].subject)
        self.assertIn("agent@mindos.app", mail.outbox[0].to)
