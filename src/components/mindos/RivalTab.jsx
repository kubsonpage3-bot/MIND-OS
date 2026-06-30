import { useMemo, useState, useEffect, useRef } from "react";
import OptimizedImage from "./OptimizedImage";
import { getRankFromXP } from "@/lib/rankEngine";
import { ACTIVITIES } from "@/lib/cognitiveEngine";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RIVAL_NAME = "JOHAN";
const ALL_SUBJECTS = Object.keys(ACTIVITIES);

// ─── TAUNT POOLS ────────────────────────────────────────────────────────────
const AHEAD_TAUNTS = [
  "The gap closes when you stop.",
  `${RIVAL_NAME} doesn't take rest days.`,
  "Every hour you skip, they don't.",
  "Shadows don't sleep.",
  `${RIVAL_NAME} logged another session. Did you?`,
  "You were ahead. Past tense.",
  "Consistency is the only variable that compounds.",
  `${RIVAL_NAME} is 3 subjects ahead this week.`,
];

const WINNING_MESSAGES = [
  "You lead by {X} XP. Don't stop now.",
  `${RIVAL_NAME} is recalibrating.`,
  "Good. Now stay ahead.",
  `${RIVAL_NAME} sees the gap. They won't accept it.`,
  "Lead means nothing without consistency.",
  `${RIVAL_NAME} is planning a surge. Stay alert.`,
];

const DEFAULT_TAUNTS = [
  "Shadow Protocol Active — Monitoring your progress.",
  "The race doesn't pause.",
  `${RIVAL_NAME} is always logging somewhere.`,
  "Your next session determines the gap.",
];

// ─── HASH-BASED SELECTION (no pure random — feels curated) ───────────────────
function hashSelect(pool, seed) {
  const h = Math.abs(
    String(seed).split("").reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0)
  );
  return pool[h % pool.length];
}

