// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { CheckCircle2, Loader2, X, Zap } from "lucide-react";
import { getGearClassColor, GEAR_CLASS_NAMES } from "@/lib/gameState";
import { getMediaUrl } from "@/api/djangoClient";
import { playSound } from "@/lib/soundEffects";
import { useTranslation } from "react-i18next";

// ─── Phase definitions ────────────────────────────────────────────────────────
// PHASE 0 – idle (not open)
// PHASE 1 – charging  (1.4s): chest vibrates, energy orbs fly in
// PHASE 2 – cracking  (0.6s): screen flash, crack lines
// PHASE 3 – burst     (1.2s): shockwave ring, ray beams, pixel confetti
// PHASE 4 – reveal    (∞):   item floats up, stats appear, equip button

// ─── Canvas Shockwave + Rays ──────────────────────────────────────────────────
function ShockwaveCanvas({ color, active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const duration = 900;

    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const RAY_COUNT = 16;
    const rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
      angle: (i / RAY_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      width: 2 + Math.random() * 5,
      len: 0.25 + Math.random() * 0.35,
    }));

    startRef.current = null;

    const frame = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, W, H);

      // Shockwave ring
      const ringRadius = t * Math.min(W, H) * 0.55;
      const ringAlpha = Math.max(0, 1 - t * 1.4);
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${ringAlpha})`;
      ctx.lineWidth = (1 - t) * 18 + 2;
      ctx.stroke();

      // Second ring (slightly delayed)
      if (t > 0.12) {
        const t2 = Math.min((t - 0.12) / 0.88, 1);
        const ringRadius2 = t2 * Math.min(W, H) * 0.45;
        const ringAlpha2 = Math.max(0, 1 - t2 * 1.6) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${ringAlpha2})`;
        ctx.lineWidth = (1 - t2) * 10 + 1;
        ctx.stroke();
      }

      // Light rays
      const rayT = Math.min(t * 1.8, 1);
      const halfSize = Math.min(W, H) * 0.5;
      rays.forEach((ray) => {
        const len = ray.len * halfSize * rayT;
        const alpha = Math.max(0, 0.7 - t * 0.9);
        const grad = ctx.createLinearGradient(
          cx, cy,
          cx + Math.cos(ray.angle) * len,
          cy + Math.sin(ray.angle) * len
        );
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.8})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(ray.angle) * len,
          cy + Math.sin(ray.angle) * len
        );
        ctx.strokeStyle = grad;
        ctx.lineWidth = ray.width * (1 - t * 0.6);
        ctx.stroke();
      });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, color]);

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={420}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}

// ─── Pixel confetti burst ─────────────────────────────────────────────────────
const CHARS = ["■", "▪", "◆", "★", "✦", "▲", "●", "◉", "✸", "❋"];

function PixelConfetti({ color, active }) {
  const particles = useRef(
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      char: CHARS[i % CHARS.length],
      angle: (360 / 32) * i + (Math.random() - 0.5) * 22,
      dist: 60 + Math.random() * 120,
      size: 8 + Math.random() * 10,
      delay: Math.random() * 0.18,
      duration: 0.55 + Math.random() * 0.4,
    }))
  );

  return (
    <AnimatePresence>
      {active && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ zIndex: 10 }}
        >
          {particles.current.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist;
            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: tx, y: ty, opacity: 0, scale: 0.2, rotate: 180 }}
                transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                className="absolute font-mono select-none"
                style={{ color, fontSize: p.size, lineHeight: 1 }}
              >
                {p.char}
              </motion.span>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Orbiting energy orbs (Phase 1) ──────────────────────────────────────────
