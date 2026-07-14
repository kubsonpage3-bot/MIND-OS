import { useState, useEffect, useCallback, useRef } from "react";

import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
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
import PomodoroPanel from "@/components/mindos/pomodoro/PomodoroPanel";
import CalendarPanel from "@/components/mindos/CalendarPanel";
import TasksPanel from "@/components/mindos/TasksPanel";
import CharacterTab from "@/components/mindos/CharacterTab";
import RivalTab from "@/components/mindos/RivalTab";
import BossDefeatModal from "@/components/mindos/BossDefeatModal";
import TabGuideModal from "@/components/mindos/TabGuideModal";
import SettingsPanel from "@/components/mindos/SettingsPanel";
import PremiumUpgradeModal from "@/components/mindos/PremiumUpgradeModal";
import { isMobileApp } from "@/utils/platformUtils";
import { modalStack } from "@/utils/modalStack";
import PillTabBar from "@/components/ui/PillTabBar";
import { hapticHeavy, hapticLight } from "@/hooks/useHaptic";

import ActivePartyWidget from "@/components/mindos/ActivePartyWidget";
import DailyQuoteWidget from "@/components/mindos/DailyQuoteWidget";
import BossPanel from "@/components/mindos/BossPanel";
import PixelRankRoad from "@/components/mindos/PixelRankRoad";
import AchievementTracker from "@/components/mindos/AchievementTracker";
import GuestBanner from "@/components/mindos/GuestBanner";
import ConvertGuestModal from "@/components/mindos/ConvertGuestModal";
import OfflineSummaryModal from "@/components/mindos/OfflineSummaryModal";

import { applyActivity, METRIC_CONFIG, getActivityDetails } from "@/lib/cognitiveEngine";
// Removed getRankFromXP
import { Activity, BarChart2, History, Timer, Calendar, Swords, User, Users, Settings } from "lucide-react";
import { playSound } from "@/lib/soundEffects.js";
import { prefetchTab } from "@/lib/prefetch";

const TABS = [
  { id: "train", label: "sidebar.sections.train", icon: Activity },
  { id: "tasks", label: "sidebar.sections.tasks", icon: Swords },
  { id: "rival", label: "sidebar.sections.rival", icon: Users },
  { id: "stats", label: "sidebar.sections.stats", icon: BarChart2 },
  { id: "history", label: "sidebar.sections.history", icon: History },
  { id: "pomodoro", label: "sidebar.sections.pomodoro", icon: Timer },
  { id: "calendar", label: "sidebar.sections.calendar", icon: Calendar },
  { id: "character", label: "sidebar.sections.character", icon: User },
  { id: "settings", label: "sidebar.sections.settings", icon: Settings },
];

const TOOLS_TABS = [
  { id: "history", label: "dashboard.tab_history" },
  { id: "stats", label: "dashboard.tab_projections" },
  { id: "pomodoro", label: "dashboard.tab_pomodoro" },
  { id: "calendar", label: "dashboard.tab_calendar" },
];

