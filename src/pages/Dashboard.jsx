import { useState, useEffect, useCallback, useRef } from "react";

import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import BossDefeatModal from "@/components/mindos/BossDefeatModal";
import SettingsPanel from "@/components/mindos/SettingsPanel";
import { hapticHeavy } from "@/hooks/useHaptic";

import CharacterHub from "@/components/mindos/CharacterHub";
import PixelRankRoad from "@/components/mindos/PixelRankRoad";
import AchievementTracker from "@/components/mindos/AchievementTracker";

import { applyActivity, calculateIQ, METRIC_CONFIG, ACTIVITIES, getActivityDetails } from "@/lib/cognitiveEngine";
import { getRankFromXP } from "@/lib/rankEngine";
import { applySessionMutators, runDailyMutatorTick } from "@/lib/mutatorEngine";
import { Activity, BarChart2, History, Timer, Calendar, Swords, User, Users, Settings, RefreshCw } from "lucide-react";
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
  const [rankXPData, setRankXPData] = useState(loadRankXP);
  const [flyingRewards, setFlyingRewards] = useState([]);
  const prevHpRef = useRef(null);
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const djangoTasks = await djangoApi.tasks.list();
      const tasksArray = Array.isArray(djangoTasks) ? djangoTasks : (djangoTasks?.results || []);
      const mapped = tasksArray.map(dt => ({
        id: dt.id,
        type: dt.task_type || 'todo',
        name: dt.title || 'Task',
        category: dt.category || 'Other',
        difficulty: dt.difficulty || 'medium',
        notes: dt.notes || '',
        done: dt.is_completed || false,
        is_completed: dt.is_completed || false,   // ← нужно DailiesColumn
        completedToday: dt.is_completed || false,
        last_completed_at: dt.last_completed_at || null,
        rpgValue: dt.value || 0,
        value: dt.value || 0,
        streak: dt.streak || 0,
        posStreak: dt.pos_streak || 0,
        negStreak: dt.neg_streak || 0,
        createdAt: dt.created_at || new Date().toISOString(),
        defaultHours: dt.default_hours || 1,
        defaultFocus: dt.default_focus || 7,
        xpReward: dt.xp_reward || 10,
        goldReward: dt.gold_reward || 8,
        bossDamage: dt.boss_damage || 15,
      }));
      localStorage.setItem('mindos_tasks', JSON.stringify(mapped));
      return mapped;
    },
    enabled: !!djangoProfile
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
    if (djangoProfile) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

  // Sync rankXPData with backend rank_xp and detect rank demotion
  useEffect(() => {
    if (!djangoProfile || djangoProfile.rank_xp === undefined) return;
    setRankXPData(prev => {
      const prevRank = getRankFromXP(prev.rankXP || 0);
      const newRank = getRankFromXP(djangoProfile.rank_xp);
      const RANK_ORDER = ["F", "D", "C", "B", "A", "S", "SS", "SSS"];
      const prevIdx = RANK_ORDER.indexOf(prevRank.id);
      const newIdx = RANK_ORDER.indexOf(newRank.id);

      const updated = {
        rankXP: djangoProfile.rank_xp,
        currentRank: newRank.id,
        rankHistory: prev.rankHistory || []
      };
      saveRankXP(updated);
      return updated;
    });
  }, [djangoProfile?.rank_xp]);

  const { data: trainingLogsData, refetch: refetchTrainingLogs } = useQuery({
    queryKey: ["trainingLogs"],
    queryFn: djangoApi.training.getLog,
    enabled: !!djangoProfile,
  });
  const logs = trainingLogsData?.log || [];

  const dp = /** @type {any} */ (djangoProfile);
  const profile = dp ? {
    ...dp,
    initialized: true,
    gf: dp.gf ?? 100.0,
    gc: dp.gc ?? 100.0,
    ps: dp.ps ?? 100.0,
    vm: dp.vm ?? 100.0,
    gf_ceiling: dp.gf_ceiling ?? 120.0,
    gc_ceiling: dp.gc_ceiling ?? 135.0,
    ps_ceiling: dp.ps_ceiling ?? 112.0,
    vm_ceiling: dp.vm_ceiling ?? 138.0,
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

  const logTraining = useMutation({
    mutationFn: (data) => djangoApi.training.log(data),
    /**
     * @param {any} res
     * @param {any} variables
     */
    onSuccess: (res, variables) => {
      if (res.profile) {
        queryClient.setQueryData(["userprofile"], res.profile);
      }
      try {
        const currentGs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
        const updatedGs = {
          ...currentGs,
          gf: res.profile?.gf ?? variables.gf ?? currentGs.gf,
          gc: res.profile?.gc ?? variables.gc ?? currentGs.gc,
          ps: res.profile?.ps ?? variables.ps ?? currentGs.ps,
          vm: res.profile?.vm ?? variables.vm ?? currentGs.vm,
          gf_ceiling: res.profile?.gf_ceiling ?? currentGs.gf_ceiling,
          gc_ceiling: res.profile?.gc_ceiling ?? currentGs.gc_ceiling,
          ps_ceiling: res.profile?.ps_ceiling ?? currentGs.ps_ceiling,
          vm_ceiling: res.profile?.vm_ceiling ?? currentGs.vm_ceiling,
          gold: res.profile?.gold ?? currentGs.gold,
          hp: res.profile?.hp ?? currentGs.hp,
          maxHp: res.profile?.hp_max ?? currentGs.maxHp,
        };
        localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));
        setGameState(updatedGs);
      } catch (e) {
        console.error("Failed to update game state in localStorage:", e);
      }
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
      
      const oldRank = getRankFromXP(djangoProfile?.rank_xp || 0);
      const newRank = getRankFromXP(res.profile?.rank_xp || 0);
      if (newRank.id !== oldRank.id && (res.profile?.rank_xp || 0) > (djangoProfile?.rank_xp || 0)) {
        setRankUpNotif(newRank.id);
        playSound('rank_up');
        hapticHeavy();
      }
    },
    onError: (err) => {
      console.error("Training logging failed:", err);
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
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
    // No-op because task completion on backend already returns the updated rank_xp in the profile response.
  }, []);

  const [defeatedBossState, setDefeatedBossState] = useState(null);

  const handleBossDamage = useCallback((amount, isCritical, isDefeated = false, combatResult = null, rewards = null) => {
    setExternalDamage({ amount, isCritical, ts: Date.now() });

    try {
      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      gs.totalBossDamage = (gs.totalBossDamage || 0) + amount;
      if (isCritical) {
        gs.totalCrits = (gs.totalCrits || 0) + 1;
      }
      if (isDefeated) {
        gs.bossIndex = (gs.bossIndex || 0) + 1;
        setDefeatedBossState({ combatResult, rewards, isOpen: true });
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

    const result = applyActivity(profile, activityKey, hours, efficiency, tasks);
    if (!result) return;

    const { gains, newProfile, xpEarned } = result;

    // Rank XP (XP-based, hours × focus_rating) — apply mutator multipliers
    const mutatorResult = applySessionMutators(activityKey, hours, []);

    // Gc bonus from lexicon mutator
    if (mutatorResult.gcBonus > 0) {
      const pending = (() => { try { return JSON.parse(localStorage.getItem("mindos_pending_gains") || "{}"); } catch { return {}; } })();
      pending.gc = (pending.gc || 0) + mutatorResult.gcBonus;
      localStorage.setItem("mindos_pending_gains", JSON.stringify(pending));
    }

    // Sound effects
    playSound('task_complete');
    if (focusRating >= 9) playSound('critical_hit');

    logTraining.mutate({
      gf: newProfile.gf,
      gc: newProfile.gc,
      ps: newProfile.ps,
      vm: newProfile.vm,
      hours: hours,
      focus_rating: focusRating,
      mutator_multiplier: mutatorResult.rankXPMultiplier,
      flat_xp_bonus: mutatorResult.cursedClockFlatXP || 0,
      activity: activityKey
    }, {
      onSuccess: (res) => {
        // We now have the updated Profile in `res.profile`
        // We do NOT simulate IQ in localStorage. We let React Query take over.
        
        // Milestone badge notifications
        Object.entries(METRIC_CONFIG).forEach(([mk, mc]) => {
          const before = Math.floor(profile[mk]);
          const after = Math.floor(res.profile[mk]);
          if (after > before) {
            setBadgeNotif({ metric: mc, value: after });
            setTimeout(() => setBadgeNotif(null), 4000);
          }
        });

        const effStr = efficiency
          ? `Focus(×${efficiency.focus.toFixed(2)}) · Streak(×${efficiency.streak.toFixed(2)}) · Fatigue(×${efficiency.fatigue.toFixed(2)}) · Dim(×${efficiency.diminishing.toFixed(2)}) = ×${efficiency.total.toFixed(2)}`
          : "";

        const gainLines = Object.entries(gains)
          .filter(([, v]) => v > 0)
          .map(([mk]) => {
            const mc = METRIC_CONFIG[mk];
            const actDetails = getActivityDetails(activityKey, tasks);
            const baseCoeff = actDetails ? actDetails.coefficients[mk] || 0 : 0;
            const raw = (baseCoeff * hours).toFixed(3);
            const final = gains[mk].toFixed(3);
            return `${mc.abbr} base ${raw} → +${final}`;
          }).join(" · ");

        const mutatorStr = mutatorResult.notes.length > 0 ? ` | Mutators: ${mutatorResult.notes.join(", ")}` : "";
        const feedbackText = `${gainLines} — ${effStr}${mutatorStr}`;

        onFeedback(feedbackText, res.gold_earned);
        if (res.combat && res.combat.damage_dealt > 0) {
            handleBossDamage(res.combat.damage_dealt, res.combat.is_critical, res.combat.boss_defeated, res.combat, res.rewards);
        }
        refetchTrainingLogs();
      },
      onError: () => {
        onFeedback("Failed to log training.");
      }
    });

    // onFeedback is now called in the onSuccess handler of logTraining
  }, [profile, logTraining, handleBossDamage, logs]);

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
    <div className="min-h-screen font-inter bg-transparent text-[var(--habit-text)]">
      <main className="max-w-7xl mx-auto px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <AchievementTracker />
        <RankUpFlash newRankId={rankUpNotif} onDone={() => setRankUpNotif(null)} />


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
                  <ActivityLogger onLog={handleLog} profile={profile} logs={logs} tasks={tasks} />
                </TabPanel>
              )}

              {/* Tasks section with sub-tabs */}
              {activeSection === "tasks" && (
                <TabPanel title="⚔️ TASKS">
                  <TasksPanel tasks={tasks} onXpGain={handleXpGain} onBossDamage={handleBossDamage} onRankXP={handleTaskRankXP} subTab={activeSubItem} onRewardFly={handleRewardFly} />
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
                  <HistoryLog logs={logs} tasks={tasks} />
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

      {/* Boss Defeat Modal */}
      <BossDefeatModal 
        isOpen={defeatedBossState?.isOpen || false} 
        onClose={() => setDefeatedBossState(null)} 
        combatResult={defeatedBossState?.combatResult} 
        rewards={defeatedBossState?.rewards} 
      />
    </div>
  );
}