function EnergyOrbs({ color, count = 8 }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const radius = 72;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: "50%", top: "50%", zIndex: 4 }}
            animate={{
              x: [x, x * 0.3, x],
              y: [y, y * 0.3, y],
              opacity: [0, 1, 0],
              scale: [0, 1.2, 0],
            }}
            transition={{
              duration: 1.2,
              delay: i * 0.08,
              ease: "easeInOut",
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                background: color,
                boxShadow: `0 0 8px ${color}, 0 0 16px ${color}88`,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Crack lines SVG overlay ──────────────────────────────────────────────────
function CrackLines({ color }) {
  const lines = [
    "M 210 210 L 140 80",
    "M 210 210 L 300 60",
    "M 210 210 L 360 190",
    "M 210 210 L 320 330",
    "M 210 210 L 90 340",
    "M 210 210 L 50 200",
    "M 210 210 L 80 120",
  ];
  return (
    <motion.svg
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 1.3] }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      viewBox="0 0 420 420"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 6 }}
    >
      {lines.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={1.5 - i * 0.1}
          fill="none"
          initial={{ pathLength: 0, opacity: 0.9 }}
          animate={{ pathLength: 1, opacity: 0 }}
          transition={{ duration: 0.4, delay: i * 0.025, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      ))}
    </motion.svg>
  );
}

// ─── SSS/SS legendary shimmer ─────────────────────────────────────────────────
function LegendaryShimmer({ gearClass }) {
  if (gearClass !== "SSS" && gearClass !== "SS") return null;
  const isSSSClass = gearClass === "SSS";
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
      style={{ zIndex: 2 }}
    >
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{
          duration: isSSSClass ? 1.8 : 2.4,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: isSSSClass ? 0.4 : 1.2,
        }}
        className="absolute inset-y-0 w-1/3"
        style={{
          background: isSSSClass
            ? "linear-gradient(90deg, transparent, rgba(255,0,128,0.2), rgba(255,140,0,0.3), rgba(255,215,0,0.4), rgba(0,255,136,0.2), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,215,0,0.3), rgba(255,255,255,0.4), rgba(255,215,0,0.3), transparent)",
        }}
      />
    </motion.div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length < 6) return "255,255,255";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * AnimatedChestModal — full-screen cinematic chest-opening experience
 *
 * Props:
 *   open            {boolean}       mount the modal
 *   chest           {object|null}   { chest_type, name, icon_url }
 *   wonItem         {object|null}   { name, gear_class, icon_url, stats, slot_type, description, code }
 *   isEquipped      {boolean}
 *   isEquipping     {boolean}
 *   onEquip         {function}
 *   onClose         {function}
 *   chestThemeColor {string}        hex accent color
 */
