import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SCROLLS, SCROLL_BOSS_IMAGES, applyDamageToActiveScroll } from "./ScrollsPanel";
import { playSound } from "@/lib/soundEffects.js";
import ParticleStrike from "./ParticleStrike";

function loadScrollState() {
  try { return JSON.parse(localStorage.getItem("mindos_scrolls") || "{}"); } catch { return {}; }
}

function getPwrMultiplier() {
  try {
    const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
    const basePwr = gs.stats?.pwr || 5;
    const equipped = gs.equipped || {};
    let bonusPwr = 0;
    Object.values(equipped).forEach(item => { if (item?.stats?.pwr) bonusPwr += item.stats.pwr; });
    return 1 + ((basePwr + bonusPwr) - 5) * 0.02;
  } catch { return 1; }
}

export default function BossPanel({ externalDamage, currentScore, onBossDamage }) {
  const [scrollState, setScrollState] = useState(loadScrollState);
  const [damageFloat, setDamageFloat] = useState(null);
  const [isCritical, setIsCritical] = useState(false);
  const [flash, setFlash] = useState(false);
  const [attackAnim, setAttackAnim] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null); // { id, intensity, color }
  const [open, setOpen] = useState(true);

  // Poll to sync with ScrollsPanel changes
  useEffect(() => {
    const interval = setInterval(() => setScrollState(loadScrollState()), 1500);
    return () => clearInterval(interval);
  }, []);

  const dealDamage = useCallback((amount, critical = false) => {
    const activeScroll = SCROLLS.find(s => {
      const st = loadScrollState();
      return st[s.id]?.active && !st[s.id]?.defeated;
    });
    if (!activeScroll) return;

    // Sound effects
    if (critical) {
      playSound('boss_critical');
    } else {
      playSound('boss_hit');
    }

    setIsCritical(critical);
    setFlash(true);
    setAttackAnim(true);
    setParticleTrigger({ id: Date.now(), intensity: critical ? "critical" : "heavy", color });
    setTimeout(() => setFlash(false), critical ? 600 : 300);
    setTimeout(() => setAttackAnim(false), 700);
    setTimeout(() => setParticleTrigger(null), 1000);

    const pwrMult = getPwrMultiplier();
    const finalDmg = Math.round(critical ? amount * 2 * pwrMult : amount * pwrMult);
    setDamageFloat({ value: finalDmg, critical, id: Date.now() });
    setTimeout(() => setDamageFloat(null), critical ? 1800 : 1000);

    applyDamageToActiveScroll(finalDmg, false);
    setScrollState(loadScrollState());
  }, []);

  // Handle external damage from session log / tasks
  useEffect(() => {
    if (!externalDamage) return;
    dealDamage(externalDamage.amount, externalDamage.isCritical);
  }, [externalDamage, dealDamage]);

  const activeScroll = SCROLLS.find(s => scrollState[s.id]?.active && !scrollState[s.id]?.defeated);

  // No active scroll = no boss panel
  if (!activeScroll) return null;

  const color = activeScroll.color;
  const bossHP = scrollState[activeScroll.id]?.bossHP ?? activeScroll.bossHP;
  const hpPercent = Math.max(0, (bossHP / activeScroll.bossHP) * 100);
  const imgUrl = SCROLL_BOSS_IMAGES[activeScroll.id] || SCROLL_BOSS_IMAGES.misted_wanderer;

  return (
    <>
      {/* Particle strike effect */}
      <AnimatePresence>
        {particleTrigger && (
          <ParticleStrike
            key={particleTrigger.id}
            triggerKey={particleTrigger.id}
            color={color}
            intensity={particleTrigger.intensity}
          />
        )}
      </AnimatePresence>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}40` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{open ? "▾" : "▸"} SCROLL BOSS — <span className="text-red-400">ACTIVE</span></span>
        <span style={{ color }}>{activeScroll.boss}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex flex-col items-center gap-3 relative">
            {/* Attack animation */}
            <AnimatePresence>
              {attackAnim && (
                <motion.div
                  initial={{ x: -120, opacity: 0, scale: 0.7 }}
                  animate={{ x: isCritical ? [-120, 40, 20] : [-120, 20, 10], opacity: [0, 1, 0], scale: [0.7, 1.1, 0.8] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute left-4 z-20 pointer-events-none"
                  style={{ top: "30%" }}
                >
                  <motion.div
                    animate={{ rotate: isCritical ? [-30, 60, 30] : [-20, 40, 0] }}
                    transition={{ duration: 0.5 }}
                    className="font-mono text-4xl"
                    style={{ textShadow: isCritical ? "0 0 20px #00e5ff, 0 0 40px #00e5ff" : "0 0 10px #fff" }}
                  >
                    {isCritical ? "⚡" : "⚔️"}
                  </motion.div>
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0.8 }}
                    animate={{ scaleX: 1, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute top-1/2 left-0 h-1 rounded-full"
                    style={{ width: 80, background: isCritical ? "linear-gradient(90deg, #00e5ff, transparent)" : "linear-gradient(90deg, #ffffff, transparent)", transformOrigin: "left" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Boss sprite */}
            <motion.div
              className="relative"
              animate={flash ? {
                x: isCritical ? [-8, 8, -6, 6, -4, 4, 0] : [-4, 4, -2, 2, 0],
                filter: isCritical
                  ? [`drop-shadow(0 0 30px ${color}) brightness(1.5)`, `drop-shadow(0 0 8px ${color}40) brightness(1)`]
                  : [`drop-shadow(0 0 18px ${color}) brightness(1.3)`, `drop-shadow(0 0 8px ${color}40) brightness(1)`],
              } : { filter: `drop-shadow(0 0 8px ${color}40)` }}
              transition={{ duration: flash ? (isCritical ? 0.5 : 0.25) : 0.2 }}
            >
              <AnimatePresence>
                {flash && isCritical && (
                  <motion.div
                    initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-40 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at center, ${color}40 0%, transparent 70%)` }}
                  />
                )}
              </AnimatePresence>
              <img
                src={imgUrl}
                alt={activeScroll.boss}
                className="rounded-xl object-cover"
                style={{ width: 180, height: 220, imageRendering: "pixelated", filter: `drop-shadow(0 0 16px ${color}80)` }}
              />
              {/* Damage float */}
              <AnimatePresence>
                {damageFloat && (
                  <motion.div
                    key={damageFloat.id}
                    initial={{ opacity: 1, y: 0, scale: damageFloat.critical ? 1.4 : 1 }}
                    animate={{ opacity: 0, y: -70, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: damageFloat.critical ? 1.8 : 1.0, ease: "easeOut" }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 font-mono font-black pointer-events-none text-center"
                    style={{
                      color: damageFloat.critical ? "#00e5ff" : "#ffffff",
                      fontSize: damageFloat.critical ? "26px" : "18px",
                      textShadow: damageFloat.critical ? "0 0 20px #00e5ff, 0 0 40px #00e5ff" : "0 0 10px #fff",
                    }}
                  >
                    {damageFloat.critical && (
                      <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1, opacity: 1 }}
                        className="text-[11px] text-cyan-300 tracking-widest font-black mb-0.5"
                        style={{ textShadow: "0 0 10px #00e5ff" }}
                      >⚡ CRITICAL ⚡</motion.div>
                    )}
                    {damageFloat.value > 0 ? '-' : '+'}{Math.abs(damageFloat.value)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* HP bar */}
            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span style={{ color }}>{activeScroll.boss}</span>
                <span className="text-muted-foreground">HP: {bossHP.toLocaleString()}/{activeScroll.bossHP.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${hpPercent}%`, background: `linear-gradient(90deg, #991b1b, ${color})` }} />
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 italic">{activeScroll.name}</div>
              <div className="text-[10px] font-mono text-yellow-400/70">
                Reward: +{Math.round(activeScroll.reward.gold).toLocaleString()}G · +{activeScroll.reward.sp}SP · {activeScroll.uniqueItem.label}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}