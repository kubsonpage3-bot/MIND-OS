import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import OptimizedImage from '../OptimizedImage';
import { Play, Pause, RotateCcw, Zap, Coffee, Moon, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useProfileSync } from '@/hooks/useProfileSync';
import { computeEfficiency, ACTIVITIES, CATEGORY_COEFFICIENTS, CATEGORY_ICONS } from "@/lib/cognitiveEngine";
import toast from 'react-hot-toast';

const PRESETS = [
  { id: 'classic', label: 'Classic', work: 25, break: 5, longBreak: 15, cycles: 4 },
  { id: 'short',   label: 'Short',   work: 15, break: 3, longBreak: 10, cycles: 4 },
  { id: 'deep',    label: 'Deep',    work: 50, break: 10, longBreak: 30, cycles: 3 },
];

const CHARACTERS = {
  work: {
    name: 'BEATRIX',
    image: '/images/webp/pomodoro_char_1.webp',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.5)',
    accent: '#ec4899',
    label: 'FOCUS MODE',
    particles: ['#ec4899', '#f472b6', '#fca5a5', '#fda4af'],
  },
  break: {
    name: 'LIGHTNING',
    image: '/images/webp/pomodoro_char_2.webp',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.5)',
    accent: '#6d28d9',
    label: 'SHORT BREAK',
    particles: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#60a5fa'],
  },
  longBreak: {
    name: 'SUMMONER',
    image: '/images/webp/pomodoro_char_3.webp',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.5)',
    accent: '#dc2626',
    label: 'LONG REST',
    particles: ['#ef4444', '#f87171', '#fca5a5', '#fb923c'],
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
            ease: 'easeOut',
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
        top: '50%',
        left: '50%',
        marginTop: -radius,
        marginLeft: -radius,
        borderColor: `${color}40`,
      }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      <div
        className="absolute w-2.5 h-2.5 rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
    </motion.div>
  );
}

