import { useState, useMemo } from "react";
import { METRIC_CONFIG, computeEfficiency, getSmartRecommendation, MASTERY_COEFFICIENTS, CATEGORY_ICONS, ACTIVITIES, resolveMasteryCategory } from "@/lib/cognitiveEngine";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Zap, Trash2, RotateCcw } from "lucide-react";
import { djangoApi } from "@/api/djangoClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import EfficiencyMeter from "./EfficiencyMeter";
import SubjectRankBadge, { SubjectRankProgressBar } from "./SubjectRankBadge";
import CreateTaskForm from "./CreateTaskForm";

function loadHiddenActivities() {
  try { return JSON.parse(localStorage.getItem("mindos_hidden_activities") || "[]"); } catch { return []; }
}
function saveHiddenActivities(list) { localStorage.setItem("mindos_hidden_activities", JSON.stringify(list)); }

const TIER_MULTIPLIER = {
  trivial: 1,
  easy: 3,
  medium: 5,
  hard: 10,
};

function getTrainingRewards(tier, hours, focus) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const clampedHours = clamp(hours, 0, 16.0);
  const focusFactor = clamp(focus / 10.0, 0.7, 1.3);
  
  const mult = TIER_MULTIPLIER[tier] || 5;
  const xpBase = 3 * mult;
  const goldBase = Math.round(xpBase * 0.5);
  const dmgBase = Math.round(xpBase * 3.33);

  const scale = 2.5 * clampedHours * focusFactor;
  return {
    xp: Math.round(xpBase * scale),
    gold: Math.round(goldBase * scale),
    dmg: Math.round(dmgBase * scale),
  };
}

