import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import OptimizedImage from "./OptimizedImage";
import { getRankDisplayData } from "@/lib/rankEngine";
import { ACTIVITIES } from "@/lib/cognitiveEngine";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import PartyTab from "./PartyTab";
import TabGuideModal from "./TabGuideModal";

const RIVAL_JOHAN_KEY = 'rivalTab.johan';

// ─── UTILS ────────────────────────────────────────────────────────────────────
function getDayNumber() {
  return Math.floor(Date.now() / 86400000);
}

function hashSelect(arr, seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return arr[Math.abs(h) % arr.length];
}

function getDayPattern(dateStr) {
  const h = hashSelect([0, 1, 2, 3], dateStr + "pattern");
  if (h === 0) return { type: "surge" };
  if (h === 1) return { type: "weak" };
  return { type: "normal" };
}

// ─── TAUNT POOLS (static — Johan name injected at call site) ────────────────
const AHEAD_TAUNTS = [
  "The gap closes when you stop.",
  "Johan doesn't take rest days.",
  "Every hour you skip, they don't.",
  "Shadows don't sleep.",
  "Johan logged another session. Did you?",
  "You were ahead. Past tense.",
  "Consistency is the only variable that compounds.",
  "Johan is 3 subjects ahead this week.",
];

const WINNING_MESSAGES = [
  "You lead by {X} XP. Don't stop now.",
  "Johan is recalibrating.",
  "Good. Now stay ahead.",
  "Johan sees the gap. They won't accept it.",
  "Lead means nothing without consistency.",
  "Johan is planning a surge. Stay alert.",
];

const DEFAULT_TAUNTS = [
  "Shadow Protocol Active — Monitoring your progress.",
  "The race doesn't pause.",
  "Johan is always logging somewhere.",
  "Your next session determines the gap.",
];

