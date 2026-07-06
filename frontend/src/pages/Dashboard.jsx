import { useState, useEffect, useCallback, useRef } from "react";

import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";

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
import TabGuideModal from "@/components/mindos/TabGuideModal";
import SettingsPanel from "@/components/mindos/SettingsPanel";
import PremiumUpgradeModal from "@/components/mindos/PremiumUpgradeModal";
import { isMobileApp } from "@/utils/platformUtils";
import PillTabBar from "@/components/ui/PillTabBar";
import { hapticHeavy } from "@/hooks/useHaptic";

import CharacterHub from "@/components/mindos/CharacterHub";
import PixelRankRoad from "@/components/mindos/PixelRankRoad";
import AchievementTracker from "@/components/mindos/AchievementTracker";

import { applyActivity, METRIC_CONFIG, getActivityDetails } from "@/lib/cognitiveEngine";
// Removed getRankFromXP
import { Activity, BarChart2, History, Timer, Calendar, Swords, User, Users, Settings } from "lucide-react";
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

const TOOLS_TABS = [
  { id: "history", label: "History" },
  { id: "stats", label: "Projections" },
  { id: "pomodoro", label: "Pomodoro" },
  { id: "calendar", label: "Calendar" },
];

const CHARACTER_TABS = [
  { id: "overview", label: "Stats" },
  { id: "skills", label: "Skills" },
  { id: "skill_tree", label: "Tree" },
  { id: "allies", label: "Allies" },
  { id: "achievements", label: "Achv" },
  { id: "mutators", label: "Mutators" },
  { id: "shop", label: "Shop" },
];

