import { useState, useEffect, useRef } from "react";
import OptimizedImage from "./OptimizedImage";
import { Play, Pause, RotateCcw, Settings, X, Zap, Coffee, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { id: "classic", label: "Classic", work: 25, break: 5, longBreak: 15, cycles: 4 },
  { id: "short", label: "Short", work: 15, break: 3, longBreak: 10, cycles: 4 },
  { id: "deep", label: "Deep", work: 50, break: 10, longBreak: 30, cycles: 3 },
];

// Characters per mode with their image URLs
const CHARACTERS = {
  work: {
    name: "BEATRIX",
    image: "/images/original/5325ab6bf_pomodorp3.png",
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.5)",
    accent: "#3b82f6",
    label: "FOCUS MODE",
    particles: ["#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe"],
  },
  break: {
    name: "LIGHTNING",
    image: "/images/original/fa6645d8f_pomodorp2.png",
    color: "#f472b6",
    glow: "rgba(244,114,182,0.5)",
    accent: "#ec4899",
    label: "SHORT BREAK",
    particles: ["#ec4899", "#f472b6", "#a855f7", "#e879f9"],
  },
  longBreak: {
    name: "SUMMONER",
    image: "/images/original/cb162ffce_pomodorp1.png",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.5)",
    accent: "#8b5cf6",
    label: "LONG REST",
    particles: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#fbbf24"],
  },
};