// ─── DYNAMIC MESSAGE SYSTEM ───────────────────────────────────────────────────
function calcJohanMessage(
  playerRankXP, johanXP, playerTodayHours, johanTodayHours,
  playerStreak, johanStreak, logs, dayNumber, rivalName
) {
  const nowH = new Date().getHours();
  const diff = Math.abs(johanXP - playerRankXP);
  const pctAhead = playerRankXP > 0 ? (johanXP - playerRankXP) / playerRankXP : 0;
  const hourSeed = `${new Date().toDateString()}${nowH}`;

  const oneHourAgo = Date.now() - 3600000;
  const recentLog = logs.find(l => new Date(l.created_at).getTime() > oneHourAgo);
  const hasPerfectFocus = logs.some(l => (l.focus_rating || 0) >= 10);

  if (playerTodayHours === 0 && nowH >= 15 && johanTodayHours > 0) {
    return {
      text: `${rivalName} logged ${johanTodayHours.toFixed(1)}h already today. You have: 0h.`,
      color: "#f59e0b",
      category: "slacking",
    };
  }

  if (pctAhead > 0.05) {
    const taunt = hashSelect(AHEAD_TAUNTS, hourSeed);
    return {
      text: `⚡ ${rivalName} overtook you by ${diff.toFixed(1)} XP today. ${taunt}`,
      color: "#ef4444",
      category: "ahead",
      pulse: true,
    };
  }

  if (recentLog) {
    return {
      text: `${rivalName} noticed your session. Adjusting pace.`,
      color: "#00e5ff",
      category: "noticed",
    };
  }

  if (playerStreak > johanStreak) {
    return {
      text: `Your streak is longer. ${rivalName} is watching.`,
      color: "#00cc88",
      category: "streakLead",
    };
  }

  if (hasPerfectFocus) {
    return {
      text: `${rivalName}: '...that focus score.'`,
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
        src="/images/webp/johan_rival.webp"
        alt="Johan"
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
export default function RivalTab({ playerRankXP, playerStreak, logs }) {
  const { t } = useTranslation();
  const RIVAL_NAME = t(RIVAL_JOHAN_KEY);
  const [activeTab, setActiveTab] = useState("rival");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState("johan");
  const [sessionToast, setSessionToast] = useState(null);
  const [cardFlash, setCardFlash] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [prevJohanXP, setPrevJohanXP] = useState(null);
  const [prevPlayerXP, setPrevPlayerXP] = useState(null);
  const toastTimerRef = useRef(null);

  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const { data: rivalDataQuery, isLoading: isRivalLoading } = useQuery({
    queryKey: ["rival"],
    queryFn: () => djangoApi.rival.get(),
  });

  const rivalData = rivalDataQuery || profile?.rival_data;

  const rivalDataMutation = useMutation({
    mutationFn: (newData) => djangoApi.profile.update({ rival_data: newData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
    }
  });

  const savedRivalData = profile?.rival_data || {};
  const [rivalEnabled, setRivalEnabled] = useState(savedRivalData.rivalEnabled ?? true);

  // Detect when Johan "logs a session"
  useEffect(() => {
    if (!rivalData) return;
    const checkSessionAppear = setInterval(() => {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const justVisible = (rivalData.todaySessions || []).filter(s => {
        const [h, m] = s.scheduledTime.split(":").map(Number);
        const sessionMin = h * 60 + m;
        return sessionMin <= nowMin && sessionMin > nowMin - 1;
      });
      if (justVisible.length > 0) {
        setCardFlash("cyan");
        setSessionToast(`${RIVAL_NAME} logged a session`);
        setTimeout(() => setCardFlash(null), 600);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setSessionToast(null), 3000);
      }
    }, 30000);
    return () => clearInterval(checkSessionAppear);
  }, [rivalData, RIVAL_NAME]);

  // Detect overtake events
  useEffect(() => {
    if (!rivalData || playerRankXP === prevPlayerXP) return;
    const johanXP = rivalData.totalXP;
    if (prevJohanXP !== null && prevPlayerXP !== null) {
      if (johanXP > playerRankXP && prevJohanXP <= prevPlayerXP) {
        setCardFlash("red");
        setTimeout(() => setCardFlash(null), 600);
      } else if (playerRankXP > johanXP && prevPlayerXP <= prevJohanXP) {
        setCardFlash("green");
        setTimeout(() => setCardFlash(null), 600);
      }
    }
    setPrevJohanXP(johanXP);
    setPrevPlayerXP(playerRankXP);
  }, [playerRankXP, rivalData]);

  // Typing indicator before midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const secsToMidnight = (23 - now.getHours()) * 3600 + (59 - now.getMinutes()) * 60 + (60 - now.getSeconds());
      if (secsToMidnight < 120 && secsToMidnight > 115) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    };
    const timer = setInterval(checkMidnight, 5000);
    return () => clearInterval(timer);
  }, []);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  // Player weekly stats
  const { playerHoursWeek, playerAvgFocus, playerSubjectsWeek, playerWeeklyRankXP } = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekLogs = logs.filter(l => new Date(l.created_at) >= weekAgo);
    const playerHoursWeek = weekLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const focusArr = weekLogs.map(l => l.focus_rating || 5);
    const playerAvgFocus = focusArr.length > 0 ? focusArr.reduce((a, b) => a + b, 0) / focusArr.length : 0;
    const playerSubjectsWeek = new Set(weekLogs.map(l => l.activity_key)).size;
    const playerWeeklyRankXP = weekLogs.reduce((s, l) => s + (l.hours || 0) * (l.focus_rating || 5), 0);
    return { playerHoursWeek, playerAvgFocus, playerSubjectsWeek, playerWeeklyRankXP };
  }, [logs]);

  if (isRivalLoading || !rivalData) return <div className="py-8 text-center text-muted-foreground/40 text-xs font-mono">{t('rivalTab.loading')}</div>;

  const { totalXP: johanXP, streak: johanStreak, todaySessions = [], weeklyHistory = [] } = rivalData;

  const rivalAhead = johanXP > playerRankXP;
  const playerAhead = playerRankXP > johanXP;
  const diff = Math.abs(johanXP - playerRankXP);
  const pctDiff = playerRankXP > 0 ? diff / playerRankXP : 0;
  const isClosing = rivalAhead && pctDiff < 0.10;

  const thresholds = profile?.rank_info?.thresholds || [];
  let johanRankId = "F";
  for (const thr of thresholds) {
    if (johanXP >= thr.min) johanRankId = thr.id;
  }
  const rivalRank = getRankDisplayData(johanRankId);
  const playerRank = getRankDisplayData(profile?.rank_info?.current_id || "F", profile);

  const visibleSessions = todaySessions.filter(s => {
    const [h, m] = s.scheduledTime.split(":").map(Number);
    return h * 60 + m <= nowMinutes;
  });
  const futureSessions = todaySessions.filter(s => {
    const [h, m] = s.scheduledTime.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });

  const rivalTodayHours = visibleSessions.reduce((s, x) => s + x.hours, 0);
  const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString());
  const playerTodayHours = todayLogs.reduce((s, l) => s + (l.hours || 0), 0);

  const msgObj = calcJohanMessage(
    playerRankXP, johanXP, playerTodayHours, rivalTodayHours,
    playerStreak, johanStreak, logs, getDayNumber(), RIVAL_NAME
  );

  const johanWeekHours = rivalData.johanWeekHours || 0;
  const johanAvgFocus = rivalData.johanAvgFocus || 0;
  const johanSubjectsWeek = rivalData.johanSubjectsWeek || 1;
  const johanWeekRankXP = rivalData.johanWeekRankXP || 0;

  const maxBarH = Math.max(...weeklyHistory.map(d => {
    return historyView === "johan" ? (d.johan?.hours || 0) : (d.player?.hours || 0);
  }), 1);

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
      {/* ── Sub-tab switcher: RIVAL | PARTY ── */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: "var(--habit-border)" }}>
        {[
          { id: "rival", label: "RIVAL" },
          { id: "party", label: "PARTY" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 py-1.5 rounded-xl transition-all"
              style={{
                fontFamily: "'Nunito'",
                fontWeight: isActive ? 800 : 600,
                fontSize: 11,
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                boxShadow: isActive ? "0 2px 8px var(--habit-purple-glow)" : "none",
                letterSpacing: "0.08em",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 🏆 Party tab 🏆 */}
      {activeTab === "party" && (
        <>
          <TabGuideModal guideId="party" profile={queryClient.getQueryData(["userprofile"]) || {}} />
          <PartyTab />
        </>
      )}

      {/* 🗡️ Rival tab (existing Johan content) 🗡️ */}
      {activeTab === "rival" && (
      <>
      <TabGuideModal guideId="rival" profile={queryClient.getQueryData(["userprofile"]) || {}} />

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

      <motion.div
        className="rounded-xl border p-4 space-y-3"
        animate={{
          borderColor: cardBorderColor,
          boxShadow: rivalAhead && pctDiff > 0.05
            ? ['0 0 8px #ef444444', '0 0 22px #ef444488', '0 0 8px #ef444444']
            : cardShadow,
        }}
        transition={rivalAhead && pctDiff > 0.05
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3 }
        }
        style={{ background: "#060c14" }}
      >
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="text-[10px] font-mono text-muted-foreground/50">🔔 RIVAL ALERTS</div>
          <button
            onClick={() => {
              const newVal = !rivalEnabled;
              setRivalEnabled(newVal);
              const updatedData = { ...savedRivalData, rivalEnabled: newVal };
              rivalDataMutation.mutate(updatedData);
              if (newVal && "Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
              }
            }}
            className={`w-10 h-5 rounded-full transition-colors relative ${rivalEnabled ? "bg-primary/60" : "bg-muted"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rivalEnabled ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <GhostAvatar
            overtook={rivalAhead && pctDiff > 0.05}
            playerOvertook={cardFlash === "green"}
          />
          <div className="flex-1 min-w-0">
            <div className="font-mono font-black text-lg tracking-widest" style={{ color: "#00e5ff", fontVariantLigatures: "none" }}>
              {RIVAL_NAME}<span className="text-xs opacity-50 ml-1">_Ω</span>
            </div>
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
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid #ef444444" }}>{t('rivalTab.surge')}</span>
              )}
              {rivalData.currentPattern === "weak" && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.2)", color: "#94a3b8", border: "1px solid #94a3b844" }}>{t('rivalTab.light')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Dual rank XP bars */}
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono" style={{ color: 'rgba(0,229,255,0.6)' }}>
              <span>{RIVAL_NAME} {t('rivalTab.rankXp')}</span>
              <span>{johanXP.toFixed(1)} XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${Math.min((johanXP / Math.max(johanXP, playerRankXP, 1)) * 100, 100)}%` }}
                transition={{ duration: 0.7 }}
                style={{ background: "#00e5ff", boxShadow: "0 0 6px #00e5ff66" }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono" style={{ color: playerRank.color }}>
              <span>{t('rivalTab.youRankXp')}</span>
              <span>{(playerRankXP || 0).toFixed(1)} XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${Math.min(((playerRankXP || 0) / Math.max(johanXP, playerRankXP, 1)) * 100, 100)}%` }}
                transition={{ duration: 0.7, delay: 0.1 }}
                style={{ background: playerRank.color, boxShadow: `0 0 6px ${playerRank.color}66` }}
              />
            </div>
          </div>
        </div>

        <div className="text-xs font-mono font-semibold" style={{ color: rivalAhead ? "#ff8800" : "#00cc88" }}>
          {rivalAhead
            ? `⚠ ${RIVAL_NAME} is ahead by ${diff.toFixed(1)} XP — close the gap`
            : `✓ You lead by ${diff.toFixed(1)} XP — maintain your edge`}
          {isClosing && (
            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold"
              style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid #ef444440" }}>{t('rivalTab.closing')}</span>
          )}
        </div>
      </motion.div>

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
          <div style={{ fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)", fontStyle: "italic", padding: "4px" }}>{t('rivalTab.noSessionsToday')}</div>
        )}

        <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)", paddingTop: 4 }}>
          {t('rivalTab.todayLabel')} {rivalTodayHours.toFixed(1)}{t('rivalTab.hLogged')}
        </div>

        {playerTodayHours === 0 && new Date().getHours() >= 15 && rivalTodayHours > 0 && (
          <div className="px-3 py-2 rounded-xl"
            style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 12, border: "1.5px solid #f59e0b", color: "#f59e0b", background: "rgba(245,158,11,0.06)" }}>
            {RIVAL_NAME} {t('rivalTab.hasAlreadyLogged')} {rivalTodayHours.toFixed(1)}{t('rivalTab.youHaveZero')}
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
        <div className="px-4 py-2.5" style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 11, color: "var(--habit-dim)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid var(--habit-border)" }}>{t('rivalTab.weeklyComparison')}</div>
        <div className="p-4 space-y-3">
          {[
            {
              label: 'Hours',
              you: playerHoursWeek,
              rival: johanWeekHours,
              fmt: v => `${v.toFixed(1)}h`,
              youColor: '#7B61FF',
              rivalColor: '#00e5ff',
            },
            {
              label: 'Avg Focus',
              you: playerAvgFocus,
              rival: johanAvgFocus,
              fmt: v => v.toFixed(1),
              youColor: '#7B61FF',
              rivalColor: '#00e5ff',
            },
            {
              label: 'Subjects',
              you: playerSubjectsWeek,
              rival: johanSubjectsWeek,
              fmt: v => `${v}`,
              youColor: '#7B61FF',
              rivalColor: '#00e5ff',
            },
            {
              label: 'Rank XP',
              you: playerWeeklyRankXP,
              rival: johanWeekRankXP,
              fmt: v => v.toFixed(1),
              youColor: '#7B61FF',
              rivalColor: '#00e5ff',
            },
          ].map(({ label, you, rival, fmt, youColor, rivalColor }) => {
            const maxVal = Math.max(you, rival, 0.01);
            const youPct = (you / maxVal) * 100;
            const rivalPct = (rival / maxVal) * 100;
            const youWin = you >= rival;
            return (
              <div key={label}>
                <div className="flex justify-between items-center mb-1">
                  <span style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }}>{label}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: youWin ? '#00cc88' : '#ef4444' }}>
                      {t('rivalTab.youLabel')} {fmt(you)}
                    </span>
                    <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: !youWin ? '#00cc88' : 'rgba(100,116,139,0.6)' }}>
                      {RIVAL_NAME}: {fmt(rival)}
                    </span>
                  </div>
                </div>
                {/* YOU bar */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Nunito'", fontSize: 9, color: youColor, width: 24 }}>{t('rivalTab.youGraph')}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--habit-border)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${youPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ background: youColor, boxShadow: youWin ? `0 0 6px ${youColor}88` : 'none' }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Nunito'", fontSize: 9, color: rivalColor, width: 24 }}>{t('rivalTab.j')}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--habit-border)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${rivalPct}%` }}
                        transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                        style={{ background: rivalColor, boxShadow: !youWin ? `0 0 6px ${rivalColor}88` : 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderBottomColor: historyOpen ? "var(--habit-border)" : "transparent", transition: "border-color 0.3s" }}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-2 transition-colors"
            style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: "var(--habit-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            {historyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {t('rivalTab.last7Days')}
          </button>
          {historyOpen && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistoryView("you")}
                style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 10, color: historyView === "you" ? "#7B61FF" : "var(--habit-dim)", textTransform: "uppercase" }}
              >
                YOU
              </button>
              <button
                onClick={() => setHistoryView("johan")}
                style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 10, color: historyView === "johan" ? "#00e5ff" : "var(--habit-dim)", textTransform: "uppercase" }}
              >
                {RIVAL_NAME}
              </button>
            </div>
          )}
        </div>
        {historyOpen && (
          <div className="px-4 py-4 space-y-1.5">
            {weeklyHistory.map((day) => {
              const h = historyView === "johan" ? (day.johan?.hours || 0) : (day.player?.hours || 0);
              const pct = h / maxBarH;
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
                        background: historyView === "you" ? "#7B61FF" : (dayPattern.type === "surge" ? "#ef4444" : dayPattern.type === "weak" ? "#94a3b8" : "#00e5ff"),
                        boxShadow: historyView === "you" ? "0 0 4px rgba(123,97,255,0.4)" : (dayPattern.type === "surge" ? "0 0 4px rgba(239,68,68,0.5)" : "0 0 4px rgba(0,229,255,0.4)"),
                      }} />
                  </div>
                  <div className="w-8 text-right" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 10, color: "#878190" }}>
                    {h.toFixed(1)}h
                  </div>
                  {historyView === "johan" && dayPattern.type === "surge" && (
                    <span style={{ fontFamily: "'Nunito'", fontSize: 8, color: "#ef4444" }}>⚡</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}