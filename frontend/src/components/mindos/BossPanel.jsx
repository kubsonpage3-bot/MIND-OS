// @ts-nocheck
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { SCROLLS, SCROLL_BOSS_IMAGES, RANK_COLORS } from "./ScrollsPanel";
import { playSound } from "@/lib/soundEffects.js";
import { hapticHeavy, hapticLight, hapticSuccess } from "@/hooks/useHaptic";
import OptimizedImage from "./OptimizedImage";
import BossCombatSlash from "./BossCombatSlash";
import BossArenaCanvas from "./BossArenaCanvas";
import ItemDetailModal from "./ItemDetailModal";
import { 
  Swords, 
  Skull, 
  Coins, 
  Zap, 
  Sparkles, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Info,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

// Format time remaining for scroll encounter
function formatTimeRemaining(encounter, daysLimit = 7) {
  if (!encounter) return null;
  const targetDate = encounter.expires_at 
    ? new Date(encounter.expires_at).getTime() 
    : (encounter.started_at ? new Date(encounter.started_at).getTime() + daysLimit * 86400000 : null);
  
  if (!targetDate) return null;
  const rem = targetDate - Date.now();
  if (rem <= 0) return "EXPIRED";
  const days = Math.floor(rem / 86400000);
  const hours = Math.floor((rem % 86400000) / 3600000);
  const minutes = Math.floor((rem % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function BossPanel({ externalDamage, currentScore, onBossDamage }) {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  
  // Animation & Visual States
  const [damageFloat, setDamageFloat] = useState(null);
  const [isCritical, setIsCritical] = useState(false);
  const [slashTrigger, setSlashTrigger] = useState(null);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [pokeTaunt, setPokeTaunt] = useState(null);
  const [selectedLootItem, setSelectedLootItem] = useState(null);
  const [open, setOpen] = useState(true);
  
  // Interactive 3D tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const arenaRef = useRef(null);
  const bossSpriteControls = useAnimation();

  // 1. Encounters subscription
  const { data: encountersData = [] } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    refetchInterval: 5000,
  });

  const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);

  // 2. Active effects subscription
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

  // HP Tracking & Ghost Bar mechanics
  const maxHP = activeEncounter?.boss?.hp_max || 1000;
  const [currentHP, setCurrentHP] = useState(() => activeEncounter ? activeEncounter.hp_current : 0);
  const [ghostHPPercent, setGhostHPPercent] = useState(100);

  // Sync server HP updates
  useEffect(() => {
    if (activeEncounter && !activeEncounter.is_defeated) {
      setCurrentHP(activeEncounter.hp_current);
    } else if (activeEncounter?.is_defeated) {
      setCurrentHP(0);
    }
  }, [activeEncounter?.hp_current, activeEncounter?.is_defeated]);

  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

  // Sync Ghost Lag Bar
  useEffect(() => {
    if (hpPercent < ghostHPPercent) {
      const timer = setTimeout(() => {
        setGhostHPPercent(hpPercent);
      }, 450);
      return () => clearTimeout(timer);
    } else {
      setGhostHPPercent(hpPercent);
    }
  }, [hpPercent]);

  // Phase Determination: Phase 1 (>60%), Phase 2 (25-60% Enraged), Phase 3 (<25% Execute)
  const bossPhase = useMemo(() => {
    if (hpPercent <= 25) return 3;
    if (hpPercent <= 60) return 2;
    return 1;
  }, [hpPercent]);

  // Deal Damage Sequence (optimistic HP drop + visual slash + hit flash + screen shake)
  const dealDamage = useCallback((amount, critical = false, bossColor = "#22c55e") => {
    if (critical) {
      playSound('boss_critical');
      try { hapticHeavy?.(); } catch {}
    } else {
      playSound('boss_hit');
      try { hapticLight?.(); } catch {}
    }

    setIsCritical(critical);
    setSlashTrigger({ id: Date.now(), isCritical: critical });
    setIsScreenShaking(true);
    setTimeout(() => setIsScreenShaking(false), critical ? 500 : 300);

    // Optimistically deduct current HP immediately
    setCurrentHP(prev => Math.max(0, prev - amount));

    // Floating combat text
    setDamageFloat({ value: amount, critical, id: Date.now() });
    setTimeout(() => setDamageFloat(null), critical ? 1800 : 1200);

    // Kinetic boss flinch & white silhouette hit-flash
    bossSpriteControls.start({
      x: critical ? [-12, 12, -8, 8, -4, 4, 0] : [-6, 6, -3, 3, 0],
      scale: critical ? [1, 1.16, 0.92, 1.06, 1] : [1, 1.08, 0.96, 1.02, 1],
      filter: critical 
        ? ["brightness(3.2) contrast(2) drop-shadow(0 0 25px #00e5ff)", "brightness(1) drop-shadow(0 6px 16px rgba(0,0,0,0.6))"]
        : ["brightness(2.4) contrast(1.6) drop-shadow(0 0 15px #ffffff)", "brightness(1) drop-shadow(0 6px 16px rgba(0,0,0,0.6))"],
      transition: { duration: critical ? 0.55 : 0.35, ease: "easeOut" }
    });
  }, [bossSpriteControls]);

  // React to external damage events (from task/training completions)
  useEffect(() => {
    if (!externalDamage || !activeBossTemplate) return;
    dealDamage(externalDamage.amount, externalDamage.isCritical, activeBossTemplate.color);
  }, [externalDamage, dealDamage, activeBossTemplate]);

  // Interactive 3D mouse move handler
  const handleMouseMove = (e) => {
    if (!arenaRef.current) return;
    const rect = arenaRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 6), y: x * 6 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Interactive Boss Tap / Provoke
  const handleBossPoke = () => {
    playSound('boss_hit');
    try { hapticLight?.(); } catch {}

    bossSpriteControls.start({
      scale: [1, 0.94, 1.04, 1],
      transition: { duration: 0.28 }
    });

    const taunts = [
      activeBossTemplate?.quote,
      t("boss_panel_extra.taunt_1", "«You dare test my resolve?!»"),
      t("boss_panel_extra.taunt_2", "«Your strikes are but a whisper in the dark!»"),
      t("boss_panel_extra.taunt_3", "«This seal will never break!»"),
      t("boss_panel_extra.taunt_4", "«Feeble efforts of a mortal!»")
    ].filter(Boolean);

    const randomTaunt = taunts[Math.floor(Math.random() * taunts.length)];
    setPokeTaunt({ text: randomTaunt, id: Date.now() });
    setTimeout(() => setPokeTaunt(null), 2400);
  };

  // If no active boss encounter exists, show summon placeholder
  if (!activeEncounter || !activeBossTemplate) {
    return (
      <div className="rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] overflow-hidden pixel-corner-brackets shadow-lg">
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
          <motion.div 
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-14 h-14 rounded-xl bg-black/40 border border-[var(--habit-border)] flex items-center justify-center text-2xl shadow-inner"
          >
            📜
          </motion.div>
          <div>
            <div className="font-game text-xs font-black text-[var(--habit-text)] tracking-wider">
              {t("boss_panel.no_active", "NO ACTIVE BOSS")}
            </div>
            <div className="font-game text-[9px] text-[var(--habit-dim)] mt-1">
              {t("boss_panel.visit_scrolls", "Visit Scrolls in Character tab to summon an encounter")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const baseColor = activeBossTemplate.color || "#22c55e";
  const bossRank = activeBossTemplate.rank || "D";
  const rankColor = RANK_COLORS[bossRank] || baseColor;
  
  // Phase visual cues
  const phaseColor = bossPhase === 3 ? "#ef4444" : bossPhase === 2 ? "#f59e0b" : baseColor;
  const isNearlyDefeated = hpPercent <= 5 && !activeEncounter.is_defeated && currentHP > 0;
  const imgUrl = SCROLL_BOSS_IMAGES[activeEncounter.boss.id_name] || SCROLL_BOSS_IMAGES.misted_wanderer;
  const timeLeft = formatTimeRemaining(activeEncounter, activeBossTemplate.daysLimit);

  return (
    <>
      <div 
        className={`rounded-2xl border relative overflow-hidden bg-[var(--habit-panel)] pixel-corner-brackets transition-all duration-500 ${
          isScreenShaking ? "animate-pixel-shake" : ""
        }`}
        style={{ 
          borderColor: `${phaseColor}70`,
          boxShadow: bossPhase === 3
            ? `0 0 35px rgba(239, 68, 68, 0.35), inset 0 0 25px rgba(239, 68, 68, 0.15)`
            : `0 8px 32px rgba(0, 0, 0, 0.45), 0 0 25px ${baseColor}25, inset 0 1px 0 rgba(255, 255, 255, 0.1)` 
        }}
      >
        {/* Ambient Element Particle Field Canvas */}
        {open && (
          <BossArenaCanvas 
            bossId={activeEncounter.boss.id_name} 
            color={phaseColor} 
            phase={bossPhase} 
          />
        )}

        {/* Phase 3 Critical Alert Pulse Border */}
        {bossPhase === 3 && (
          <div className="absolute inset-0 border-2 border-red-500/60 rounded-2xl pointer-events-none animate-pulse z-20" />
        )}

        {/* ─── EXPANDABLE HEADER ─── */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-black/40 border-b border-[var(--habit-border)] text-xs font-game text-[var(--habit-text)] hover:text-white transition-all cursor-pointer relative z-20 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[var(--habit-dim)] text-xs">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
            <Swords className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="font-bold tracking-wider text-[11px] flex items-center gap-1.5">
              <span>{t("boss_panel.scroll_boss", "SCROLL BOSS")}</span>
              <span className="text-[10px] text-red-400 font-black tracking-widest">• ACTIVE</span>
            </span>

            {/* Boss Rank Badge */}
            <span 
              className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border flex items-center gap-1 shadow-sm"
              style={{ 
                color: rankColor, 
                backgroundColor: `${rankColor}18`, 
                borderColor: `${rankColor}60` 
              }}
            >
              RANK {bossRank}
            </span>

            {/* Damage Buff Badge */}
            {hasDamageBuff && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[8px] font-bold border border-cyan-500/50 flex items-center gap-1 animate-pulse">
                <span>{t("boss_panel_extra.buff_active", "⚡ BUFF ACTIVE")}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Scroll Expiration Timer */}
            {timeLeft && (
              <span className="text-[9px] font-mono font-bold text-[var(--habit-dim)] flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/30 border border-white/5">
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                {timeLeft}
              </span>
            )}

            {/* Boss Name Header Tag */}
            <span 
              className="font-black text-[10px] uppercase px-2.5 py-1 rounded-md shadow-sm hidden sm:inline-block" 
              style={{ color: baseColor, background: `${baseColor}18`, border: `1px solid ${baseColor}50` }}
            >
              {t(`scrolls.${activeBossTemplate.id}.boss`, activeBossTemplate.boss)}
            </span>
          </div>
        </button>

        {open && (
          <div 
            ref={arenaRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="p-4 sm:p-5 space-y-4 relative z-10"
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            {/* ─── BOSS ARENA STAGE ─── */}
            <div className="flex flex-col items-center relative py-2">
              
              {/* Boss Phase Indicator Banner */}
              <div className="mb-2 flex items-center gap-2 z-20">
                <span 
                  className={`text-[9px] font-game font-black tracking-widest px-2.5 py-0.5 rounded-full border uppercase shadow-md flex items-center gap-1.5 ${
                    bossPhase === 3 ? "animate-pulse" : ""
                  }`}
                  style={{
                    color: phaseColor,
                    borderColor: `${phaseColor}80`,
                    backgroundColor: `${phaseColor}15`,
                    boxShadow: `0 0 14px ${phaseColor}40`
                  }}
                >
                  {bossPhase === 3 ? <Flame className="w-3 h-3 text-red-400" /> : <Skull className="w-3 h-3" />}
                  {bossPhase === 3 
                    ? t("boss_panel_extra.phase_3", "PHASE III • EXECUTE")
                    : bossPhase === 2
                    ? t("boss_panel_extra.phase_2", "PHASE II • ENRAGED")
                    : t("boss_panel_extra.phase_1", "PHASE I • UNYIELDING")
                  }
                </span>

                {/* Lore Quote Tooltip / Caption */}
                {activeBossTemplate.quote && (
                  <span className="hidden md:inline-block text-[10px] font-game text-[var(--habit-dim)] italic opacity-85">
                    {activeBossTemplate.quote}
                  </span>
                )}
              </div>

              {/* Runic Summoning Seal under the Boss Pedestal */}
              <div 
                className="absolute bottom-1 w-48 h-28 pointer-events-none z-0 flex items-center justify-center opacity-70"
                style={{ transform: "perspective(320px) rotateX(65deg)" }}
              >
                {/* Spinning Runic Circle */}
                <svg 
                  className="w-48 h-48 animate-rune-spin overflow-visible" 
                  viewBox="0 0 100 100"
                >
                  <circle cx="50" cy="50" r="46" fill="none" stroke={phaseColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke={phaseColor} strokeWidth="1.5" opacity="0.8" />
                  <circle cx="50" cy="50" r="28" fill="none" stroke={phaseColor} strokeWidth="0.8" strokeDasharray="6 4" opacity="0.5" />
                  <polygon points="50,14 81,68 19,68" fill="none" stroke={phaseColor} strokeWidth="1" opacity="0.4" />
                  <polygon points="50,86 19,32 81,32" fill="none" stroke={phaseColor} strokeWidth="1" opacity="0.4" />
                </svg>

                {/* Glowing Core Spot */}
                <div 
                  className="absolute w-36 h-36 rounded-full blur-[8px] opacity-80"
                  style={{ background: `radial-gradient(circle, ${phaseColor}80 0%, transparent 75%)` }}
                />
              </div>

              {/* Cinematic Vector Combat Slash */}
              <AnimatePresence>
                {slashTrigger && (
                  <BossCombatSlash
                    key={slashTrigger.id}
                    trigger={slashTrigger.id}
                    isCritical={slashTrigger.isCritical}
                    color={phaseColor}
                  />
                )}
              </AnimatePresence>

              {/* Boss Sprite Container */}
              <div className="relative flex flex-col items-center cursor-pointer group" onClick={handleBossPoke}>
                
                {/* Interactive Speech Taunt Bubble */}
                <AnimatePresence>
                  {pokeTaunt && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.85 }}
                      animate={{ opacity: 1, y: -20, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ type: "spring", damping: 18, stiffness: 300 }}
                      className="absolute -top-6 z-40 px-3 py-1.5 rounded-xl bg-black/90 border border-white/20 text-white font-game text-[10px] text-center shadow-2xl pointer-events-none max-w-[240px]"
                      style={{ 
                        borderColor: `${phaseColor}90`,
                        boxShadow: `0 0 20px ${phaseColor}50`
                      }}
                    >
                      <div className="leading-tight">{pokeTaunt.text}</div>
                      <div 
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/90 border-b border-r border-white/20 rotate-45"
                        style={{ borderColor: `${phaseColor}90` }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Boss Sprite with breathing & hit reactions */}
                <motion.div
                  animate={bossSpriteControls}
                  initial={{ x: 0, scale: 1 }}
                  className="relative z-10 transition-transform duration-300 group-hover:scale-[1.03]"
                >
                  <motion.div
                    animate={{ 
                      y: [-3, 3, -3],
                      scale: [1, 1.018, 1]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: bossPhase === 3 ? 2.2 : bossPhase === 2 ? 3.0 : 3.8,
                      ease: "easeInOut"
                    }}
                  >
                    <OptimizedImage
                      src={imgUrl}
                      alt={activeBossTemplate.boss}
                      className="rounded-2xl object-contain select-none pointer-events-none transition-all duration-500"
                      style={{ 
                        width: 180, 
                        height: 215, 
                        imageRendering: "pixelated",
                        // Subtle gradient vignette fading bottom into pedestal
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 99%)',
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 99%)',
                        filter: isNearlyDefeated 
                          ? `grayscale(0.5) sepia(0.3) hue-rotate(-30deg) drop-shadow(0 0 22px #ef4444)` 
                          : bossPhase === 3
                          ? `drop-shadow(0 0 20px #ef4444) drop-shadow(0 8px 24px rgba(0,0,0,0.8))`
                          : `drop-shadow(0 6px 18px ${baseColor}55) drop-shadow(0 10px 28px rgba(0,0,0,0.6))` 
                      }}
                    />
                  </motion.div>
                </motion.div>

                {/* Floating Damage Text Popup */}
                <AnimatePresence>
                  {damageFloat && (
                    <motion.div
                      key={damageFloat.id}
                      initial={{ opacity: 1, y: 0, scale: damageFloat.critical ? 1.5 : 1 }}
                      animate={{ opacity: 0, y: -80, scale: damageFloat.critical ? 1.2 : 0.9 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: damageFloat.critical ? 1.6 : 1.1, ease: "easeOut" }}
                      className="absolute top-8 left-1/2 -translate-x-1/2 font-game font-black pointer-events-none text-center z-40 whitespace-nowrap"
                      style={{
                        color: damageFloat.critical ? "#00e5ff" : "#ffffff",
                        fontSize: damageFloat.critical ? "26px" : "20px",
                        textShadow: damageFloat.critical 
                          ? "0 0 25px #00e5ff, 0 0 50px #00e5ff, 0 4px 10px rgba(0,0,0,0.9)" 
                          : "0 0 15px #fff, 0 4px 8px rgba(0,0,0,0.9)",
                      }}
                    >
                      {damageFloat.critical && (
                        <motion.div 
                          initial={{ scale: 0.5, opacity: 1 }} 
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] text-cyan-300 tracking-widest font-black mb-0.5 uppercase drop-shadow-[0_0_8px_#00e5ff]"
                        >
                          ⚡ CRITICAL STRIKE ⚡
                        </motion.div>
                      )}
                      -{Math.abs(damageFloat.value)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── NEXT-GEN DUAL HP BAR (GHOST LAG BAR) ─── */}
              <div className="w-full space-y-2 mt-2">
                
                {/* Boss Label, Percentage & Exact HP */}
                <div className="flex justify-between items-center text-xs font-game">
                  <div className="flex items-center gap-1.5 font-black text-[11px]" style={{ color: phaseColor }}>
                    <Skull className="w-3.5 h-3.5" />
                    <span>{activeBossTemplate.boss}</span>
                    <span className="text-[9px] text-[var(--habit-dim)] font-mono font-normal">
                      (LV. {activeEncounter.boss.rank || bossRank})
                    </span>
                  </div>

                  <div className="font-bold text-[10px] text-[var(--habit-text)] flex items-center gap-2">
                    <span className="text-amber-400 font-mono text-[11px]">
                      {hpPercent.toFixed(1)}%
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/50 border border-white/10 font-mono text-[10px]">
                      {currentHP.toLocaleString()} / {maxHP.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* HP Track with Ghost Bar and Phase Milestone Notches */}
                <div className="h-6 rounded-xl bg-black/70 border-2 border-[var(--habit-border)] overflow-hidden relative p-0.5 shadow-inner">
                  
                  {/* Delayed Ghost Damage Bar (Yellow/Red lag behind) */}
                  <motion.div 
                    className="absolute top-0.5 bottom-0.5 left-0.5 rounded-lg opacity-85"
                    animate={{ width: `${ghostHPPercent}%` }}
                    transition={{ 
                      width: { duration: 0.6, delay: 0.2, ease: "easeInOut" }
                    }}
                    style={{
                      background: bossPhase === 3 
                        ? `linear-gradient(90deg, #7f1d1d 0%, #ef4444 100%)`
                        : `linear-gradient(90deg, #b45309 0%, #f59e0b 100%)`,
                      boxShadow: `0 0 10px rgba(245, 158, 11, 0.5)`
                    }}
                  />

                  {/* Primary Health Bar */}
                  <motion.div 
                    className="absolute top-0.5 bottom-0.5 left-0.5 rounded-lg z-10"
                    animate={{ 
                      width: `${hpPercent}%`,
                      background: bossPhase === 3
                        ? `linear-gradient(90deg, #991b1b 0%, #ef4444 60%, #f87171 100%)` 
                        : bossPhase === 2
                        ? `linear-gradient(90deg, #854d0e 0%, #eab308 60%, #fef08a 100%)`
                        : `linear-gradient(90deg, #14532d 0%, ${baseColor} 70%, #86efac 100%)`,
                      boxShadow: bossPhase === 3 
                        ? `0 0 16px #ef4444` 
                        : `0 0 12px ${baseColor}99`
                    }}
                    transition={{ 
                      width: { type: "tween", ease: "easeOut", duration: 0.3 }
                    }}
                  />

                  {/* Phase Milestone Notches (75%, 50%, 25%) */}
                  <div className="absolute inset-0 pointer-events-none z-20 flex justify-between px-0.5">
                    <div className="w-[1px] h-full bg-white/25 absolute left-[25%]" title="Execute Phase" />
                    <div className="w-[1px] h-full bg-white/35 absolute left-[50%]" title="Enrage Phase" />
                    <div className="w-[1px] h-full bg-white/25 absolute left-[75%]" />
                  </div>

                  {/* Pixel Scanline Meter Segment Pattern Overlay */}
                  <div className="absolute inset-0 pixel-meter-pattern pointer-events-none opacity-40 z-20" />

                  {/* Low HP Crack Overlay */}
                  <motion.svg
                    className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay z-20"
                    animate={{ opacity: bossPhase === 3 ? 0.8 : bossPhase === 2 ? 0.35 : 0 }}
                    transition={{ duration: 0.5 }}
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path d="M10 0L15 4L20 2M30 8L35 4L42 7M60 0L63 5L68 3M85 8L88 3L95 5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
                  </motion.svg>
                </div>
                
                {/* ─── LOOT & UNIQUE ARTIFACT SHOWCASE ─── */}
                <div className="pt-2.5 border-t border-[var(--habit-border)]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-game text-[8.5px] text-[var(--habit-dim)] uppercase font-black tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      {t("boss_panel_extra.loot_drops", "LOOT DROPS:")}
                    </span>

                    {/* Gold Reward Badge */}
                    <span className="inline-flex items-center gap-1 font-game text-[8.5px] text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 shadow-sm">
                      <Coins className="w-2.5 h-2.5 text-amber-400" />
                      +{Math.round(activeEncounter.boss.reward_gold).toLocaleString()}G
                    </span>

                    {/* SP Reward Badge */}
                    <span className="inline-flex items-center gap-1 font-game text-[8.5px] text-purple-300 font-bold px-2 py-0.5 rounded bg-purple-400/10 border border-purple-400/30 shadow-sm">
                      <Zap className="w-2.5 h-2.5 text-purple-400" />
                      +{activeBossTemplate.reward?.sp || 2} SP
                    </span>

                    {/* Interactive Unique Artifact Drop Badge */}
                    {activeBossTemplate.uniqueItem?.label && (
                      <button
                        onClick={() => setSelectedLootItem(activeBossTemplate.uniqueItem)}
                        className="inline-flex items-center gap-1.5 font-game text-[8.5px] text-cyan-300 font-bold px-2.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/30 transition-all cursor-pointer group/item shadow-sm"
                        title={t("boss_panel_extra.click_to_inspect", "Click to inspect artifact")}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400 group-hover/item:rotate-12 transition-transform" />
                        <span>{activeBossTemplate.uniqueItem.label}</span>
                        <Info className="w-2 h-2 opacity-60 group-hover/item:opacity-100" />
                      </button>
                    )}
                  </div>

                  {/* Phase 3 / Final Blow Banner */}
                  {isNearlyDefeated && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="font-game text-[9px] font-black text-red-400 animate-pulse bg-red-500/25 px-2.5 py-1 rounded-lg border border-red-500/60 shadow-lg flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3 h-3 text-red-400 animate-bounce" />
                      <span>⚡ {t("boss_panel_extra.final_blow", "FINAL BLOW REQUIRED!")} ⚡</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unique Artifact Inspection Modal */}
      {selectedLootItem && (
        <ItemDetailModal
          isOpen={!!selectedLootItem}
          onClose={() => setSelectedLootItem(null)}
          title={selectedLootItem.label}
          subtitle={`UNIQUE ${selectedLootItem.slot ? selectedLootItem.slot.toUpperCase() : "ARTIFACT"}`}
          tierColor="#06b6d4"
          description={selectedLootItem.effect}
        />
      )}
    </>
  );
}