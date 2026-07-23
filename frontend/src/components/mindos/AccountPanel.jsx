import { useState, useEffect } from "react";
import { User, Mail, LogOut, Trash2, Shield, AlertTriangle, X, Crown, Star, Lock, Calendar, RefreshCw, Sparkles, Puzzle } from "lucide-react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useToast } from "@/components/ui/use-toast";
import { isMobileApp } from "@/utils/platformUtils";
import { useTranslation } from "react-i18next";
import { Eye, UserX, BarChart3, Loader2 } from "lucide-react";
import { useMutation } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import ExtensionPanel from '@/components/mindos/ExtensionPanel';

export default function AccountPanel() {
  const { profile, logout } = useDjangoAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null); // null | "pending" | "done"
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const user = profile?.user || null;
  const isPremium = !!profile?.is_premium;

  const updateProfile = useMutation({
    mutationFn: ({ data }) => djangoApi.profile.update(data),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
    },
  });

  const anonymousMode = profile?.anonymous_mode || false;
  const rivalVisibility = profile?.rival_visibility !== false; // default true
  const analyticsEnabled = profile?.analytics_enabled !== false; // default true

  useEffect(() => {
    if (profile) {
      const consentValue = analyticsEnabled ? "granted" : "denied";
      localStorage.setItem("mindos_consent_analytics", consentValue);
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          "analytics_storage": consentValue,
          "ad_storage": consentValue,
          "ad_user_data": consentValue,
          "ad_personalization": consentValue
        });
      }
    }
  }, [profile?.analytics_enabled]);

  const updatePrivacySetting = (key, value) => {
    if (profile) {
      updateProfile.mutate({ data: { [key]: value } });
    }
  };

  const [localCharName, setLocalCharName] = useState("");

  useEffect(() => {
    if (profile) {
      setLocalCharName(profile.character_name || "");
    }
  }, [profile?.character_name]);

  const updateCharacterName = () => {
    if (profile && localCharName !== profile.character_name) {
      updateProfile.mutate({ data: { character_name: localCharName } });
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleteStatus("pending");
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDeleteStatus("done");
  };

  const handleManageSubscription = async () => {
    if (isMobileApp()) {
      window.open('https://mindos.pages.dev', '_blank');
      return;
    }
    
    setIsPortalLoading(true);
    try {
      const data = await djangoApi.billing.createPortalSession();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned from server.");
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || err?.message || "Failed to open subscription portal.";
      toast({ title: "Subscription Portal Error", description: msg, variant: "destructive" });
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (isMobileApp()) {
      window.open('https://mindos.pages.dev', '_blank');
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const data = await djangoApi.billing.createCheckoutSession();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from server.");
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || err?.message || "Failed to start checkout. Please try again.";
      toast({ title: "Checkout Error", description: msg, variant: "destructive" });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('settings.accountSettings')}</span>
      </div>

      {/* Character Profile */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.characterProfile')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.characterProfileDesc')}</p>
        <input
          type="text"
          value={localCharName}
          onChange={(e) => setLocalCharName(e.target.value)}
          onBlur={updateCharacterName}
          placeholder={t('settings.enterCharacterName')}
          className="w-full px-3 py-2 rounded-lg border border-[var(--habit-border)] bg-background text-foreground font-mono text-sm"
        />
      </div>

      {/* ── SUBSCRIPTION BLOCK ── */}
      {isPremium ? (
        /* ── PREMIUM CARD ── */
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-[#1a120a] to-[#0d0a06]">
          {/* Gold glow orbs */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative p-5 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Crown className="w-4 h-4 text-black" />
                </div>
                <div>
                  <div className="font-mono font-black text-sm text-amber-400 tracking-tight">MIND OS PREMIUM</div>
                  <div className="text-[9px] font-mono text-amber-400/60 uppercase tracking-widest">{t('settings.premiumFullAccess')}</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                {t('settings.premiumActive')}
              </span>
            </div>

            {/* Feature list */}
            <div className="space-y-2">
              {[
                "All character classes (Linguist, Warlord, etc.)",
                "Class change at any time via Class Recalibration",
                "Integrated Calendar & Pomodoro tools",
                "Priority support",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <span className="text-amber-400 text-[10px] font-bold">✦</span>
                  <span className="text-[11px] font-mono text-amber-100/80">{feat}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-amber-500/20" />

            {/* Manage button */}
            <div className="space-y-1.5">
              {isMobileApp() ? (
                <div className="w-full p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-center text-[10px]">
                  Manage billing at <strong>mindos.pages.dev</strong>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleManageSubscription}
                    disabled={isPortalLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-mono text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPortalLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isPortalLoading ? t('settings.openingPortal') : t('settings.manageSubscription')}
                  </button>
                  <p className="text-center text-[9px] font-mono text-muted-foreground/50">
                    {t('settings.cancelUpgradeBilling')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── FREE / UPGRADE CARD ── */
        <div className="relative overflow-hidden rounded-2xl border border-[var(--habit-purple)]/40 bg-gradient-to-br from-[#0e0a1a] to-[#08060f]">
          {/* Purple glow orbs */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Star className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-mono font-black text-sm text-white tracking-tight">Upgrade to <span className="text-amber-400">Premium</span></div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{t('settings.upgradeSubtitle')}</div>
              </div>
            </div>

            {/* Locked features */}
            <div className="space-y-2">
              {[
                { icon: Crown, text: "3 additional character classes" },
                { icon: RefreshCw, text: "Class change at any time" },
                { icon: Calendar, text: "Integrated Calendar & Pomodoro" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 opacity-70">
                  <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground line-through decoration-muted-foreground/40">{text}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Upgrade button */}
            <div className="space-y-1.5">
              {isMobileApp() ? (
                <div className="w-full p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-center text-[10px]">
                  Want Premium? Visit <strong>mindos.pages.dev</strong> on your browser to upgrade.
                </div>
              ) : (
                <>
                  <button
                    onClick={handleUpgrade}
                    disabled={isCheckoutLoading}
                    className="w-full relative group overflow-hidden rounded-xl font-mono font-black text-sm text-black disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 transition-all duration-300 group-hover:brightness-110" />
                    <div className="relative py-3 px-4 flex items-center justify-center gap-2">
                      {isCheckoutLoading ? (
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>✦ Upgrade — Premium</span>
                        </>
                      )}
                    </div>
                  </button>
                  <p className="text-center text-[9px] font-mono text-muted-foreground/50">
                    {t('settings.secureCheckout')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.accountInfo')}</span>
        </div>
        {user ? (
          <>
            <div className="space-y-2">
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">{t('settings.email')}:</span>{" "}
                <span className="text-foreground">{user.email}</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">{t('settings.userId')}:</span>{" "}
                <span className="text-foreground font-mono text-[10px]">{user.id}</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">{t('settings.role')}:</span>{" "}
                <span className="text-foreground capitalize">{user.role}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {t('settings.changePasswordDesc')}
            </p>
          </>
        ) : (
          <div className="text-xs text-muted-foreground font-mono">{t('settings.loading')}</div>
        )}
      </div>

      {/* Security */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.security')}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full py-2 rounded-lg border border-[var(--habit-border)] text-muted-foreground font-mono text-xs hover:bg-accent transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-3 h-3" /> {t('settings.logout')}
        </button>
      </div>

      {/* ── BROWSER EXTENSION ── */}
      <div className="flex items-center gap-2 mt-6 mb-3">
        <Puzzle className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Browser Extension</span>
      </div>
      <ExtensionPanel />

      {/* Danger Zone */}
      <div className="p-4 rounded-xl border border-red-700/30 bg-red-700/5 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span className="font-mono text-xs font-bold text-red-400">{t('settings.deleteAccount')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          {t('settings.deleteAccountDesc')}
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteInput(""); setDeleteStatus(null); }}
          className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs font-bold hover:bg-red-500/30 transition-colors"
        >
          {t('settings.deleteAccountBtn')}
        </button>
      </div>

      {/* ── PRIVACY SETTINGS ── */}
      <div className="flex items-center gap-2 mt-8 mb-4">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('privacy.title')}</span>
      </div>

      {/* Rival Visibility */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.rivalVisibility')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.rivalDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.visibleLabel')}</span>
          <button
            onClick={() => updatePrivacySetting("rival_visibility", !rivalVisibility)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              rivalVisibility
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-[var(--habit-border)]/40 text-muted-foreground"
            }`}
          >
            {rivalVisibility ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Anonymous Mode */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.anonMode')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.anonDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.anonLabel')}</span>
          <button
            onClick={() => updatePrivacySetting("anonymous_mode", !anonymousMode)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              anonymousMode
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-[var(--habit-border)]/40 text-muted-foreground"
            }`}
          >
            {anonymousMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Analytics */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.analytics')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.analyticsDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.analyticsLabel')}</span>
          <button
            onClick={() => {
              const nextConsent = !analyticsEnabled;
              if (profile) {
                updateProfile.mutate({ 
                  data: { analytics_enabled: nextConsent }
                });
              }
            }}
            disabled={updateProfile.isPending}
            className={`px-3 py-1.5 flex items-center justify-center min-w-[50px] text-xs font-mono rounded border transition-all ${
              analyticsEnabled
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-[var(--habit-border)]/40 text-muted-foreground"
            } ${updateProfile.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (analyticsEnabled ? "ON" : "OFF")}
          </button>
        </div>
      </div>

      {/* Data Usage */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)]">
        <div className="space-y-2 text-[10px] font-mono text-muted-foreground/70">
          <p>{t('privacy.dataCollected')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{t('privacy.dataTaskHistory')}</li>
            <li>{t('privacy.dataMetricProgress')}</li>
            <li>{t('privacy.dataSessionInfo')}</li>
            <li>{t('privacy.dataDeviceType')}</li>
          </ul>
          <p className="mt-3">{t('privacy.dataSecureInfo')}</p>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[9999] rounded-2xl p-5 space-y-4 max-w-sm mx-auto"
              style={{ background: "#1a1218", border: "1px solid rgba(239,68,68,0.4)" }}
            >
              {deleteStatus === "done" ? (
                <div className="text-center space-y-3 py-2">
                  <div className="text-2xl">✅</div>
                  <div className="font-mono text-xs text-green-400">{t('settings.deletionLogged')}</div>
                  <p className="text-[10px] text-muted-foreground/70">{t('settings.deletionPending')}</p>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-2 rounded-lg border border-[var(--habit-border)] font-mono text-xs text-muted-foreground hover:bg-accent transition-colors"
                  >
                    {t('settings.close')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="font-mono text-xs font-bold text-red-400">{t('settings.confirmDeletion')}</span>
                    </div>
                    <button onClick={() => setShowDeleteModal(false)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    {t('settings.confirmDeletionDesc')}
                  </p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={t('settings.typeDelete')}
                    className="w-full px-3 py-2.5 rounded-lg border border-red-500/30 bg-black/40 text-foreground font-mono text-sm focus:outline-none focus:border-red-500/60"
                    autoFocus
                  />
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteInput !== "DELETE" || deleteStatus === "pending"}
                    className="w-full py-2.5 rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-30"
                    style={{
                      background: deleteInput === "DELETE" ? "rgba(239,68,68,0.25)" : "transparent",
                      border: "1px solid rgba(239,68,68,0.5)",
                      color: "#ef4444",
                    }}
                  >
                    {deleteStatus === "pending" ? t('settings.processing') : t('settings.confirmDelete')}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
