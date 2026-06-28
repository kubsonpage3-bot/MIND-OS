import { useEffect } from "react";
import { ACHIEVEMENTS, loadRPGData } from "@/lib/rpgSystem";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { playSound } from "@/lib/soundEffects";

export default function AchievementTracker({ logs }) {
  useEffect(() => {
    const checkAchievements = () => {
      const rpgData = loadRPGData();
      const unlockedList = rpgData.achievements.unlocked || [];
      const alliesData = rpgData.alliesData || {};
      const prestigeData = rpgData.prestige || {};

      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      const streak = (() => { try { return JSON.parse(localStorage.getItem("mindos_streak") || "{}").streakCount || 0; } catch { return 0; } })();
      const uniqueSubjects = new Set(logs.map(l => l.activity)).size;
      const prayerSessions = logs.filter(l => l.activity === "prayer_meditation" || l.activity === "prayer").length;
      const totalCrits = gs.totalCrits || 0;
      const totalBossDamage = gs.totalBossDamage || 0;
      const bossesDefeated = gs.bossIndex || 0;
      const recruited = alliesData.recruited || [];
      const allyLevels = alliesData.levels || {};

      const stats = {
        totalSessions: logs.length,
        maxStreak: streak,
        uniqueSubjects,
        prayerSessions,
        totalCrits,
        totalBossDamage,
        bossesDefeated,
        alliesRecruited: recruited.length,
        allyMaxLevel: Math.max(0, ...Object.values(allyLevels)),
        totalGoldEarned: gs.totalGoldEarned || 0,
        highestSubjectRank: 0,
        prayerRank: 0,
        prestigeCount: prestigeData.count || 0,
      };

      let changed = false;
      const newUnlocked = [...unlockedList];

      ACHIEVEMENTS.forEach(ach => {
        if (!newUnlocked.includes(ach.id) && ach.check(stats)) {
          newUnlocked.push(ach.id);
          changed = true;
          showRewardToast({ label: `🏆 UNLOCKED: ${ach.name}` });
          playSound('success');
        }
      });

      if (changed) {
        rpgData.achievements.unlocked = newUnlocked;
        localStorage.setItem("mindos_achievements", JSON.stringify(rpgData.achievements));
        window.dispatchEvent(new CustomEvent("mindos-achievements-updated"));
      }
    };

    // Check periodically or when logs change
    checkAchievements();
    const interval = setInterval(checkAchievements, 5000);
    return () => clearInterval(interval);
  }, [logs]);

  return null;
}