// Floating particles component
function Particles({ colors, count = 18, active }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 5 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 3,
      dx: (Math.random() - 0.5) * 40,
      dy: -(Math.random() * 60 + 20),
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
          animate={active ? {
            y: [0, p.dy, p.dy * 1.5],
            x: [0, p.dx],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          } : { opacity: 0 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// Orbiting ring animation
function OrbitRing({ color, radius, duration, reverse }) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{
        width: radius * 2,
        height: radius * 2,
        top: "50%",
        left: "50%",
        marginTop: -radius,
        marginLeft: -radius,
        borderColor: `${color}40`,
      }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      <div
        className="absolute w-2.5 h-2.5 rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
    </motion.div>
  );
}

export default function PomodoroPanel() {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [customSettings, setCustomSettings] = useState({ ...PRESETS[0] });
  const [mode, setMode] = useState("work");
  const [timeLeft, setTimeLeft] = useState(PRESETS[0].work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);

  const char = CHARACTERS[mode];
  const totalTime = mode === "work" ? preset.work * 60 : mode === "break" ? preset.break * 60 : preset.longBreak * 60;
  const progress = 1 - timeLeft / totalTime;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const circumference = 2 * Math.PI * 110;

  useEffect(() => {
    setTimeLeft(preset.work * 60);
    setMode("work");
    setCycleCount(0);
    setIsRunning(false);
  }, [preset]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleCycleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, mode, cycleCount, preset]);

  const handleCycleComplete = () => {
    setIsRunning(false);
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 2000);
    if (mode === "work") {
      const newCount = cycleCount + 1;
      setCycleCount(newCount);
      if (newCount >= preset.cycles) {
        setMode("longBreak");
        setTimeLeft(preset.longBreak * 60);
        setCycleCount(0);
      } else {
        setMode("break");
        setTimeLeft(preset.break * 60);
      }
    } else {
      setMode("work");
      setTimeLeft(preset.work * 60);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setCycleCount(0);
    setMode("work");
    setTimeLeft(preset.work * 60);
  };

  const switchMode = (newMode) => {
    setIsRunning(false);
    setMode(newMode);
    const t = newMode === "work" ? preset.work : newMode === "break" ? preset.break : preset.longBreak;
    setTimeLeft(t * 60);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold tracking-wider">POMODORO SETTINGS</span>
                <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setCustomSettings({ ...p }); setPreset(p); setShowSettings(false); }}
                    className={`flex-1 py-2 text-[10px] font-mono rounded-lg border transition-all uppercase ${
                      preset.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Work (min)", key: "work" },
                  { label: "Break (min)", key: "break" },
                  { label: "Long Break (min)", key: "longBreak" },
                  { label: "Cycles", key: "cycles" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-[10px] font-mono text-muted-foreground mb-1 block uppercase">{label}</label>
                    <Input
                      type="number"
                      value={customSettings[key]}
                      onChange={e => setCustomSettings(s => ({ ...s, [key]: parseInt(e.target.value) || 1 }))}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={() => {
                  setPreset({ ...customSettings, id: "custom", label: "Custom" });
                  setShowSettings(false);
                }}
                className="w-full font-mono"
              >
                APPLY
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { id: "work", label: "FOCUS", icon: Zap },
          { id: "break", label: "BREAK", icon: Coffee },
          { id: "longBreak", label: "REST", icon: Moon },
        ].map(({ id, label, icon: Icon }) => {
          const c = CHARACTERS[id];
          return (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className="flex-1 py-2.5 text-[10px] font-mono rounded-xl border transition-all flex items-center justify-center gap-1.5"
              style={{
                borderColor: mode === id ? c.accent : "rgba(255,255,255,0.08)",
                background: mode === id ? `${c.accent}18` : "transparent",
                color: mode === id ? c.color : "#64748b",
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Main timer area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at center, ${char.glow.replace("0.5", "0.08")} 0%, rgba(0,0,0,0) 70%)`,
            border: `1px solid ${char.accent}30`,
          }}
        >
          <Particles colors={char.particles} active={isRunning} />

          {/* Background glow pulse */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={isRunning ? {
              background: [
                `radial-gradient(ellipse at 50% 80%, ${char.glow.replace("0.5", "0.05")} 0%, transparent 60%)`,
                `radial-gradient(ellipse at 50% 80%, ${char.glow.replace("0.5", "0.15")} 0%, transparent 60%)`,
              ]
            } : {}}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
          />

          <div className="relative flex flex-col items-center px-4 pt-6 pb-4 gap-4">
            {/* Character image */}
            <div className="relative">
              {/* Orbit rings behind character */}
              <div className="relative w-48 h-48 flex items-end justify-center">
                <OrbitRing color={char.accent} radius={85} duration={8} reverse={false} />
                <OrbitRing color={char.color} radius={70} duration={5} reverse={true} />

                {/* Character sprite */}
                <motion.div
                  className="relative z-10 flex items-end justify-center"
                  animate={isRunning ? {
                    y: [0, -8, 0],
                  } : { y: 0 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Ground glow */}
                  <motion.div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-full blur-xl"
                    style={{ background: char.glow }}
                    animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <OptimizedImage
                    src={char.image}
                    alt={char.name}
                    className="relative z-10 h-40 object-contain drop-shadow-2xl"
                    style={{
                      filter: `drop-shadow(0 0 16px ${char.glow}) drop-shadow(0 0 6px ${char.color})`,
                      imageRendering: "pixelated",
                    }}
                  />
                </motion.div>
              </div>

              {/* Character name */}
              <motion.div
                className="text-center mt-1 font-mono text-[10px] tracking-[0.3em] font-bold"
                style={{ color: char.color }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {char.name}
              </motion.div>
            </div>

            {/* Timer circle */}
            <div className="relative w-52 h-52">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 240 240">
                {/* Track */}
                <circle cx="120" cy="120" r="110" stroke={`${char.accent}20`} strokeWidth="6" fill="none" />
                {/* Progress */}
                <motion.circle
                  cx="120"
                  cy="120"
                  r="110"
                  stroke={char.color}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 6px ${char.color})` }}
                  transition={{ duration: 0.5 }}
                />
                {/* Inner glow ring */}
                <circle cx="120" cy="120" r="100" stroke={`${char.accent}08`} strokeWidth="1" fill="none" />
              </svg>

              {/* Time display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${minutes}-${seconds}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono font-black text-5xl leading-none"
                    style={{ color: char.color, textShadow: `0 0 20px ${char.glow}` }}
                  >
                    {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </motion.div>
                </AnimatePresence>
                <div className="font-mono text-[10px] tracking-[0.25em] mt-1.5" style={{ color: `${char.color}80` }}>
                  {char.label}
                </div>
              </div>
            </div>

            {/* Cycle dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: preset.cycles }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{
                    background: i < cycleCount ? char.color : `${char.accent}25`,
                    boxShadow: i < cycleCount ? `0 0 6px ${char.color}` : "none",
                  }}
                  animate={i < cycleCount ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.5 }}
                />
              ))}
              <span className="font-mono text-[10px] text-muted-foreground ml-2">
                {cycleCount + 1}/{preset.cycles}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 pb-2">
              <motion.button
                onClick={resetTimer}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                style={{ borderColor: `${char.accent}30` }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>

              <motion.button
                onClick={() => setIsRunning(!isRunning)}
                whileTap={{ scale: 0.92 }}
                className="w-20 h-20 rounded-full font-mono font-bold text-sm flex items-center justify-center transition-all"
                style={{
                  background: `linear-gradient(135deg, ${char.accent}, ${char.color})`,
                  boxShadow: isRunning ? `0 0 24px ${char.glow}, 0 0 8px ${char.glow}` : `0 4px 20px ${char.glow.replace("0.5", "0.3")}`,
                  color: "#fff",
                }}
                animate={isRunning ? {
                  boxShadow: [
                    `0 0 16px ${char.glow}`,
                    `0 0 32px ${char.glow}`,
                    `0 0 16px ${char.glow}`,
                  ]
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
              </motion.button>

              <motion.button
                onClick={() => setShowSettings(true)}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                style={{ borderColor: `${char.accent}30` }}
              >
                <Settings className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Session info */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "FOCUS", value: `${preset.work}m`, color: CHARACTERS.work.color },
          { label: "BREAK", value: `${preset.break}m`, color: CHARACTERS.break.color },
          { label: "REST", value: `${preset.longBreak}m`, color: CHARACTERS.longBreak.color },
        ].map(item => (
          <div
            key={item.label}
            className="p-2.5 rounded-xl border text-center"
            style={{ borderColor: `${item.color}20`, background: `${item.color}06` }}
          >
            <div className="font-mono font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
            <div className="font-mono text-[9px] text-muted-foreground mt-0.5 tracking-wider">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}