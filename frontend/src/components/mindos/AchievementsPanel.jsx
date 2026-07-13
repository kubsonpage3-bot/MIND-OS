import { useState, useMemo } from "react";
import { ACHIEVEMENTS } from "@/constants/rpgData";
import { useTranslation } from "react-i18next";

const RARITY_STYLES = {
  common: { color: "#9CA3AF", glowStrength: "10px", glowOpacity: "30", borderOpacity: "60", bgOpacity: "10" },
  uncommon: { color: "#4ADE80", glowStrength: "15px", glowOpacity: "40", borderOpacity: "70", bgOpacity: "15" },
  rare: { color: "#60A5FA", glowStrength: "20px", glowOpacity: "50", borderOpacity: "80", bgOpacity: "15" },
  epic: { color: "#A78BFA", glowStrength: "25px", glowOpacity: "60", borderOpacity: "90", bgOpacity: "20" },
  legendary: { color: "#FBBF24", glowStrength: "35px", glowOpacity: "80", borderOpacity: "ff", bgOpacity: "25" }
};

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
              const rarityStyle = RARITY_STYLES[ach.rarity || "common"];
              const rColor = rarityStyle.color;

              return (
                <div 
                   key={ach.id} 
                   className={`p-2 rounded-xl border text-center transition-all relative overflow-hidden flex flex-col items-center justify-center min-h-[90px] ${isUnlocked && ach.rarity === 'legendary' ? 'legendary-shimmer-effect' : ''}`}
                   style={{
                     borderColor: isUnlocked ? `${rColor}${rarityStyle.borderOpacity}` : "#1e1a38",
                     background: isUnlocked ? `${rColor}${rarityStyle.bgOpacity}` : "#0a0818",
                     boxShadow: isUnlocked ? `0 0 ${rarityStyle.glowStrength} ${rColor}${rarityStyle.glowOpacity}, inset 0 0 12px ${rColor}${rarityStyle.bgOpacity}` : "none",
                   }}>
                  
                  {isUnlocked && (
                    <div 
                      className="absolute top-1 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold px-1.5 py-0.5 rounded border leading-none whitespace-nowrap z-10"
                      style={{ color: rColor, borderColor: `${rColor}60`, backgroundColor: `${rColor}20`, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                    >
                      {(ach.rarity || "common").toUpperCase()}
                    </div>
                  )}

                  <div 
                    className={`transition-all z-10 relative ${isUnlocked ? 'text-3xl mt-3' : 'text-xl grayscale mt-1 opacity-60'}`}
                    style={{ 
                      filter: isUnlocked ? `drop-shadow(0 0 6px ${rColor}90)` : `drop-shadow(0 0 3px ${rColor}80)`,
                    }}
                  >
                    {isUnlocked ? ach.icon : "🔒"}
                  </div>
                  
                  <div 
                    className="text-[9px] font-mono font-bold mt-2 leading-tight z-10 relative" 
                    style={{ color: isUnlocked ? rColor : "#4a4060", textShadow: isUnlocked ? "0 1px 2px rgba(0,0,0,0.8)" : "none" }}
                  >
                    {isUnlocked ? t(`rpgData.achievements.${ach.id}.name`, ach.name) : "???"}
                  </div>
                  
                  {isUnlocked && (
                    <div 
                      className="text-[8px] font-mono font-bold mt-1 z-10 relative"
                      style={{ color: rColor, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                    >
                      {t(`rpgData.achievements.${ach.id}.reward`, ach.reward)}
                    </div>
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