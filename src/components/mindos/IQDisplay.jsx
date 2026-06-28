import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getLevelTitle, calculateIQ } from "@/lib/cognitiveEngine";

const METRIC_COLORS = {
  gf: "#3b82f6", gc: "#22c55e", ps: "#f59e0b", vm: "#a855f7"
};

function OrbitParticle({ angle, radius, color, size, delay }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, background: color, top: "50%", left: "50%", marginLeft: -size / 2, marginTop: -size / 2 }}
      animate={{
        x: [Math.cos(angle) * radius, Math.cos(angle + Math.PI * 2) * radius],
        y: [Math.sin(angle) * radius, Math.sin(angle + Math.PI * 2) * radius],
        opacity: [0.7, 1, 0.7],
        scale: [1, 1.5, 1],
      }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: "linear", delay }}
    />
  );
}

function GlowRing({ progress, color, size, strokeWidth = 4 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = typeof progress === "number" && !isNaN(progress) ? progress : 0;
  const dash = safeProgress * circumference;

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90" style={{ top: 0, left: 0 }}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color + "22"} strokeWidth={strokeWidth} />
      {/* Progress */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference - (isNaN(dash) ? 0 : dash) }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

export default function IQDisplay({ gf, gc, ps, vm, gfCeiling, gcCeiling, psCeiling, vmCeiling }) {
  const safeGf = gf || 100.0;
  const safeGc = gc || 100.0;
  const safePs = ps || 100.0;
  const safeVm = vm || 100.0;
  
  const safeGfCeiling = gfCeiling || 120.0;
  const safeGcCeiling = gcCeiling || 135.0;
  const safePsCeiling = psCeiling || 112.0;
  const safeVmCeiling = vmCeiling || 138.0;

  const iq = calculateIQ(safeGf, safeGc, safePs, safeVm);
  const potentialIQ = calculateIQ(safeGfCeiling, safeGcCeiling, safePsCeiling, safeVmCeiling);
  const level = getLevelTitle(iq);

  const [displayIQ, setDisplayIQ] = useState(iq);
  const [prevIQ, setPrevIQ] = useState(iq);
  const [gained, setGained] = useState(null);

  useEffect(() => {
    const start = displayIQ;
    const end = iq;
    if (Math.abs(start - end) < 0.05) return;

    if (end > start) {
      const diff = (end - start).toFixed(2);
      setGained(`+${diff}`);
      setTimeout(() => setGained(null), 1800);
    }

    const duration = 800;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayIQ(Math.round((start + (end - start) * eased) * 10) / 10);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    setPrevIQ(iq);
  }, [iq]);

  // Progress toward max IQ
  const progress = Math.min(1, (iq - 80) / (potentialIQ - 80 || 1));

  const particles = [
    { angle: 0, radius: 66, color: METRIC_COLORS.gf, size: 5, delay: 0 },
    { angle: Math.PI * 0.5, radius: 66, color: METRIC_COLORS.gc, size: 4, delay: 1 },
    { angle: Math.PI, radius: 66, color: METRIC_COLORS.ps, size: 5, delay: 0.5 },
    { angle: Math.PI * 1.5, radius: 66, color: METRIC_COLORS.vm, size: 4, delay: 1.5 },
    { angle: Math.PI * 0.25, radius: 52, color: METRIC_COLORS.gf + "99", size: 3, delay: 2 },
    { angle: Math.PI * 0.75, radius: 52, color: METRIC_COLORS.gc + "99", size: 3, delay: 2.5 },
    { angle: Math.PI * 1.25, radius: 52, color: METRIC_COLORS.ps + "99", size: 3, delay: 3 },
    { angle: Math.PI * 1.75, radius: 52, color: METRIC_COLORS.vm + "99", size: 3, delay: 0.8 },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-4 px-2">
      {/* IQ circle */}
      <div className="relative flex items-center justify-center" style={{ width: 144, height: 144 }}>
        {/* Glow rings */}
        <GlowRing progress={progress} color={level.color} size={144} strokeWidth={3} />

        {/* Pulsing bg */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 112, height: 112, background: `radial-gradient(circle, ${level.color}22 0%, transparent 80%)` }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Orbit particles */}
        {particles.map((p, i) => <OrbitParticle key={i} {...p} />)}

        {/* Inner circle */}
        <div
          className="relative z-10 flex flex-col items-center justify-center w-24 h-24 rounded-full"
          style={{
            background: "radial-gradient(circle, #f8f6ff 0%, #f0eeff 100%)",
            boxShadow: `0 0 0 2px ${level.color}44, 0 4px 24px rgba(123,97,255,0.2)`,
          }}
        >
          <motion.div
            key={Math.round(displayIQ * 10)}
            style={{ fontFamily: "'Press Start 2P'", fontSize: "1.25rem", color: level.color, lineHeight: 1 }}
          >
            {displayIQ.toFixed(1)}
          </motion.div>
          <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 8, color: "#878190", marginTop: 4, letterSpacing: "0.1em" }}>
            IQ
          </div>
        </div>

        {/* +gain float */}
        {gained && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{ opacity: 1, y: -32, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6 }}
            className="absolute top-4 right-0 z-20"
            style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: "#22c55e", pointerEvents: "none", textShadow: "0 0 8px #22c55e66" }}
          >
            {gained}
          </motion.div>
        )}
      </div>

      {/* Level title */}
      <motion.div
        key={level.title}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-3 text-center"
      >
        <div
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
          style={{
            fontFamily: "'Nunito'",
            color: level.color,
            border: `2px solid ${level.color}55`,
            background: `${level.color}15`,
            boxShadow: `0 0 12px ${level.color}33`,
          }}
        >
          {level.title}
        </div>
      </motion.div>

      {/* Potential IQ */}
      <div className="mt-2 text-center">
        <span style={{ fontFamily: "'Nunito'", fontSize: 11, color: "#878190" }}>
          Potential: <span style={{ color: "#2b2738", fontWeight: 700 }}>{potentialIQ.toFixed(1)}</span>
        </span>
      </div>

      {/* Mini metric dots */}
      <div className="flex gap-1.5 mt-2">
        {Object.entries(METRIC_COLORS).map(([k, c]) => (
          <motion.div
            key={k}
            className="w-2 h-2 rounded-full"
            style={{ background: c }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, delay: Object.keys(METRIC_COLORS).indexOf(k) * 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}