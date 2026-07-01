import { useState } from "react";
import { Bell, Mail, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const NOTIFICATION_TYPES = [
  { id: "streak_risk", label: "Risk of losing streak", icon: "🔥", default: true },
  { id: "rival_overtook", label: "Rival overtook you", icon: "⚔️", default: true },
  { id: "boss_ready", label: "Boss ready to fight", icon: "👹", default: true },
  { id: "boss_defeated", label: "Boss defeated", icon: "🎉", default: true },
  { id: "new_ally", label: "New ally unlocked", icon: "🤝", default: true },
  { id: "rank_up", label: "Rank promotion", icon: "⬆️", default: true },
  { id: "weekly_report", label: "Weekly report ready", icon: "📊", default: true },
];

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_notifications") || "{}");
    } catch {
      return {};
    }
  });

  const [reminderTime, setReminderTime] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_reminders") || "{}").time || "21:00";
    } catch {
      return "21:00";
    }
  });

  const [channel, setChannel] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_notifications") || "{}").channel || "push";
    } catch {
      return "push";
    }
  });

  const updateNotification = (typeId, enabled) => {
    const newNotifs = { ...notifications, [typeId]: enabled };
    setNotifications(newNotifs);
    localStorage.setItem("mindos_notifications", JSON.stringify(newNotifs));
  };

  const updateReminderTime = (time) => {
    setReminderTime(time);
    const current = JSON.parse(localStorage.getItem("mindos_reminders") || "{}");
    localStorage.setItem("mindos_reminders", JSON.stringify({ ...current, time }));
  };

  const updateChannel = (newChannel) => {
    setChannel(newChannel);
    const current = JSON.parse(localStorage.getItem("mindos_notifications") || "{}");
    localStorage.setItem("mindos_notifications", JSON.stringify({ ...current, channel: newChannel }));
  };

  const toggleAll = (enable) => {
    const newNotifs = {};
    NOTIFICATION_TYPES.forEach(t => { newNotifs[t.id] = enable; });
    setNotifications(newNotifs);
    localStorage.setItem("mindos_notifications", JSON.stringify(newNotifs));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Notification Center</span>
      </div>

      {/* Daily Reminder Time */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Daily Reminder Time</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Receive a daily reminder to complete your tasks</p>
        <input
          type="time"
          value={reminderTime}
          onChange={(e) => updateReminderTime(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm"
        />
      </div>

      {/* Notification Channel */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Notification Channel</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Choose how you want to receive notifications</p>
        <div className="flex gap-1">
          {[
            { id: "push", label: "Push", icon: "📱" },
            { id: "email", label: "Email", icon: "✉️" },
            { id: "none", label: "None", icon: "🔕" },
          ].map(ch => (
            <button
              key={ch.id}
              onClick={() => updateChannel(ch.id)}
              className={`flex-1 py-2 text-xs font-mono rounded border transition-all ${
                channel === ch.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              <span className="mr-1">{ch.icon}</span>{ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Toggles */}
      <div className="flex gap-2">
        <button
          onClick={() => toggleAll(true)}
          className="flex-1 py-2 rounded-lg border border-primary/40 text-primary font-mono text-xs hover:bg-primary/10 transition-colors"
        >
          Enable All
        </button>
        <button
          onClick={() => toggleAll(false)}
          className="flex-1 py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs hover:bg-accent transition-colors"
        >
          Disable All
        </button>
      </div>

      {/* Individual Notifications */}
      <div className="space-y-2">
        {NOTIFICATION_TYPES.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between p-3 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{notif.icon}</span>
              <div>
                <div className="font-mono text-xs text-foreground">{notif.label}</div>
              </div>
            </div>
            <button
              onClick={() => updateNotification(notif.id, !notifications[notif.id])}
              className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
                notifications[notif.id] !== false
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              {notifications[notif.id] !== false ? "ON" : "OFF"}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}