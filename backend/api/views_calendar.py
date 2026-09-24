import datetime
import secrets
import zoneinfo

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from api.models import UserActivityLog, UserProfile


def _require_premium(request):
    profile = getattr(request.user, "profile", None)
    if not profile or not profile.is_premium:
        raise PermissionDenied("Premium subscription required to access Calendar.")
    return profile


def _new_token() -> str:
    return secrets.token_urlsafe(32)


class CalendarFeedInfoView(APIView):
    """
    GET  /api/calendar/feed-info/  -> the user's private subscription URL
                                       (created on first use)
    POST /api/calendar/feed-info/  -> rotate the token (the old URL stops working)
    """

    permission_classes = [permissions.IsAuthenticated]

    def _payload(self, request, profile):
        path = f"/api/calendar/feed/{profile.calendar_feed_token}.ics"
        return {
            "url": request.build_absolute_uri(path),
            "webcal_url": request.build_absolute_uri(path).replace("https://", "webcal://").replace("http://", "webcal://"),
        }

    def get(self, request):
        profile = _require_premium(request)
        if not profile.calendar_feed_token:
            profile.calendar_feed_token = _new_token()
            profile.save(update_fields=["calendar_feed_token"])
        return Response(self._payload(request, profile))

    def post(self, request):
        profile = _require_premium(request)
        profile.calendar_feed_token = _new_token()
        profile.save(update_fields=["calendar_feed_token"])
        return Response(self._payload(request, profile), status=status.HTTP_200_OK)


class CalendarFeedView(APIView):
    """
    GET /api/calendar/feed/<token>.ics -- the iCalendar feed a calendar app
    subscribes to. No login (calendar apps can't send our JWT); the long random
    per-user token IS the credential, so it is only ever handed to its owner and
    can be rotated. Premium is re-checked on every fetch.
    """

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        if not token or len(token) < 20:
            return HttpResponse(status=404)
        profile = (
            UserProfile.objects.select_related("user")
            .filter(calendar_feed_token=token)
            .first()
        )
        if not profile or not profile.is_premium:
            return HttpResponse(status=404)

        from api.services.ics import build_calendar_ics

        response = HttpResponse(
            build_calendar_ics(profile.user), content_type="text/calendar; charset=utf-8"
        )
        response["Content-Disposition"] = 'inline; filename="mind-os.ics"'
        # Calendar clients poll; let them cache briefly but never a shared cache.
        response["Cache-Control"] = "private, max-age=300"
        return response


class CalendarWidgetFeedView(APIView):
    """
    GET /api/calendar/feed/<token>/widget.json?month=YYYY-MM -- the same
    private, unauthenticated-but-secret token as the ICS feed (CalendarFeedView),
    but returning a compact per-day JSON summary instead of iCalendar text.

    This exists specifically for the native Android widget's background
    WorkManager sync job: native code has no access to the app's JWT (it lives
    in the WebView's own localStorage), so it authenticates the same way a
    subscribed calendar app does -- by knowing the token.
    """

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        if not token or len(token) < 20:
            return HttpResponse(status=404)
        profile = (
            UserProfile.objects.select_related("user")
            .filter(calendar_feed_token=token)
            .first()
        )
        if not profile or not profile.is_premium:
            return HttpResponse(status=404)

        from api.services.calendar_widget import build_calendar_widget_summary

        month = request.query_params.get("month")
        data = build_calendar_widget_summary(profile.user, month)
        response = Response(data)
        response["Cache-Control"] = "private, max-age=300"
        return response


class CalendarDailyHistoryView(APIView):
    """
    GET /api/calendar/daily-history/?from=YYYY-MM-DD&to=YYYY-MM-DD
    -> { "YYYY-MM-DD": [task_id, ...] }: which Dailies were completed on which
    (user-local) day, so the calendar can show past occurrences as done/missed
    instead of an ever-present template.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _require_premium(request)
        try:
            start = datetime.date.fromisoformat(request.query_params.get("from", ""))
            end = datetime.date.fromisoformat(request.query_params.get("to", ""))
        except ValueError:
            return Response(
                {"detail": "from/to must be YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end < start or (end - start).days > 400:
            return Response(
                {"detail": "Invalid range."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
        except Exception:
            tz = zoneinfo.ZoneInfo("UTC")
        # Explicit UTC bounds of the user's local [start, end] days -- never
        # created_at__date, which converts to the server's timezone.
        lower = datetime.datetime.combine(start, datetime.time.min, tzinfo=tz)
        upper = datetime.datetime.combine(
            end + datetime.timedelta(days=1), datetime.time.min, tzinfo=tz
        )

        logs = UserActivityLog.objects.filter(
            user=request.user,
            activity_type=UserActivityLog.ActivityType.DAILY,
            task__isnull=False,
            created_at__gte=lower,
            created_at__lt=upper,
        ).values_list("task_id", "created_at")

        result: dict = {}
        for task_id, created_at in logs:
            day = created_at.astimezone(tz).date().isoformat()
            bucket = result.setdefault(day, [])
            if task_id not in bucket:
                bucket.append(task_id)
        return Response(result)
