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

// Glow ring with gradient segments for Gf, Gc, Ps, Vm
export default function IQDisplay({ gf, gc, ps, vm, gfCeiling, gcCeiling, psCeiling, vmCeiling }) {
  const safeGf = gf || 100.0;
  const safeGc = gc || 100.0;
  const safePs = ps || 100.0;
  const safeVm = vm || 100.0;
  
  const safeGfCeiling = gfCeiling || 105.0;
  const safeGcCeiling = gcCeiling || 105.0;
  const safePsCeiling = psCeiling || 105.0;
  const safeVmCeiling = vmCeiling || 105.0;

  const iq = calculateIQ(safeGf, safeGc, safePs, safeVm);
  const potentialIQ = calculateIQ(safeGfCeiling, safeGcCeiling, safePsCeiling, safeVmCeiling);
  const level = getLevelTitle(iq);

  const [displayIQ, setDisplayIQ] = useState(iq);
  const [gained, setGained] = useState(null);

  useEffect(() => {
    const start = displayIQ;
    const end = iq;
    if (Math.abs(start - end) < 0.05) return;

    if (end > start) {
      const diff = (end - start).toFixed(2);
      setGained(`+${diff}`);
      const timer = setTimeout(() => setGained(null), 1800);
      return () => clearTimeout(timer);
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
  }, [iq]);

  // Calculate percentage of progress from 80 to ceiling for each metric
  const gfPct = Math.max(0, Math.min(1, (safeGf - 80) / (safeGfCeiling - 80 || 1)));
  const gcPct = Math.max(0, Math.min(1, (safeGc - 80) / (safeGcCeiling - 80 || 1)));
  const psPct = Math.max(0, Math.min(1, (safePs - 80) / (safePsCeiling - 80 || 1)));
  const vmPct = Math.max(0, Math.min(1, (safeVm - 80) / (safeVmCeiling - 80 || 1)));

  const size = 144;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2; // (144 - 5) / 2 = 69.5
  const circumference = 2 * Math.PI * radius; // ~436.68
  const quadLength = circumference / 4; // ~109.17
  const segmentLength = quadLength - 2; // small gap between quadrants

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
        {/* Pulsing glow ring container (achievement style) */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 136,
            height: 136,
            border: `2px solid ${level.color}33`,
            boxShadow: `0 0 25px ${level.color}30, inset 0 0 15px ${level.color}15`,
          }}
          animate={{
            scale: [1, 1.03, 1],
            opacity: [0.6, 0.9, 0.6],
            boxShadow: [
              `0 0 20px ${level.color}20, inset 0 0 10px ${level.color}10`,
              `0 0 35px ${level.color}50, inset 0 0 20px ${level.color}25`,
              `0 0 20px ${level.color}20, inset 0 0 10px ${level.color}10`,
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Pulsing bg */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 112, height: 112, background: `radial-gradient(circle, ${level.color}22 0%, transparent 80%)` }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Gradient Segment Ring SVG */}
        <svg width={size} height={size} className="absolute inset-0 z-0">
          <defs>
            <linearGradient id="gf-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="gc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#047857" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="ps-grad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b45309" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="vm-grad" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#7e22ce" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {/* Underlay / Track for each segment */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
          
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3b82f610" strokeWidth={strokeWidth} strokeDasharray={`${segmentLength} ${circumference - segmentLength}`} transform="rotate(-89 72 72)" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#22c55e10" strokeWidth={strokeWidth} strokeDasharray={`${segmentLength} ${circumference - segmentLength}`} transform="rotate(1 72 72)" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f59e0b10" strokeWidth={strokeWidth} strokeDasharray={`${segmentLength} ${circumference - segmentLength}`} transform="rotate(91 72 72)" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#a855f710" strokeWidth={strokeWidth} strokeDasharray={`${segmentLength} ${circumference - segmentLength}`} transform="rotate(181 72 72)" />

          {/* Gf Segment (Top-Right: -90deg to 0deg) */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="url(#gf-grad)" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            initial={{ strokeDashoffset: segmentLength }}
            animate={{ strokeDashoffset: segmentLength - (gfPct * segmentLength) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(-89 72 72)"
          />

          {/* Gc Segment (Bottom-Right: 0deg to 90deg) */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="url(#gc-grad)" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            initial={{ strokeDashoffset: segmentLength }}
            animate={{ strokeDashoffset: segmentLength - (gcPct * segmentLength) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(1 72 72)"
          />

          {/* Ps Segment (Bottom-Left: 90deg to 180deg) */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="url(#ps-grad)" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            initial={{ strokeDashoffset: segmentLength }}
            animate={{ strokeDashoffset: segmentLength - (psPct * segmentLength) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(91 72 72)"
          />

          {/* Vm Segment (Top-Left: 180deg to 270deg) */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="url(#vm-grad)" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            initial={{ strokeDashoffset: segmentLength }}
            animate={{ strokeDashoffset: segmentLength - (vmPct * segmentLength) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(181 72 72)"
          />
        </svg>

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
            style={{ fontFamily: "'PixeloidSans'", fontSize: "1.25rem", color: level.color, lineHeight: 1 }}
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
            style={{ fontFamily: "'PixeloidSans'", fontSize: 9, color: "#22c55e", pointerEvents: "none", textShadow: "0 0 8px #22c55e66" }}
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
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full animate-pulse"
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
          Potential: <span style={{ color: "#c4c2cc", fontWeight: 700 }}>{potentialIQ.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}