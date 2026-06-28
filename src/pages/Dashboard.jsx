import { useState, useEffect, useCallback, useRef } from "react";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import IQDisplay from "@/components/mindos/IQDisplay";
import MetricBar from "@/components/mindos/MetricBar";
import StatsPanel from "@/components/mindos/StatsPanel";
import SetupModal from "@/components/mindos/SetupModal";
import RankUpFlash from "@/components/mindos/RankUpFlash";
import TabErrorBoundary from "@/components/mindos/TabErrorBoundary";
import FlyingReward from "@/components/mindos/FlyingReward";

import ActivityLogger from "@/components/mindos/ActivityLogger";
import ProjectionTable from "@/components/mindos/ProjectionTable";
import HistoryLog from "@/components/mindos/HistoryLog";
import PomodoroPanel from "@/components/mindos/PomodoroPanel";
import CalendarPanel from "@/components/mindos/CalendarPanel";
import TasksPanel from "@/components/mindos/TasksPanel";
import CharacterTab from "@/components/mindos/CharacterTab";
import RivalTab from "@/components/mindos/RivalTab";
import SettingsPanel from "@/components/mindos/SettingsPanel";

import CharacterHub from "@/components/mindos/CharacterHub";
import PixelRankRoad from "@/components/mindos/PixelRankRoad";
import AchievementTracker from "@/components/mindos/AchievementTracker";

import { applyActivity, calculateIQ, METRIC_CONFIG, ACTIVITIES } from "@/lib/cognitiveEngine";
import { normalizeGold } from "@/lib/utils";
import { getRankFromXP, calcSessionRankXP } from "@/lib/rankEngine";
import { applySessionMutators, applyBossDamageModifiers, runDailyMutatorTick } from "@/lib/mutatorEngine";
import { Activity, BarChart2, History, Timer, Calendar, Swords, User, Users, Settings, RefreshCw } from "lucide-react";
import { CLASSES } from "@/lib/rpgSystem";
import { playSound } from "@/lib/soundEffects.js";
import { prefetchTab } from "@/lib/prefetch";

