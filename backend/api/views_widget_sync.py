import secrets

from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from api.models import UserProfile


def _new_token() -> str:
    return secrets.token_urlsafe(32)


class WidgetSyncTokenView(APIView):
    """
    GET  /api/widget/sync-token/  -> {"token": "..."} (created on first use)
    POST /api/widget/sync-token/  -> rotates the token (the old value stops working)

    Not Premium-gated, unlike CalendarFeedInfoView's calendar_feed_token:
    the RPG stats / Dailies / Daily Summary / Quick Actions widgets aren't a
    Premium feature, so every user's background sync should work.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        if not profile.widget_sync_token:
            profile.widget_sync_token = _new_token()
            profile.save(update_fields=["widget_sync_token"])
        return Response({"token": profile.widget_sync_token})

    def post(self, request):
        profile = request.user.profile
        profile.widget_sync_token = _new_token()
        profile.save(update_fields=["widget_sync_token"])
        return Response({"token": profile.widget_sync_token})


class WidgetSyncFeedView(APIView):
    """
    GET /api/widget/sync/<token>/ -- compact profile + today's-Dailies
    summary for the native Android widgets' background WorkManager sync job
    (WidgetSyncWorker). Same reasoning as CalendarWidgetFeedView: native code
    has no access to the app's JWT (it lives in the WebView's own
    localStorage), so it authenticates the same way -- by knowing a secret,
    revocable, per-user token, not a login.
    """

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        if not token or len(token) < 20:
            return HttpResponse(status=404)
        profile = (
            UserProfile.objects.select_related("user").filter(widget_sync_token=token).first()
        )
        if not profile:
            return HttpResponse(status=404)

        from api.services.widget_sync import build_widget_sync_summary

        data = build_widget_sync_summary(profile.user)
        response = Response(data)
        response["Cache-Control"] = "private, max-age=300"
        return response
