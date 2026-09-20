// @ts-nocheck
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import OptimizedImage from '../OptimizedImage';
import { Play, Pause, RotateCcw, Zap, Coffee, Moon, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useProfileSync } from '@/hooks/useProfileSync';
import { ACTIVITIES, MASTERY_COEFFICIENTS, CATEGORY_ICONS } from '@/lib/cognitiveEngine';
import { playPomodoroEndSound } from '@/lib/soundEffects';
import toast from 'react-hot-toast';
import { LocalNotificationsService } from '@/utils/localNotifications';

const DEFAULT_PRESET = { id: 'default', label: 'Classic', work: 25, break: 5, longBreak: 15, cycles: 4 };

// The server logs a focus session only after a minute of real elapsed time.
const MIN_LOG_SECONDS = 60;
const CYCLE_STORAGE_KEY = 'mindos_pomodoro_cycle';

function loadCycleCount() {
  try {
    const raw = JSON.parse(localStorage.getItem(CYCLE_STORAGE_KEY) || 'null');
    if (raw && raw.date === new Date().toDateString() && Number.isFinite(raw.count)) {
      return raw.count;
    }
  } catch {
    /* storage unavailable */
  }
  return 0;
}

function saveCycleCount(count) {
  try {
    localStorage.setItem(
      CYCLE_STORAGE_KEY,
      JSON.stringify({ date: new Date().toDateString(), count })
    );
  } catch {
    /* storage unavailable */
  }
}