const TABS = [
  { id: "train", label: "Train", icon: Activity },
  { id: "tasks", label: "Tasks", icon: Swords },
  { id: "rival", label: "Rival", icon: Users },
  { id: "stats", label: "Projections", icon: BarChart2 },
  { id: "history", label: "History", icon: History },
  { id: "pomodoro", label: "Pomodoro", icon: Timer },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "character", label: "Character", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

function TabPanel({ title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--habit-border)" }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function loadRankXP() {
  try {
    const raw = localStorage.getItem("mindos_rank_xp");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { rankXP: 0, currentRank: "F", rankHistory: [] };
}

function saveRankXP(data) {
  localStorage.setItem("mindos_rank_xp", JSON.stringify(data));
}

export default function Dashboard({ activeSection = "dashboard", activeSubItem = null, onSectionChange, onSubItemChange }) {
  const { profile: djangoProfile, isLoading: djangoProfileLoading, refreshProfile } = useDjangoAuth();
  const [gameState, setGameState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleStateUpdate = () => {
      try {
        setGameState(JSON.parse(localStorage.getItem("mindos_game_state") || "{}"));
      } catch {}
    };
    window.addEventListener("storage", handleStateUpdate);
    window.addEventListener("mindos-state-change", handleStateUpdate);
    // Initial fetch to be safe
    handleStateUpdate();
    return () => {
      window.removeEventListener("storage", handleStateUpdate);
      window.removeEventListener("mindos-state-change", handleStateUpdate);
    };
  }, [djangoProfile]);

  // Map sections to tab IDs
  const activeTab = activeSection || "dashboard";
  const [badgeNotif, setBadgeNotif] = useState(null);
  const [rankUpNotif, setRankUpNotif] = useState(null);
  const [externalDamage, setExternalDamage] = useState(null);
  const [goldDisplay, setGoldDisplay] = useState(0);
  const [rankXPData, setRankXPData] = useState(loadRankXP);
  const [hpMana, setHpMana] = useState({ hp: 100, maxHp: 100, mana: 0, maxMana: 100, classColor: "#3b82f6" });
  const [rankDemoteNotif, setRankDemoteNotif] = useState(null);
  const [flyingRewards, setFlyingRewards] = useState([]);
  const prevHpRef = useRef(null);
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState(false);

  const { pullRef, pulling, progress } = usePullToRefresh(() => {
    queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    queryClient.invalidateQueries({ queryKey: ["activitylogs"] });
    setRankXPData(loadRankXP());
  });

  // Run daily mutator tick (loan shark deductions, compound interest, etc.)
  useEffect(() => {
    try {
      const lastTick = localStorage.getItem("mindos_mutator_tick_date") || "";
      const today = new Date().toISOString().split("T")[0];
      if (lastTick !== today) {
        const ran = runDailyMutatorTick(lastTick);
        if (ran) localStorage.setItem("mindos_mutator_tick_date", today);
      }
    } catch {}
  }, []);



  // Auto-initialize game state metrics if not initialized yet
  useEffect(() => {
    if (djangoProfile) {
      try {
        const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
        if (!gs.initialized) {
          const updatedGs = {
            ...gs,
            initialized: true,
            gf: gs.gf ?? djangoProfile.gf ?? 100.0,
            gc: gs.gc ?? djangoProfile.gc ?? 100.0,
            ps: gs.ps ?? djangoProfile.ps ?? 100.0,
            vm: gs.vm ?? djangoProfile.vm ?? 100.0,
            gf_ceiling: gs.gf_ceiling ?? djangoProfile.gf_ceiling ?? 120.0,
            gc_ceiling: gs.gc_ceiling ?? djangoProfile.gc_ceiling ?? 135.0,
            ps_ceiling: gs.ps_ceiling ?? djangoProfile.ps_ceiling ?? 112.0,
            vm_ceiling: gs.vm_ceiling ?? djangoProfile.vm_ceiling ?? 138.0,
            hp: gs.hp ?? djangoProfile.hp ?? 100,
            maxHp: gs.maxHp ?? djangoProfile.hp_max ?? 100,
            gold: gs.gold ?? djangoProfile.gold ?? 0,
          };
          localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));
          setGameState(updatedGs);
          window.dispatchEvent(new CustomEvent("mindos-state-change"));
        }
      } catch (e) {
        console.warn("Failed to auto-initialize game state:", e);
      }
    }
  }, [djangoProfile]);

  // Sync tasks from Django to LocalStorage on mount/load
  useEffect(() => {
    const syncTasksFromDjango = async () => {
      try {
        const djangoTasks = await djangoApi.tasks.list();
        if (Array.isArray(djangoTasks)) {
          const mappedTasks = djangoTasks.map(dt => ({
            id: dt.id,
            type: dt.task_type || 'todo',
            name: dt.title || 'Task',
            category: 'Coding',
            difficulty: dt.difficulty || 'medium',
            notes: dt.notes || '',
            done: dt.is_completed || false,
            completedToday: dt.is_completed || false,
            rpgValue: dt.value || 0,
            createdAt: dt.created_at || new Date().toISOString(),
          }));
          
          const current = localStorage.getItem('mindos_tasks');
          if (current !== JSON.stringify(mappedTasks)) {
            localStorage.setItem('mindos_tasks', JSON.stringify(mappedTasks));
          }
        }
      } catch (e) {
        console.warn('Failed to sync tasks from Django on load:', e);
      }
    };

    if (djangoProfile) {
      syncTasksFromDjango();
    }
  }, [djangoProfile]);

  // Idle prefetching for chunks
  useEffect(() => {
    const triggerPrefetch = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      if (isMobile) {
        // Mobile: prefetch all main sections
        const mainSections = ["tasks", "character", "train", "stats", "rival", "settings"];
        mainSections.forEach((sec, idx) => {
          setTimeout(() => prefetchTab(sec), idx * 250);
        });
      } else {
        // Desktop: prefetch likely next tabs
        prefetchTab("tasks");
        prefetchTab("character");
      }
    };

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => triggerPrefetch());
    } else {
      setTimeout(triggerPrefetch, 2500);
    }
  }, []);

  // Refresh gold + HP/Mana from localStorage
  useEffect(() => {
    const refresh = () => {
      try {
        const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
        setGoldDisplay(normalizeGold(gs.gold || 0));
        const cls = JSON.parse(localStorage.getItem("mindos_class") || "{}");
        const classInfo = cls.chosen ? CLASSES[cls.chosen] : null;
        const currentHp = gs.hp !== undefined ? gs.hp : (gs.maxHp || 100);

        // Detect rank demotion (HP just reached 0)
        if (prevHpRef.current !== null && prevHpRef.current > 0 && currentHp === 0) {
          const rankData = JSON.parse(localStorage.getItem("mindos_rank_xp") || "{}");
          playSound('error');
          setRankDemoteNotif(rankData.currentRank || "F");
          setRankXPData({ ...rankData });
          setTimeout(() => setRankDemoteNotif(null), 5000);
        }
        prevHpRef.current = currentHp;

        setHpMana({
          hp: currentHp,
          maxHp: gs.maxHp || 100,
          mana: cls.mana || 0,
          maxMana: cls.maxMana || (classInfo?.maxMana || 100),
          classColor: classInfo?.color || "#3b82f6",
        });
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  const [logs, setLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_activity_logs") || "[]");
    } catch {
      return [];
    }
  });

  const profile = djangoProfile ? {
    ...djangoProfile,
    initialized: true,
    gf: gameState.gf ?? djangoProfile.gf ?? 100.0,
    gc: gameState.gc ?? djangoProfile.gc ?? 100.0,
    ps: gameState.ps ?? djangoProfile.ps ?? 100.0,
    vm: gameState.vm ?? djangoProfile.vm ?? 100.0,
    gf_ceiling: gameState.gf_ceiling ?? djangoProfile.gf_ceiling ?? 120.0,
    gc_ceiling: gameState.gc_ceiling ?? djangoProfile.gc_ceiling ?? 135.0,
    ps_ceiling: gameState.ps_ceiling ?? djangoProfile.ps_ceiling ?? 112.0,
    vm_ceiling: gameState.vm_ceiling ?? djangoProfile.vm_ceiling ?? 138.0,
  } : null;

  const profileLoading = djangoProfileLoading || !profile;


  const updateProfile = useMutation({
    /**
     * @param {{ id: any, data: any }} variables
     */
    mutationFn: ({ data }) => {
      return djangoApi.profile.update(data);
    },
    /**
     * @param {any} res
     * @param {any} variables
     */
    onSuccess: (res, variables) => {
      try {
        const currentGs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
        const updatedGs = {
          ...currentGs,
          gf: res.gf ?? variables.data.gf ?? currentGs.gf,
          gc: res.gc ?? variables.data.gc ?? currentGs.gc,
          ps: res.ps ?? variables.data.ps ?? currentGs.ps,
          vm: res.vm ?? variables.data.vm ?? currentGs.vm,
          gf_ceiling: res.gf_ceiling ?? variables.data.gf_ceiling ?? currentGs.gf_ceiling,
          gc_ceiling: res.gc_ceiling ?? variables.data.gc_ceiling ?? currentGs.gc_ceiling,
          ps_ceiling: res.ps_ceiling ?? variables.data.ps_ceiling ?? currentGs.ps_ceiling,
          vm_ceiling: res.vm_ceiling ?? variables.data.vm_ceiling ?? currentGs.vm_ceiling,
        };
        localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));
        setGameState(updatedGs);
      } catch (e) {
        console.error("Failed to update game state in localStorage:", e);
      }
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
    },
  });

  const createLog = useMutation({
    /**
     * @param {any} data
     */
    mutationFn: async (data) => {
      const newLog = { ...data, id: Date.now(), created_date: new Date().toISOString() };
      const currentLogs = [newLog, ...logs];
      localStorage.setItem("mindos_activity_logs", JSON.stringify(currentLogs));
      setLogs(currentLogs);
      return newLog;
    },
  });

  const handleSetup = (data) => {
    try {
      const currentGs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      const updatedGs = {
        ...currentGs,
        ...data,
      };
      localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));
      setGameState(updatedGs);
    } catch (e) {
      console.error("Failed to save initial game state to localStorage:", e);
    }
  };

  const handleXpGain = useCallback((xp) => {
    // Backend complete_task already handles XP gain and updates database.
  }, []);

  // Called by TasksPanel when a task gives rank XP — syncs Dashboard state
  const handleTaskRankXP = useCallback((amount) => {
    const RANK_THRESHOLDS = [
      { id: "F", min: 0 }, { id: "D", min: 50 }, { id: "C", min: 150 },
      { id: "B", min: 400 }, { id: "A", min: 800 }, { id: "S", min: 1500 },
      { id: "SS", min: 2500 }, { id: "SSS", min: 4000 },
    ];
    setRankXPData(prev => {
      const newRankXP = Math.max(0, (prev.rankXP || 0) + amount);
      const newRank = [...RANK_THRESHOLDS].reverse().find(r => newRankXP >= r.min);
      const newRankId = newRank?.id || "F";
      if (newRankId !== prev.currentRank && amount > 0) {
        setRankUpNotif(newRankId);
        playSound('rank_up');
      }
      const updated = { ...prev, rankXP: newRankXP, currentRank: newRankId };
      saveRankXP(updated);
      return updated;
    });
  }, []);

  const handleBossDamage = useCallback((amount, isCritical, isDefeated = false) => {
    setExternalDamage({ amount, isCritical, ts: Date.now() });

    try {
      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      gs.totalBossDamage = (gs.totalBossDamage || 0) + amount;
      if (isCritical) {
        gs.totalCrits = (gs.totalCrits || 0) + 1;
      }
      if (isDefeated) {
        gs.bossIndex = (gs.bossIndex || 0) + 1;
      }
      localStorage.setItem("mindos_game_state", JSON.stringify(gs));
    } catch {}
  }, []);

  const handleRewardFly = useCallback((reward) => {
    const id = Date.now() + Math.random();
    setFlyingRewards(prev => [...prev, { ...reward, id }]);
    setTimeout(() => {
      setFlyingRewards(prev => prev.filter(r => r.id !== id));
    }, 1000);
  }, []);

  const handleLog = useCallback((activityKey, hours, focusRating, efficiency, onFeedback) => {
    if (!profile) return;

    const result = applyActivity(profile, activityKey, hours, efficiency);
    if (!result) return;

    const { gains, newProfile, xpEarned } = result;
    const iqBefore = calculateIQ(profile.gf, profile.gc, profile.ps, profile.vm);
    const iqAfter = calculateIQ(newProfile.gf, newProfile.gc, newProfile.ps, newProfile.vm);

    // Milestone badge notifications
    Object.entries(METRIC_CONFIG).forEach(([mk, mc]) => {
      const before = Math.floor(profile[mk]);
      const after = Math.floor(newProfile[mk]);
      if (after > before) {
        setBadgeNotif({ metric: mc, value: after });
        setTimeout(() => setBadgeNotif(null), 4000);
      }
    });

    // Rank XP (XP-based, hours × focus_rating) — apply mutator multipliers
    const mutatorResult = applySessionMutators(activityKey, hours, logs);
    const baseSessionRankXP = calcSessionRankXP(hours, focusRating);
    const sessionRankXP = Math.round(baseSessionRankXP * mutatorResult.rankXPMultiplier + (mutatorResult.cursedClockFlatXP || 0));

    // Gc bonus from lexicon mutator
    if (mutatorResult.gcBonus > 0) {
      const pending = (() => { try { return JSON.parse(localStorage.getItem("mindos_pending_gains") || "{}"); } catch { return {}; } })();
      pending.gc = (pending.gc || 0) + mutatorResult.gcBonus;
      localStorage.setItem("mindos_pending_gains", JSON.stringify(pending));
    }

    const prevRankXPData = loadRankXP();
    const newTotalRankXP = (prevRankXPData.rankXP || 0) + sessionRankXP;
    const prevRank = getRankFromXP(prevRankXPData.rankXP || 0);
    const newRank = getRankFromXP(newTotalRankXP);

    const today = new Date().toISOString().split("T")[0];
    const newRankHistory = prevRankXPData.rankHistory || [];
    if (newRank.id !== prevRank.id) {
      newRankHistory.push({ rank: newRank.id, achievedAt: today });
      setRankUpNotif(newRank.id);
    }

    const updatedRankXPData = { rankXP: newTotalRankXP, currentRank: newRank.id, rankHistory: newRankHistory };
    saveRankXP(updatedRankXPData);
    setRankXPData(updatedRankXPData);

    // Sound effects
    playSound('task_complete');
    if (focusRating >= 9) playSound('critical_hit');

    // Boss damage from session — apply PWR stat + mutator multipliers
    const rawBossDmg = Math.round(hours * focusRating * 10);
    const bossDmg = applyBossDamageModifiers(rawBossDmg);
    const isCrit = focusRating >= 10;
    handleBossDamage(bossDmg, isCrit);

    updateProfile.mutate({
      id: profile.id,
      data: {
        gf: newProfile.gf,
        gc: newProfile.gc,
        ps: newProfile.ps,
        vm: newProfile.vm,
        weekly_xp: (profile.weekly_xp || 0) + xpEarned,
        total_xp: (profile.total_xp || 0) + xpEarned,
      }
    });

    const effStr = efficiency
      ? `Focus(×${efficiency.focus.toFixed(2)}) · Streak(×${efficiency.streak.toFixed(2)}) · Fatigue(×${efficiency.fatigue.toFixed(2)}) · Dim(×${efficiency.diminishing.toFixed(2)}) = ×${efficiency.total.toFixed(2)}`
      : "";

    const gainLines = Object.entries(gains)
      .filter(([, v]) => v > 0)
      .map(([mk]) => {
        const mc = METRIC_CONFIG[mk];
        const baseCoeff = ACTIVITIES[activityKey].coefficients[mk] || 0;
        const raw = (baseCoeff * hours).toFixed(3);
        const final = gains[mk].toFixed(3);
        return `${mc.abbr} base ${raw} → +${final}`;
      }).join(" · ");

    const mutatorStr = mutatorResult.notes.length > 0 ? ` | Mutators: ${mutatorResult.notes.join(", ")}` : "";
    const feedbackText = `${gainLines} — ${effStr}${mutatorStr}`;

    createLog.mutate({
      activity: activityKey,
      hours,
      gf_gain: gains.gf,
      gc_gain: gains.gc,
      ps_gain: gains.ps,
      vm_gain: gains.vm,
      iq_before: iqBefore,
      iq_after: iqAfter,
      xp_earned: xpEarned,
      log_date: new Date().toISOString(),
      focus_rating: focusRating,
      efficiency_total: efficiency?.total,
      efficiency_focus: efficiency?.focus,
      efficiency_streak: efficiency?.streak,
      efficiency_fatigue: efficiency?.fatigue,
      efficiency_diminishing: efficiency?.diminishing,
    });

    onFeedback(feedbackText);
  }, [profile, updateProfile, createLog, handleBossDamage]);

  if (profileLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !profile.initialized) {
    return <SetupModal onSave={handleSetup} />;
  }

  return (
    <div ref={pullRef} className="min-h-screen font-inter bg-transparent text-[var(--habit-text)]">
      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div className="flex justify-center py-2 pointer-events-none">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-mono text-muted-foreground"
            style={{ opacity: Math.min(1, progress) }}
          >
            <RefreshCw className="w-3 h-3 animate-spin" style={{ animationPlayState: progress >= 1 ? "running" : "paused" }} />
            {progress >= 1 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <AchievementTracker logs={logs} />
        <RankUpFlash newRankId={rankUpNotif} onDone={() => setRankUpNotif(null)} />

        <AnimatePresence>
          {rankDemoteNotif && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
            >
              <div className="bg-card border border-red-500/50 rounded-2xl p-8 max-w-xs w-full text-center space-y-4">
                <div className="text-4xl">💀</div>
                <div className="font-mono text-red-400 font-black text-xl tracking-widest">HP REACHED 0</div>
                <div className="font-mono text-muted-foreground text-sm">Your rank has been reduced.</div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl font-mono text-red-400 font-bold">
                  DEMOTED TO RANK {rankDemoteNotif}
                </div>
                <div className="text-xs text-muted-foreground/60 font-mono">HP restored to 30. Rise again.</div>
                <button onClick={() => setRankDemoteNotif(null)}
                  className="w-full py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-mono font-bold text-sm hover:bg-red-500/30 transition-colors">
                  ACKNOWLEDGE
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {badgeNotif && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border border-border bg-card shadow-xl text-sm font-mono flex items-center gap-2"
            >
              <span className="text-lg">🏆</span>
              <span className={`font-bold text-${badgeNotif.metric.color}`}>{badgeNotif.metric.abbr}</span>
              <span className="text-foreground">reached {badgeNotif.value} — milestone unlocked!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="rounded-xl md:rounded-2xl p-3 md:p-5" style={{ background: 'transparent' }}>
          <TabErrorBoundary tabKey={activeTab}>
            <>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
              {/* Dashboard — Habitica-style layout */}
              {activeSection === "dashboard" && (
                <>
                  {/* IQ + Metrics block */}
                  {profile && (
                    <div className="mb-4 rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
                      {/* Header */}
                      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>🧠 COGNITIVE METRICS</span>
                      </div>
                      <div className="px-4 pb-4">
                        {/* IQ + metrics side by side */}
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="shrink-0">
                            <IQDisplay gf={profile.gf} gc={profile.gc} ps={profile.ps} vm={profile.vm} gfCeiling={profile.gf_ceiling} gcCeiling={profile.gc_ceiling} psCeiling={profile.ps_ceiling} vmCeiling={profile.vm_ceiling} />
                          </div>
                          <div className="flex-1 space-y-3 py-2">
                            {["gf", "gc", "ps", "vm"].map(mk => (
                              <MetricBar key={mk} metricKey={mk} current={profile[mk]} ceiling={profile[`${mk}_ceiling`]} />
                            ))}
                          </div>
                        </div>
                        {/* Stats row */}
                        <div className="mt-3">
                          <StatsPanel profile={profile} logs={logs} />
                        </div>
                      </div>
                    </div>
                  )}



                  {/* Character Hub: portrait + HP/MP + Boss */}
                  <CharacterHub
                    rankXP={rankXPData.rankXP}
                    currentRankId={rankXPData.currentRank}
                    onBossDamage={handleBossDamage}
                    externalDamage={externalDamage}
                  />

                  {/* Pixel Rank Road Map */}
                  <div className="mt-4">
                    <PixelRankRoad rankXP={rankXPData.rankXP} />
                  </div>
                </>
              )}

              {/* Train section */}
              {(activeSection === "train" || activeSection === "training") && (
                <TabPanel title="🏋️ TRAINING">
                  <ActivityLogger onLog={handleLog} profile={profile} logs={logs} />
                </TabPanel>
              )}

              {/* Tasks section with sub-tabs */}
              {activeSection === "tasks" && (
                <TabPanel title="⚔️ TASKS">
                  <TasksPanel onXpGain={handleXpGain} onBossDamage={handleBossDamage} onRankXP={handleTaskRankXP} subTab={activeSubItem} onRewardFly={handleRewardFly} />
                </TabPanel>
              )}

              {/* Character section with sub-tabs */}
              {activeSection === "character" && (
                <TabPanel title="👤 CHARACTER">
                  <CharacterTab profile={profile} logs={logs} rankXP={rankXPData.rankXP} currentRankId={rankXPData.currentRank} subTab={activeSubItem} />
                </TabPanel>
              )}

              {/* Rival section */}
              {activeSection === "rival" && (
                <TabPanel title="👥 RIVAL">
                  <RivalTab playerRankXP={rankXPData.rankXP} playerStreak={(() => { try { return JSON.parse(localStorage.getItem("mindos_streak") || "{}").streakCount || 0; } catch { return 0; } })()} logs={logs} />
                </TabPanel>
              )}

              {/* Projections/Stats section */}
              {activeSection === "stats" && (
                <TabPanel title="📊 PROJECTIONS">
                  <ProjectionTable profile={profile} logs={logs} />
                </TabPanel>
              )}

              {/* Tools sections */}
              {activeSection === "history" && (
                <TabPanel title="📋 HISTORY">
                  <HistoryLog logs={logs} />
                </TabPanel>
              )}
              {activeSection === "pomodoro" && (
                <TabPanel title="⏱️ POMODORO">
                  <PomodoroPanel />
                </TabPanel>
              )}
              {activeSection === "calendar" && (
                <TabPanel title="📅 CALENDAR">
                  <CalendarPanel />
                </TabPanel>
              )}

              {/* Settings section with sub-tabs */}
              {activeSection === "settings" && (
                <TabPanel title="⚙️ SETTINGS">
                  <SettingsPanel activeSubTab={activeSubItem || "appearance"} />
                </TabPanel>
              )}
              </motion.div>
            </>
          </TabErrorBoundary>
        </div>
      </main>

      {/* Flying reward particles overlay */}
      <FlyingReward rewards={flyingRewards} />
    </div>
  );
}