function TabPanel({ title, children }) {
  return (
    <div className="rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--habit-border)" }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function PremiumGate({ isPremium, children, showNotice = false }) {
  const [showModal, setShowModal] = useState(false);
  if (isPremium) return children;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="filter blur-md opacity-40 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-black/40 backdrop-blur-[2px]">
        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
          <span className="text-2xl">👑</span>
        </div>
        <h3 className="text-lg font-bold font-mono text-white mb-2">Premium Feature</h3>
        <p className="text-xs font-mono text-muted-foreground mb-4 max-w-xs">
          Unlock advanced tools, new character classes, and support development.
        </p>
        {showNotice && (
          <p className="text-[10px] font-mono text-amber-500 mb-4 max-w-xs">
            // TODO: Pomodoro has no backend enforcement yet — UI-only gate, revisit if backend persistence is added
          </p>
        )}
        {isMobileApp() ? (
          <div className="text-center space-y-2">
            <p className="text-white/50 text-sm">
              Available with Premium
            </p>
            
            <div
              className="block px-6 py-2 rounded-lg
                         border border-amber-500/40
                         text-amber-400 text-sm font-ui"
            >
              🌐 mindos.pages.dev
            </div>
          </div>
        ) : (
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold font-mono text-sm rounded transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            Upgrade Now
          </button>
        )}
      </div>
      <AnimatePresence>
        {showModal && <PremiumUpgradeModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

function loadRankXP() {
  return { rankXP: 0, currentRank: "F", rankHistory: [] };
}

export default function Dashboard({ activeSection = "dashboard", activeSubItem = null, onSectionChange, onSubItemChange }) {
  const { t } = useTranslation();
  const { profile: djangoProfile, isLoading: djangoProfileLoading, refreshProfile } = useDjangoAuth();

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
      return mapped;
    },
    enabled: !!djangoProfile
  });



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
      const newRankId = djangoProfile.rank_info?.current_id || "F";
      const oldRankId = prev.currentRank || "F";

      const RANK_ORDER = ["F", "D", "C", "B", "A", "S", "SS", "SSS"];
      const prevIdx = RANK_ORDER.indexOf(oldRankId);
      const newIdx = RANK_ORDER.indexOf(newRankId);

      const updated = {
        ...prev,
        rankXP: djangoProfile.rank_xp,
        currentRank: newRankId,
      };

      if (newIdx < prevIdx && prevIdx !== -1) {
        updated.rankHistory = [...prev.rankHistory, {
          date: new Date().toISOString(),
          from: oldRankId,
          to: newRankId,
          reason: "Death Penalty"
        }];
      }

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
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
    },
  });

  const completeGuideMutation = useMutation({
    mutationFn: (/** @type {string} */ guideId) => djangoApi.profile.completeGuide(guideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
    },
  });

  const logTraining = useMutation({
    mutationFn: (/** @type {{ hours: number, focus_rating: number, mutator_multiplier: number, flat_xp_bonus: number, activity: string, efficiency: number }} */ data) => djangoApi.training.log(data),
    /**
     * @param {any} res
     * @param {any} variables
     */
    onSuccess: (res, variables) => {
      if (res.profile) {
        queryClient.setQueryData(["userprofile"], res.profile);
      }
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["trainingLogs"] });
      queryClient.invalidateQueries({ queryKey: ["combat_encounters"] });
      refreshProfile();

      const oldRankId = djangoProfile?.rank_info?.current_id || "F";
      const newRankId = res.profile?.rank_info?.current_id || "F";
      if (newRankId !== oldRankId && (res.profile?.rank_xp || 0) > (djangoProfile?.rank_xp || 0)) {
        setRankUpNotif(newRankId);
        playSound('rank_up');
        hapticHeavy();
      }

      const combatResult = res?.combat_result;
      if (combatResult && combatResult.damage_dealt > 0) {
        handleBossDamage(
          combatResult.damage_dealt,
          res?.gamification_result?.is_crit || false,
          combatResult.boss_defeated,
          combatResult,
          combatResult.rewards || null
        );
      }
    },
    onError: (err) => {
      console.error("Training logging failed:", err);
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Your session may have expired. Please log in again if this persists.",
      });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
  });


  const handleSetup = (data) => {
    // Rely exclusively on API update.
    updateProfile.mutate({ id: djangoProfile?.id, data });
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

    if (isDefeated) {
      setDefeatedBossState({ combatResult, rewards, isOpen: true });
    }
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

    // Sound effects
    playSound('task_complete');
    if (focusRating >= 9) playSound('critical_hit');

    logTraining.mutate({
      hours: hours,
      focus_rating: focusRating,
      mutator_multiplier: 1.0,
      flat_xp_bonus: 0,
      activity: activityKey,
      efficiency: efficiency?.total || 1.0
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

        const backendGains = {
          gf: res.gf_gain || 0,
          gc: res.gc_gain || 0,
          ps: res.ps_gain || 0,
          vm: res.vm_gain || 0,
        };

        const gainLines = Object.entries(backendGains)
          .filter(([, v]) => v > 0)
          .map(([mk]) => {
            const mc = METRIC_CONFIG[mk];
            const actDetails = getActivityDetails(activityKey, tasks);
            const baseCoeff = actDetails ? actDetails.coefficients[mk] || 0 : 0;
            const raw = (baseCoeff * hours).toFixed(3);
            const final = backendGains[mk].toFixed(3);
            return `${mc.abbr} base ${raw} → +${final}`;
          }).join(" · ");

        const feedbackText = `${gainLines} — ${effStr}`;

        onFeedback(feedbackText, res.gold_earned);
        if (res.combat && res.combat.damage_dealt > 0) {
          handleBossDamage(res.combat.damage_dealt, false, res.combat.boss_defeated, res.combat, res.rewards);
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
      <main className="max-w-7xl mx-auto px-0 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
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
        <div className="rounded-none md:rounded-2xl p-0 py-3 md:p-5" style={{ background: 'transparent' }}>
          <TabErrorBoundary tabKey={activeTab}>
            <>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: typeof window !== 'undefined' && window.matchMedia("(max-width: 768px)").matches ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Dashboard — Habitica-style layout */}
                {activeSection === "dashboard" && (
                  <>
                    <TabGuideModal guideId="dashboard" profile={profile} />
                    {/* IQ + Metrics block */}
                    {profile && (
                      <div className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
                        {/* Header */}
                        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                          <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{"🧠 " + t("dashboard.metrics", "COGNITIVE METRICS").toUpperCase()}</span>
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
                  <TabPanel title={"🏋️‍♀️ " + t("sidebar.sections.train", "TRAINING").toUpperCase()}>
                    <TabGuideModal guideId="training" profile={profile} />
                    <ActivityLogger onLog={handleLog} profile={profile} logs={logs} tasks={tasks} />
                  </TabPanel>
                )}

                {/* Tasks section with sub-tabs */}
                {activeSection === "tasks" && (
                  <TabPanel title={"⚔️ " + t("sidebar.sections.tasks", "TASKS").toUpperCase()}>
                    <TasksPanel tasks={tasks} onXpGain={handleXpGain} onBossDamage={handleBossDamage} onRankXP={handleTaskRankXP} subTab={activeSubItem} onRewardFly={handleRewardFly} onLog={handleLog} profile={profile} logs={logs} />
                  </TabPanel>
                )}

                {/* Character section with sub-tabs */}
                {activeSection === "character" && (
                  <>
                    <PillTabBar tabs={CHARACTER_TABS} activeTab={activeSubItem || "overview"} onChange={onSubItemChange} wrap={true} />
                    <TabPanel title={"👤 " + t("sidebar.sections.character", "CHARACTER").toUpperCase()}>
                      <CharacterTab profile={profile} logs={logs} rankXP={rankXPData.rankXP} currentRankId={rankXPData.currentRank} subTab={activeSubItem} />
                    </TabPanel>
                  </>
                )}

                {/* Rival section */}
                {activeSection === "rival" && (
                  <TabPanel title={"👥 " + t("sidebar.sections.rival", "RIVAL").toUpperCase()}>
                    <RivalTab playerRankXP={rankXPData.rankXP} playerStreak={0} logs={logs} />
                  </TabPanel>
                )}

                {/* Tools/Stats sections */}
                {["history", "pomodoro", "calendar", "stats"].includes(activeSection) && (
                  <PillTabBar tabs={TOOLS_TABS} activeTab={activeSection} onChange={onSectionChange} wrap={true} />
                )}
                {activeSection === "stats" && (
                  <TabPanel title={"📊 " + t("sidebar.sections.stats", "PROJECTIONS").toUpperCase()}>
                    <ProjectionTable profile={profile} logs={logs} />
                  </TabPanel>
                )}
                {activeSection === "history" && (
                  <TabPanel title={"📋 " + t("sidebar.sections.history", "HISTORY").toUpperCase()}>
                    <HistoryLog logs={logs} tasks={tasks} />
                  </TabPanel>
                )}
                {activeSection === "pomodoro" && (
                  <TabPanel title={"⏱️ " + t("sidebar.sections.pomodoro", "POMODORO").toUpperCase()}>
                    <PremiumGate isPremium={profile?.is_premium} showNotice={true}>
                      <PomodoroPanel />
                    </PremiumGate>
                  </TabPanel>
                )}
                {activeSection === "calendar" && (
                  <TabPanel title={"📅 " + t("sidebar.sections.calendar", "CALENDAR").toUpperCase()}>
                    <PremiumGate isPremium={profile?.is_premium}>
                      <CalendarPanel />
                    </PremiumGate>
                  </TabPanel>
                )}

                {/* Settings section with sub-tabs */}
                {activeSection === "settings" && (
                  <TabPanel title={"⚙️ " + t("sidebar.sections.settings", "SETTINGS").toUpperCase()}>
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