// Server modes: work|focus, break, longBreak|long_break -> UI modes.
const normalizeMode = (m) =>
  m === 'focus' || !m ? 'work' : m === 'long_break' ? 'longBreak' : m;

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
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [mode, setMode] = useState('work');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_PRESET.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  // Persisted (per day): leaving the Timer tab unmounts this component, which
  // used to reset the long-break cycle to 1/N every time.
  const [cycleCount, setCycleCount] = useState(loadCycleCount);
  const [justCompleted, setJustCompleted] = useState(false);
  const [focusLabel, setFocusLabel] = useState('');

  const [linkedMode, setLinkedMode] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [linkedDuration, setLinkedDuration] = useState(30); // 30 or 60
  const [showRatingOverlay, setShowRatingOverlay] = useState(false);
  const [ratingCountdown, setRatingCountdown] = useState(10);

  const { profile: syncProfile } = useProfileSync();
  const profile = djangoProfile || syncProfile;

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
  const settingsRef = useRef(profile?.pomodoro_settings);
  const activeSessionRef = useRef(null);
  const completingRef = useRef(false); // a completion request is in flight
  const lastLocalActionAtRef = useRef(0); // last pause/reset/mode-switch by the user
  const presetSigRef = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { presetRef.current = preset; }, [preset]);
  useEffect(() => { cycleCountRef.current = cycleCount; saveCycleCount(cycleCount); }, [cycleCount]);
  useEffect(() => { focusLabelRef.current = focusLabel; }, [focusLabel]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { linkedModeRef.current = linkedMode; }, [linkedMode]);
  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);
  useEffect(() => { settingsRef.current = profile?.pomodoro_settings; }, [profile?.pomodoro_settings]);

  const {
    isCompleting,
    activeSession,
    activeSessionUpdatedAt,
    startActiveSession,
    pauseActiveSession,
    resumeActiveSession,
    resetActiveSession,
    completeActiveSessionAsync,
  } = usePomodoro();
  const isBusySaving = isCompleting;

  // --- Compiled Activities (filtered by user's hidden list, same as Training) ---
  const hiddenActivities = profile?.hidden_activities || [];

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
        const masteryKey = (t.mastery_category || "").toLowerCase();
        const coeff = MASTERY_COEFFICIENTS[masteryKey] || MASTERY_COEFFICIENTS["humanities"];
        const category = t.category || "Other";
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

  // ─── LOAD SETTINGS FROM USERPROFILE (SSOT) ──────────────────────────────────
  // Apply saved durations without clobbering a live session: the old
  // "reset whenever preset.id changes" effect fired the first time the profile
  // loaded ('classic' -> 'custom') and could stop a timer that had just been
  // restored from the server.
  useEffect(() => {
    const ps = profile?.pomodoro_settings;
    if (!ps) return;
    const next = {
      id: 'custom',
      label: 'Custom',
      work: ps.work ?? 25,
      break: ps.break ?? 5,
      longBreak: ps.longBreak ?? 15,
      cycles: ps.cycles ?? 4,
    };
    const sig = `${next.work}|${next.break}|${next.longBreak}|${next.cycles}`;
    if (sig === presetSigRef.current) return;
    const firstApply = presetSigRef.current === null;
    presetSigRef.current = sig;
    setPreset(next);
    // A running/paused session owns the display until it ends.
    if (isRunningRef.current || activeSessionRef.current?.active) return;
    setMode('work');
    setTimeLeft(next.work * 60);
    if (!firstApply) setCycleCount(0);
  }, [profile?.pomodoro_settings]);

  // ─── SESSION COMPLETE HANDLER (no stale closures — reads from refs) ──────────
  // The server decides everything that matters (how long the session really
  // ran, what it's worth, whether it counts): we only ask it to complete the
  // active session and then advance the local cycle. `finishedModeRaw` is
  // passed explicitly -- reading modeRef right after a setMode() used to book
  // an expired break found on reload as a full work session.
  const finishCycle = useCallback(async (finishedModeRaw) => {
    if (completingRef.current) return;
    completingRef.current = true;
    const finishedMode = normalizeMode(finishedModeRaw);
    const currentPreset = presetRef.current;
    const currentCycleCount = cycleCountRef.current;
    const wasRunning = isRunningRef.current;
    const ps = settingsRef.current || {};

    setIsRunning(false);
    try {
      try {
        await completeActiveSessionAsync({
          rating: 7,
          ...(finishedMode === 'work' && focusLabelRef.current
            ? { label: focusLabelRef.current }
            : {}),
        });
      } catch (err) {
        const code = err?.data?.code;
        if (code === 'too_short') {
          // Not a full minute yet: nothing was consumed, keep the timer going.
          toast(t('pomodoro_ui.too_short', 'Focus for at least a minute to log a session.'), { icon: '⏱️' });
          setIsRunning(wasRunning);
          return;
        }
        if (code === 'no_active_session') {
          toast(t('pomodoro_ui.already_logged', 'This session was already completed on another device.'), { icon: 'ℹ️' });
        } else {
          // Network/server failure (already toasted by the hook): drop the
          // server row so the 10s poll can't resurrect a dead session.
          resetActiveSession();
        }
      }

      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 2500);
      playPomodoroEndSound(ps.soundMode);

      // Local notification (respects the "Browser Notifications" toggle)
      if (ps.notifications !== false) {
        if (finishedMode === 'work') {
          LocalNotificationsService.sendInstant(
            "🍅 Pomodoro Session Complete!",
            "Excellent focus! Take a break to recover your energy."
          );
        } else {
          LocalNotificationsService.sendInstant(
            "⚡ Break Complete!",
            "Time to get back to work. Focus mode active."
          );
        }
      }

      // Advance the cycle state
      if (finishedMode === 'work') {
        const newCount = currentCycleCount + 1;
        if (newCount >= currentPreset.cycles) {
          setMode('longBreak');
          setTimeLeft(currentPreset.longBreak * 60);
          setCycleCount(0);
        } else {
          setCycleCount(newCount);
          setMode('break');
          setTimeLeft(currentPreset.break * 60);
        }
      } else {
        setMode('work');
        setTimeLeft(currentPreset.work * 60);
      }
    } finally {
      completingRef.current = false;
    }
  }, [completeActiveSessionAsync, resetActiveSession, t]);

  // ── Sync from Backend Active Session (SSOT) ──────────────────────────────────
  useEffect(() => {
    activeSessionRef.current = activeSession;
    if (!activeSession?.active || isRunningRef.current || completingRef.current) return;

    const isPaused = activeSession.is_paused;
    // The snapshot may be older than "now" (cache / poll interval): age a
    // running session's remaining time by how long ago it was fetched, so a
    // restored countdown isn't minutes off.
    const ageSec = activeSessionUpdatedAt
      ? Math.max(0, Math.floor((Date.now() - activeSessionUpdatedAt) / 1000))
      : 0;
    const remaining = isPaused
      ? activeSession.remaining_seconds
      : Math.max(0, activeSession.remaining_seconds - ageSec);
    const sessionMode = normalizeMode(activeSession.mode);

    // We just paused/reset/switched locally: the in-flight request may not be
    // reflected in this snapshot yet -- don't resurrect the old running state.
    if (!isPaused && Date.now() - lastLocalActionAtRef.current < 4000) return;

    if (activeSession.linked_activity_key) {
      setLinkedMode(true);
      setSelectedActivity(activeSession.linked_activity_key);
      setLinkedDuration(activeSession.duration_minutes);
    } else {
      setLinkedMode(false);
    }
    setMode(sessionMode);
    setTimeLeft(remaining);

    if (isPaused) return;
    if (remaining > 0) {
      setIsRunning(true);
    } else if (activeSession.linked_activity_key) {
      // Expired while away in another tab / background
      setShowRatingOverlay(prev => {
        if (!prev) setRatingCountdown(10);
        return true;
      });
    } else {
      finishCycle(sessionMode);
    }
  }, [activeSession, activeSessionUpdatedAt, finishCycle]);

  // ─── TIMER TICK (TIMESTAMP-BASED & BACKGROUND-SAFE) ─────────────────────────
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const endTimeRef = useRef(null);

  useEffect(() => {
    if (!isRunning) return;

    // Calculate absolute future completion timestamp
    endTimeRef.current = Date.now() + timeLeftRef.current * 1000;

    // Native app: also ask the OS to alert at the end -- a frozen WebView can't.
    if ((settingsRef.current || {}).notifications !== false) {
      LocalNotificationsService.schedulePomodoroEnd(
        timeLeftRef.current,
        modeRef.current === 'work' ? "🍅 Pomodoro Session Complete!" : "⚡ Break Complete!",
        modeRef.current === 'work'
          ? "Excellent focus! Take a break to recover your energy."
          : "Time to get back to work."
      );
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));

      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        if (linkedModeRef.current && selectedActivityRef.current) {
          setShowRatingOverlay(true);
          setRatingCountdown(10);
          setIsRunning(false);
        } else {
          finishCycle(modeRef.current);
        }
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      LocalNotificationsService.cancelPomodoroEnd();
    };
  }, [isRunning, finishCycle]);

  // Synchronize timer instantly when app is returned from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && endTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning]);

  // Countdown in the browser tab title while a session runs.
  const baseTitleRef = useRef(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (baseTitleRef.current === null) baseTitleRef.current = document.title;
    if (isRunning) {
      const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
      const ss = String(timeLeft % 60).padStart(2, '0');
      document.title = `${mm}:${ss} · ${CHARACTERS[mode]?.label || 'FOCUS'}`;
    } else {
      document.title = baseTitleRef.current;
    }
  }, [isRunning, timeLeft, mode]);
  useEffect(() => () => {
    if (baseTitleRef.current !== null) document.title = baseTitleRef.current;
  }, []);

  // Keep the screen awake while a session runs (re-acquired when the tab
  // becomes visible again -- the browser drops the lock on hide).
  useEffect(() => {
    if (!isRunning || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* unsupported / denied / low battery -- non-essential */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [isRunning]);

  // ─── CONTROLS ────────────────────────────────────────────────────────────────
  const resetTimer = useCallback((nextLinked = linkedMode) => {
    lastLocalActionAtRef.current = Date.now();
    resetActiveSession();
    setIsRunning(false);
    setCycleCount(0);
    setMode('work');
    if (nextLinked) {
      setTimeLeft(linkedDuration * 60);
    } else {
      setTimeLeft(preset.work * 60);
    }
  }, [linkedMode, linkedDuration, preset, resetActiveSession]);

  const switchMode = (newMode) => {
    // Disabled while running (see the buttons): switching mid-session used to
    // leave the server session alive and the 10s poll resumed it.
    if (isRunning) return;
    lastLocalActionAtRef.current = Date.now();
    resetActiveSession();
    setIsRunning(false);
    setLinkedMode(false);
    setMode(newMode);
    const duration =
      newMode === 'work' ? preset.work
      : newMode === 'break' ? preset.break
      : preset.longBreak;
    setTimeLeft(duration * 60);
  };

  const handlePlayPause = useCallback(() => {
    if (linkedMode && !selectedActivity) {
      toast.error(t('pomodoro_ui.select_activity_first', 'Please select an activity first!'));
      return;
    }
    if (isRunning) {
      lastLocalActionAtRef.current = Date.now();
      pauseActiveSession();
      setIsRunning(false);
      return;
    }

    const wantedDuration = linkedMode
      ? linkedDuration
      : (mode === 'work' ? preset.work : mode === 'break' ? preset.break : preset.longBreak);
    const wantedKey = linkedMode ? selectedActivity : null;
    const server = activeSessionRef.current;
    const isSameSessionPaused =
      server?.active &&
      server.is_paused &&
      normalizeMode(server.mode) === mode &&
      server.duration_minutes === wantedDuration &&
      (server.linked_activity_key || null) === (wantedKey || null);

    if (isSameSessionPaused) {
      // Resume the paused session with the server's own clock. (It used to
      // call /start/ with the full duration, which desynced the countdown.)
      resumeActiveSession();
    } else {
      startActiveSession({
        linked_activity_key: wantedKey,
        duration_minutes: wantedDuration,
        mode,
      });
    }
    setIsRunning(true);
  }, [
    linkedMode, selectedActivity, linkedDuration, isRunning, mode, preset,
    pauseActiveSession, resumeActiveSession, startActiveSession, t,
  ]);

  const submitLinkedLog = useCallback((rating) => {
    setShowRatingOverlay(false);
    setRatingCountdown(10);
    setIsRunning(false);
    lastLocalActionAtRef.current = Date.now();

    if (rating === null) {
      // Discard and cleanly exit to Standalone mode
      resetActiveSession();
      setLinkedMode(false);
      setCycleCount(0);
      setMode('work');
      setTimeLeft(preset.work * 60);
      return;
    }

    playPomodoroEndSound(settingsRef.current?.soundMode);

    // The server logs PomodoroSession + TrainingSession + XP/Gold from its own
    // record of the session -- only the focus rating comes from us.
    completeActiveSessionAsync({ rating: rating || 7 })
      .then(() => {
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 2500);
        const restDuration = linkedDuration === 30 ? 5 : 15;
        setMode(linkedDuration === 30 ? 'break' : 'longBreak');
        setTimeLeft(restDuration * 60);
        setLinkedMode(false);
      })
      .catch((err) => {
        const code = err?.data?.code;
        if (code === 'too_short') {
          toast(t('pomodoro_ui.too_short', 'Focus for at least a minute to log a session.'), { icon: '⏱️' });
        } else if (code === 'no_active_session') {
          toast(t('pomodoro_ui.already_logged', 'This session was already completed on another device.'), { icon: 'ℹ️' });
          setLinkedMode(false);
          setMode('work');
          setTimeLeft(preset.work * 60);
        }
      });
  }, [linkedDuration, resetActiveSession, completeActiveSessionAsync, preset.work, t]);

  const handleManualComplete = useCallback(() => {
    // "Complete" ends the session early; the server pays for the time that
    // really elapsed and refuses under a minute. Check up front so the user
    // gets an instant answer instead of a round trip.
    const isFocus = linkedMode || mode === 'work';
    const elapsedSec = totalTime - timeLeft;
    if (isFocus && elapsedSec < MIN_LOG_SECONDS) {
      toast(t('pomodoro_ui.too_short', 'Focus for at least a minute to log a session.'), { icon: '⏱️' });
      return;
    }
    if (linkedMode) {
      if (!selectedActivity) {
        toast.error(t('pomodoro_ui.select_activity_first', 'Please select an activity first!'));
        return;
      }
      setIsRunning(false);
      setShowRatingOverlay(true);
      setRatingCountdown(10);
    } else {
      finishCycle(mode);
    }
  }, [linkedMode, mode, selectedActivity, totalTime, timeLeft, finishCycle, t]);

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
          onClick={() => { setLinkedMode(false); resetTimer(false); }}
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
          onClick={() => { setLinkedMode(true); resetTimer(true); }}
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
                disabled={isRunning}
                className="flex-1 py-2.5 text-[10px] font-mono rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span>{t('pomodoro_ui.linked_focus_mode')}</span>
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
            {Object.entries(allActivities)
              .filter(([key]) => !hiddenActivities.includes(key))
              .map(([key, act]) => (
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
                onClick={() => resetTimer()}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                style={{ borderColor: `${char.accent}30` }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>

              <motion.button
                onClick={handlePlayPause}
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

              {/* Manual complete button / Save status indicator */}
              <motion.button
                onClick={handleManualComplete}
                disabled={isBusySaving}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full border flex items-center justify-center transition-all group"
                style={{
                  borderColor: (isRunning || justCompleted || (linkedMode && selectedActivity))
                    ? 'rgba(34, 197, 94, 0.4)'
                    : `${char.accent}30`,
                  background: (isRunning || justCompleted || (linkedMode && selectedActivity))
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'transparent',
                }}
                title={
                  linkedMode
                    ? t('pomodoro_ui.complete_and_log', 'Complete & Log Focus')
                    : t('pomodoro_ui.complete_cycle', 'Complete Cycle')
                }
              >
                <AnimatePresence mode="wait">
                  {isBusySaving ? (
                    <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    </motion.div>
                  ) : justCompleted ? (
                    <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <CheckCircle2
                        className={`w-4 h-4 transition-colors ${
                          (isRunning || (linkedMode && selectedActivity))
                            ? 'text-emerald-400 group-hover:text-emerald-300'
                            : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
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
            <div className="font-mono font-black text-sm text-pink-400 uppercase tracking-widest">{t('pomodoro_ui.session_complete')}</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              Log training session for:
              <div className="text-foreground font-bold mt-0.5">{allActivities[selectedActivity]?.label}</div>
            </div>
            
            <div className="text-[9px] font-mono text-muted-foreground/60 mt-4 uppercase tracking-wider">{t('pomodoro_ui.focus_quality')}</div>
            
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