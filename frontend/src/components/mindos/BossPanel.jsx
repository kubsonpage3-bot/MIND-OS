import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { SCROLLS, SCROLL_BOSS_IMAGES } from "./ScrollsPanel";
import { playSound } from "@/lib/soundEffects.js";
import ParticleStrike from "./ParticleStrike";
import OptimizedImage from "./OptimizedImage";

import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function BossPanel({ externalDamage, currentScore, onBossDamage }) {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  const [damageFloat, setDamageFloat] = useState(null);
  const [isCritical, setIsCritical] = useState(false);
  const [flash, setFlash] = useState(false);
  const [attackAnim, setAttackAnim] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null); // { id, intensity, color }
  const [open, setOpen] = useState(true);
  const [displayHP, setDisplayHP] = useState(0);
  const [idleDamageFloats, setIdleDamageFloats] = useState([]);
  const bossSpriteControls = useAnimation();


  // Preserve initial drain state across React Query refetches
  const initialDrainRef = useRef({
    active: false,
    preDamageHP: 0,
    serverHP: 0,
  });

  // 1. Подписываемся на энкаунтеры (для отображения активного босса)
  const { data: encountersData = [] } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    refetchInterval: 5000, // Автоматическое обновление для синхронизации
  });

  const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);

  // 2. Подписываемся на активные эффекты (для иконки баффа)
  const { data: effectsData } = useQuery({
    queryKey: ['active_effects'],
    queryFn: djangoApi.skills.getActiveEffects,
    refetchInterval: 10000,
  });

  const activeEffects = effectsData?.active_effects || [];
  const activeEncounter = encounters.find(e => !e.is_defeated);
  const activeBossTemplate = activeEncounter ? SCROLLS.find(s => s.id === activeEncounter.boss.id_name) : null;
  const hasDamageBuff = activeEffects.some(e => 
    (e.skill_id === 'system_overload' && e.data?.active) || 
    (e.skill_id === 'battle_fury')
  );

  const dealDamage = useCallback((amount, critical = false, color = "#ff00ff") => {
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

    setDamageFloat({ value: amount, critical, id: Date.now() });
    setTimeout(() => setDamageFloat(null), critical ? 1800 : 1000);

    bossSpriteControls.start({
      x: critical ? [-8, 8, -6, 6, -4, 4, 0] : [-4, 4, -2, 2, 0],
      scale: critical ? [1, 1.1, 0.95, 1.05, 1] : [1, 1.05, 0.98, 1],
      filter: critical 
        ? ["brightness(2) contrast(1.5)", "brightness(1)"]
        : ["brightness(1.5)", "brightness(1)"],
      transition: { duration: critical ? 0.6 : 0.3, ease: "easeOut" }
    });
  }, [bossSpriteControls]);

  // Handle external damage from session log / tasks
  useEffect(() => {
    if (!externalDamage || !activeBossTemplate) return;
    dealDamage(externalDamage.amount, externalDamage.isCritical, activeBossTemplate.color);
  }, [externalDamage, dealDamage, activeBossTemplate]);

  // Format remaining time to victory
  const formatETA = (seconds) => {
    if (seconds <= 0 || !isFinite(seconds)) return "Final Blow Required!";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) return `~${h}h ${m}m`;
    if (m > 0) return `~${m}m ${s}s`;
    return `~${s}s`;
  };

  // Idle HP tick effect
  useEffect(() => {
    if (!activeEncounter || activeEncounter.is_defeated || !activeBossTemplate) return;

    const maxHP = activeEncounter.boss.hp_max;
    const minHP = Math.max(0, Math.floor(maxHP * 0.05));
    const serverHP = activeEncounter.hp_current;
    const serverTime = activeEncounter.last_idle_tick_at ? new Date(activeEncounter.last_idle_tick_at).getTime() : Date.now();
    const dps = activeEncounter.idle_dps || 0.1;

    // Lock in the initial drain state if we have offline damage and aren't already draining it
    if (!initialDrainRef.current.active && (activeEncounter.idle_damage_applied || 0) > 0) {
      initialDrainRef.current = {
        active: true,
        preDamageHP: serverHP + activeEncounter.idle_damage_applied,
        serverHP: serverHP
      };
    } else if (initialDrainRef.current.active && serverHP !== initialDrainRef.current.serverHP) {
      // Abort drain if the server HP changed (e.g. user dealt damage)
      initialDrainRef.current.active = false;
    }

    const isInitialDrain = initialDrainRef.current.active;
    const preDamageHP = isInitialDrain ? initialDrainRef.current.preDamageHP : serverHP;

    const updateHP = () => {
      const elapsedSeconds = Math.max(0, (Date.now() - serverTime) / 1000);
      const idleDamage = elapsedSeconds * dps;
      const newDisplayHP = Math.floor(Math.max(minHP, serverHP - idleDamage));
      
      if (window.isOfflineModalOpen) {
        setDisplayHP(prev => {
          if (prev === 0) return isInitialDrain ? preDamageHP : newDisplayHP;
          return prev;
        });
        return;
      }

      setDisplayHP(prev => {
        // Handle initialization
        if (prev === 0) {
            return isInitialDrain ? preDamageHP : newDisplayHP;
        }

        // Handle the fast initial drain from preDamageHP to serverHP
        if (isInitialDrain && prev > newDisplayHP) {
            // Drain 5% of max HP per frame or a fixed amount to make it fast but visible
            const drainAmount = Math.max(Math.floor(maxHP * 0.02), 10);
            const nextHP = Math.max(newDisplayHP, prev - drainAmount);
            if (nextHP <= newDisplayHP) {
                initialDrainRef.current.active = false; // Finished draining
            }
            return nextHP;
        }

        // Normal idle ticks
        if (prev !== 0 && newDisplayHP < prev && !isInitialDrain) {
          const damageAmt = prev - newDisplayHP;
          const id = Date.now();
          setIdleDamageFloats(curr => [...curr, { id, value: damageAmt }]);
          
          bossSpriteControls.start({
            x: [0, -3, 3, -1, 1, 0],
            scale: [1, 1.02, 0.99, 1],
            filter: ["brightness(1.2)", "brightness(1)"],
            transition: { duration: 0.25, ease: "easeOut" }
          });
          
          playSound('boss_idle_tick');
        }
        return newDisplayHP;
      });
    };

    updateHP();
    // Use requestAnimationFrame style interval for the fast drain, or just stick to 100ms if draining, otherwise 1000ms
    const interval = setInterval(updateHP, 100);
    return () => clearInterval(interval);
  }, [activeEncounter, activeBossTemplate, bossSpriteControls]);


  // Если нет активного босса, показываем заглушку "Призвать"
  if (!activeEncounter || !activeBossTemplate) {
    return (
      <div className="rounded-2xl border border-[var(--habit-border)] bg-[var(--habit-panel)] overflow-hidden">
        <div className="p-5 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 rounded-xl bg-muted/20 border border-border flex items-center justify-center text-2xl">
            📜
          </div>
          <div>
            <div className="font-mono text-sm font-black text-muted-foreground/70 tracking-wider">{t("boss_panel.no_active")}</div>
            <div className="font-mono text-xs text-muted-foreground/40 mt-1">{t("boss_panel.visit_scrolls")}</div>
          </div>
        </div>
      </div>
    );
  }

  const color = activeBossTemplate.color;
  const maxHP = activeEncounter.boss.hp_max;
  const minHP = Math.max(0, Math.floor(maxHP * 0.05));

  const bossHP = activeEncounter.is_defeated ? 0 : (displayHP || activeEncounter.hp_current);
  const hpPercent = Math.max(0, (bossHP / maxHP) * 100);
  const dps = activeEncounter.idle_dps || 0.1;
  const crackOpacity = Math.max(0, 0.7 * (1 - hpPercent / 100));
  const isNearlyDefeated = bossHP <= minHP && !activeEncounter.is_defeated && bossHP > 0;
  const imgUrl = SCROLL_BOSS_IMAGES[activeEncounter.boss.id_name] || SCROLL_BOSS_IMAGES.misted_wanderer;

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
        <span className="flex items-center gap-2">
          {open ? "▾" : "▸"} {t("boss_panel.scroll_boss")} — <span className="text-red-400">{t("boss_panel.active")}</span>
          {hasDamageBuff && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-bold border border-cyan-500/50 flex items-center gap-1">
              <span>⚡ BUFF ACTIVE</span>
            </span>
          )}
        </span>
        <span style={{ color }}>{activeBossTemplate.boss}</span>
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
              animate={{ 
                filter: [`drop-shadow(0 0 4px ${color}20)`, `drop-shadow(0 0 16px ${color}60)`, `drop-shadow(0 0 4px ${color}20)`] 
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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
              <motion.div
                animate={bossSpriteControls}
                initial={{ x: 0, scale: 1 }}
              >
                <OptimizedImage
                  src={imgUrl}
                  alt={activeBossTemplate.boss}
                  className="rounded-xl object-cover transition-all duration-1000"
                  style={{ 
                    width: 180, 
                    height: 220, 
                    imageRendering: "pixelated", 
                    filter: isNearlyDefeated ? `grayscale(0.6) sepia(0.3) hue-rotate(-30deg)` : "" 
                  }}
                />
              </motion.div>
              {/* Idle Damage floats */}
              <AnimatePresence>
                {idleDamageFloats.map((float) => (
                  <motion.div
                    key={float.id}
                    initial={{ opacity: 1, y: 0, scale: 0.8 }}
                    animate={{ opacity: 0, y: -40, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    onAnimationComplete={() => {
                      setIdleDamageFloats(curr => curr.filter(item => item.id !== float.id));
                    }}
                    className="absolute font-mono font-black pointer-events-none text-center z-10"
                    style={{
                      top: `${30 + Math.random() * 20}%`, // Randomize start position slightly
                      left: `${40 + Math.random() * 20}%`,
                      color: "#cbd5e1", // slate-300
                      fontSize: "16px",
                      textShadow: "0px 2px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    -{float.value}
                  </motion.div>
                ))}
              </AnimatePresence>
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
                <span style={{ color }}>{activeBossTemplate.boss}</span>
                <span className="text-muted-foreground">
                  HP: {bossHP.toLocaleString()}/{maxHP.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                <motion.div className="absolute top-0 left-0 h-full rounded-full"
                  initial={{ width: `${hpPercent}%` }}
                  animate={{ 
                    width: `${hpPercent}%`,
                    background: isNearlyDefeated 
                      ? [`linear-gradient(90deg, #991b1b, #ef4444)`, `linear-gradient(90deg, #991b1b, #b91c1c)`, `linear-gradient(90deg, #991b1b, #ef4444)`] 
                      : `linear-gradient(90deg, #991b1b, ${color})`
                  }}
                  transition={{ 
                    width: { type: "tween", ease: "easeOut", duration: 0.5 },
                    background: isNearlyDefeated ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }
                  }}
                />
                
                {/* Crack Overlay */}
                <motion.svg
                  className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay"
                  animate={{ opacity: crackOpacity }}
                  transition={{ duration: 0.5 }}
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  fill="none"
                >
                  <path d="M10 0L15 4L20 2M30 8L35 4L42 7M60 0L63 5L68 3M85 8L88 3L95 5" stroke="black" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
                </motion.svg>
              </div>
              
              {/* Idle Stats Bar */}
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground/60 border-t border-border/30 pt-1.5 mt-1">
                <span>⚡ Idle DPS: {dps.toFixed(2)} ({ (dps * 3600).toFixed(0) }/hr)</span>
                <span>⏱️ ETA: {formatETA((bossHP - minHP) / dps)}</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 italic">{activeBossTemplate.name}</div>
                  <div className="text-[10px] font-mono text-yellow-400/70">
                    Reward: +{Math.round(activeEncounter.boss.reward_gold).toLocaleString()}G · +{activeBossTemplate.reward.sp}SP · {activeBossTemplate.uniqueItem.label}
                  </div>
                </div>
                {isNearlyDefeated && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] font-mono font-bold text-red-400 animate-pulse bg-red-400/10 px-2 py-0.5 rounded border border-red-400/30"
                  >
                    FINAL BLOW REQUIRED!
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}