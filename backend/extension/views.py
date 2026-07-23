import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.models import UserProfile
from .models import BlockedSite, ExtensionToken, PairingCode, SiteUnlock
from .permissions import IsExtensionAuthenticated
from .serializers import BlockedSiteSerializer, SiteUnlockSerializer

logger = logging.getLogger(__name__)

# ── Web-app endpoints (use standard JWT auth) ─────────────────────────────


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_code(request):
    """
    Generate a 10-min OTP pairing code for the extension.
    Called from the MIND OS web app Settings page.
    """
    # Invalidate any previous unused codes for this user
    PairingCode.objects.filter(user=request.user, used=False).delete()
    code = PairingCode.objects.create(user=request.user)
    return Response({"code": code.code, "expires_at": code.expires_at})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def revoke_token(request):
    """Disconnect the extension — web app Settings 'Disconnect' button."""
    ExtensionToken.objects.filter(user=request.user).delete()
    return Response({"detail": "Extension disconnected."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def web_status(request):
    """
    Returns whether this user has an extension token paired.
    Used by the Settings page to show 'Connected' / 'Not connected'.
    """
    paired = ExtensionToken.objects.filter(user=request.user).exists()
    return Response({"paired": paired})


# ── Extension-facing endpoints (use ExtensionToken auth) ─────────────────


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def pair(request):
    """
    Exchange OTP code for a scoped ExtensionToken.
    No auth required — this IS the auth flow.
    """
    code_str = request.data.get("code", "").upper().strip()
    if not code_str:
        return Response({"error": "code_required"}, status=400)

    try:
        code = PairingCode.objects.select_related("user").get(code=code_str)
    except PairingCode.DoesNotExist:
        return Response({"error": "invalid_code"}, status=400)

    if not code.is_valid():
        return Response({"error": "code_expired_or_used"}, status=400)

    code.used = True
    code.save(update_fields=["used"])

    # Issue or replace scoped token
    token, _ = ExtensionToken.objects.get_or_create(user=code.user)
    if _:
        pass  # freshly created
    else:
        # Rotate token on re-pair
        import secrets

        token.token = secrets.token_urlsafe(48)
        token.save(update_fields=["token"])

    return Response({"token": token.token})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([IsExtensionAuthenticated])
def status_view(request):
    """
    Extension polls this on popup open.
    Returns gold, hp, blocked sites, and active unlocks.
    """
    try:
        profile = UserProfile.objects.get(user=request.user)
    except UserProfile.DoesNotExist:
        return Response({"error": "profile_not_found"}, status=404)

    now = timezone.now()
    # Clean expired unlocks
    SiteUnlock.objects.filter(user=request.user, unlocked_until__lt=now).delete()

    active_unlocks = SiteUnlock.objects.filter(user=request.user)
    blocked_sites = BlockedSite.objects.filter(user=request.user)

    from api.models import ActivePomodoroSession

    active_pomo = ActivePomodoroSession.objects.filter(user=request.user).first()
    active_session_data = None
    if active_pomo:
        active_session_data = {
            "active": True,
            "linked_activity_key": active_pomo.linked_activity_key,
            "duration_minutes": active_pomo.duration_minutes,
            "mode": active_pomo.mode,
            "is_paused": active_pomo.is_paused,
            "remaining_seconds": active_pomo.remaining_seconds(),
            "started_at": active_pomo.started_at,
        }

    return Response(
        {
            "gold": profile.gold,
            "hp": profile.hp,
            "max_hp": profile.max_hp,
            "blocked_sites": BlockedSiteSerializer(blocked_sites, many=True).data,
            "active_unlocks": SiteUnlockSerializer(active_unlocks, many=True).data,
            "active_session": active_session_data,
        }
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([IsExtensionAuthenticated])
def unlock_site(request):
    """
    Pay gold to temporarily unblock a site.
    Cost and duration are taken from the BlockedSite record — NEVER from the client.
    """
    domain = request.data.get("domain", "").lower().strip()
    if not domain:
        return Response({"error": "domain_required"}, status=400)

    try:
        blocked = BlockedSite.objects.get(user=request.user, domain=domain)
    except BlockedSite.DoesNotExist:
        return Response({"error": "site_not_in_blocklist"}, status=400)

    cost = blocked.unlock_cost
    duration = blocked.unlock_duration_minutes

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=request.user)
        if profile.gold < cost:
            return Response(
                {"error": "insufficient_gold", "gold": profile.gold}, status=400
            )

        profile.gold = max(0, profile.gold - cost)
        profile.save(update_fields=["gold"])

        unlocked_until = timezone.now() + timedelta(minutes=duration)
        unlock, _ = SiteUnlock.objects.update_or_create(
            user=request.user,
            domain=domain,
            defaults={"unlocked_until": unlocked_until, "gold_spent": cost},
        )

    logger.info(
        "User %s unlocked %s for %d min, spent %d gold",
        request.user.username,
        domain,
        duration,
        cost,
    )
    return Response(
        {
            "gold": profile.gold,
            "unlocked_until": unlock.unlocked_until,
            "domain": domain,
        }
    )


# ── Blocklist CRUD (extension auth) ──────────────────────────────────────


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([IsExtensionAuthenticated])
def blocklist(request):
    if request.method == "GET":
        sites = BlockedSite.objects.filter(user=request.user)
        return Response(BlockedSiteSerializer(sites, many=True).data)

    # POST — add site
    serializer = BlockedSiteSerializer(data=request.data)
    if serializer.is_valid():
        # upsert by domain
        site, _ = BlockedSite.objects.update_or_create(
            user=request.user,
            domain=serializer.validated_data["domain"].lower().strip(),
            defaults={
                "unlock_cost": serializer.validated_data.get("unlock_cost", 111),
                "unlock_duration_minutes": serializer.validated_data.get(
                    "unlock_duration_minutes", 30
                ),
            },
        )
        return Response(
            BlockedSiteSerializer(site).data, status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=400)


@api_view(["PATCH", "DELETE"])
@authentication_classes([])
@permission_classes([IsExtensionAuthenticated])
def blocklist_detail(request, pk):
    try:
        site = BlockedSite.objects.get(pk=pk, user=request.user)
    except BlockedSite.DoesNotExist:
        return Response({"error": "not_found"}, status=404)

    if request.method == "DELETE":
        site.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — update cost or duration
    serializer = BlockedSiteSerializer(site, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)
