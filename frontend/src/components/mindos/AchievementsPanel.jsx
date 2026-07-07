import { useState, useMemo } from "react";
import { ACHIEVEMENTS } from "@/constants/rpgData";
import { useTranslation } from "react-i18next";

export default function AchievementsPanel({ profile, logs, alliesData, prestigeData, onClaimReward }) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState("ALL");
  const [claiming, setClaiming] = useState(null);

  const unlocked = profile?.unlocked_achievements || [];

  // Build stats for checking
  const stats = useMemo(() => ({
    totalSessions: profile?.total_sessions || 0,
    maxStreak: profile?.streak_count || 0,
    alliesRecruited: profile?.allies_count || 0,
    totalGoldEarned: profile?.total_gold_earned || 0,
    prestigeCount: profile?.prestige_count || 0,
  }), [profile]);

  const byCategory = {};
  ACHIEVEMENTS.forEach(ach => {
    if (!byCategory[ach.cat]) byCategory[ach.cat] = [];
    byCategory[ach.cat].push(ach);
  });

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        {t('character.achievements_header', {
          unlocked: unlocked.length,
          total: ACHIEVEMENTS.length
        })}
      </div>

      {Object.entries(byCategory).map(([cat, achs]) => (
        <div key={cat} className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider pl-1">
            {t(`achievements_cats.${cat}`, cat)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {achs.map(ach => {
              const isUnlocked = unlocked.includes(ach.id);
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
                    {isUnlocked ? t(ach.name) : "???"}
                  </div>
                  {isUnlocked && (
                    <div className="text-[8px] font-mono text-muted-foreground/40 mt-0.5 leading-tight">{t(ach.reward)}</div>
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