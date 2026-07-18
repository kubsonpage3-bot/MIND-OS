import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from .models import PushSubscription
from .services.push_service import send_streak_warnings

logger = logging.getLogger(__name__)


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        p256dh = request.data.get("keys", {}).get("p256dh")
        auth = request.data.get("keys", {}).get("auth")

        if not endpoint or not p256dh or not auth:
            return Response(
                {"error": "Missing subscription fields"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or update subscription
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user": request.user,
                "p256dh": p256dh,
                "auth": auth,
            },
        )

        return Response(
            {"status": "subscribed", "created": created}, status=status.HTTP_200_OK
        )


class PushUnsubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        if not endpoint:
            return Response(
                {"error": "Missing endpoint"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Delete the subscription if it belongs to the user
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()

        return Response({"status": "unsubscribed"}, status=status.HTTP_200_OK)


class CronStreakWarningView(APIView):
    """
    Called by an external cron service (like cron-job.org)
    every hour to send streak warnings to users.
    """

    permission_classes: list = []  # Custom auth via header

    def post(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return Response(
                {"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED
            )

        token = auth_header.split(" ")[1]
        if token != settings.CRON_SECRET:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        try:
            from .services.push_service import (
                send_rival_overtook_warnings,
                send_weekly_reports,
            )
            from datetime import datetime

            sent_streak = send_streak_warnings()
            sent_rival = send_rival_overtook_warnings()

            # Usually weekly reports are sent on a specific day (e.g., Sunday).
            # We can check if today is Sunday, but for now we just call it and it could
            # internally check the day, or we check it here. Let's say Sunday:
            sent_weekly = 0
            if datetime.now().weekday() == 6:  # 6 is Sunday
                sent_weekly = send_weekly_reports()

            total_sent = sent_streak + sent_rival + sent_weekly
            return Response(
                {
                    "status": "ok",
                    "sent_count": total_sent,
                    "details": {
                        "streak": sent_streak,
                        "rival": sent_rival,
                        "weekly": sent_weekly,
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error in CronStreakWarningView: {e}", exc_info=True)
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
