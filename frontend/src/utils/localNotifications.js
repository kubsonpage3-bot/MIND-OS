import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const LocalNotificationsService = {
  // Request permission
  async requestPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.requestPermissions();
        return status.display; // 'granted', 'denied', or 'prompt'
      } catch (err) {
        console.error("Failed to request native local notification permission:", err);
        return 'denied';
      }
    } else {
      if (!("Notification" in window)) return "unsupported";
      if (Notification.permission === "granted") return "granted";
      try {
        return await Notification.requestPermission();
      } catch {
        return "denied";
      }
    }
  },

  // Check permission status
  async getPermissionStatus() {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.checkPermissions();
        return status.display;
      } catch {
        return 'denied';
      }
    } else {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission;
    }
  },

  // Send immediate local notification
  async sendInstant(title, body) {
    const isGranted = (await this.getPermissionStatus()) === 'granted';
    if (!isGranted) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title,
              body,
              smallIcon: 'res://ic_stat_notify', // Android notification icon
              schedule: {
                allowWhileIdle: true
              }
            }
          ]
        });
      } catch (err) {
        console.error("Failed to send native local notification:", err);
      }
    } else {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  },

  // Schedule a daily reminder
  async scheduleDailyReminder(hour, minute) {
    const isGranted = (await this.getPermissionStatus()) === 'granted';
    if (!isGranted) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await this.cancelNotification(1001); // Cancel existing daily reminder

        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1001,
              title: "⚡ MIND OS — Training Session",
              body: "Time to log your daily activity. Every session counts toward your rank.",
              schedule: {
                on: {
                  hour: parseInt(hour, 10),
                  minute: parseInt(minute, 10)
                },
                repeats: true,
                allowWhileIdle: true
              },
              smallIcon: 'res://ic_stat_notify'
            }
          ]
        });
      } catch (err) {
        console.error("Failed to schedule native daily reminder:", err);
      }
    } else {
      console.log(`PWA fallback: Daily reminder scheduled at ${hour}:${minute} (active tab only)`);
    }
  },

  // Schedule streak warning at 21:00 if no task is completed today
  async scheduleStreakWarning(hour, minute, enabled) {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.cancelNotification(1002); // Cancel existing warning

        if (!enabled) return;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1002,
              title: "Streak at Risk! ⚠️",
              body: "You haven't logged any activity today. Complete a task before midnight to preserve your streak!",
              schedule: {
                on: {
                  hour: parseInt(hour, 10),
                  minute: parseInt(minute, 10)
                },
                repeats: true,
                allowWhileIdle: true
              },
              smallIcon: 'res://ic_stat_notify'
            }
          ]
        });
      } catch (err) {
        console.error("Failed to schedule native streak warning:", err);
      }
    } else {
      console.log(`PWA fallback: Streak warning scheduled at ${hour}:${minute} (active tab only)`);
    }
  },

  // Cancel scheduled notification by ID
  async cancelNotification(id) {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id }]
        });
      } catch (err) {
        console.error(`Failed to cancel native notification ${id}:`, err);
      }
    }
  }
};