// ─── DETERMINISTIC PRNG from date string ─────────────────────────────────────
function makePrng(seed) {
  let s = String(seed).split("").reduce((a, b) => a * 31 + b.charCodeAt(0), 0) >>> 0;
  return () => {
    s = ((s * 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function getDayNumber() {
  return Math.floor(Date.now() / 86400000);
}

// ─── BEHAVIORAL PATTERN LOGIC ────────────────────────────────────────────────
// morning person: days 1-7, 15-21 of month
// night owl: days 8-14, 22-28
// surge/weak: determined by seeded dayOfWeek
function getDayPattern(dateStr) {
  const d = new Date(dateStr);
  const dayOfMonth = d.getDate();
  const dayOfWeek = d.getDay(); // 0=Sun ... 6=Sat
  const rand = makePrng(dateStr + "pattern");

  // 1 surge day/week (seeded), 2 weak days/week (seeded)
  const surgeDay = Math.floor(rand() * 7);
  const weakDay1 = Math.floor(rand() * 7);
  const weakDay2 = (weakDay1 + 2) % 7;

  if (dayOfWeek === surgeDay) return { type: "surge", multiplier: 1.5, msg: `${RIVAL_NAME}: intensive session today.` };
  if (dayOfWeek === weakDay1 || dayOfWeek === weakDay2) return { type: "weak", multiplier: 0.5, msg: "Short session today." };
  if ((dayOfMonth >= 1 && dayOfMonth <= 7) || (dayOfMonth >= 15 && dayOfMonth <= 21)) return { type: "morning", multiplier: 1.0, msg: "Early session logged." };
  return { type: "night", multiplier: 1.0, msg: "Late night grind." };
}

function getSessionTimeRange(pattern) {
  if (pattern.type === "morning") return { startH: 7, endH: 10 };
  if (pattern.type === "night") return { startH: 21, endH: 23 };
  return { startH: 8, endH: 20 };
}

// ─── SESSION GENERATION (weighted by player subjects) ────────────────────────
function generateDailySessions(dateStr, playerSubjectWeights, pattern) {
  const rand = makePrng(dateStr + "sessions");
  const count = pattern.type === "weak" ? 1 : 1 + Math.floor(rand() * 2) + 1; // 1 if weak, else 2-3
  const { startH, endH } = getSessionTimeRange(pattern);

  const sessions = [];
  let scheduledMinutes = (startH * 60) + Math.floor(rand() * 30);

  for (let i = 0; i < count; i++) {
    // Subject selection: 70% copies player dominant, 30% random
    let subject;
    if (playerSubjectWeights.length > 0 && rand() < 0.7) {
      // Weighted pick from player subjects
      const totalWeight = playerSubjectWeights.reduce((s, x) => s + x.count, 0);
      let pick = rand() * totalWeight;
      subject = playerSubjectWeights[playerSubjectWeights.length - 1].subject;
      for (const sw of playerSubjectWeights) {
        pick -= sw.count;
        if (pick <= 0) { subject = sw.subject; break; }
      }
    } else {
      subject = ALL_SUBJECTS[Math.floor(rand() * ALL_SUBJECTS.length)];
    }

    const baseHours = 0.5 + rand() * 2.0;
    const hours = Math.round(baseHours * pattern.multiplier * 2) / 2;
    const focus = Math.round((6.0 + rand() * 3.5) * 10) / 10;

    const hh = Math.floor(scheduledMinutes / 60);
    const mm = scheduledMinutes % 60;
    const clampedH = Math.min(hh, endH);
    const scheduledTime = `${String(clampedH).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    // Session format template (A/B/C)
    const templateIdx = Math.floor(rand() * 3);
    const act = ACTIVITIES[subject];
    const subjectLabel = act?.label || subject;
    let displayText;
    if (templateIdx === 0) displayText = `${subjectLabel} · ${hours}h · Focus ${focus}`;
    else if (templateIdx === 1) displayText = `${subjectLabel} session · ${hours}h`;
    else displayText = `Deep work: ${subjectLabel} · ${hours}h · ${focus} focus`;

    sessions.push({ subject, hours, focus, scheduledTime, displayText, patternMsg: pattern.msg });
    scheduledMinutes += Math.round(hours * 60) + 15 + Math.floor(rand() * 30);
  }

  return sessions;
}

// ─── ADAPTIVE XP ALGORITHM ───────────────────────────────────────────────────
function calcJohanXP(playerRankXP, dailyXPHistory, dayNumber) {
  // JOHAN mirrors player's 7-day average with sine wave fluctuation
  const last7 = dailyXPHistory.slice(-7);
  const playerAvg = last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;

  // Sine wave creates natural rhythm — some days ahead, some behind
  const dayFactor = 0.85 + 0.30 * Math.sin(dayNumber * 0.8);

  // Clamp: never more than 20% ahead, never more than 25% behind
  const raw = playerAvg * dayFactor;
  const maxDaily = playerAvg * 1.20;
  const minDaily = playerAvg * 0.75;
  const clampedDaily = Math.max(minDaily, Math.min(maxDaily, raw));

  // Build Johan's cumulative XP starting from a base close to player's
  // Johan's XP oscillates ±15% around player's XP
  const baseXP = playerRankXP * (0.85 + 0.30 * Math.sin(dayNumber * 0.8));
  const clampedXP = Math.max(playerRankXP * 0.75, Math.min(playerRankXP * 1.20, baseXP));

  // Never exactly equal — add small offset based on dayNumber
  const offset = ((dayNumber % 7) - 3) * 0.5;
  return Math.max(1, Math.round((clampedXP + offset) * 10) / 10);
}

// ─── STREAK LOGIC ─────────────────────────────────────────────────────────────
function calcJohanStreak(playerStreak, dayNumber) {
  const rand = makePrng(dayNumber + "streak");
  const offset = Math.floor(rand() * 4) - 1; // -1 to +2
  if (playerStreak >= 5) return playerStreak + 1; // permanent 1-day deficit
  return Math.max(1, Math.min(playerStreak + 3, playerStreak + offset));
}

// ─── DYNAMIC MESSAGE SYSTEM ───────────────────────────────────────────────────
function calcJohanMessage(
  playerRankXP, johanXP, playerTodayHours, johanTodayHours,
  playerStreak, johanStreak, logs, dayNumber
) {
  const nowH = new Date().getHours();
  const diff = Math.abs(johanXP - playerRankXP);
  const pctAhead = playerRankXP > 0 ? (johanXP - playerRankXP) / playerRankXP : 0;
  const hourSeed = `${new Date().toDateString()}${nowH}`;

  // Check if player just logged (within 1 hour)
  const oneHourAgo = Date.now() - 3600000;
  const recentLog = logs.find(l => new Date(l.log_date || l.created_date).getTime() > oneHourAgo);

  // Perfect focus check
  const hasPerfectFocus = logs.some(l => (l.focus_rating || 0) >= 10);

  if (playerTodayHours === 0 && nowH >= 15 && johanTodayHours > 0) {
    return {
      text: `${RIVAL_NAME} logged ${johanTodayHours.toFixed(1)}h already today. You have: 0h.`,
      color: "#f59e0b",
      category: "slacking",
    };
  }

  if (pctAhead > 0.05) {
    const taunt = hashSelect(AHEAD_TAUNTS, hourSeed);
    return {
      text: `⚡ ${RIVAL_NAME} overtook you by ${diff.toFixed(1)} XP today. ${taunt}`,
      color: "#ef4444",
      category: "ahead",
      pulse: true,
    };
  }

  if (recentLog) {
    return {
      text: `${RIVAL_NAME} noticed your session. Adjusting pace.`,
      color: "#00e5ff",
      category: "noticed",
    };
  }

  if (playerStreak > johanStreak) {
    return {
      text: `Your streak is longer. ${RIVAL_NAME} is watching.`,
      color: "#00cc88",
      category: "streakLead",
    };
  }

  if (hasPerfectFocus) {
    return {
      text: `${RIVAL_NAME}: '...that focus score.'`,
      color: "#00e5ff",
      category: "perfectFocus",
    };
  }

  if (playerRankXP > johanXP) {
    const template = hashSelect(WINNING_MESSAGES, hourSeed);
    return {
      text: template.replace("{X}", diff.toFixed(1)),
      color: "#00cc88",
      category: "winning",
    };
  }

  return {
    text: hashSelect(DEFAULT_TAUNTS, hourSeed),
    color: "rgba(0,229,255,0.5)",
    category: "default",
  };
}

// ─── LOAD / SAVE RIVAL DATA ───────────────────────────────────────────────────
function loadAndUpdateRivalData(playerRankXP, playerStreak, logs) {
  const today = new Date().toISOString().split("T")[0];
  const dayNum = getDayNumber();

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("rival_data") || "{}"); } catch {}

  // Build player subject weights from last 7 days
  const weekAgo = Date.now() - 7 * 86400000;
  const weekLogs = logs.filter(l => new Date(l.log_date || l.created_date).getTime() >= weekAgo);
  const subjectCounts = {};
  weekLogs.forEach(l => { subjectCounts[l.activity] = (subjectCounts[l.activity] || 0) + 1; });
  const playerSubjectWeights = Object.entries(subjectCounts)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);

  // Regenerate today's sessions if needed (new day or first run)
  let todaySessions = stored.todaySessions;
  const pattern = getDayPattern(today);
  if (!stored.lastUpdated || stored.lastUpdated !== today) {
    todaySessions = generateDailySessions(today, playerSubjectWeights, pattern);
  }

  // Build daily XP history from logs
  const dailyXPMap = {};
  logs.forEach(l => {
    const date = (l.log_date || l.created_date || "").split("T")[0];
    if (date) dailyXPMap[date] = (dailyXPMap[date] || 0) + (l.hours || 0) * (l.focus_rating || 5);
  });
  const dailyXPHistory = Object.values(dailyXPMap);

  // Adaptive XP
  const johanXP = calcJohanXP(playerRankXP, dailyXPHistory, dayNum);

  // Streak
  const johanStreak = calcJohanStreak(playerStreak, dayNum);

  // Weekly history (Johan's)
  const weeklyHistory = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().split("T")[0];
    const p = getDayPattern(d);
    const prevStored = (stored.weeklyHistory || []).find(x => x.date === d);
    if (prevStored) return prevStored;
    const sessions = generateDailySessions(d, playerSubjectWeights, p);
    return {
      date: d,
      hours: sessions.reduce((s, x) => s + x.hours, 0),
      xp: Math.round(sessions.reduce((s, x) => s + x.hours * x.focus, 0) * 10) / 10,
    };
  });

  const data = {
    totalXP: johanXP,
    streak: johanStreak,
    lastUpdated: today,
    todaySessions,
    weeklyHistory,
    currentPattern: pattern.type,
  };

  localStorage.setItem("rival_data", JSON.stringify(data));
  return data;
}

// ─── GHOST AVATAR ─────────────────────────────────────────────────────────────
function GhostAvatar({ pulse = false, overtook, playerOvertook }) {
  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
      <motion.div
        animate={{ opacity: [0.85, 1.0, 0.85] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 43.5 }}
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, #9333ea, transparent)", filter: "blur(12px)" }}
      />
      {overtook && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ boxShadow: ["0 0 0px #ef4444", "0 0 18px #ef4444", "0 0 0px #ef4444"] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ borderRadius: "50%", border: "2px solid #ef4444" }}
        />
      )}
      {playerOvertook && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{ background: "rgba(0,204,136,0.3)", borderRadius: "50%" }}
        />
      )}
      <OptimizedImage
        src="/images/original/6aa09434f_grafik.png"
        alt="JOHAN"
        style={{
          width: 72, height: 72, objectFit: "cover", borderRadius: "50%",
          imageRendering: "pixelated",
          filter: overtook
            ? "drop-shadow(0 0 10px #ef4444) drop-shadow(0 0 4px #9333ea)"
            : "drop-shadow(0 0 10px #9333ea) drop-shadow(0 0 4px #ef4444)",
          position: "relative", zIndex: 1,
        }}
      />
    </div>
  );
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 items-end">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
          style={{ width: 4, height: 4, background: "rgba(0,229,255,0.7)", borderRadius: "50%", display: "inline-block" }}
        />
      ))}
    </span>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RivalTab({ playerRankXP = 0, playerStreak = 0, logs = [] }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rivalData, setRivalData] = useState(null);
  const [sessionToast, setSessionToast] = useState(null);
  const [cardFlash, setCardFlash] = useState(null); // "cyan" | "green" | "red"
  const [isTyping, setIsTyping] = useState(false);
  const [prevJohanXP, setPrevJohanXP] = useState(null);
  const [prevPlayerXP, setPrevPlayerXP] = useState(null);
  const toastTimerRef = useRef(null);

  const [rivalEnabled, setRivalEnabled] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem("mindos_notifications") || "{}");
      return settings.rivalEnabled !== false;
    } catch { return true; }
  });

  // Load rival data on mount and whenever player XP changes
  useEffect(() => {
    const data = loadAndUpdateRivalData(playerRankXP, playerStreak, logs);
    setRivalData(data);
  }, [playerRankXP, playerStreak, logs.length]);

  // Detect when Johan "logs a session" (timestamp passes current time)
  useEffect(() => {
    if (!rivalData) return;
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const checkSessionAppear = setInterval(() => {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const justVisible = (rivalData.todaySessions || []).filter(s => {
        const [h, m] = s.scheduledTime.split(":").map(Number);
        const sessionMin = h * 60 + m;
        return sessionMin <= nowMin && sessionMin > nowMin - 1; // just appeared in last 1 min
      });
      if (justVisible.length > 0) {
        const s = justVisible[0];
        setCardFlash("cyan");
        setSessionToast(`${RIVAL_NAME} logged a session`);
        setTimeout(() => setCardFlash(null), 600);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setSessionToast(null), 3000);
      }
    }, 30000);
    return () => clearInterval(checkSessionAppear);
  }, [rivalData]);

  // Detect overtake events → flash card
  useEffect(() => {
    if (!rivalData || playerRankXP === prevPlayerXP) return;
    const johanXP = rivalData.totalXP;
    if (prevJohanXP !== null && prevPlayerXP !== null) {
      if (johanXP > playerRankXP && prevJohanXP <= prevPlayerXP) {
        // Johan just overtook
        setCardFlash("red");
        setTimeout(() => setCardFlash(null), 600);
      } else if (playerRankXP > johanXP && prevPlayerXP <= prevJohanXP) {
        // Player just overtook
        setCardFlash("green");
        setTimeout(() => setCardFlash(null), 600);
      }
    }
    setPrevJohanXP(johanXP);
    setPrevPlayerXP(playerRankXP);
  }, [playerRankXP, rivalData]);

  // Typing indicator before midnight (message about to change)
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const secsToMidnight = (23 - now.getHours()) * 3600 + (59 - now.getMinutes()) * 60 + (60 - now.getSeconds());
      if (secsToMidnight < 120 && secsToMidnight > 115) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    };
    const t = setInterval(checkMidnight, 5000);
    return () => clearInterval(t);
  }, []);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  // Player weekly stats
  const { playerHoursWeek, playerAvgFocus, playerSubjectsWeek, playerWeeklyRankXP } = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekLogs = logs.filter(l => new Date(l.log_date || l.created_date) >= weekAgo);
    const playerHoursWeek = weekLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const focusArr = weekLogs.map(l => l.focus_rating || 5);
    const playerAvgFocus = focusArr.length > 0 ? focusArr.reduce((a, b) => a + b, 0) / focusArr.length : 0;
    const playerSubjectsWeek = new Set(weekLogs.map(l => l.activity)).size;
    const playerWeeklyRankXP = weekLogs.reduce((s, l) => s + (l.hours || 0) * (l.focus_rating || 5), 0);
    return { playerHoursWeek, playerAvgFocus, playerSubjectsWeek, playerWeeklyRankXP };
  }, [logs]);

  if (!rivalData) return <div className="py-8 text-center text-muted-foreground/40 text-xs font-mono">Loading rival data...</div>;

  const { totalXP: johanXP, streak: johanStreak, todaySessions = [], weeklyHistory = [] } = rivalData;

  const rivalAhead = johanXP > playerRankXP;
  const playerAhead = playerRankXP > johanXP;
  const diff = Math.abs(johanXP - playerRankXP);
  const pctDiff = playerRankXP > 0 ? diff / playerRankXP : 0;
  const isClosing = rivalAhead && pctDiff < 0.10; // within 10%

  const rivalRank = getRankFromXP(johanXP);
  const playerRank = getRankFromXP(playerRankXP);

  // Sessions split: visible now vs future
  const visibleSessions = todaySessions.filter(s => {
    const [h, m] = s.scheduledTime.split(":").map(Number);
    return h * 60 + m <= nowMinutes;
  });
  const futureSessions = todaySessions.filter(s => {
    const [h, m] = s.scheduledTime.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });

  const rivalTodayHours = visibleSessions.reduce((s, x) => s + x.hours, 0);
  const todayLogs = logs.filter(l => new Date(l.log_date || l.created_date).toDateString() === new Date().toDateString());
  const playerTodayHours = todayLogs.reduce((s, l) => s + (l.hours || 0), 0);

  // Dynamic message
  const msgObj = calcJohanMessage(
    playerRankXP, johanXP, playerTodayHours, rivalTodayHours,
    playerStreak, johanStreak, logs, getDayNumber()
  );

  // Johan weekly stats
  const johanWeekHours = weeklyHistory.reduce((s, d) => s + (d.hours || 0), 0);
  const johanAvgFocus = Math.round(
    (playerAvgFocus + (Math.sin(getDayNumber() * 0.4) * 0.5 - 0.1)) * 10
  ) / 10;
  const johanSubjectsWeek = Math.max(1, playerSubjectsWeek + (getDayNumber() % 3) - 1);
  const johanWeekRankXP = Math.round(weeklyHistory.reduce((s, d) => s + (d.xp || 0), 0) * 10) / 10;

  const maxBarH = Math.max(...weeklyHistory.map(d => d.hours || 0), 1);

  // Card border color based on state
  const cardBorderColor = cardFlash === "red" ? "#ef4444"
    : cardFlash === "green" ? "#00cc88"
    : cardFlash === "cyan" ? "#00e5ff"
    : rivalAhead ? "#ff4444" : "#00e5ff";

  const cardShadow = cardFlash === "red"
    ? "0 0 24px rgba(239,68,68,0.5)"
    : cardFlash === "green"
    ? "0 0 24px rgba(0,204,136,0.4)"
    : rivalAhead
    ? "0 0 16px rgba(239,68,68,0.25), 0 0 6px rgba(0,229,255,0.1)"
    : "0 0 12px rgba(0,229,255,0.15)";

  return (
    <div className="space-y-4 relative">
      {/* Session toast bottom-right */}
      <AnimatePresence>
        {sessionToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed bottom-20 right-4 z-50 px-4 py-2 rounded-xl text-xs font-mono"
            style={{ background: "#0a1a25", border: "1px solid #00e5ff44", color: "#00e5ff", boxShadow: "0 4px 20px rgba(0,229,255,0.2)" }}
          >
            {sessionToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert banner when Johan overtakes by >5% */}
      <AnimatePresence>
        {rivalAhead && pctDiff > 0.05 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 py-2.5 rounded-xl"
            style={{
              fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13,
              border: "2px solid #ef4444",
              color: "#ef4444",
              background: "rgba(239,68,68,0.08)",
              animation: "pulse 2s infinite",
            }}
          >
            ⚡ {RIVAL_NAME} overtook you by {diff.toFixed(1)} XP today.
          </motion.div>
        )}
      </AnimatePresence>

      {/* RIVAL CARD */}
      <motion.div
        className="rounded-xl border p-4 space-y-3"
        animate={{
          borderColor: cardBorderColor,
          boxShadow: cardShadow,
        }}
        transition={{ duration: 0.3 }}
        style={{ background: "#060c14" }}
      >
        {/* Notification toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="text-[10px] font-mono text-muted-foreground/50">🔔 RIVAL ALERTS</div>
          <button
            onClick={() => {
              const newVal = !rivalEnabled;
              setRivalEnabled(newVal);
              const settings = JSON.parse(localStorage.getItem("mindos_notifications") || "{}");
              settings.rivalEnabled = newVal;
              localStorage.setItem("mindos_notifications", JSON.stringify(settings));
              if (newVal && "Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
              }
            }}
            className={`w-10 h-5 rounded-full transition-colors relative ${rivalEnabled ? "bg-primary/60" : "bg-muted"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rivalEnabled ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <GhostAvatar
            overtook={rivalAhead && pctDiff > 0.05}
            playerOvertook={cardFlash === "green"}
          />
          <div className="flex-1 min-w-0">
            <div className="font-mono font-black text-lg tracking-widest" style={{ color: "#00e5ff", fontVariantLigatures: "none" }}>
              {RIVAL_NAME}<span className="text-xs opacity-50 ml-1">_Ω</span>
            </div>
            {/* Dynamic message with typing indicator */}
            <div className="mt-1 text-xs font-mono italic" style={{ color: msgObj.color, minHeight: 18 }}>
              {isTyping ? <TypingDots /> : `"${msgObj.text}"`}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded"
                style={{ color: rivalRank.color, background: `${rivalRank.color}22`, border: `1px solid ${rivalRank.color}44` }}>
                {rivalRank.id}
              </span>
              <span className="font-mono text-xs" style={{ color: "rgba(0,229,255,0.6)" }}>
                🔥 {johanStreak} days
              </span>
              {rivalData.currentPattern === "surge" && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid #ef444444" }}>
                  SURGE
                </span>
              )}
              {rivalData.currentPattern === "weak" && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.2)", color: "#94a3b8", border: "1px solid #94a3b844" }}>
                  LIGHT
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rival Rank XP bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60">
            <span>RIVAL RANK XP</span>
            <span style={{ color: "#00e5ff" }}>{johanXP.toFixed(1)} XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min((johanXP / Math.max(johanXP, playerRankXP, 1)) * 100, 100)}%`, background: "#00e5ff", boxShadow: "0 0 6px #00e5ff66" }} />
          </div>
        </div>

        {/* Comparison line */}
        <div className="text-xs font-mono font-semibold" style={{ color: rivalAhead ? "#ff8800" : "#00cc88" }}>
          {rivalAhead
            ? `⚠ ${RIVAL_NAME} is ahead by ${diff.toFixed(1)} XP — close the gap`
            : `✓ You lead by ${diff.toFixed(1)} XP — maintain your edge`}
          {isClosing && (
            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold"
              style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid #ef444440" }}>
              CLOSING
            </span>
          )}
        </div>
      </motion.div>

      {/* TODAY'S ACTIVITY */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          {RIVAL_NAME} — TODAY
          {rivalData.currentPattern === "morning" && (
            <span className="ml-2 text-[9px]" style={{ color: "#f59e0b" }}>☀ Morning Person</span>
          )}
          {rivalData.currentPattern === "night" && (
            <span className="ml-2 text-[9px]" style={{ color: "#7B61FF" }}>🌙 Night Owl</span>
          )}
        </div>

        {visibleSessions.map((s, i) => {
          const act = ACTIVITIES[s.subject];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl flex items-center justify-between gap-2"
              style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{act?.icon || "📌"}</span>
                <div>
                  <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: "var(--habit-text)" }}>
                    {s.displayText}
                  </div>
                  {s.patternMsg && (
                    <div style={{ fontFamily: "'Nunito'", fontSize: 10, color: "var(--habit-dim)", fontStyle: "italic" }}>
                      {s.patternMsg}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">{s.scheduledTime}</span>
            </motion.div>
          );
        })}

        {futureSessions.map((s, i) => {
          const act = ACTIVITIES[s.subject];
          return (
            <div key={i} className="p-3 rounded-xl italic" style={{ background: "var(--habit-bg)", border: "1px solid var(--habit-border)", fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)" }}>
              {RIVAL_NAME} — next session: {act?.label || s.subject} at {s.scheduledTime}
            </div>
          );
        })}

        {visibleSessions.length === 0 && futureSessions.length === 0 && (
          <div style={{ fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)", fontStyle: "italic", padding: "4px" }}>
            No sessions logged yet today.
          </div>
        )}

        <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)", paddingTop: 4 }}>
          Today: {rivalTodayHours.toFixed(1)}h logged
        </div>

        {/* Slacking warning */}
        {playerTodayHours === 0 && new Date().getHours() >= 15 && rivalTodayHours > 0 && (
          <div className="px-3 py-2 rounded-xl"
            style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 12, border: "1.5px solid #f59e0b", color: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
            {RIVAL_NAME} has already logged {rivalTodayHours.toFixed(1)}h today. You have: 0h.
          </div>
        )}
      </div>

      {/* WEEKLY COMPARISON TABLE (psychological) */}
      <div className="md:rounded-2xl overflow-hidden border-b md:border border-[var(--habit-border)] md:shadow-sm" style={{ background: "var(--habit-panel)" }}>
        <div className="px-4 py-2.5" style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 11, color: "var(--habit-dim)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid var(--habit-border)" }}>
          Weekly Comparison
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--habit-border)" }}>
              <td className="px-4 py-2" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: "var(--habit-dim)" }}></td>
              <td className="px-4 py-2 text-center" style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 12, color: "var(--habit-text)" }}>YOU</td>
              <td className="px-4 py-2 text-center" style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 12, color: "#00e5ff" }}>{RIVAL_NAME}</td>
            </tr>
          </thead>
          <tbody>
            {/* Hours row */}
            {(() => {
              const pWins = playerHoursWeek >= johanWeekHours;
              const hourDiff = Math.abs(playerHoursWeek - johanWeekHours).toFixed(1);
              return (
                <tr style={{ borderBottom: "1px solid var(--habit-border)" }}>
                  <td className="px-4 py-2" style={{ fontFamily: "'Nunito'", fontSize: 12, color: "#878190" }}>Hours</td>
                  <td className="px-4 py-2 text-center">
                    <span style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: pWins ? 700 : 400, color: pWins ? "#1ca830" : "rgba(100,116,139,0.5)" }}>
                      {playerHoursWeek.toFixed(1)}
                    </span>
                    {!pWins && <span style={{ fontFamily: "'Nunito'", fontSize: 9, color: "#ef4444", marginLeft: 2 }}>(-{hourDiff}h)</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: !pWins ? 700 : 400, color: !pWins ? "#ef4444" : "rgba(100,116,139,0.5)" }}>
                      {johanWeekHours.toFixed(1)}
                    </span>
                    {pWins && <span style={{ fontFamily: "'Nunito'", fontSize: 9, color: "rgba(100,116,139,0.4)", marginLeft: 2 }}>(-{hourDiff}h)</span>}
                  </td>
                </tr>
              );
            })()}

            {/* Avg Focus row */}
            {(() => {
              const pWins = playerAvgFocus >= johanAvgFocus;
              return (
                <tr style={{ borderBottom: "1px solid #f0eef8" }}>
                  <td className="px-4 py-2" style={{ fontFamily: "'Nunito'", fontSize: 12, color: "#878190" }}>Avg Focus</td>
                  <td className="px-4 py-2 text-center" style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: pWins ? "#1ca830" : "#f74e52" }}>
                    {playerAvgFocus.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-center" style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: !pWins ? "#1ca830" : "#f74e52" }}>
                    {johanAvgFocus.toFixed(1)}
                  </td>
                </tr>
              );
            })()}

            {/* Subjects row */}
            {(() => {
              const pWins = playerSubjectsWeek >= johanSubjectsWeek;
              return (
                <>
                  <tr style={{ borderBottom: johanSubjectsWeek > playerSubjectsWeek ? "none" : "1px solid #f0eef8" }}>
                    <td className="px-4 py-2" style={{ fontFamily: "'Nunito'", fontSize: 12, color: "#878190" }}>Subjects</td>
                    <td className="px-4 py-2 text-center" style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: pWins ? "#1ca830" : "#f74e52" }}>
                      {playerSubjectsWeek}
                    </td>
                    <td className="px-4 py-2 text-center" style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: !pWins ? "#1ca830" : "#f74e52" }}>
                      {johanSubjectsWeek}
                    </td>
                  </tr>
                  {johanSubjectsWeek > playerSubjectsWeek && (
                    <tr style={{ borderBottom: "1px solid #f0eef8" }}>
                      <td colSpan={3} className="px-4 pb-2">
                        <span style={{ fontFamily: "'Nunito'", fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>⚠ Diversify your subjects</span>
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}

            {/* Rank XP row with trend arrow */}
            {(() => {
              const pWins = playerWeeklyRankXP >= johanWeekRankXP;
              const trendArrow = rivalAhead ? "↑ " : "↓ ";
              return (
                <tr>
                  <td className="px-4 py-2" style={{ fontFamily: "'Nunito'", fontSize: 12, color: "#878190" }}>Rank XP</td>
                  <td className="px-4 py-2 text-center" style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: pWins ? "#1ca830" : "#f74e52" }}>
                    {playerWeeklyRankXP.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span style={{ fontFamily: "'Pixeltype'", fontSize: 9, fontWeight: 700, color: !pWins ? "#1ca830" : "#f74e52" }}>
                      {rivalAhead ? trendArrow : ""}{johanWeekRankXP.toFixed(1)}
                    </span>
                    {isClosing && (
                      <div style={{ fontFamily: "'Nunito'", fontSize: 9, color: "#ef4444", fontWeight: 700, marginTop: 1 }}>CLOSING</div>
                    )}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* RIVAL HISTORY (collapsible) */}
      <div className="md:rounded-2xl overflow-hidden border-b md:border border-[var(--habit-border)] md:shadow-sm" style={{ background: "var(--habit-panel)" }}>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 transition-colors"
          style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: "var(--habit-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          {historyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Last 7 Days
        </button>
        {historyOpen && (
          <div className="px-4 pb-4 space-y-1.5">
            {weeklyHistory.map((day) => {
              const pct = (day.hours || 0) / maxBarH;
              const d = new Date(day.date);
              const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const dayPattern = getDayPattern(day.date);
              return (
                <div key={day.date} className="flex items-center gap-2">
                  <div className="w-20 shrink-0" style={{ fontFamily: "'Nunito'", fontSize: 10, color: "var(--habit-dim)" }}>{label}</div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--habit-border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct * 100}%`,
                        background: dayPattern.type === "surge" ? "#ef4444" : dayPattern.type === "weak" ? "#94a3b8" : "#7B61FF",
                        boxShadow: dayPattern.type === "surge" ? "0 0 4px rgba(239,68,68,0.5)" : "0 0 4px rgba(123,97,255,0.4)",
                      }} />
                  </div>
                  <div className="w-8 text-right" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 10, color: "#878190" }}>
                    {(day.hours || 0).toFixed(1)}h
                  </div>
                  {dayPattern.type === "surge" && (
                    <span style={{ fontFamily: "'Nunito'", fontSize: 8, color: "#ef4444" }}>⚡</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}