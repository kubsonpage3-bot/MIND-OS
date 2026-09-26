import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import UserProfile


@pytest.mark.django_db
class TestDeleteAccountEndpoint:
    def setup_method(self):
        self.user = User.objects.create_user(username="delete_tester", password="Password123!")
        self.profile = UserProfile.objects.get(user=self.user)
        self.client = APIClient()

    def test_requires_authentication(self):
        res = self.client.post("/api/account/delete/", {"confirm": "DELETE"}, format="json")
        assert res.status_code in (401, 403)
        assert User.objects.filter(pk=self.user.pk).exists()

    def test_rejects_missing_confirmation(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/account/delete/", {}, format="json")
        assert res.status_code == 400
        assert User.objects.filter(pk=self.user.pk).exists()

    def test_rejects_wrong_confirmation_text(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/account/delete/", {"confirm": "delete"}, format="json")
        assert res.status_code == 400
        assert User.objects.filter(pk=self.user.pk).exists()

    def test_deletes_user_and_profile_on_correct_confirmation(self):
        user_id = self.user.pk
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/account/delete/", {"confirm": "DELETE"}, format="json")
        assert res.status_code == 200
        assert not User.objects.filter(pk=user_id).exists()
        assert not UserProfile.objects.filter(user_id=user_id).exists()
