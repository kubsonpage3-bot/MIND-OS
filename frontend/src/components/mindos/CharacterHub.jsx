import PixelCharacter from "@/components/mindos/PixelCharacter";
import BossPanel from "@/components/mindos/BossPanel";
import { CLASSES } from "@/lib/rpgSystem";
import { getRankFromXP } from "@/lib/rankEngine";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function CharacterHub({ rankXP, currentRankId, onBossDamage, externalDamage }) {
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
  const rankInfo = getRankFromXP(rankXP || 0);
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
          <PixelCharacter rankId={rankId} rankColor={classColor} size={100} />
        </div>
        <div style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 16, color: "var(--habit-text)" }}>{userName || "Hero"}</div>
        <div style={{ fontFamily: "'Pixeltype'", fontSize: 9, color: "var(--habit-dim)", marginTop: 4 }}>LVL {rankId}</div>
      </div>

      {/* HP Bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: "#f74e52" }}>HP</span>
          <span style={{ fontFamily: "'Pixeltype'", fontSize: 8, color: "var(--habit-dim)" }}>{Math.round(charHp)}/{charMaxHp}</span>
        </div>
        <div className="habit-bar-track">
          <div className="habit-bar-fill-hp" style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {/* MP Bar */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: classColor }}>MP</span>
          <span style={{ fontFamily: "'Pixeltype'", fontSize: 8, color: "var(--habit-dim)" }}>{Math.round(charMana)}/{charMaxMana}</span>
        </div>
        <div className="habit-bar-track">
          <div className="habit-bar-fill-mp" style={{ width: `${manaPct}%`, background: classColor, boxShadow: `0 0 8px ${classColor}66` }} />
        </div>
      </div>

      {/* Boss Panel */}
      <div className="px-2 pb-3">
        <BossPanel currentScore={rankXP || 0} onBossDamage={onBossDamage} externalDamage={externalDamage} />
      </div>
    </div>
  );
}