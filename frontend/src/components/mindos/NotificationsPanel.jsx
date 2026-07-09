import { useState, useEffect } from "react";
import { Bell, Mail, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";

const NOTIFICATION_TYPES = [
  { id: "streak_risk", label: "Risk of losing streak", icon: "🔥", default: true },
  { id: "rival_overtook", label: "Rival overtook you", icon: "⚔️", default: true },
  { id: "boss_defeated", label: "Boss defeated", icon: "🎉", default: true },
  { id: "new_ally", label: "New ally unlocked", icon: "🤝", default: true },
  { id: "weekly_report", label: "Weekly report ready", icon: "📊", default: true },
];

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlB64ToUint8Array(base64String) {
  if (!base64String) return null;
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationsPanel() {
  const queryClient = useQueryClient();

  // 1. Fetch character profile which contains notification_preferences
  const { data: profile } = useQuery({
    queryKey: ["character"],
    queryFn: async () => {
      const res = await djangoApi.get("/profile/");
      return res.data;
    },
  });

  const [notifications, setNotifications] = useState({});
  const [reminderTime, setReminderTime] = useState("21:00");
  const [channel, setChannel] = useState("push");

  useEffect(() => {
    if (profile && profile.notification_preferences) {
      setNotifications(profile.notification_preferences);
      if (profile.notification_preferences.reminderTime) {
        setReminderTime(profile.notification_preferences.reminderTime);
      }
      if (profile.notification_preferences.channel) {
        setChannel(profile.notification_preferences.channel);
      }
    }
  }, [profile]);

  // Mutation to save preferences to the backend
  const updatePrefsMutation = useMutation({
    mutationFn: async (newPrefs) => {
      const res = await djangoApi.patch("/profile/", {
        notification_preferences: newPrefs,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character"] });
    },
    onError: (err) => {
      console.error("Failed to save notification preferences", err);
    }
  });

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications are not supported by the browser.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Push permission denied.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const applicationServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
        if (!applicationServerKey) {
          console.error("VITE_VAPID_PUBLIC_KEY is not defined in env.");
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }
      
      // Send subscription to backend
      const subJSON = subscription.toJSON();
      await djangoApi.post("/notifications/subscribe/", {
        endpoint: subJSON.endpoint,
        keys: subJSON.keys
      });
      console.log("Successfully subscribed to push notifications");
    } catch (err) {
      console.error("Failed to subscribe to push notifications", err);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const subJSON = subscription.toJSON();
        await djangoApi.post("/notifications/unsubscribe/", {
          endpoint: subJSON.endpoint
        });
        // We can optionally call subscription.unsubscribe() here to stop receiving them locally too,
        // but typically removing it from backend is sufficient and avoids needing to resubscribe later.
        // await subscription.unsubscribe();
      }
    } catch (err) {
      console.error("Failed to unsubscribe from push notifications", err);
    }
  };

  const updateNotification = async (typeId, enabled) => {
    const newNotifs = { ...notifications, [typeId]: enabled };
    setNotifications(newNotifs);
    // localStorage.setItem("mindos_notifications", JSON.stringify(newNotifs));
    updatePrefsMutation.mutate(newNotifs);

    // Handle real push subscriptions when enabling/disabling streak_risk
    // For now, any enabled push can trigger subscribeToPush to ensure the browser has permission.
    if (enabled) {
      await subscribeToPush();
    } else if (typeId === "streak_risk") {
      await unsubscribeFromPush();
    }
  };

  const updateReminderTime = (time) => {
    setReminderTime(time);
    const newNotifs = { ...notifications, reminderTime: time };
    setNotifications(newNotifs);
    updatePrefsMutation.mutate(newNotifs);
  };

  const updateChannel = (newChannel) => {
    setChannel(newChannel);
    const newNotifs = { ...notifications, channel: newChannel };
    setNotifications(newNotifs);
    updatePrefsMutation.mutate(newNotifs);
  };

  const toggleAll = (enable) => {
    const newNotifs = {};
    NOTIFICATION_TYPES.forEach(t => { newNotifs[t.id] = enable; });
    setNotifications(newNotifs);
    updatePrefsMutation.mutate(newNotifs);
    
    if (enable) {
      subscribeToPush();
    } else {
      unsubscribeFromPush();
    }
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