export default function PomodoroTimer({ profile: djangoProfile, tasks = [], logs = [], onLog }) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState(PRESETS[0]);
  const [mode, setMode] = useState('work');
  const [timeLeft, setTimeLeft] = useState(PRESETS[0].work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [focusLabel, setFocusLabel] = useState('');

  const [linkedMode, setLinkedMode] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [linkedDuration, setLinkedDuration] = useState(30); // 30 or 60
  const [showRatingOverlay, setShowRatingOverlay] = useState(false);
  const [ratingCountdown, setRatingCountdown] = useState(10);

  // ─── ANTI-STALE-CLOSURE REFS ────────────────────────────────────────────────
  // These refs always hold the latest values so the setInterval callback
  // doesn't capture stale closures.
  const modeRef = useRef(mode);
  const presetRef = useRef(preset);
  const cycleCountRef = useRef(cycleCount);
  const focusLabelRef = useRef(focusLabel);
  const isRunningRef = useRef(isRunning);
  const linkedModeRef = useRef(linkedMode);
  const selectedActivityRef = useRef(selectedActivity);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { presetRef.current = preset; }, [preset]);
  useEffect(() => { cycleCountRef.current = cycleCount; }, [cycleCount]);
  useEffect(() => { focusLabelRef.current = focusLabel; }, [focusLabel]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { linkedModeRef.current = linkedMode; }, [linkedMode]);
  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);

  const { saveSession, isSaving } = usePomodoro();

  // --- Compiled Activities ---
  const allActivities = useMemo(() => {
    const list = {};
    Object.keys(ACTIVITIES).forEach(key => {
      list[key] = {
        ...ACTIVITIES[key],
        label: t(`activities.${key}`, ACTIVITIES[key].label)
      };
    });
    tasks.forEach(t => {
      if (t.type === 'button') {
        const key = `custom_task_${t.id}`;
        const category = t.category || "Other";
        const coeff = CATEGORY_COEFFICIENTS[category] || CATEGORY_COEFFICIENTS["Other"];
        list[key] = {
          label: t.name || t.title,
          icon: t.icon || CATEGORY_ICONS[category] || "🔘",
          description: t.notes || `Custom ${category} activity`,
          coefficients: coeff,
          xpPerHour: t.xpReward || 25,
          goldReward: t.goldReward,
          bossDamage: t.bossDamage,
          defaultHours: t.defaultHours || 1,
          defaultFocus: t.defaultFocus || 7,
          isCustom: true,
          taskId: t.id
        };
      }
    });
    return list;
  }, [tasks, t]);

  // --- Efficiency metrics ---
  const { hoursToday, subjectHoursMap } = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today);
    const hoursToday = todayLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const subjectHoursMap = {};
    todayLogs.forEach(l => {
      subjectHoursMap[l.activity_key] = (subjectHoursMap[l.activity_key] || 0) + (l.hours || 0);
    });
    return { hoursToday, subjectHoursMap };
  }, [logs]);

  const subjectHoursToday = selectedActivity ? (subjectHoursMap[selectedActivity] || 0) : 0;

  // ─── DERIVED STATE ───────────────────────────────────────────────────────────
  const char = CHARACTERS[mode];
  const totalTime = linkedMode
    ? linkedDuration * 60
    : mode === 'work' ? preset.work * 60 : mode === 'break' ? preset.break * 60 : preset.longBreak * 60;
  const progress = 1 - timeLeft / totalTime;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const circumference = 2 * Math.PI * 110;

  const { profile: syncProfile } = useProfileSync();
  const profile = djangoProfile || syncProfile;

  // ─── LOAD SETTINGS FROM USERPROFILE (SSOT) ──────────────────────────────────
  useEffect(() => {
    if (profile?.pomodoro_settings) {
      const ps = profile.pomodoro_settings;
      setPreset({
        id: 'custom',
        label: 'Custom',
        work: ps.work ?? 25,
        break: ps.break ?? 5,
        longBreak: ps.longBreak ?? 15,
        cycles: ps.cycles ?? 4,
      });
    }
  }, [profile?.pomodoro_settings]);

  // Reset timer when preset changes
  useEffect(() => {
    setTimeLeft(preset.work * 60);
    setMode('work');
    setCycleCount(0);
    setIsRunning(false);
  }, [preset.id]); // intentionally only preset.id so manual changes don't re-trigger

  // ─── SESSION COMPLETE HANDLER (no stale closures — reads from refs) ──────────
  const handleCycleComplete = useCallback(() => {
    const currentMode = modeRef.current;
    const currentPreset = presetRef.current;
    const currentCycleCount = cycleCountRef.current;
    const currentLabel = focusLabelRef.current;

    setIsRunning(false);
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 2500);

    // ── SSOT: Save session to Django backend ───────────────────────────────────
    const duration =
      currentMode === 'work' ? currentPreset.work
      : currentMode === 'break' ? currentPreset.break
      : currentPreset.longBreak;

    saveSession({
      duration,
      mode: currentMode,
      label: currentLabel,
      completed: true,
    });

    // Advance the cycle state
    if (currentMode === 'work') {
      const newCount = currentCycleCount + 1;
      setCycleCount(newCount);
      if (newCount >= currentPreset.cycles) {
        setMode('longBreak');
        setTimeLeft(currentPreset.longBreak * 60);
        setCycleCount(0);
      } else {
        setMode('break');
        setTimeLeft(currentPreset.break * 60);
      }
    } else {
      setMode('work');
      setTimeLeft(currentPreset.work * 60);
    }
  }, [saveSession]); // saveSession is stable from useMutation

  // ─── TIMER TICK ─────────────────────────────────────────────────────────────
  // We track timeLeft in a ref to avoid stale closure; the state is updated
  // every second for the UI but the completion logic uses the ref.
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const current = timeLeftRef.current;
      if (current <= 1) {
        setTimeLeft(0);
        clearInterval(interval);
        if (linkedModeRef.current && selectedActivityRef.current) {
          setShowRatingOverlay(true);
          setRatingCountdown(10);
          setIsRunning(false);
        } else {
          handleCycleComplete();
        }
      } else {
        setTimeLeft(current - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, handleCycleComplete]);

  // ─── CONTROLS ────────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setCycleCount(0);
    setMode('work');
    if (linkedMode) {
      setTimeLeft(linkedDuration * 60);
    } else {
      setTimeLeft(preset.work * 60);
    }
  }, [linkedMode, linkedDuration, preset]);

  const switchMode = (newMode) => {
    setIsRunning(false);
    setLinkedMode(false);
    setMode(newMode);
    const duration =
      newMode === 'work' ? preset.work
      : newMode === 'break' ? preset.break
      : preset.longBreak;
    setTimeLeft(duration * 60);
  };

  const submitLinkedLog = useCallback((rating) => {
    setShowRatingOverlay(false);
    setRatingCountdown(10);
    setIsRunning(false);

    if (rating === null) {
      resetTimer();
      return;
    }

    const activityKey = selectedActivity;
    const hours = linkedDuration / 60; // 0.5 or 1.0

    saveSession({
      duration: linkedDuration,
      mode: 'work',
      label: allActivities[activityKey]?.label || 'Activity Focus',
      completed: true,
    });

    if (onLog && activityKey) {
      const computedEff = computeEfficiency({
        focus: rating,
        streakDays: profile?.streak || 0,
        hoursToday,
        subjectHoursToday,
        statFoc: profile?.total_stats?.foc || 5,
        statMem: profile?.total_stats?.mem || 5,
      });

      onLog(activityKey, hours, rating, computedEff, () => {});
    }

    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 2500);

    const restDuration = linkedDuration === 30 ? 5 : 15;
    setMode(linkedDuration === 30 ? 'break' : 'longBreak');
    setTimeLeft(restDuration * 60);
    setLinkedMode(false);
  }, [linkedDuration, selectedActivity, allActivities, saveSession, onLog, profile, hoursToday, subjectHoursToday, resetTimer]);

  useEffect(() => {
    if (!showRatingOverlay) return;
    if (ratingCountdown <= 0) {
      submitLinkedLog(5);
      return;
    }
    const timer = setTimeout(() => {
      setRatingCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showRatingOverlay, ratingCountdown, submitLinkedLog]);

  return (
    <div className="space-y-4 select-none relative">
      {/* Mode Toggle: Standalone vs Linked */}
      <div className="flex rounded-xl p-0.5 bg-black/20 border border-white/5 mb-3" onPointerDown={e => e.stopPropagation()}>
        <button
          onClick={() => { setLinkedMode(false); resetTimer(); }}
          disabled={isRunning}
          className={`flex-1 py-1.5 text-[9px] font-mono rounded-lg transition-all ${
            !linkedMode
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-foreground opacity-60'
          }`}
        >
          STANDALONE TIMER
        </button>
        <button
          onClick={() => { setLinkedMode(true); resetTimer(); }}
          disabled={isRunning}
          className={`flex-1 py-1.5 text-[9px] font-mono rounded-lg transition-all ${
            linkedMode
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
              : 'text-muted-foreground hover:text-foreground opacity-60'
          }`}
        >
          LINKED ACTIVITY
        </button>
      </div>

      {/* Mode selector */}
      {!linkedMode ? (
        <div className="flex gap-2">
          {[
            { id: 'work', label: 'FOCUS', icon: Zap },
            { id: 'break', label: 'BREAK', icon: Coffee },
            { id: 'longBreak', label: 'REST', icon: Moon },
          ].map(({ id, label, icon: Icon }) => {
            const c = CHARACTERS[id];
            return (
              <button
                key={id}
                onClick={() => switchMode(id)}
                className="flex-1 py-2.5 text-[10px] font-mono rounded-xl border transition-all flex items-center justify-center gap-1.5"
                style={{
                  borderColor: mode === id ? c.accent : 'rgba(255,255,255,0.08)',
                  background: mode === id ? `${c.accent}18` : 'transparent',
                  color: mode === id ? c.color : '#64748b',
                }}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-pink-500/10 bg-pink-500/5 animate-in fade-in duration-200" onPointerDown={e => e.stopPropagation()}>
          <div className="flex items-center justify-between text-[10px] font-mono text-pink-400 font-bold">
            <span>LINKED FOCUS MODE</span>
            <span>{linkedDuration} MINS</span>
          </div>
          
          {/* Activity Dropdown */}
          <select
            value={selectedActivity || ''}
            onChange={(e) => setSelectedActivity(e.target.value || null)}
            disabled={isRunning}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-pink-500/50 outline-none disabled:opacity-50 text-white"
          >
            <option value="" className="bg-slate-900 text-muted-foreground">-- Select Activity --</option>
            {Object.entries(allActivities).map(([key, act]) => (
              <option key={key} value={key} className="bg-slate-900 text-foreground">
                {act.icon} {act.label}
              </option>
            ))}
          </select>
          
          {/* Duration Selector */}
          <div className="flex gap-2 w-full mt-1">
            {[
              { label: '30 MINS (0.5h)', value: 30 },
              { label: '1 HOUR (1.0h)', value: 60 },
            ].map(opt => (
              <button
                key={opt.value}
                disabled={isRunning}
                onClick={() => { setLinkedDuration(opt.value); setTimeLeft(opt.value * 60); }}
                className={`flex-1 py-1 text-[9px] font-mono rounded-lg border transition-all ${
                  linkedDuration === opt.value
                    ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                    : 'border-white/5 bg-transparent text-muted-foreground hover:border-white/10 disabled:opacity-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
            background: `radial-gradient(ellipse at center, ${char.glow.replace('0.5', '0.08')} 0%, rgba(0,0,0,0) 70%)`,
            border: `1px solid ${char.accent}30`,
          }}
        >
          <Particles colors={char.particles} active={isRunning} />

          {/* Background glow pulse */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={isRunning ? {
              background: [
                `radial-gradient(ellipse at 50% 80%, ${char.glow.replace('0.5', '0.05')} 0%, transparent 60%)`,
                `radial-gradient(ellipse at 50% 80%, ${char.glow.replace('0.5', '0.15')} 0%, transparent 60%)`,
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
          />

          <div className="relative flex flex-col items-center px-4 pt-6 pb-4 gap-4">
            {/* Focus Label Input — visible when paused in work mode */}
            <AnimatePresence>
              {!isRunning && mode === 'work' && !linkedMode && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="w-full max-w-[220px] absolute top-4 z-20"
                >
                  <Input
                    placeholder={t('pomodoro.whatFocusingOn', 'What are you focusing on?')}
                    value={focusLabel}
                    onChange={(e) => setFocusLabel(e.target.value)}
                    className="h-8 text-xs font-mono text-center bg-black/40 border-primary/20 focus:border-primary/50 placeholder:text-primary/40 rounded-full"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Character image */}
            <div className="relative">
              <div className="relative w-48 h-48 flex items-end justify-center">
                <OrbitRing color={char.accent} radius={85} duration={8} reverse={false} />
                <OrbitRing color={char.color} radius={70} duration={5} reverse={true} />

                <motion.div
                  className="relative z-10 flex items-end justify-center"
                  animate={isRunning ? { y: [0, -8, 0] } : { y: 0 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
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
                      imageRendering: 'pixelated',
                    }}
                  />
                </motion.div>
              </div>

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
                <circle cx="120" cy="120" r="110" stroke={`${char.accent}20`} strokeWidth="6" fill="none" />
                <motion.circle
                  cx="120"
                  cy="120"
                  r="110"
                  stroke={char.color}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  strokeDashoffset={circumference * (1 - (isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress))))}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 6px ${char.color})` }}
                  transition={{ duration: 0.5 }}
                />
                <circle cx="120" cy="120" r="100" stroke={`${char.accent}08`} strokeWidth="1" fill="none" />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${minutes}-${seconds}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono font-black text-5xl leading-none"
                    style={{ color: char.color, textShadow: `0 0 20px ${char.glow}` }}
                  >
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </motion.div>
                </AnimatePresence>
                <div className="font-mono text-[10px] tracking-[0.25em] mt-1.5" style={{ color: `${char.color}80` }}>
                  {char.label}
                </div>
              </div>
            </div>

            {/* Cycle dots - standalone only */}
            {!linkedMode && (
              <div className="flex items-center gap-2">
                {Array.from({ length: preset.cycles }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{
                      background: i < cycleCount ? char.color : `${char.accent}25`,
                      boxShadow: i < cycleCount ? `0 0 6px ${char.color}` : 'none',
                    }}
                    animate={i < cycleCount ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.5 }}
                  />
                ))}
                <span className="font-mono text-[10px] text-muted-foreground ml-2">
                  {cycleCount + 1}/{preset.cycles}
                </span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3 pb-2" onPointerDown={e => e.stopPropagation()}>
              <motion.button
                onClick={resetTimer}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                style={{ borderColor: `${char.accent}30` }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>

              <motion.button
                onClick={() => {
                  if (linkedMode && !selectedActivity) {
                    toast.error("Please select an activity first!");
                    return;
                  }
                  setIsRunning(!isRunning);
                }}
                whileTap={{ scale: 0.92 }}
                className="w-20 h-20 rounded-full font-mono font-bold text-sm flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${char.accent}, ${char.color})`,
                  boxShadow: isRunning
                    ? `0 0 24px ${char.glow}, 0 0 8px ${char.glow}`
                    : `0 4px 20px ${char.glow.replace('0.5', '0.3')}`,
                  color: '#fff',
                }}
                animate={isRunning ? {
                  boxShadow: [
                    `0 0 16px ${char.glow}`,
                    `0 0 32px ${char.glow}`,
                    `0 0 16px ${char.glow}`,
                  ],
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
              </motion.button>

              {/* Save status indicator */}
              <div className="w-12 h-12 rounded-full border flex items-center justify-center"
                style={{ borderColor: `${char.accent}30` }}
              >
                <AnimatePresence mode="wait">
                  {isSaving ? (
                    <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    </motion.div>
                  ) : justCompleted ? (
                    <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}>
                      <CheckCircle2 className="w-4 h-4" style={{ color: char.color }} />
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 0.3 }}>
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Session info footer - standalone only */}
      {!linkedMode && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'FOCUS', value: `${preset.work}m`, color: CHARACTERS.work.color },
            { label: 'BREAK', value: `${preset.break}m`, color: CHARACTERS.break.color },
            { label: 'REST',  value: `${preset.longBreak}m`, color: CHARACTERS.longBreak.color },
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
      )}

      {/* Focus Quality Rating Overlay */}
      <AnimatePresence>
        {showRatingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 text-center rounded-2xl border border-pink-500/20"
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1.5 animate-bounce">⚡</div>
            <div className="font-mono font-black text-sm text-pink-400 uppercase tracking-widest">Session Complete!</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              Log training session for:
              <div className="text-foreground font-bold mt-0.5">{allActivities[selectedActivity]?.label}</div>
            </div>
            
            <div className="text-[9px] font-mono text-muted-foreground/60 mt-4 uppercase tracking-wider">How was your focus quality?</div>
            
            {/* 1-10 grid of rating buttons */}
            <div className="grid grid-cols-5 gap-1.5 my-3.5 w-full max-w-[220px]">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(rating => (
                <button
                  key={rating}
                  onClick={() => submitLinkedLog(rating)}
                  className="py-1.5 rounded-lg border text-xs font-mono font-bold transition-all bg-black/40 hover:bg-pink-500/20 border-white/5 hover:border-pink-500/30 text-muted-foreground hover:text-pink-400"
                >
                  {rating}
                </button>
              ))}
            </div>
            
            <div className="flex flex-col items-center gap-1.5 w-full max-w-[220px] mt-1">
              <button
                onClick={() => submitLinkedLog(null)}
                className="w-full py-1.5 border border-white/10 rounded-lg text-[9px] font-mono text-muted-foreground hover:text-white transition-all bg-white/5"
              >
                DISCARD / DO NOT LOG
              </button>
              
              <div className="text-[9px] font-mono text-pink-400/50 animate-pulse mt-1">
                Auto-logging rating 5 in {ratingCountdown}s...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}