export default function AnimatedChestModal({
  open,
  chest,
  wonItem,
  isEquipped,
  isEquipping,
  onEquip,
  onClose,
  chestThemeColor = "#f59e0b",
  equipLabel,
  equippedLabel,
  disableEquip = false,
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(0);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const chestControls = useAnimation();
  const timerRefs = useRef([]);

  const itemColor = wonItem ? (wonItem.color || getGearClassColor(wonItem.gear_class)) : chestThemeColor;

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  const addTimer = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timerRefs.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase(0);
      setShockwaveActive(false);
      setConfettiActive(false);
      setScreenFlash(false);
      clearTimers();
      return;
    }

    if (!wonItem) {
      // Phase 1: waiting for API response — chest vibrates
      setPhase(1);
      chestControls.start({
        x: [0, -3, 3, -2, 2, -1, 1, 0],
        rotate: [0, -1.5, 1.5, -1, 1, 0],
        transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
      });
      return;
    }

    // wonItem just arrived → run phases 2 → 3 → 4
    clearTimers();
    chestControls.stop();

    // Phase 2: crack
    setPhase(2);
    setScreenFlash(true);
    playSound("chest_open");

    addTimer(() => setScreenFlash(false), 300);

    chestControls.start({
      x: [0, -8, 8, -6, 6, -4, 4, 0],
      scale: [1, 1.08, 0.94, 1.05, 1],
      rotate: [0, -3, 3, -2, 0],
      filter: ["brightness(1)", "brightness(3)", "brightness(1)"],
      transition: { duration: 0.55, ease: "easeOut" },
    });

    // Phase 3: burst
    addTimer(() => {
      setPhase(3);
      setShockwaveActive(true);
      setConfettiActive(true);
      playSound("critical");

      chestControls.start({
        scale: [1, 1.15, 0.92, 1],
        opacity: [1, 1, 0],
        transition: { duration: 0.6, ease: "easeOut" },
      });
    }, 560);

    addTimer(() => setShockwaveActive(false), 1700);
    addTimer(() => setConfettiActive(false), 1500);

    // Phase 4: reveal
    addTimer(() => {
      setPhase(4);
      playSound("achievement");
    }, 1200);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wonItem]);

  if (!open || !chest) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="chest-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          background: "rgba(2, 1, 10, 0.96)",
          backdropFilter: "blur(12px)",
          paddingTop: "max(1rem, env(safe-area-inset-top, 16px))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 16px))",
          touchAction: phase === 4 ? "auto" : "none",
        }}
      >
        {/* Screen flash */}
        <AnimatePresence>
          {screenFlash && (
            <motion.div
              key="screen-flash"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: itemColor, zIndex: 20, mixBlendMode: "screen" }}
            />
          )}
        </AnimatePresence>

        {/* ── PHASES 1-3: Chest cinematic ── */}
        <AnimatePresence mode="wait">
          {phase < 4 && (
            <motion.div
              key="chest-stage"
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.3, y: -30 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative flex flex-col items-center gap-5"
            >
              {/* Ambient glow pulse */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                animate={
                  phase === 1
                    ? { opacity: [0.3, 0.7, 0.3], scale: [1, 1.08, 1] }
                    : { opacity: [0.8, 0.2], scale: [1, 2] }
                }
                transition={{
                  duration: phase === 1 ? 1.2 : 0.6,
                  repeat: phase === 1 ? Infinity : 0,
                  ease: "easeInOut",
                }}
                style={{
                  width: 200,
                  height: 200,
                  background: `radial-gradient(circle, ${chestThemeColor}55 0%, transparent 70%)`,
                  zIndex: 1,
                }}
              />

              {/* Canvas shockwave (Phase 3) */}
              <div
                className="absolute pointer-events-none"
                style={{
                  width: 420,
                  height: 420,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <ShockwaveCanvas color={chestThemeColor} active={shockwaveActive} />
              </div>

              {/* Pixel confetti (Phase 3) */}
              <div
                className="absolute pointer-events-none flex items-center justify-center"
                style={{ inset: 0, zIndex: 10 }}
              >
                <PixelConfetti color={chestThemeColor} active={confettiActive} />
              </div>

              {/* Crack SVG (Phase 2) */}
              {phase === 2 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    width: 420,
                    height: 420,
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <CrackLines color={chestThemeColor} />
                </div>
              )}

              {/* Energy orbs (Phase 1) */}
              {phase === 1 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <EnergyOrbs color={chestThemeColor} count={8} />
                </div>
              )}

              {/* Chest image */}
              <motion.div
                animate={chestControls}
                className="relative w-36 h-36 flex items-center justify-center"
                style={{ zIndex: 3 }}
              >
                {chest.icon_url ? (
                  <img
                    src={getMediaUrl(chest.icon_url)}
                    alt={chest.name}
                    className="w-full h-full object-contain"
                    style={{
                      imageRendering: "pixelated",
                      filter:
                        phase === 1
                          ? `drop-shadow(0 0 12px ${chestThemeColor}) drop-shadow(0 0 30px ${chestThemeColor}88)`
                          : `drop-shadow(0 0 6px ${chestThemeColor}88)`,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 72 }}>📦</span>
                )}
              </motion.div>

              {/* Spinning dashed ring (Phase 1) */}
              {phase === 1 && !wonItem && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="absolute pointer-events-none rounded-full"
                  style={{
                    width: 170,
                    height: 170,
                    border: `2px dashed ${chestThemeColor}55`,
                    zIndex: 2,
                  }}
                />
              )}

              {/* Phase label */}
              <motion.div
                key={`label-${phase}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold"
                style={{ color: chestThemeColor, textShadow: `0 0 10px ${chestThemeColor}` }}
              >
                {phase === 1 && !wonItem && t("chest_modal.decrypting", "DECRYPTING...")}
                {phase === 2 && t("chest_modal.cracking", "CRACKING SHELL...")}
                {phase === 3 && t("chest_modal.releasing", "RELEASING CONTENTS...")}
              </motion.div>

              <div
                className="font-mono text-xs font-black tracking-wider uppercase"
                style={{ color: `${chestThemeColor}cc` }}
              >
                {chest.name}
              </div>
            </motion.div>
          )}

          {/* ── PHASE 4: Item reveal ── */}
          {phase === 4 && wonItem && (
            <motion.div
              key="item-reveal"
              initial={{ opacity: 0, y: 40, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative rounded-2xl border-2 overflow-hidden flex flex-col max-h-[88svh]"
                style={{
                  borderColor: itemColor,
                  background: `linear-gradient(160deg, rgba(0,0,0,0.97) 0%, rgba(${hexToRgb(itemColor)}, 0.07) 100%)`,
                  boxShadow: `0 0 40px ${itemColor}55, 0 0 80px ${itemColor}22, inset 0 0 30px ${itemColor}08`,
                }}
              >
                {/* Scanlines */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.025]"
                  style={{
                    background:
                      "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)",
                  }}
                />

                {/* SS/SSS shimmer */}
                <LegendaryShimmer gearClass={wonItem.gear_class} />

                {/* Corner brackets */}
                {[
                  ["top-0 left-0", "8px 0 0 0"],
                  ["top-0 right-0", "0 8px 0 0"],
                  ["bottom-0 right-0", "0 0 8px 0"],
                  ["bottom-0 left-0", "0 0 0 8px"],
                ].map(([pos, radius], idx) => (
                  <div
                    key={idx}
                    className={`absolute ${pos} w-4 h-4 pointer-events-none`}
                    style={{
                      border: `2px solid ${itemColor}`,
                      borderRadius: radius,
                      opacity: 0.7,
                    }}
                  />
                ))}

                <div className="p-6 overflow-y-auto">
                  {/* DECRYPTION COMPLETE badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center justify-center gap-1.5 mb-3"
                  >
                    <Zap className="w-3 h-3" style={{ color: itemColor }} />
                    <span
                      className="font-mono text-[9px] tracking-[0.35em] uppercase font-bold"
                      style={{ color: `${itemColor}cc` }}
                    >
                      {t("chest_modal.decryption_complete", "[ DECRYPTION COMPLETE ]")}
                    </span>
                    <Zap className="w-3 h-3" style={{ color: itemColor }} />
                  </motion.div>

                  {/* Gear class or Mutator badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.18, type: "spring", stiffness: 300 }}
                    className="flex items-center justify-center gap-2 mb-2"
                  >
                    <span
                      className="font-mono text-[10px] font-black px-2 py-0.5 rounded border"
                      style={{
                        color: itemColor,
                        borderColor: `${itemColor}60`,
                        background: `${itemColor}18`,
                        boxShadow: `0 0 8px ${itemColor}44`,
                        ...(wonItem.gear_class === "SSS" && {
                          background:
                            "linear-gradient(90deg,#ff0080,#ff8c00,#FFD700,#00ff88,#00cfff,#CC00FF)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          filter: "drop-shadow(0 0 6px #CC00FF)",
                        }),
                      }}
                    >
                      {wonItem.isMutator ? (wonItem.badge || "MUTATOR") : wonItem.gear_class}
                    </span>
                    <span
                      className="font-mono text-[10px] tracking-wider font-bold"
                      style={{ color: itemColor }}
                    >
                      {wonItem.isMutator ? (wonItem.categoryName || wonItem.category?.toUpperCase()) : GEAR_CLASS_NAMES[wonItem.gear_class]}
                    </span>
                  </motion.div>

                  {/* Item name */}
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.24 }}
                    className="text-center text-lg font-mono font-black tracking-wider uppercase mb-4"
                    style={{
                      color: itemColor,
                      textShadow: `0 0 20px ${itemColor}88, 0 0 40px ${itemColor}44`,
                    }}
                  >
                    {wonItem.name}
                  </motion.h2>

                  {/* Floating item icon */}
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 220, damping: 16 }}
                    className="flex justify-center mb-4"
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                      className="relative"
                    >
                      <div
                        className="w-24 h-24 border flex items-center justify-center relative overflow-hidden"
                        style={{
                          borderColor: `${itemColor}60`,
                          background: `radial-gradient(circle at 50% 50%, ${itemColor}15 0%, transparent 70%)`,
                          boxShadow: `0 0 20px ${itemColor}33, inset 0 0 15px ${itemColor}11`,
                          imageRendering: "pixelated",
                        }}
                      >
                        {/* Corner px brackets */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: itemColor }} />
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: itemColor }} />
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: itemColor }} />
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: itemColor }} />

                        {wonItem.icon_url ? (
                          <img
                            src={getMediaUrl(wonItem.icon_url)}
                            alt={wonItem.name}
                            className="w-[80%] h-[80%] object-contain"
                            style={{
                              imageRendering: "pixelated",
                              filter: `drop-shadow(0 0 6px ${itemColor}88)`,
                            }}
                          />
                        ) : (
                          <span className="font-mono text-3xl" style={{ color: itemColor }}>
                            ?
                          </span>
                        )}
                      </div>

                      {/* Glow shadow below item */}
                      <motion.div
                        animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          width: 60,
                          height: 12,
                          background: `radial-gradient(ellipse, ${itemColor}55 0%, transparent 70%)`,
                          filter: "blur(4px)",
                        }}
                      />
                    </motion.div>
                  </motion.div>

                  {/* Description */}
                  {wonItem.description && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.45 }}
                      className="text-xs font-mono text-center leading-relaxed px-1 mb-3"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {wonItem.description}
                    </motion.p>
                  )}

                  {/* Stats */}
                  {wonItem.stats && Object.keys(wonItem.stats).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.52 }}
                      className="p-3 mb-4 rounded border"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        className="text-[8px] font-mono uppercase tracking-widest text-center mb-2"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        {t("chest_modal.modifications", "MODIFICATIONS")}
                      </div>
                      <div className="space-y-1">
                        {Object.entries(wonItem.stats).map(([stat, val]) => (
                          <div
                            key={stat}
                            className="flex justify-between items-center text-xs font-mono"
                          >
                            <span className="uppercase text-white/50">
                              {stat.replace(/_/g, " ")}
                            </span>
                            <motion.span
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 }}
                              className="font-bold"
                              style={{ color: itemColor }}
                            >
                              +{val}
                            </motion.span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Slot or Mutator info */}
                  {wonItem.isMutator ? (
                    <div className="flex flex-col items-center gap-1.5 mb-5">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-white/40">
                        {t("chest_modal.category", "CATEGORY")}: <span className="font-bold" style={{ color: itemColor }}>{wonItem.categoryName || wonItem.category?.toUpperCase()}</span>
                      </div>
                      {wonItem.synergyName && (
                        <div className="text-[9px] font-mono text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1">
                          <span>⚡ {t("chest_modal.synergy", "SYNERGY")}:</span>
                          <span className="font-bold text-white">{wonItem.synergyName}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="text-center text-[8px] font-mono uppercase tracking-widest mb-5"
                      style={{ color: "rgba(255,255,255,0.2)" }}
                    >
                      {t("chest_modal.slot", {
                        slot: wonItem.slot_type?.replace(/_/g, " ") || "unknown",
                        defaultValue: `Slot: ${wonItem.slot_type?.replace(/_/g, " ") || "unknown"}`,
                      })}
                    </div>
                  )}

                  {/* Action buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="flex flex-col gap-2"
                  >
                    {!isEquipped ? (
                      <button
                        onClick={onEquip}
                        disabled={isEquipping || disableEquip}
                        className="h-11 font-mono text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        style={{
                          background: itemColor,
                          borderColor: itemColor,
                          color: "#000",
                          boxShadow: `0 0 16px ${itemColor}55`,
                        }}
                      >
                        {isEquipping ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          equipLabel || (wonItem.isMutator ? t("chest_modal.activate_mutator", "ACTIVATE MUTATOR") : t("chest_modal.equip", "EQUIP CYBERWARE"))
                        )}
                      </button>
                    ) : (
                      <div className="h-11 font-mono text-xs font-bold border border-green-500/30 text-green-400 bg-green-500/10 flex items-center justify-center gap-1.5 select-none rounded">
                        <CheckCircle2 className="w-4 h-4" />
                        {equippedLabel || (wonItem.isMutator ? t("chest_modal.mutator_active", "MUTATOR ACTIVE") : t("chest_modal.equipped", "EQUIPPED TO SYSTEM"))}
                      </div>
                    )}

                    <button
                      onClick={onClose}
                      className="h-11 font-mono text-xs font-bold border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.03] flex items-center justify-center transition-colors select-none active:scale-[0.98] cursor-pointer rounded"
                    >
                      {t("chest_modal.dismiss", "DISMISS")}
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button (phase 4 only) */}
        {phase === 4 && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            style={{ zIndex: 30 }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
