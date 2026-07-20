import PixelCharacter from "@/components/mindos/PixelCharacter";
import BossPanel from "@/components/mindos/BossPanel";
import { CLASSES } from "@/constants/rpgData";
import { getRankDisplayData } from "@/lib/rankEngine";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";

export default function CharacterHub({ rankXP, currentRankId, onBossDamage, externalDamage }) {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  const classData = {
    chosen: profile?.character_class !== "Wanderer" ? profile?.character_class : null,
    mana: profile?.mana || 0,
    maxMana: profile?.mana_max || 100
  };

  const userName = profile?.username || "Hero";
  const charHp = profile?.hp ?? 100;
  const charMaxHp = profile?.hp_max ?? 100;
  const charMana = profile?.mana ?? classData.mana;
  const charMaxMana = profile?.mana_max ?? classData.maxMana;

  const classInfo = classData.chosen ? CLASSES[classData.chosen] : null;
  const classColor = classInfo?.color || "#3b82f6";
  const rankInfo = getRankDisplayData(profile?.rank_info?.current_id || "E", profile);
  const rankId = currentRankId || rankInfo.id;

  const hpPct = Math.max(0, Math.min(100, charMaxHp > 0 ? (charHp / charMaxHp) * 100 : 0));
  const manaPct = Math.max(0, Math.min(100, charMaxMana > 0 ? (charMana / charMaxMana) * 100 : 0));
  const hpColor = "#ef4444"; // red like Habitica

  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      {/* Character portrait */}
      <div className="flex flex-col items-center py-6 px-4">
        <div className="w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center mb-3"
          style={{ background: `radial-gradient(circle at center, ${classColor}33 0%, transparent 70%)`, border: `2px solid ${classColor}44` }}>
          <PixelCharacter rankId={rankId} rankColor={classColor} size={100} hideLabel={true} />
        </div>
        <div style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 16, color: "var(--habit-text)" }}>{userName || "Hero"}</div>
        <div style={{ fontFamily: "'PixeloidSans'", fontSize: 9, color: "var(--habit-dim)", marginTop: 4 }}>LVL {rankId}</div>
        {(() => {
          const activeTitle = profile?.playstyle_info?.active_title || { id: "awakened_one", name: "Awakened One", icon: "✨", color: "#a855f7" };
          const translatedName = t(`titles.${activeTitle.id}.name`, activeTitle.name);
          return (
            <div
              className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border shadow-xs"
              style={{
                background: `${activeTitle.color}15`,
                borderColor: `${activeTitle.color}40`,
                color: activeTitle.color,
              }}
            >
              <span>{activeTitle.icon || "👑"}</span>
              <span>{translatedName}</span>
            </div>
          );
        })()}
      </div>

      {/* HP Bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: "#f74e52" }}>HP</span>
          <span style={{ fontFamily: "'PixeloidSans'", fontSize: 8, color: "var(--habit-dim)" }}>
            <AnimatedNumber value={Math.round(charHp)} />/{charMaxHp}
          </span>
        </div>
        <div className="habit-bar-track">
          <motion.div 
            className="habit-bar-fill-hp" 
            animate={{ width: `${hpPct}%` }} 
            transition={ANIM_CONFIG.springBar}
          />
        </div>
      </div>

      {/* MP Bar */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: classColor }}>MP</span>
          <span style={{ fontFamily: "'PixeloidSans'", fontSize: 8, color: "var(--habit-dim)" }}>
            <AnimatedNumber value={Math.round(charMana)} />/{charMaxMana}
          </span>
        </div>
        <div className="habit-bar-track">
          <motion.div 
            className="habit-bar-fill-mp" 
            animate={{ width: `${manaPct}%` }} 
            transition={ANIM_CONFIG.springBar}
            style={{ background: classColor, boxShadow: `0 0 8px ${classColor}66` }} 
          />
        </div>
      </div>

      {/* Boss Panel */}
      <div className="px-2 pb-3">
        <BossPanel currentScore={rankXP || 0} onBossDamage={onBossDamage} externalDamage={externalDamage} />
      </div>
    </div>
  );
}