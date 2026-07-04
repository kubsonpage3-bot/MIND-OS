import { useState, useEffect } from "react";
import { User, Mail, LogOut, Trash2, Shield, AlertTriangle, X, Crown, ExternalLink } from "lucide-react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";

export default function AccountPanel() {
  const { profile, logout } = useDjangoAuth();
  const [characterName, setCharacterName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null); // null | "pending" | "done"

  const user = profile?.user || null;

  useEffect(() => {
    try {
      setCharacterName(localStorage.getItem("mindos_character_name") || "");
    } catch {}
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
    // Mock deletion request for now
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDeleteStatus("done");
  };

  const handleManageSubscription = async () => {
    try {
      const data = await djangoApi.billing.createPortalSession();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to open subscription portal.");
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

      {/* Subscription */}
      {profile?.is_premium && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono text-xs font-bold text-amber-500">Premium Subscription</span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 font-mono">
            You are currently subscribed to MIND OS Premium. Thank you for your support!
          </p>
          <button
            onClick={handleManageSubscription}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-500 font-mono text-[10px] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Manage Subscription
          </button>
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