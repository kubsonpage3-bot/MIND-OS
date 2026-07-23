from rest_framework.permissions import BasePermission
from django.utils import timezone
from .models import ExtensionToken


class IsExtensionAuthenticated(BasePermission):
    """
    Authenticate via the scoped ExtensionToken stored in browser.storage.local.
    Header: Authorization: Bearer <token>
    Sets request.user so all standard DRF patterns work downstream.
    """

    def has_permission(self, request, view):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return False
        token_str = auth[7:]
        try:
            ext = ExtensionToken.objects.select_related("user").get(token=token_str)
            request.user = ext.user
            # Track last use
            ExtensionToken.objects.filter(pk=ext.pk).update(last_used_at=timezone.now())
            return True
        except ExtensionToken.DoesNotExist:
            return False
