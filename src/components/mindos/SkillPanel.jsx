import { useState, useEffect } from "react";
import { CLASSES, saveRPGData } from "@/lib/rpgSystem";
import { motion, AnimatePresence } from "framer-motion";
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatCountdown(ms) {
  if (ms <= 0) return "READY";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SkillPanel({ classId, classData, onUseSkill }) {
  const now = useNow();
  const cls = CLASSES[classId];
  const [glowing, setGlowing] = useState(null);
  const [shaking, setShaking] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [toast, setToast] = useState(null);
  const { bursts, trigger: triggerBurst } = usePixelBurst();

  if (!cls) return null;

  const getSkillState = (sk) => {
    const stored = (classData.skills || []).find(s => s.id === sk.id);
    const cdUntil = stored?.cooldownUntil || 0;
    const remaining = cdUntil - now;
    const onCooldown = remaining > 0;
    const hasMana = (classData.mana || 0) >= sk.mana;
    return { onCooldown, remaining, hasMana, available: !onCooldown && hasMana };
  };

  const activateSkill = (skill) => {
    const state = getSkillState(skill);
    if (!state.available) return;

    const newMana = (classData.mana || 0) - skill.mana;
    const cdUntil = Date.now() + skill.cooldownH * 3600000;
    const existingSkills = classData.skills || [];
    const newSkills = existingSkills.filter(s => s.id !== skill.id).concat({ id: skill.id, cooldownUntil: cdUntil });

    const newClassData = { ...classData, mana: newMana, skills: newSkills };
    saveRPGData("mindos_class", newClassData);
    onUseSkill(skill, newClassData);

    // Pixel art animations
    setGlowing(skill.id);
    setShaking(skill.id);
    setFlashId(skill.id);
    triggerBurst(cls.color, 10);
    setTimeout(() => setGlowing(null), 1800);
    setTimeout(() => setShaking(null), 500);
    setTimeout(() => setFlashId(null), 400);

    setToast(`${skill.name} activated!`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Active Skills</div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="px-3 py-2 rounded-lg text-xs font-mono font-bold text-center relative overflow-hidden"
            style={{ background: `${cls.color}20`, color: cls.color, border: `1px solid ${cls.color}60` }}
          >
            {/* Pixel scanlines on toast */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
              style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff08 2px, #ffffff08 4px)" }} />
            ⚡ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mana bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
          <span>MANA</span>
          <span style={{ color: cls.color }}>{classData.mana || 0}/{classData.maxMana || cls.maxMana}</span>
        </div>
        <div className="h-2 rounded-none bg-muted overflow-hidden" style={{ imageRendering: "pixelated" }}>
          <motion.div
            className="h-full"
            animate={{ width: `${Math.min(100, ((classData.mana || 0) / (classData.maxMana || cls.maxMana)) * 100)}%` }}
            transition={{ duration: 0.5, ease: "steps(10)" }}
            style={{ background: cls.color, boxShadow: `0 0 8px ${cls.color}88` }}
          />
        </div>
      </div>

      {cls.skills.map((skill, idx) => {
        const state = getSkillState(skill);
        const isGlowing = glowing === skill.id;
        const isShaking = shaking === skill.id;
        const isFlashing = flashId === skill.id;

        return (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{
              opacity: 1,
              x: isShaking ? [-4, 4, -3, 3, -2, 2, 0] : 0,
              boxShadow: isGlowing
                ? [`0 0 0px transparent`, `0 0 20px ${cls.color}`, `0 0 35px ${cls.color}`, `0 0 20px ${cls.color}`, `0 0 0px transparent`]
                : `0 0 0px transparent`,
            }}
            transition={{
              opacity: { duration: 0.25, delay: idx * 0.07 },
              x: isShaking ? { duration: 0.45, ease: "easeOut" } : { duration: 0.25, delay: idx * 0.07 },
              boxShadow: { duration: 1.8, ease: "easeInOut" },
            }}
            className="p-3 rounded-xl border space-y-2 relative overflow-hidden"
            style={{
              borderColor: state.available ? `${cls.color}60` : "#1e1a38",
              background: "#0a0818",
              imageRendering: "pixelated",
            }}
          >
            {/* Pixel scanlines background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, #ffffff 3px, #ffffff 4px)" }} />

            {/* Flash overlay */}
            <PixelFlash active={isFlashing} color={cls.color} />

            {/* Burst particles relative to this card */}
            {isGlowing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <PixelBurstLayer bursts={bursts} />
              </div>
            )}

            <div className="flex items-start justify-between gap-2 relative">
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold flex items-center gap-1.5" style={{ color: state.available ? cls.color : "#4a4060" }}>
                  {/* Pixel "ready" indicator */}
                  {state.available && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="text-[8px]"
                    >■</motion.span>
                  )}
                  {skill.name}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 leading-relaxed">{skill.desc}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-mono font-bold" style={{ color: state.hasMana ? cls.color : "#ef4444" }}>
                  {skill.mana} MP
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 tracking-widest">
                  {formatCountdown(state.remaining)}
                </div>
              </div>
            </div>

            <motion.button
              onClick={() => activateSkill(skill)}
              disabled={!state.available}
              whileTap={state.available ? { scale: 0.92, y: 2 } : {}}
              className="w-full py-1.5 text-[10px] font-mono font-bold rounded-none transition-colors relative overflow-hidden"
              style={{
                background: state.available ? `${cls.color}25` : "#1e1a38",
                color: state.available ? cls.color : "#4a4060",
                border: `2px solid ${state.available ? cls.color + "80" : "#1e1a38"}`,
                cursor: state.available ? "pointer" : "not-allowed",
                imageRendering: "pixelated",
              }}
            >
              {/* Pixel shimmer on available */}
              {state.available && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1.5 }}
                  style={{ background: `linear-gradient(90deg, transparent, ${cls.color}30, transparent)`, width: "60%" }}
                />
              )}
              <span className="relative z-10">
                {state.onCooldown ? `⧗ ${formatCountdown(state.remaining)}` : !state.hasMana ? "✗ NOT ENOUGH MANA" : "► USE SKILL"}
              </span>
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}