export default function ActivityLogger({ onLog, isLogging, profile, logs = [], tasks = [] }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [trainTab, setTrainTab] = useState("log"); // "log" | "create"
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [hours, setHours] = useState(1);
  const [questions, setQuestions] = useState(5);
  const [focusRating, setFocusRating] = useState(7);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [goldFloat, setGoldFloat] = useState(null);
  const [hiddenActivities, setHiddenActivities] = useState(loadHiddenActivities);
  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // activity key pending confirmation

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
          taskId: t.id,
          difficulty: t.difficulty || "medium"
        };
      }
    });
    return list;
  }, [tasks]);

  const { hoursToday, subjectHoursMap, recentFocusRatings, subjectTotalHours } = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today);
    const hoursToday = todayLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const subjectHoursMap = {};
    todayLogs.forEach(l => {
      subjectHoursMap[l.activity_key] = (subjectHoursMap[l.activity_key] || 0) + (l.hours || 0);
    });
    // Total hours per subject across all logs
    const subjectTotalHours = {};
    logs.forEach(l => {
      subjectTotalHours[l.activity_key] = (subjectTotalHours[l.activity_key] || 0) + (l.hours || 0);
    });
    const recentFocusRatings = logs.slice(0, 5).map(l => l.focus_rating || 5);
    return { hoursToday, subjectHoursMap, recentFocusRatings, subjectTotalHours };
  }, [logs]);

  const subjectHoursToday = selectedActivity ? (subjectHoursMap[selectedActivity] || 0) : 0;
  const isQuestionsMode = selectedActivity && allActivities[selectedActivity]?.inputType === "questions";
  const logValue = isQuestionsMode ? questions : hours;

  const { data: effectsData } = useQuery({
    queryKey: ["active_effects"],
    queryFn: djangoApi.skills.getActiveEffects,
    enabled: !!profile,
  });
  const activeEffects = effectsData?.active_effects || [];
  const meditationEffect = activeEffects.find(e => e.skill_id === "meditation");
  const hasMeditationSessions = meditationEffect && (meditationEffect.data?.sessionsRemaining > 0);

  const effectiveFocus = hasMeditationSessions ? Math.min(10, focusRating * 1.3) : focusRating;

  const category = useMemo(() => {
    if (!selectedActivity) return "";
    const act = allActivities[selectedActivity];
    if (act?.isCustom) {
      return resolveMasteryCategory(null, act.category);
    }
    return resolveMasteryCategory(selectedActivity);
  }, [selectedActivity, allActivities]);

  const categoryStreakDays = useMemo(() => {
    if (!category || !profile?.category_streaks) return 0;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    const streakData = profile.category_streaks[category];
    if (streakData && typeof streakData === "object") {
      const lastActive = streakData.last_active_date;
      if (lastActive === todayStr || lastActive === yesterdayStr) {
        return streakData.days || 0;
      }
    }
    return 0;
  }, [category, profile]);

  const categoryHoursToday = useMemo(() => {
    if (!category) return 0;
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today);
    return todayLogs.reduce((sum, l) => {
      let logCat = "";
      if (l.activity_key.startsWith("custom_task_")) {
        const taskId = l.activity_key.replace("custom_task_", "");
        const task = tasks.find(t => String(t.id) === String(taskId));
        if (task) {
          logCat = resolveMasteryCategory(null, task.category);
        }
      } else {
        logCat = resolveMasteryCategory(l.activity_key);
      }
      if (logCat === category) {
        return sum + (l.hours || 0);
      }
      return sum;
    }, 0);
  }, [category, logs, tasks]);

  const efficiency = computeEfficiency({
    focus: effectiveFocus,
    streakDays: profile?.streak || 0,
    hoursToday,
    subjectHoursToday,
    categoryHoursToday,
    categoryStreakDays,
    statFoc: profile?.total_stats?.foc || 5,
    statMem: profile?.total_stats?.mem || 5,
  });

  const recommendation = getSmartRecommendation({
    hoursToday,
    streak: profile?.streak || 0,
    subjectHoursMap,
    recentFocusRatings,
    tasks,
  });

  const previewRewards = useMemo(() => {
    if (!selectedActivity) return null;
    const act = allActivities[selectedActivity];
    const tier = act?.difficulty || "medium";
    return getTrainingRewards(tier, hours, focusRating);
  }, [selectedActivity, hours, focusRating, allActivities]);

  const confirmLog = () => {
    if (!selectedActivity) return;

    onLog(selectedActivity, logValue, focusRating, efficiency, (msg) => {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(null), 4000);
    });
    setSelectedActivity(null);
    setHours(1);
    setFocusRating(7);
  };

  const handleSelectActivity = (key) => {
    if (selectedActivity === key) {
      setSelectedActivity(null);
      setHours(1);
      setFocusRating(7);
    } else {
      setSelectedActivity(key);
      const act = allActivities[key];
      if (act) {
        setHours(act.defaultHours || 1);
        setFocusRating(act.defaultFocus || 7);
      }
    }
  };

  const hideActivity = async (key) => {
    if (key.startsWith("custom_task_")) {
      const taskId = parseInt(key.replace("custom_task_", ""), 10);
      try {
        await djangoApi.tasks.delete(taskId);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } catch (e) {
        console.error("Failed to delete custom training activity:", e);
      }
    } else {
      const updated = [...hiddenActivities, key];
      setHiddenActivities(updated);
      saveHiddenActivities(updated);
    }
    setConfirmDelete(null);
    if (selectedActivity === key) setSelectedActivity(null);
  };

  const restoreActivities = () => {
    setHiddenActivities([]);
    saveHiddenActivities([]);
    setDeleteMode(false);
  };

  const focusColors = ["", "#ef4444", "#ef4444", "#ef4444", "#f59e0b", "#f59e0b", "#f59e0b", "#22c55e", "#22c55e", "#3b82f6", "#a855f7"];
  const getFocusLabel = (rating) => {
    if (rating >= 9) return t('training.flow_state');
    if (rating >= 7) return t('training.focus_good');
    if (rating >= 4) return t('training.focus_avg');
    return t('training.focus_bad');
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--habit-bg)" }}>
        {[{ id: "log", label: t('training.log_session') }, { id: "create", label: t('training.add_activity') }].map(tab => (
          <button key={tab.id} onClick={() => setTrainTab(tab.id)}
            className="flex-1 py-2 rounded-xl transition-all"
            style={{
              fontFamily: "'Nunito'",
              fontWeight: trainTab === tab.id ? 800 : 600,
              fontSize: 13,
              background: trainTab === tab.id ? "var(--habit-purple)" : "transparent",
              color: trainTab === tab.id ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
              boxShadow: trainTab === tab.id ? "0 2px 8px var(--habit-purple-glow)" : "none",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {trainTab === "create" && <CreateTaskForm onCreated={() => setTrainTab("log")} hideTypeSelector={true} />}

      {trainTab === "log" && <>
      {/* Smart recommendation */}
      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "var(--habit-bg)", border: "1px solid var(--habit-border)" }}>
        <span className="text-base shrink-0">{recommendation.icon}</span>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{recommendation.text}</p>
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl flex items-start gap-2"
            style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)", fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)" }}
          >
            <Zap className="w-3 h-3 text-ps mt-0.5 shrink-0" />
            <span>{feedbackMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity grid header */}
      <div className="flex items-center justify-between">
        <span className="text-xl font-pixel text-muted-foreground uppercase tracking-widest">{t('training.activities')}</span>
        <div className="flex items-center gap-1.5">
          {hiddenActivities.length > 0 && (
            <button onClick={restoreActivities}
              className="flex items-center gap-1 px-2 py-1 text-sm font-pixel text-muted-foreground/60 hover:text-foreground border border-border/40 rounded transition-colors">
              <RotateCcw className="w-2.5 h-2.5" /> {t('training.restore_all', { count: hiddenActivities.length })}
            </button>
          )}
          <button
            onClick={() => { setDeleteMode(d => !d); setConfirmDelete(null); }}
            className={`flex items-center gap-1 px-2 py-1 text-sm font-pixel border rounded transition-colors ${
              deleteMode
                ? "border-red-500/60 text-red-400 bg-red-500/10"
                : "border-border/40 text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            <Trash2 className="w-2.5 h-2.5" /> {deleteMode ? t('training.done') : t('training.edit')}
          </button>
        </div>
      </div>

      {/* Activity grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 auto-rows-fr">
        {Object.entries(allActivities)
          .filter(([key]) => !hiddenActivities.includes(key))
          .map(([key, activity]) => {
            const activeMetrics = Object.entries(METRIC_CONFIG)
              .filter(([mk]) => (activity.coefficients[mk] || 0) > 0);
            const isSelected = selectedActivity === key;
            const totalHours = subjectTotalHours[key] || 0;
            const isPendingDelete = confirmDelete === key;
            const cat = activity.category || "Other";
            const catColor = {
              STEM: "#3b82f6",
              Languages: "#00cc88",
              "Humanities & Arts": "#eab308",
              "Health & Fitness": "#ef4444",
              Mindfulness: "#9944ff",
              "Rest & Recovery": "#f97316",
              "Social & Communication": "#a855f7",
              "Reading & Writing": "#22c55e",
              "Work & Career": "#06b6d4",
            }[cat] || "#6366f1";

            return (
              <div key={key} className="relative h-full flex flex-col">
                <motion.button
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => !deleteMode && handleSelectActivity(key)}
                  className="w-full h-full min-h-[165px] sm:min-h-[180px] flex flex-col justify-between group relative p-3 sm:p-3.5 rounded-xl transition-colors text-left overflow-hidden"
                  style={{
                    background: deleteMode 
                      ? "rgba(247,78,82,0.08)" 
                      : isSelected 
                        ? `radial-gradient(circle at 50% 0%, ${catColor}30 0%, var(--habit-panel) 90%)` 
                        : "var(--habit-panel)",
                    border: deleteMode 
                      ? "1.5px solid rgba(247,78,82,0.4)" 
                      : isSelected 
                        ? `1.5px solid ${catColor}` 
                        : "1.5px solid var(--habit-border)",
                    boxShadow: isSelected ? `0 0 16px ${catColor}40` : "0 1px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  {/* Category Corner Brackets */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 opacity-60 group-hover:opacity-100 transition-opacity" style={{ borderColor: catColor }} />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 opacity-60 group-hover:opacity-100 transition-opacity" style={{ borderColor: catColor }} />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 opacity-60 group-hover:opacity-100 transition-opacity" style={{ borderColor: catColor }} />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 opacity-60 group-hover:opacity-100 transition-opacity" style={{ borderColor: catColor }} />

                  {/* Top Header: Icon + Rank Badge */}
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl sm:text-2xl bg-black/40 border border-white/10 group-hover:scale-110 transition-transform"
                      style={{ boxShadow: `inset 0 0 8px ${catColor}20` }}>
                      {activity.icon}
                    </div>
                    <SubjectRankBadge hours={totalHours} />
                  </div>

                  {/* Middle Content: Title + Description */}
                  <div className="my-auto py-1.5 w-full">
                    <div
                      className="leading-snug line-clamp-1 sm:line-clamp-2"
                      style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, color: "var(--habit-text)" }}
                    >
                      {activity.label}
                    </div>
                    <div
                      className="mt-1 leading-snug line-clamp-2 block text-[11px] sm:text-xs text-muted-foreground/90 dark:text-gray-300/80"
                      style={{ fontFamily: "'Nunito'", fontWeight: 500 }}
                    >
                      {activity.description}
                    </div>
                  </div>

                  {/* Bottom: Metrics tags + Progress bar */}
                  <div className="w-full mt-auto pt-1.5">
                    <div className="flex gap-1 flex-wrap items-center">
                      {activeMetrics.map(([mk, mc]) => (
                        <span
                          key={mk}
                          className={`text-[9px] sm:text-[10px] font-pixel font-bold px-1.5 py-0.5 rounded bg-${mc.color}/10 text-${mc.color} border border-${mc.color}/20`}
                        >
                          +{mc.abbr}
                        </span>
                      ))}
                    </div>
                    <SubjectRankProgressBar hours={totalHours} className="mt-2" />
                  </div>
                </motion.button>

                {/* Delete button overlay */}
                {deleteMode && (
                  <div className="absolute top-1.5 right-1.5 z-10">
                    {isPendingDelete ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => hideActivity(key)}
                          className="px-1.5 py-0.5 text-xs font-pixel bg-red-500 text-white rounded"
                        >✓ YES</button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-1.5 py-0.5 text-xs font-pixel bg-muted text-muted-foreground rounded"
                        >✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(key)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/90 hover:bg-red-500 text-white shadow transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Session config panel */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="p-4 rounded-2xl space-y-4 relative overflow-hidden"
            style={{ background: "var(--habit-panel)", border: "1.5px solid var(--habit-purple-light)", boxShadow: "0 4px 20px var(--habit-purple-glow)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 16, color: "var(--habit-text)" }}>{allActivities[selectedActivity].label}</div>
                <div style={{ fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)" }}>{allActivities[selectedActivity].description}</div>
              </div>
              <button onClick={() => setSelectedActivity(null)} style={{ color: "var(--habit-dim)", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            {isQuestionsMode ? (
              <div className="flex items-center gap-4 justify-center">
                <button onClick={() => setQuestions(Math.max(1, questions - 1))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center w-16 tabular-nums tracking-tight">
                  <div className="font-pixel text-4xl text-foreground">{questions}</div>
                  <div className="text-xs text-muted-foreground">{t('training.questions')}</div>
                </div>
                <button onClick={() => setQuestions(Math.min(20, questions + 1))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 justify-center">
                <button onClick={() => setHours(Math.max(0.5, hours - 0.5))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center w-16 tabular-nums tracking-tight">
                  <div className="font-pixel text-4xl text-foreground">{hours}</div>
                  <div className="text-xs text-muted-foreground">{t('training.hours')}</div>
                </div>
                <button onClick={() => setHours(Math.min(16, hours + 0.5))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Neural Overclock Focus rating */}
            <div className="space-y-2 p-3 rounded-xl bg-black/40 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                  ⚡ {t('training.focus_quality')}
                </span>
                <span className="font-pixel text-base" style={{ color: focusColors[focusRating] }}>
                  {focusRating}/10 — {getFocusLabel(focusRating)}
                </span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setFocusRating(n)}
                    className="flex-1 h-7 rounded-sm transition-all duration-150 relative overflow-hidden border"
                    style={{
                      backgroundColor: n <= focusRating ? focusColors[focusRating] : "rgba(255,255,255,0.04)",
                      borderColor: n <= focusRating ? `${focusColors[focusRating]}cc` : "rgba(255,255,255,0.08)",
                      boxShadow: n === focusRating ? `0 0 10px ${focusColors[focusRating]}` : undefined,
                      opacity: n <= focusRating ? 1 : 0.35,
                    }}
                  />
                ))}
              </div>
            </div>

            <EfficiencyMeter
              focus={effectiveFocus}
              streakDays={profile?.streak || 0}
              hoursToday={hoursToday}
              subjectHoursToday={subjectHoursToday}
              categoryHoursToday={categoryHoursToday}
              categoryStreakDays={categoryStreakDays}
              statFoc={profile?.total_stats?.foc || 5}
              statMem={profile?.total_stats?.mem || 5}
            />

            {/* Expected gains */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(METRIC_CONFIG).map(([mk, mc]) => {
                const coeff = allActivities[selectedActivity].coefficients[mk] || 0;
                const ceiling = profile?.[`${mk}_ceiling`] || 1;
                const current = profile?.[mk] || 0;
                const growthMult = Math.max(0, 1 - Math.pow(current / ceiling, 2));
                const rawGain = coeff * logValue * growthMult;
                const effGain = rawGain * efficiency.total;
                return (
                  <div key={mk} className="text-center p-2 rounded-lg bg-muted/40">
                    <div className={`text-xl font-pixel text-${mc.color}`}>{mc.abbr}</div>
                    <div className="text-lg font-pixel text-foreground/70 mt-0.5">
                      {effGain > 0 ? `+${effGain.toFixed(3)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expected Rewards preview */}
            {previewRewards && (() => {
              const stats = profile?.total_stats || {};
              const goldMultStats = stats.gold_multiplier || 1.0;
              const xpMultStats = profile?.xp_multiplier || 1.0;
              const dmgMultStats = profile?.damage_multiplier || 1.0;
              
              const expectedXp = Math.max(0, Math.round(previewRewards.xp * xpMultStats));
              const expectedGold = Math.max(0, Math.round(previewRewards.gold * goldMultStats));
              const expectedDmg = Math.max(0, Math.round(previewRewards.dmg * dmgMultStats));

              return (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3 font-mono text-xs space-y-2">
                  <div className="text-muted-foreground/50 uppercase text-[9px] tracking-wider">{t('training_extra.expected_rewards', 'Expected Rewards')}</div>
                  <div className="flex justify-around gap-4 text-center">
                    <div>
                      <div className="text-blue-400 font-pixel text-lg">+{expectedXp} XP</div>
                      <div className="text-[8.5px] text-muted-foreground mt-0.5">{t('training_extra.experience', 'Experience')}</div>
                    </div>
                    <div>
                      <div className="text-yellow-500 font-pixel text-lg">+{expectedGold}G</div>
                      <div className="text-[8.5px] text-muted-foreground mt-0.5">{t('training_extra.gold', 'Gold')}</div>
                    </div>
                    <div>
                      <div className="text-red-400 font-pixel text-lg">⚔ {expectedDmg}</div>
                      <div className="text-[8.5px] text-muted-foreground mt-0.5">{t('training_extra.boss_dmg', 'Boss DMG')}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Log button with gold float */}
            <div className="relative">
              <AnimatePresence>
                {goldFloat && (
                  <motion.div
                    key={goldFloat.id}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -30 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 font-pixel text-3xl pointer-events-none"
                    style={{ color: "var(--habit-gold)" }}
                  >
                    +{goldFloat.value}G
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={confirmLog}
                disabled={isLogging}
                className={`w-full py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] ${isLogging ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ background: "var(--habit-purple)", color: "white", fontFamily: "'Nunito'", fontWeight: 800, fontSize: 14, letterSpacing: "0.02em", boxShadow: "0 4px 16px var(--habit-purple-glow)" }}
              >
                {t('training_extra.log_btn', 'Log')} {isQuestionsMode ? `${questions}q` : `${hours}h`} · ×{efficiency.total.toFixed(2)} {t('training.efficiency', 'eff.')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>}
    </div>
  );
}