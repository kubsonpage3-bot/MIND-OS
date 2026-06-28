import { useState, useEffect, useMemo } from "react";
import { ACHIEVEMENTS, loadRPGData } from "@/lib/rpgSystem";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { playSound } from "@/lib/soundEffects";

const CAT_LABELS = {
  consistency: "Consistency",
  combat: "Combat",
  knowledge: "Knowledge",
  wealth: "Wealth",
  spirit: "Spirit",
  skill: "Skill",
  allies: "Allies",
  prestige: "Prestige",
};

export default function AchievementsPanel({ logs, alliesData, prestigeData }) {
  const { achievements } = loadRPGData();
  const unlocked = achievements.unlocked || [];

  // Build stats for checking
  const stats = useMemo(() => {
    const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
    const streak = (() => { try { return JSON.parse(localStorage.getItem("mindos_streak") || "{}").streakCount || 0; } catch { return 0; } })();
    const uniqueSubjects = new Set(logs.map(l => l.activity)).size;
    const prayerSessions = logs.filter(l => l.activity === "prayer_meditation" || l.activity === "prayer").length;
    const totalCrits = gs.totalCrits || 0;
    const totalBossDamage = gs.totalBossDamage || 0;
    const bossesDefeated = gs.bossIndex || 0;
    const recruited = alliesData?.recruited || [];
    const allyLevels = alliesData?.levels || {};
    return {
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
      prestigeCount: prestigeData?.count || 0,
    };
  }, [logs, alliesData, prestigeData]);

  const byCategory = {};
  ACHIEVEMENTS.forEach(ach => {
    if (!byCategory[ach.cat]) byCategory[ach.cat] = [];
    byCategory[ach.cat].push(ach);
  });

  const [unlockedList, setUnlockedList] = useState(unlocked);

  useEffect(() => {
    const handleUpdate = () => {
      const rpg = loadRPGData();
      setUnlockedList(rpg.achievements.unlocked || []);
    };
    window.addEventListener("mindos-achievements-updated", handleUpdate);
    return () => window.removeEventListener("mindos-achievements-updated", handleUpdate);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        Achievements — {unlockedList.length}/{ACHIEVEMENTS.length} unlocked
      </div>

      {Object.entries(byCategory).map(([cat, achs]) => (
        <div key={cat} className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider pl-1">
            {CAT_LABELS[cat] || cat}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {achs.map(ach => {
              const isUnlocked = unlockedList.includes(ach.id);
              return (
                <div key={ach.id} className="p-2 rounded-xl border text-center transition-all"
                   style={{
                     borderColor: isUnlocked ? `${ach.color}60` : "#1e1a38",
                     background: isUnlocked ? `${ach.color}0d` : "#0a0818",
                     boxShadow: isUnlocked ? `0 0 6px ${ach.color}30` : "none",
                     filter: isUnlocked ? "none" : "grayscale(1) opacity(0.4)",
                   }}>
                  <div className="text-lg">{isUnlocked ? ach.icon : "🔒"}</div>
                  <div className="text-[9px] font-mono font-bold mt-1" style={{ color: isUnlocked ? ach.color : "#4a4060" }}>
                    {isUnlocked ? ach.name : "???"}
                  </div>
                  {isUnlocked && (
                    <div className="text-[8px] font-mono text-muted-foreground/40 mt-0.5 leading-tight">{ach.reward}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}