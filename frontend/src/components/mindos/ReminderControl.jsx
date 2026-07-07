import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const DEFAULT_REMINDER_HOUR = 14; // 2 PM default

function loadReminderSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem("mindos_reminder_settings") || "{}");
    return {
      enabled: settings.enabled !== false,
      hour: settings.hour ?? DEFAULT_REMINDER_HOUR,
      notifiedToday: false,
    };
  } catch {
    return { enabled: true, hour: DEFAULT_REMINDER_HOUR, notifiedToday: false };
  }
}

function saveReminderSettings(settings) {
  localStorage.setItem("mindos_reminder_settings", JSON.stringify(settings));
}

function setNotifiedToday() {
  const key = "reminder_notified_" + new Date().toDateString();
  localStorage.setItem(key, "true");
}

function wasNotifiedToday() {
  const key = "reminder_notified_" + new Date().toDateString();
  return localStorage.getItem(key) === "true";
}

export default function ReminderControl() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadReminderSettings);
  const [permission, setPermission] = useState("default");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check and send daily reminder
  useEffect(() => {
    if (!settings.enabled || !("Notification" in window)) return;
    if (wasNotifiedToday()) return;

    const checkTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      // Trigger at configured hour (once per day)
      if (currentHour === settings.hour && currentMin === 0) {
        if (Notification.permission === "granted") {
          new Notification("⚡ Time to Train!", {
            body: "Your daily cognitive session awaits. JOHAN is already training.",
            icon: "/images/webp/993830219_generated_image.webp",
            tag: "daily-reminder",
          });
          setNotifiedToday();
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(perm => {
            if (perm === "granted" && !wasNotifiedToday()) {
              new Notification("⚡ Time to Train!", {
                body: "Your daily cognitive session awaits. JOHAN is already training.",
                icon: "/images/webp/993830219_generated_image.webp",
                tag: "daily-reminder",
              });
              setNotifiedToday();
              setShowToast(true);
              setTimeout(() => setShowToast(false), 4000);
            }
          });
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [settings.enabled, settings.hour]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
  };

  const toggleEnabled = () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
    saveReminderSettings(newSettings);
  };

  const updateHour = (newHour) => {
    const newSettings = { ...settings, hour: newHour };
    setSettings(newSettings);
    saveReminderSettings(newSettings);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.enabled ? (
              <Bell className="w-4 h-4 text-primary" />
            ) : (
              <BellOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs font-mono font-bold">{t('reminder.dailyReminder')}</span>
          </div>
          <button
            onClick={toggleEnabled}
            className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
              settings.enabled
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:border-border/80"
            }`}
          >
            {settings.enabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono text-muted-foreground">{t('reminder.reminderTime')}</label>
          <select
            value={settings.hour}
            onChange={(e) => updateHour(parseInt(e.target.value))}
            className="text-xs font-mono bg-muted/40 border border-border rounded px-2 py-1"
            disabled={!settings.enabled}
          >
            {Array.from({ length: 24 }, (_, i) => i).map(h => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>

        {permission === "denied" && (
          <div className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
            ⚠ Notifications blocked. Enable in browser settings.
          </div>
        )}

        {permission !== "granted" && permission !== "denied" && (
          <button
            onClick={requestPermission}
            className="w-full py-1.5 text-[10px] font-mono rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
          >{t('reminder.enableBtn')}</button>
        )}

        {permission === "granted" && settings.enabled && (
          <div className="text-[9px] font-mono text-muted-foreground/50 text-center">
            ✓ Notifications active · Daily alert at {String(settings.hour).padStart(2, "0")}:00
          </div>
        )}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border border-primary/40 bg-card shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono">{t('reminder.setFor')} {String(settings.hour).padStart(2, "0")}:00</span>
          </div>
        </div>
      )}
    </>
  );
}