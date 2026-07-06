import pytest
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from api.models import FeatureEvent  # noqa: F401


@pytest.mark.django_db
class TestFeatureAnalytics:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpassword"
        )
        self.profile = self.user.profile
        self.url = "/api/analytics/event/"

    def test_anonymous_event(self):
        # Unauthenticated users can no longer log events
        response = self.client.post(self.url, {"event_name": "opened_app"})
        assert response.status_code == 401

    def test_authenticated_event_analytics_enabled(self):
        # By default, analytics_enabled is True
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {"event_name": "clicked_button"})
        assert response.status_code == 201

        event = FeatureEvent.objects.first()
        assert event is not None
        assert event.user == self.user
        assert event.event_name == "clicked_button"

    def test_authenticated_event_analytics_disabled_silent_drop(self):
        # When analytics_enabled is False, the server should silently drop the event and return 200 OK
        self.profile.analytics_enabled = False
        self.profile.save()

        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {"event_name": "clicked_button"})

        # Returns 200 OK, not 201 Created (and definitely not an error)
        assert response.status_code == 200
        assert response.json() == {"status": "ignored"}

        # Event was not written to DB
        assert FeatureEvent.objects.count() == 0

    def test_missing_event_name_returns_400(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, {})
        assert response.status_code == 400