const CHARACTER_TABS = [
  { id: "overview", label: "dashboard.tab_stats" },
  { id: "skills", label: "dashboard.tab_skills" },
  { id: "achievements", label: "dashboard.tab_achv" },
  { id: "shop", label: "dashboard.tab_shop" },
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
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef(null);
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
        <h3 className="text-lg font-bold font-mono text-white mb-2">{t('dashboard.premium_title')}</h3>
        <p className="text-xs font-mono text-muted-foreground mb-4 max-w-xs">
          {t('dashboard.premium_desc')}
        </p>
        {showNotice && (
          <p className="text-[10px] font-mono text-amber-500 mb-4 max-w-xs">
            // TODO: Pomodoro has no backend enforcement yet — UI-only gate, revisit if backend persistence is added
          </p>
        )}
        {isMobileApp() ? (
          <div className="text-center space-y-3">
            <p className="text-white/70 text-sm font-mono">
              Want Premium? Visit the site to purchase:
            </p>
            <div
              className="inline-block px-6 py-2 rounded-lg
                         border border-amber-500/40
                         text-amber-400 text-sm font-mono tracking-wide"
            >
              🌐 mindos.pages.dev
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold font-mono text-sm rounded transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              {t('dashboard.btn_upgrade')}
            </button>
            <a
              href="https://mindos.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-amber-400/70 hover:text-amber-400 transition-colors underline underline-offset-2"
            >
              🌐 mindos.pages.dev
            </a>
          </div>
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

const BOTTOM_TABS = ["dashboard", "tasks", "character", "tools", "settings"];
const getSectionIndex = (sec) => {
  if (["history", "pomodoro", "calendar", "stats"].includes(sec)) return 3; // "tools"
  const idx = BOTTOM_TABS.indexOf(sec);
  return idx === -1 ? 0 : idx;
};

export default function Dashboard({ activeSection = "dashboard", activeSubItem = null, onSectionChange, onSubItemChange }) {
  const { t } = useTranslation();
  const { profile: djangoProfile, isLoading: djangoProfileLoading, refreshProfile } = useDjangoAuth();

  // Map sections to tab IDs
  const activeTab = activeSection || "dashboard";
  
  // Group tool sections under a single key so the page doesn't unmount when switching sub-tabs
  const getTabKey = (sec) => {
    if (["history", "pomodoro", "calendar", "stats"].includes(sec)) return "tools";
    return sec || "dashboard";
  };
  const activeTabKey = getTabKey(activeSection);
  
  const prevTabRef = useRef(activeTab);
  const directionRef = useRef(0);
  if (activeTab !== prevTabRef.current) {
    const oldIdx = getSectionIndex(prevTabRef.current);
    const newIdx = getSectionIndex(activeTab);
    directionRef.current = newIdx > oldIdx ? 1 : newIdx < oldIdx ? -1 : 0;
    prevTabRef.current = activeTab;
  }
  const slideDirection = directionRef.current;

  const pageVariants = {
    initial: (direction) => {
      const isMobile = typeof window !== 'undefined' && window.matchMedia("(max-width: 768px)").matches;
      if (!isMobile) return { opacity: 0, y: 15 };
      return { x: direction > 0 ? '100%' : direction < 0 ? '-100%' : 0, opacity: 1 };
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }
    },
    exit: (direction) => {
      const isMobile = typeof window !== 'undefined' && window.matchMedia("(max-width: 768px)").matches;
      if (!isMobile) return { opacity: 0, y: -15 };
      return {
        x: direction > 0 ? '-28%' : direction < 0 ? '28%' : 0,
        opacity: 0.35,
        transition: { duration: 0.18, ease: [0.4, 0, 0.6, 1] }
      };
    }
  };

  // MotionValue drives drag preview — FM stays fully in control, no style.transform conflicts
  const containerRef = useRef(null);
  const activeTabRef = useRef(null);
  const activeSectionRef = useRef(activeSection);
  const dragX = useMotionValue(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const activeTabIndex = getSectionIndex(activeSection);
  const activeIndexRef = useRef(activeTabIndex);
  activeIndexRef.current = activeTabIndex;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (containerWidth > 0) {
      setIsTransitioning(true);
      const anim = animate(dragX, -(activeTabIndex * containerWidth), {
        type: 'spring', stiffness: 380, damping: 36, mass: 0.8
      });
      anim.then(() => {
        setIsTransitioning(false);
      });
    }
  }, [activeTabIndex, containerWidth]);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) return;

    let touchStart = null;
    let isHorizontal = null;
    let velocityX = 0;
    let lastMoveTime = 0;
    let lastMoveX = 0;

    const handleStart = (e) => {
      if (document.body.classList.contains('dnd-dragging') || modalStack.length > 0) return;
      if (e.target.closest('.overflow-x-auto, .overflow-x-scroll, .touch-none, [data-no-swipe], nav')) return;
      if (e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
      isHorizontal = null;
      velocityX = 0;
      lastMoveTime = Date.now();
      lastMoveX = touch.clientX;
      dragX.stop();
    };

    const handleMove = (e) => {
      if (!touchStart || document.body.classList.contains('dnd-dragging')) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;

      if (isHorizontal === null) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (Math.abs(dy) > Math.abs(dx) * 0.9) {
            touchStart = null;
            return;
          }
          isHorizontal = true;
        }
        return;
      }

      if (isHorizontal === true) {
        if (e.cancelable) e.preventDefault();
        setIsTransitioning(true);

        const now = Date.now();
        const dt = now - lastMoveTime;
        if (dt > 0 && dt < 100) {
          const instantV = (touch.clientX - lastMoveX) / dt * 1000;
          velocityX = velocityX * 0.6 + instantV * 0.4;
        }
        lastMoveTime = now;
        lastMoveX = touch.clientX;

        const cw = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
        const currentIdx = activeIndexRef.current;
        const baseOffset = -(currentIdx * cw);
        let targetX = baseOffset + dx;

        if (targetX > 0) {
          targetX = targetX * 0.3;
        } else if (targetX < -(BOTTOM_TABS.length - 1) * cw) {
          const over = targetX - (-(BOTTOM_TABS.length - 1) * cw);
          targetX = -(BOTTOM_TABS.length - 1) * cw + (over * 0.3);
        }

        dragX.set(targetX);
      }
    };

    const handleEnd = () => {
      if (!touchStart) return;
      touchStart = null;

      if (isHorizontal !== true) return;
      isHorizontal = null;

      const cw = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
      const currentIdx = activeIndexRef.current;
      const baseOffset = -(currentIdx * cw);
      const distValue = dragX.get() - baseOffset;
      const vel = velocityX;

      const DIST_THRESHOLD = cw * 0.25;
      const VEL_THRESHOLD  = 450;

      const wantsForward = distValue < -DIST_THRESHOLD || vel < -VEL_THRESHOLD;
      const wantsBack    = distValue >  DIST_THRESHOLD || vel >  VEL_THRESHOLD;

      if (wantsForward && currentIdx < BOTTOM_TABS.length - 1) {
        const nextTab = BOTTOM_TABS[currentIdx + 1];
        hapticLight();
        onSectionChange(nextTab === 'tools' ? 'history' : nextTab);
      } else if (wantsBack && currentIdx > 0) {
        const prevTab = BOTTOM_TABS[currentIdx - 1];
        hapticLight();
        onSectionChange(prevTab === 'tools' ? 'history' : prevTab);
      } else {
        const anim = animate(dragX, baseOffset, {
          type: 'spring',
          stiffness: 350,
          damping: 30,
          mass: 0.8,
        });
        anim.then(() => {
          setIsTransitioning(false);
        });
      }
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: true });
    document.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [onSectionChange]);


  const [badgeNotif, setBadgeNotif] = useState(null);
  const [rankUpNotif, setRankUpNotif] = useState(null);
  const [externalDamage, setExternalDamage] = useState(null);
  const [rankXPData, setRankXPData] = useState(loadRankXP);
  const [flyingRewards, setFlyingRewards] = useState([]);
  const prevHpRef = useRef(null);
  const queryClient = useQueryClient();
  const [synced, setSynced] = useState(false);
  const [isConvertGuestModalOpen, setIsConvertGuestModalOpen] = useState(false);

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
    gf_ceiling: dp.gf_ceiling ?? 105.0,
    gc_ceiling: dp.gc_ceiling ?? 105.0,
    ps_ceiling: dp.ps_ceiling ?? 105.0,
    vm_ceiling: dp.vm_ceiling ?? 105.0,
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
      if (/** @type {any} */ (err)?.status === 401) {
        toast({
          variant: "destructive",
          title: t('dashboard.session_expired', 'Session Expired'),
          description: t('dashboard.session_expired_desc', 'Your session has expired. Please log in again.'),
        });
      } else {
        toast({
          variant: "destructive",
          title: t('dashboard.training_failed', 'Log Failed'),
          description: err?.message || 'Failed to submit training log.',
        });
      }
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
    <div className="flex flex-col flex-1 min-h-full font-inter bg-transparent text-[var(--habit-text)]">
      <GuestBanner onConvertClick={() => setIsConvertGuestModalOpen(true)} />
      <main ref={containerRef} className="flex-1 w-full max-w-7xl mx-auto px-0 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
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
              <span className="text-foreground">{t('dashboard.milestone_unlocked', { value: badgeNotif.value })}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="rounded-none md:rounded-2xl p-0 py-3 md:p-5 overflow-x-hidden" style={{ background: 'transparent' }}>
          <TabErrorBoundary tabKey={activeTab}>
            <div className="w-full h-auto overflow-hidden relative">
              <motion.div
                className="flex flex-row w-full h-auto"
                style={{ x: dragX, willChange: 'transform' }}
              >
                {BOTTOM_TABS.map((tabKey, idx) => {
                  const isActive = idx === activeTabIndex;
                  const isVisible = isActive || (isTransitioning && Math.abs(idx - activeTabIndex) <= 1);

                  if (!isVisible) {
                    return <div key={tabKey} className="w-full shrink-0 h-0 overflow-hidden" />;
                  }

                  const sectionToRender = isActive ? activeSection : tabKey;
                  const isTools = ["history", "pomodoro", "calendar", "stats"].includes(sectionToRender);

                  return (
                    <div key={tabKey} className="w-full shrink-0 h-auto overflow-x-hidden touch-pan-y px-0 md:px-4">
                      
                      {sectionToRender === "dashboard" && (
                        <>
                          <TabGuideModal guideId="dashboard" profile={profile} />
                          {profile && (
                            <div className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
                              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                                <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{"📊 " + t("dashboard.metrics", "COGNITIVE METRICS").toUpperCase()}</span>
                              </div>
                              <div className="px-4 pb-4">
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
                                <div className="mt-3">
                                  <StatsPanel profile={profile} logs={logs} />
                                </div>
                              </div>
                            </div>
                          )}

                          <DailyQuoteWidget />
                          <ActivePartyWidget />

                          <div className="mt-4 px-2 pb-3 bg-[var(--habit-panel)] border border-[var(--habit-border)] rounded-2xl shadow-sm pt-3">
                            <BossPanel currentScore={rankXPData.rankXP || 0} onBossDamage={handleBossDamage} externalDamage={externalDamage} />
                          </div>

                          <div className="mt-4">
                            <PixelRankRoad rankXP={rankXPData.rankXP} />
                          </div>
                        </>
                      )}

                      {(sectionToRender === "train" || sectionToRender === "training") && (
                        <TabPanel title={"⚔️ " + t("sidebar.sections.train", "TRAINING").toUpperCase()}>
                          <TabGuideModal guideId="training" profile={profile} />
                          <ActivityLogger onLog={handleLog} isLogging={logTraining.isPending} profile={profile} logs={logs} tasks={tasks} />
                        </TabPanel>
                      )}

                      {sectionToRender === "tasks" && (
                        <div className="py-2">
                          <TasksPanel tasks={tasks} onXpGain={handleXpGain} onBossDamage={handleBossDamage} onRankXP={handleTaskRankXP} subTab={activeSubItem} onRewardFly={handleRewardFly} onLog={handleLog} profile={profile} logs={logs} />
                        </div>
                      )}

                      {sectionToRender === "character" && (
                        <>
                          <PillTabBar tabs={CHARACTER_TABS.map(tab => ({ ...tab, label: t(tab.label) }))} activeTab={activeSubItem || "overview"} onChange={onSubItemChange} />
                          <div className="py-2">
                            <CharacterTab profile={profile} logs={logs} rankXP={rankXPData.rankXP} currentRankId={rankXPData.currentRank} subTab={activeSubItem} />
                          </div>
                        </>
                      )}

                      {sectionToRender === "rival" && (
                        <TabPanel title={"👥 " + t("sidebar.sections.rival", "RIVAL").toUpperCase()}>
                          <RivalTab playerRankXP={rankXPData.rankXP} playerStreak={0} logs={logs} />
                        </TabPanel>
                      )}

                      {isTools && (
                        <PillTabBar tabs={TOOLS_TABS.map(tab => ({ ...tab, label: t(tab.label) }))} activeTab={sectionToRender} onChange={onSectionChange} />
                      )}
                      {sectionToRender === "stats" && (
                        <TabPanel title={"📈 " + t("sidebar.sections.stats", "PROJECTIONS").toUpperCase()}>
                          <ProjectionTable profile={profile} logs={logs} />
                        </TabPanel>
                      )}
                      {sectionToRender === "history" && (
                        <TabPanel title={"📜 " + t("sidebar.sections.history", "HISTORY").toUpperCase()}>
                          <HistoryLog logs={logs} tasks={tasks} />
                        </TabPanel>
                      )}
                      {sectionToRender === "pomodoro" && (
                        <TabPanel title={"⏱️ " + t("sidebar.sections.pomodoro", "POMODORO").toUpperCase()}>
                          <PremiumGate isPremium={profile?.is_premium}>
                            <PomodoroPanel />
                          </PremiumGate>
                        </TabPanel>
                      )}
                      {sectionToRender === "calendar" && (
                        <TabPanel title={"📅 " + t("sidebar.sections.calendar", "CALENDAR").toUpperCase()}>
                          <PremiumGate isPremium={profile?.is_premium}>
                            <CalendarPanel />
                          </PremiumGate>
                        </TabPanel>
                      )}

                      {sectionToRender === "settings" && (
                        <div className="py-2">
                          <SettingsPanel activeSubTab={activeSubItem || "appearance"} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </div>
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

      {/* Convert Guest Modal */}
      <ConvertGuestModal 
        isOpen={isConvertGuestModalOpen} 
        onClose={() => setIsConvertGuestModalOpen(false)} 
      />

      {/* Offline Summary Modal */}
      <OfflineSummaryModal profile={profile} />
    </div>
  );
}