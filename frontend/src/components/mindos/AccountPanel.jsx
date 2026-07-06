import { useState, useEffect } from "react";
import { User, Mail, LogOut, Trash2, Shield, AlertTriangle, X, Crown, ExternalLink, Star, Lock, Calendar, RefreshCw, Sparkles } from "lucide-react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useToast } from "@/components/ui/use-toast";
import { isMobileApp } from "@/utils/platformUtils";

export default function AccountPanel() {
  const { profile, logout } = useDjangoAuth();
  const { toast } = useToast();
  const [characterName, setCharacterName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null); // null | "pending" | "done"
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const user = profile?.user || null;
  const isPremium = !!profile?.is_premium;

  useEffect(() => {
    try {
      setCharacterName(localStorage.getItem("mindos_character_name") || "");
    } catch { }
  }, []);

  const updateCharacterName = (name) => {
    setCharacterName(name);
    localStorage.setItem("mindos_character_name", name);
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
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Account Settings</span>
      </div>

      {/* Character Profile */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Character Profile</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Your in-game character name</p>
        <input
          type="text"
          value={characterName}
          onChange={(e) => updateCharacterName(e.target.value)}
          placeholder="Enter character name"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm"
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
                  <div className="text-[9px] font-mono text-amber-400/60 uppercase tracking-widest">Full Access</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                ● ACTIVE
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
                    {isPortalLoading ? "Opening portal…" : "⚙ Manage Subscription"}
                  </button>
                  <p className="text-center text-[9px] font-mono text-muted-foreground/50">
                    Cancel, upgrade, or view billing history
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
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Unlock the full game</div>
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
                    Secure checkout via Stripe · Cancel anytime
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Account Information</span>
        </div>
        {user ? (
          <>
            <div className="space-y-2">
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="text-foreground">{user.email}</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">User ID:</span>{" "}
                <span className="text-foreground font-mono text-[10px]">{user.id}</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">Role:</span>{" "}
                <span className="text-foreground capitalize">{user.role}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              To change password or account details, use the profile settings.
            </p>
          </>
        ) : (
          <div className="text-xs text-muted-foreground font-mono">Loading...</div>
        )}
      </div>

      {/* Security */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Security</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs hover:bg-accent transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-3 h-3" /> Logout
        </button>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-xl border border-red-700/30 bg-red-700/5 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span className="font-mono text-xs font-bold text-red-400">Delete Account</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteInput(""); setDeleteStatus(null); }}
          className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs font-bold hover:bg-red-500/30 transition-colors"
        >
          DELETE ACCOUNT
        </button>
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
                  <div className="font-mono text-xs text-green-400">Deletion request logged.</div>
                  <p className="text-[10px] text-muted-foreground/70">Our team will process your request within 48 hours. You'll receive a confirmation email.</p>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="font-mono text-xs font-bold text-red-400">Confirm Deletion</span>
                    </div>
                    <button onClick={() => setShowDeleteModal(false)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    This will permanently delete your account and all game progress. Type <span className="text-red-400 font-bold font-mono">DELETE</span> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE"
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
                    {deleteStatus === "pending" ? "Processing..." : "CONFIRM DELETE"}
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
