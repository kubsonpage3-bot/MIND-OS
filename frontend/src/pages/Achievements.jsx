import { useState } from "react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { ACHIEVEMENTS } from "@/constants/rpgData";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

function replaceBossNames(text, t) {
  if (!text) return text;
  return text
    .replace("Crimson Sovereign", t("bosses.crimson_sovereign", "Crimson Sovereign"))
    .replace("Void Emperor", t("bosses.void_emperor", "Void Emperor"));
}

const CAT_LABELS = {
  consistency: { label: "Consistency", icon: "🔥", color: "#f59e0b" },
  combat: { label: "Combat", icon: "⚔️", color: "#ef4444" },
  knowledge: { label: "Knowledge", icon: "📚", color: "#3b82f6" },
  wealth: { label: "Wealth", icon: "💰", color: "#f0c040" },
  spirit: { label: "Spirit", icon: "✨", color: "#9944ff" },
  skill: { label: "Skill", icon: "🎯", color: "#00e5ff" },
  allies: { label: "Allies", icon: "🤝", color: "#00cc88" },
  prestige: { label: "Prestige", icon: "👑", color: "#ffd700" },
};

const BOSS_MEDALS = [
  { id: "void", name: "THE VOID", color: "#00e5ff", glow: "#00e5ff40", medal: "🔵", desc: "Slayer of The Void", index: 0 },
  { id: "static", name: "COGNITIVE STATIC", color: "#ff2222", glow: "#ff222240", medal: "🔴", desc: "Overcomer of Static", index: 1 },
  { id: "algorithm", name: "THE ALGORITHM", color: "#00ff88", glow: "#00ff8840", medal: "🟢", desc: "Master of The Algorithm", index: 2 },
  { id: "parasite", name: "MEMETIC PARASITE", color: "#aa00ff", glow: "#aa00ff40", medal: "🟣", desc: "Vanquisher of Parasites", index: 3 },
  { id: "recursive", name: "THE RECURSIVE", color: "#3b82f6", glow: "#3b82f640", medal: "💎", desc: "Conqueror of Infinity", index: 4 },
];

function BossMedalCard({ boss, defeated }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all"
      style={{
        borderColor: defeated ? `${boss.color}60` : "#1e1a38",
        background: defeated ? `${boss.color}0a` : "#0a0818",
        boxShadow: defeated ? `0 0 20px ${boss.color}30, inset 0 0 20px ${boss.color}08` : "none",
      }}
    >
      <motion.div
        animate={defeated ? {
          filter: [`drop-shadow(0 0 6px ${boss.color})`, `drop-shadow(0 0 16px ${boss.color})`, `drop-shadow(0 0 6px ${boss.color})`],
        } : {}}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="text-4xl"
        style={{ filter: defeated ? undefined : "grayscale(1) opacity(0.3)" }}
      >
        {defeated ? boss.medal : "🔒"}
      </motion.div>
      <div className="text-center">
        <div className="font-mono text-[10px] font-black tracking-wider" style={{ color: defeated ? boss.color : "#4a4060" }}>
          {t(`bosses.${boss.id}`, boss.name)}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 italic">{defeated ? replaceBossNames(boss.desc, t) : "???"}</div>
      </div>
      {defeated && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
          style={{ background: boss.color, boxShadow: `0 0 8px ${boss.color}` }}
        >✓</motion.div>
      )}
    </motion.div>
  );
}

function AchievementCard({ ach, isUnlocked }) {
  const { t } = useTranslation();
  const [showTip, setShowTip] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={isUnlocked ? { scale: 1.04 } : {}}
      className="relative p-3 rounded-xl border text-center cursor-pointer transition-all"
      style={{
        borderColor: isUnlocked ? `${ach.color}60` : "#1e1a38",
        background: isUnlocked ? `${ach.color}0d` : "#0a0818",
        boxShadow: isUnlocked ? `0 0 10px ${ach.color}30` : "none",
        filter: isUnlocked ? "none" : "grayscale(1) opacity(0.4)",
      }}
      onClick={() => setShowTip(!showTip)}
    >
      <motion.div
        animate={isUnlocked ? { y: [0, -2, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, delay: Math.random() * 2 }}
        className="text-2xl mb-1"
      >
        {isUnlocked ? ach.icon : "🔒"}
      </motion.div>
      <div className="text-[9px] font-mono font-bold" style={{ color: isUnlocked ? ach.color : "#4a4060" }}>
        {isUnlocked ? ach.name : "???"}
      </div>
      {isUnlocked && showTip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 w-36 p-2 rounded-lg border border-border bg-card text-left shadow-xl"
        >
          <div className="text-[9px] font-mono text-foreground/70 leading-snug">{replaceBossNames(ach.desc, t)}</div>
          <div className="text-[9px] font-mono mt-1" style={{ color: ach.color }}>{ach.reward}</div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Achievements() {
  const { profile } = useDjangoAuth();
  
  const unlockedList = profile?.unlocked_achievements || [];
  const bossIndex = profile?.boss_difficulty || 0;
  const totalUnlocked = unlockedList.length;

  return (
    <div className="min-h-screen bg-background text-foreground font-inter">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="font-mono text-sm font-bold tracking-wider">ACHIEVEMENTS</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground/50">{totalUnlocked}/{ACHIEVEMENTS.length}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
            <span>TOTAL PROGRESS</span>
            <span>{Math.round((totalUnlocked / ACHIEVEMENTS.length) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totalUnlocked / ACHIEVEMENTS.length) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ background: "linear-gradient(90deg, #3b82f6, #9944ff, #f0c040)", boxShadow: "0 0 8px #9944ff80" }}
            />
          </div>
        </div>

        {/* Boss medals */}
        <div className="space-y-3">
          <div className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest flex items-center gap-2">
            <span>⚔️</span> Boss Medals
          </div>
          <div className="grid grid-cols-5 gap-2">
            {BOSS_MEDALS.map(boss => (
              <BossMedalCard key={boss.id} boss={boss} defeated={bossIndex > boss.index} />
            ))}
          </div>
        </div>

        {/* Achievement categories */}
        {Object.entries(CAT_LABELS).map(([cat, info]) => {
          const catAchs = ACHIEVEMENTS.filter(a => a.cat === cat);
          if (catAchs.length === 0) return null;
          const catUnlocked = catAchs.filter(a => unlockedList.includes(a.id)).length;
          return (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{info.icon}</span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: info.color }}>
                  {info.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/30 ml-auto">{catUnlocked}/{catAchs.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {catAchs.map((ach) => {
                  const isUnlocked = unlockedList.includes(ach.id);
                  return <AchievementCard key={ach.id} ach={ach} isUnlocked={isUnlocked} />;
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}