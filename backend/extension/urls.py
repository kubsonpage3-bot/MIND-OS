from django.urls import path
from . import views

urlpatterns = [
    # ── Web-app endpoints (standard JWT auth) ────────────────────────────────
    # POST /api/extension/generate-code/ → MIND OS Settings: generate OTP
    path("generate-code/", views.generate_code, name="extension-generate-code"),
    # DELETE /api/extension/revoke/ → disconnect extension
    path("revoke/", views.revoke_token, name="extension-revoke"),
    # GET /api/extension/web-status/ → is extension paired?
    path("web-status/", views.web_status, name="extension-web-status"),
    # ── Extension-facing endpoints (ExtensionToken auth) ─────────────────────
    # POST /api/extension/pair/ → exchange OTP for scoped token
    path("pair/", views.pair, name="extension-pair"),
    # GET /api/extension/status/ → gold, hp, blocklist, active unlocks
    path("status/", views.status_view, name="extension-status"),
    # POST /api/extension/unlock-site/ → pay gold, temporarily unblock
    path("unlock-site/", views.unlock_site, name="extension-unlock-site"),
    # GET/POST /api/extension/blocklist/ → list + add sites
    path("blocklist/", views.blocklist, name="extension-blocklist"),
    # PATCH/DELETE /api/extension/blocklist/<pk>/ → edit/delete single site
    path(
        "blocklist/<int:pk>/", views.blocklist_detail, name="extension-blocklist-detail"
    ),
    # POST /api/extension/complete-task/ → log button-task done from extension
    path("complete-task/", views.complete_task, name="extension-complete-task"),
]
