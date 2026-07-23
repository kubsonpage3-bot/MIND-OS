import logging
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.models import UserProfile
from api.constants import RANK_THRESHOLDS
from .models import BlockedSite, ExtensionToken, PairingCode, SiteUnlock
from .permissions import IsExtensionAuthenticated
from .serializers import BlockedSiteSerializer, SiteUnlockSerializer

logger = logging.getLogger(__name__)


def _compute_rank(rank_xp: int) -> str:
    current = "E"
    for t in RANK_THRESHOLDS:
        if rank_xp >= t["min"]:
            current = t["id"]
    return current


def _rank_progress(rank_xp: int) -> dict:
    rank = _compute_rank(rank_xp)
    thresholds = RANK_THRESHOLDS
    rank_ids = [t["id"] for t in thresholds]
    idx = rank_ids.index(rank)
    current_min = thresholds[idx]["min"]
    next_min = (
        thresholds[idx + 1]["min"]
        if idx + 1 < len(thresholds)
        else thresholds[idx]["min"]
    )
    in_rank = rank_xp - current_min
    needed = max(1, next_min - current_min)
    pct = min(100, int(in_rank / needed * 100))
    return {
        "rank": rank,
        "rank_xp": rank_xp,
        "rank_xp_in_rank": in_rank,
        "rank_xp_to_next": max(0, next_min - rank_xp),
        "rank_progress_pct": pct,
        "is_max_rank": idx == len(thresholds) - 1,
    }


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
    Returns gold, hp, xp, rank, mana, streak, blocked sites, active unlocks, today_tasks.
    """
    try:
        profile = UserProfile.objects.select_related("user").get(user=request.user)
    except UserProfile.DoesNotExist:
        return Response({"error": "profile_not_found"}, status=404)

    now = timezone.now()
    SiteUnlock.objects.filter(user=request.user, unlocked_until__lt=now).delete()

    active_unlocks = SiteUnlock.objects.filter(user=request.user)
    blocked_sites = BlockedSite.objects.filter(user=request.user)

    from api.models import ActivePomodoroSession, Task

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

    BASE_ACTIVITIES = [
        {"key": "mathematics", "label": "Mathematics", "icon": "∑"},
        {"key": "physics", "label": "Physics", "icon": "⚛"},
        {"key": "history", "label": "History", "icon": "📜"},
        {"key": "english", "label": "English", "icon": "✍"},
        {"key": "philosophy", "label": "Philosophy", "icon": "φ"},
        {"key": "vocabulary", "label": "Vocabulary", "icon": "Aa"},
        {"key": "chess", "label": "Chess / Logic", "icon": "♟"},
        {"key": "coding", "label": "Coding", "icon": "</>"},
        {"key": "creative_answers", "label": "Creative Answers", "icon": "💡"},
        {"key": "exercise", "label": "Exercise", "icon": "⚡"},
        {"key": "prayer", "label": "Prayer / Meditation", "icon": "🕊️"},
        {"key": "running", "label": "Running", "icon": "🏃"},
        {"key": "reading", "label": "Reading", "icon": "📖"},
        {"key": "german", "label": "German", "icon": "🇩🇪"},
        {"key": "languages", "label": "Other Languages", "icon": "🌐"},
        {"key": "psychology", "label": "Psychology", "icon": "💗"},
        {"key": "chemistry", "label": "Chemistry", "icon": "💎"},
        {"key": "neuroscience", "label": "Neuroscience", "icon": "🧠"},
    ]

    # Button tasks (custom activities) with today's completion status
    today_str = now.date().isoformat()
    custom_tasks = Task.objects.filter(user=request.user, task_type="button")
    custom_activities = []
    today_tasks = []
    for t in custom_tasks:
        task_key = f"custom_task_{t.id}"
        completed_today = (
            t.last_completed_at is not None
            and t.last_completed_at.date().isoformat() == today_str
        )
        custom_activities.append(
            {"key": task_key, "label": t.title, "icon": t.icon or "🔘"}
        )
        today_tasks.append(
            {
                "id": t.id,
                "key": task_key,
                "title": t.title,
                "icon": t.icon or "🔘",
                "completed_today": completed_today,
            }
        )

    user_activities = BASE_ACTIVITIES + custom_activities

    rank_data = _rank_progress(profile.rank_xp)

    return Response(
        {
            # Core resources
            "gold": profile.gold,
            "hp": profile.hp,
            "max_hp": profile.max_hp,
            "mana": profile.mana,
            "max_mana": profile.mana_max,
            # Character progression
            "xp": profile.xp,
            "xp_to_next_level": profile.xp_to_next_level,
            "level": profile.level,
            "streak": profile.streak,
            **rank_data,
            # Blocklist
            "blocked_sites": BlockedSiteSerializer(blocked_sites, many=True).data,
            "active_unlocks": SiteUnlockSerializer(active_unlocks, many=True).data,
            # Pomodoro
            "active_session": active_session_data,
            # Activities
            "user_activities": user_activities,
            "today_tasks": today_tasks,
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


@api_view(["POST"])
@authentication_classes([])
@permission_classes([IsExtensionAuthenticated])
def complete_task(request):
    """
    Log a button-task completion from the extension popup.
    Awards XP + Gold based on the task's difficulty setting.
    """
    from api.models import Task
    from api.services.profile_service import gain_xp
    from api.constants import TASK_REWARD_TABLE

    task_id = request.data.get("task_id")
    if not task_id:
        return Response({"error": "task_id_required"}, status=400)

    try:
        task = Task.objects.get(id=task_id, user=request.user, task_type="button")
    except Task.DoesNotExist:
        return Response({"error": "task_not_found"}, status=404)

    now = timezone.now()
    today_str = now.date().isoformat()

    # Idempotency: prevent double-completing in same day
    if (
        task.last_completed_at
        and task.last_completed_at.date().isoformat() == today_str
    ):
        return Response({"error": "already_completed_today"}, status=400)

    difficulty = getattr(task, "difficulty", "easy") or "easy"
    rewards = TASK_REWARD_TABLE.get(difficulty, TASK_REWARD_TABLE["easy"])
    xp_gained = rewards["xp"]
    gold_gained = rewards["gold"]

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=request.user)
        leveled_up = gain_xp(profile, xp_gained)
        profile.gold = max(0, profile.gold + gold_gained)
        profile.save(update_fields=["gold"])
        task.completion_count = (task.completion_count or 0) + 1
        task.last_completed_at = now
        task.save(update_fields=["completion_count", "last_completed_at"])

    logger.info(
        "Extension task complete: user=%s task_id=%s xp=%s gold=%s",
        request.user.username,
        task.id,
        xp_gained,
        gold_gained,
    )
    return Response(
        {
            "ok": True,
            "xp_gained": xp_gained,
            "gold_gained": gold_gained,
            "task_id": task.id,
            "leveled_up": leveled_up,
        }
    )
