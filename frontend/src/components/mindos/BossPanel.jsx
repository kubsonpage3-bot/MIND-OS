import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { SCROLLS, SCROLL_BOSS_IMAGES } from "./ScrollsPanel";
import { playSound } from "@/lib/soundEffects.js";
import ParticleStrike from "./ParticleStrike";
import OptimizedImage from "./OptimizedImage";
import { Swords, Skull, Coins, Zap, Trophy, Sparkles } from "lucide-react";
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
  const bossSpriteControls = useAnimation();

  // 1. Подписываемся на энкаунтеры (для отображения активного босса)
  const { data: encountersData = [] } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    refetchInterval: 5000,
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

  // Если нет активного босса, показываем заглушку "Призвать"
  if (!activeEncounter || !activeBossTemplate) {
    return (
      <div className="rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] overflow-hidden pixel-corner-brackets">
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-black/20 border border-[var(--habit-border)] flex items-center justify-center text-2xl">
            📜
          </div>
          <div>
            <div className="font-game text-xs font-black text-[var(--habit-text)] tracking-wider">{t("boss_panel.no_active", "NO ACTIVE BOSS")}</div>
            <div className="font-game text-[9px] text-[var(--habit-dim)] mt-1">{t("boss_panel.visit_scrolls", "Visit Scrolls in Character tab to summon an encounter")}</div>
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

      <div 
        className="rounded-xl border relative overflow-hidden bg-[var(--habit-panel)] pixel-corner-brackets"
        style={{ 
          borderColor: `${color}60`,
          boxShadow: `0 4px 28px rgba(0, 0, 0, 0.3), 0 0 20px ${color}20, inset 0 1px 0 rgba(255, 255, 255, 0.08)` 
        }}
      >
        {/* Ambient background arena glow */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${color}35 0%, rgba(13, 8, 32, 0.8) 70%, transparent 100%)`
          }}
        />

        {/* Collapsible Header */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-black/25 border-b border-[var(--habit-border)] text-xs font-game text-[var(--habit-text)] hover:text-white transition-colors cursor-pointer relative z-10"
        >
          <span className="flex items-center gap-2 text-[10px]">
            <Swords className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span className="font-bold tracking-wider">
              {open ? "▾" : "▸"} {t("boss_panel.scroll_boss", "SCROLL BOSS")} — <span className="text-red-400 font-black">{t("boss_panel.active", "ACTIVE")}</span>
            </span>
            {hasDamageBuff && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[8px] font-bold border border-cyan-500/50 flex items-center gap-1">
                <span>{t("boss_panel_extra.buff_active", "⚡ BUFF ACTIVE")}</span>
              </span>
            )}
          </span>
          <span className="font-black text-[10px] uppercase px-2 py-0.5 rounded" style={{ color, background: `${color}15`, border: `1px solid ${color}40` }}>
            {activeBossTemplate.boss}
          </span>
        </button>

        {open && (
          <div className="p-4 md:p-5 space-y-4 relative z-10">
            <div className="flex flex-col items-center gap-4 relative">
              {/* Attack Slash / Crit Overlay */}
              <AnimatePresence>
                {attackAnim && (
                  <motion.div
                    initial={{ x: -120, opacity: 0, scale: 0.7 }}
                    animate={{ x: isCritical ? [-120, 40, 20] : [-120, 20, 10], opacity: [0, 1, 0], scale: [0.7, 1.1, 0.8] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute left-4 z-30 pointer-events-none"
                    style={{ top: "35%" }}
                  >
                    <motion.div
                      animate={{ rotate: isCritical ? [-30, 60, 30] : [-20, 40, 0] }}
                      transition={{ duration: 0.5 }}
                      className="font-game text-4xl select-none"
                      style={{ textShadow: isCritical ? "0 0 20px #00e5ff, 0 0 40px #00e5ff" : "0 0 10px #fff" }}
                    >
                      {isCritical ? "⚡" : "⚔️"}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Boss Sprite in Arena */}
              <div className="relative flex flex-col items-center">
                {/* Critical flash */}
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

                {/* Pedestal shadow */}
                <div 
                  className="absolute bottom-1 w-32 h-6 rounded-full blur-[4px] opacity-80 z-0"
                  style={{ background: `radial-gradient(ellipse, ${color}60 0%, transparent 80%)` }}
                />

                {/* Boss Sprite */}
                <motion.div
                  animate={bossSpriteControls}
                  initial={{ x: 0, scale: 1 }}
                  className="relative z-10 animate-pixel-float"
                >
                  <OptimizedImage
                    src={imgUrl}
                    alt={activeBossTemplate.boss}
                    className="rounded-xl object-contain transition-all duration-700"
                    style={{ 
                      width: 170, 
                      height: 200, 
                      imageRendering: "pixelated", 
                      filter: isNearlyDefeated 
                        ? `grayscale(0.6) sepia(0.3) hue-rotate(-30deg) drop-shadow(0 0 15px #ef4444)` 
                        : `drop-shadow(0 6px 16px ${color}50)` 
                    }}
                  />
                </motion.div>

                {/* Floating Damage Text */}
                <AnimatePresence>
                  {damageFloat && (
                    <motion.div
                      key={damageFloat.id}
                      initial={{ opacity: 1, y: 0, scale: damageFloat.critical ? 1.4 : 1 }}
                      animate={{ opacity: 0, y: -75, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: damageFloat.critical ? 1.8 : 1.0, ease: "easeOut" }}
                      className="absolute top-4 left-1/2 -translate-x-1/2 font-game font-black pointer-events-none text-center z-40"
                      style={{
                        color: damageFloat.critical ? "#00e5ff" : "#ffffff",
                        fontSize: damageFloat.critical ? "24px" : "18px",
                        textShadow: damageFloat.critical ? "0 0 20px #00e5ff, 0 0 40px #00e5ff" : "0 0 10px #fff",
                      }}
                    >
                      {damageFloat.critical && (
                        <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[10px] text-cyan-300 tracking-widest font-black mb-0.5"
                          style={{ textShadow: "0 0 10px #00e5ff" }}
                        >⚡ CRITICAL ⚡</motion.div>
                      )}
                      {damageFloat.value > 0 ? '-' : '+'}{Math.abs(damageFloat.value)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── RETRO SEGMENTED HP BAR ─── */}
              <div className="w-full space-y-2">
                {/* Boss Label & HP Numbers */}
                <div className="flex justify-between items-center text-xs font-game">
                  <div className="flex items-center gap-1.5 font-bold" style={{ color }}>
                    <Skull className="w-3.5 h-3.5" />
                    <span>{activeBossTemplate.boss}</span>
                  </div>
                  <div className="font-bold text-[10px] text-[var(--habit-text)] flex items-center gap-2">
                    <span className="text-[var(--habit-dim)] font-mono">
                      {hpPercent.toFixed(1)}%
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                      {bossHP.toLocaleString()} / {maxHP.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* HP Track & Segments */}
                <div className="h-5 rounded-lg bg-black/50 border-2 border-[var(--habit-border)] overflow-hidden relative p-0.5 shadow-inner">
                  {/* Background Bar */}
                  <motion.div 
                    className="absolute top-0.5 bottom-0.5 left-0.5 rounded-md"
                    initial={{ width: `${hpPercent}%` }}
                    animate={{ 
                      width: `${hpPercent}%`,
                      background: isNearlyDefeated 
                        ? `linear-gradient(90deg, #991b1b 0%, #ef4444 100%)` 
                        : `linear-gradient(90deg, #991b1b 0%, ${color} 100%)`,
                      boxShadow: isNearlyDefeated ? `0 0 12px #ef4444` : `0 0 10px ${color}80`
                    }}
                    transition={{ 
                      width: { type: "tween", ease: "easeOut", duration: 0.5 }
                    }}
                  />

                  {/* Pixel Meter Segment Pattern Overlay */}
                  <div className="absolute inset-0 pixel-meter-pattern pointer-events-none opacity-40" />

                  {/* Crack Overlay for low HP */}
                  <motion.svg
                    className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay"
                    animate={{ opacity: crackOpacity }}
                    transition={{ duration: 0.5 }}
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path d="M10 0L15 4L20 2M30 8L35 4L42 7M60 0L63 5L68 3M85 8L88 3L95 5" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.9" />
                  </motion.svg>
                </div>
                
                {/* ─── LOOT SHOWCASE ─── */}
                <div className="pt-2 border-t border-[var(--habit-border)]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-game text-[8px] text-[var(--habit-dim)] uppercase font-bold">
                      {t("boss_panel_extra.reward", "LOOT DROPS:")}
                    </span>

                    {/* Gold Badge */}
                    <span className="inline-flex items-center gap-1 font-game text-[8px] text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                      <Coins className="w-2.5 h-2.5 text-amber-400" />
                      +{Math.round(activeEncounter.boss.reward_gold).toLocaleString()}G
                    </span>

                    {/* SP Badge */}
                    <span className="inline-flex items-center gap-1 font-game text-[8px] text-purple-300 font-bold px-2 py-0.5 rounded bg-purple-400/10 border border-purple-400/30">
                      <Zap className="w-2.5 h-2.5 text-purple-400" />
                      +{activeBossTemplate.reward?.sp || 2} SP
                    </span>

                    {/* Item Drop Badge */}
                    {activeBossTemplate.uniqueItem?.label && (
                      <span className="inline-flex items-center gap-1 font-game text-[8px] text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/30">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        {activeBossTemplate.uniqueItem.label}
                      </span>
                    )}
                  </div>

                  {/* Final Blow Warning */}
                  {isNearlyDefeated && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="font-game text-[8.5px] font-black text-red-400 animate-pulse bg-red-500/20 px-2 py-1 rounded border border-red-500/50"
                    >
                      ⚡ {t("boss_panel_extra.final_blow", "FINAL BLOW REQUIRED!")} ⚡
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