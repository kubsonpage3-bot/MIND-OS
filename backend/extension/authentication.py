from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from .models import ExtensionToken


class ExtensionTokenAuthentication(BaseAuthentication):
    """
    DRF Authentication backend for scoped ExtensionToken.
    Allows extension requests to authenticate transparently on standard API endpoints
    (e.g., /api/pomodoro/sessions/, /api/profile/, etc.).
    """

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None
        token_str = auth[7:]
        try:
            ext = ExtensionToken.objects.select_related("user").get(token=token_str)
            ExtensionToken.objects.filter(pk=ext.pk).update(
                last_used_at=timezone.now()
            )
            return (ext.user, ext)
        except ExtensionToken.DoesNotExist:
            return None
