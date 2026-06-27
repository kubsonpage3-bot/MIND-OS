import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_NOTIFY_TIME = "09:00";

function loadNotificationSettings() {
  try {
    return JSON.parse(localStorage.getItem("mindos_notifications") || "{}");
  } catch {
    return { enabled: false, time: DEFAULT_NOTIFY_TIME, rivalEnabled: true };
  }
}

function saveNotificationSettings(settings) {
  localStorage.setItem("mindos_notifications", JSON.stringify(settings));
}

// Request browser notification permission
async function requestPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "denied";
  }
}

function sendNotification(title, body, icon) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  new Notification(title, {
    body,
    icon: icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: "mindos-notification",
    requireInteraction: false,
  });
}

export default function NotificationPanel() {
  const [settings, setSettings] = useState(loadNotificationSettings);
  const [showModal, setShowModal] = useState(false);
  const [permStatus, setPermStatus] = useState("default");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if ("Notification" in window) {
      setPermStatus(Notification.permission);
    } else {
      setPermStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    let interval;
    if (settings.enabled) {
      interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const seconds = now.getSeconds();
        
        // Check time + only trigger once per minute at :00 seconds
        if (currentTime === settings.time && seconds === 0) {
          sendNotification(
            "⚡ MIND OS — Training Session",
            "Time to log your daily activity. Every session counts toward your rank.",
            "/favicon.ico"
          );
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [settings.enabled, settings.time]);

  const handleEnable = async () => {
    const perm = await requestPermission();
    setPermStatus(perm);
    if (perm === "granted") {
      setSettings({ ...settings, enabled: true });
      saveNotificationSettings({ ...settings, enabled: true });
      setToast({ type: "success", message: "Notifications enabled" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDisable = () => {
    setSettings({ ...settings, enabled: false });
    saveNotificationSettings({ ...settings, enabled: false });
    setToast({ type: "info", message: "Notifications disabled" });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTimeChange = (newTime) => {
    setSettings({ ...settings, time: newTime });
    saveNotificationSettings({ ...settings, time: newTime });
  };

  const handleRivalToggle = () => {
    const newVal = !settings.rivalEnabled;
    setSettings({ ...settings, rivalEnabled: newVal });
    saveNotificationSettings({ ...settings, rivalEnabled: newVal });
  };

  const handleTestNotification = () => {
    sendNotification(
      "🔔 MIND OS — Test Notification",
      "Your notification system is working. Time to train!",
      "/favicon.ico"
    );
    setToast({ type: "success", message: "Test notification sent" });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Notifications
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="text-[10px] font-mono text-primary hover:text-primary/80"
          >
            SETTINGS →
          </button>
        </div>

        <div className="p-3 rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2">
            {settings.enabled ? (
              <Bell className="w-4 h-4 text-primary" />
            ) : (
              <BellOff className="w-4 h-4 text-muted-foreground/40" />
            )}
            <div className="flex-1">
              <div className="text-xs font-semibold">
                {settings.enabled ? "Daily Reminder Active" : "Notifications Disabled"}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                {settings.enabled 
                  ? `⏰ ${settings.time} daily · Rival alerts: ${settings.rivalEnabled ? "ON" : "OFF"}`
                  : "Enable to receive daily training reminders"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold tracking-wider">NOTIFICATION SETTINGS</span>
              <button onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Permission status */}
            {permStatus === "unsupported" && (
              <div className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                ⚠ Your browser doesn't support notifications
              </div>
            )}
            {permStatus === "denied" && (
              <div className="text-xs text-amber-400 font-mono bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                ⚠ Notifications blocked — enable in browser settings
              </div>
            )}

            {/* Enable/Disable */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Daily Reminder</label>
              {settings.enabled ? (
                <button
                  onClick={handleDisable}
                  className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-xs font-mono hover:bg-red-500/10 transition-colors"
                >
                  DISABLE NOTIFICATIONS
                </button>
              ) : (
                <button
                  onClick={handleEnable}
                  disabled={permStatus === "unsupported" || permStatus === "denied"}
                  className="w-full py-2 rounded-lg border border-primary/40 text-primary text-xs font-mono hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ENABLE NOTIFICATIONS
                </button>
              )}
            </div>

            {/* Time picker */}
            {settings.enabled && (
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted-foreground uppercase">Reminder Time</label>
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-foreground font-mono text-sm"
                />
              </div>
            )}

            {/* Rival notifications */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">Rival Activity Alerts</div>
                  <div className="text-[10px] font-mono text-muted-foreground/60">
                    Get notified when JOHAN starts training
                  </div>
                </div>
                <button
                  onClick={handleRivalToggle}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings.rivalEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.rivalEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Test button */}
            {settings.enabled && (
              <button
                onClick={handleTestNotification}
                className="w-full py-2 rounded-lg border border-border text-xs font-mono hover:bg-accent transition-colors"
              >
                SEND TEST NOTIFICATION
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-16 right-4 z-50 px-4 py-2 rounded-lg border border-border bg-card shadow-lg text-xs font-mono"
          >
            {toast.type === "success" ? (
              <span className="text-green-400">✓ {toast.message}</span>
            ) : (
              <span className="text-muted-foreground">{toast.message}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}