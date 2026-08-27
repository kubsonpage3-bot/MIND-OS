// @ts-nocheck
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Flame, CheckCircle2, XCircle, Search, 
  Calendar, Award, Sparkles, Filter, Zap, BookOpen, 
  CheckSquare, Timer, ArrowUpRight, ShieldAlert, Heart
} from "lucide-react";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useProfileMount } from "@/utils/perf";
import { METRIC_CONFIG, getActivityDetails } from "@/lib/cognitiveEngine";
import { getRankDisplayData } from "@/lib/rankEngine";

const COLOR_MAP = {
  gf: "#3b82f6",
  gc: "#22c55e",
  ps: "#f59e0b",
  vm: "#a855f7",
};

const CATEGORY_ACCENTS = {
  STEM: "#3b82f6",
  sciences: "#3b82f6",
  Languages: "#00cc88",
  languages: "#00cc88",
  "Humanities & Arts": "#eab308",
  humanities: "#eab308",
  "Health & Fitness": "#ef4444",
  body: "#ef4444",
  "Rest & Recovery": "#f97316",
  Mindfulness: "#9944ff",
  spirit: "#9944ff",
  "Social & Communication": "#a855f7",
  "Reading & Writing": "#22c55e",
  "Work & Career": "#64748b",
  Other: "#7b61ff",
};

export default function HistoryLog({ logs = [], tasks = [] }) {
  useProfileMount("HistoryLog");
  const { profile } = useDjangoAuth();
  const { t } = useTranslation();

  const [filterType, setFilterType] = useState("all");
  const [period, setPeriod] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch unified history from backend
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["activityHistory", filterType, period, searchQuery],
    queryFn: () => djangoApi.history.getHistory({
      type: filterType,
      days: period,
      search: searchQuery
    }),
    staleTime: 10000,
  });

  const rawResults = historyData?.results;
  const stats = historyData?.stats;

  // Transform raw items or fallback to legacy logs prop if needed
  const activityItems = useMemo(() => {
    if (rawResults && Array.isArray(rawResults)) {
      return rawResults;
    }

    // Fallback: convert legacy `logs` prop into standard items
    return (logs || []).map(l => {
      const act = getActivityDetails(l.activity_key, tasks);
      return {
        id: `legacy-${l.id}`,
        activity_type: "study",
        title: act?.label || l.activity_key,
        icon: act?.icon || "📚",
        category: "Other",
        hours: l.hours || 0,
        focus_rating: l.focus_rating || 5,
        xp_earned: l.xp_earned || 0,
        gold_earned: 0,
        boss_damage: 0,
        hp_lost: 0,
        streak_value: 0,
        cognitive_gains: {
          gf: l.gf_gain || 0,
          gc: l.gc_gain || 0,
          ps: l.ps_gain || 0,
          vm: l.vm_gain || 0,
        },
        created_at: l.created_at,
        metadata: { activity_key: l.activity_key },
      };
    });
  }, [rawResults, logs, tasks]);

  // Compute Daily Rank scores
  const dailyRankMap = useMemo(() => {
    const map = {};
    activityItems.forEach(item => {
      const day = new Date(item.created_at).toDateString();
      if (!map[day]) {
        map[day] = { xp: 0, hours: 0, count: 0 };
      }
      map[day].hours += item.hours || 0;
      map[day].xp += item.xp_earned || 0;
      map[day].count += 1;
    });

    const result = {};
    const thresholds = profile?.rank_info?.thresholds || [];

    Object.entries(map).forEach(([day, data]) => {
      const score = (data.hours * 50) + data.xp;
      let rankId = "E";
      for (const thr of thresholds) {
        if (score >= thr.min) rankId = thr.id;
      }
      result[day] = { score, rank: getRankDisplayData(rankId), data };
    });

    return result;
  }, [activityItems, profile]);

  // Group items by day for the timeline view
  const groupedByDay = useMemo(() => {
    const groups = {};
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    activityItems.forEach(item => {
      const d = new Date(item.created_at);
      const dayKey = d.toDateString();
      if (!groups[dayKey]) {
        let label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
        if (dayKey === todayStr) label = t("history_page.today", "Today");
        else if (dayKey === yesterdayStr) label = t("history_page.yesterday", "Yesterday");

        groups[dayKey] = {
          dayKey,
          label,
          dateObj: d,
          items: [],
          totalXp: 0,
          totalHours: 0,
          dailiesDone: 0,
          habitsDone: 0,
          todosDone: 0,
        };
      }

      groups[dayKey].items.push(item);
      groups[dayKey].totalXp += item.xp_earned || 0;
      groups[dayKey].totalHours += item.hours || 0;
      if (item.activity_type === "daily") groups[dayKey].dailiesDone += 1;
      if (item.activity_type === "habit_pos") groups[dayKey].habitsDone += 1;
      if (item.activity_type === "todo") groups[dayKey].todosDone += 1;
    });

    return Object.values(groups).sort((a, b) => b.dateObj - a.dateObj);
  }, [activityItems, t]);

  const activeStats = useMemo(() => {
    if (stats) return stats;
    // Compute from fallback items
    const total_hours = activityItems.reduce((s, i) => s + (i.hours || 0), 0);
    const total_xp = activityItems.reduce((s, i) => s + (i.xp_earned || 0), 0);
    const habits_count = activityItems.filter(i => i.activity_type.startsWith("habit")).length;
    const dailies_count = activityItems.filter(i => i.activity_type.startsWith("daily")).length;
    const todos_count = activityItems.filter(i => i.activity_type.startsWith("todo")).length;
    const study_count = activityItems.filter(i => i.activity_type === "study").length;
    const pomodoro_count = activityItems.filter(i => i.activity_type === "pomodoro").length;
    return {
      total_hours: Math.round(total_hours * 10) / 10,
      total_xp,
      habits_count,
      dailies_count,
      todos_count,
      study_count,
      pomodoro_count,
      tasks_completed_count: habits_count + dailies_count + todos_count,
    };
  }, [stats, activityItems]);

  const filterTabs = [
    { id: "all", label: t("history_page.filter_all", "All"), icon: Sparkles, count: activityItems.length },
    { id: "study", label: t("history_page.filter_study", "Study"), icon: BookOpen, count: activeStats.study_count, color: "#3b82f6" },
    { id: "habit", label: t("history_page.filter_habits", "Habits"), icon: Zap, count: activeStats.habits_count, color: "#f59e0b" },
    { id: "daily", label: t("history_page.filter_dailies", "Dailies"), icon: Calendar, count: activeStats.dailies_count, color: "#10b981" },
    { id: "todo", label: t("history_page.filter_todos", "To-Do"), icon: CheckSquare, count: activeStats.todos_count, color: "#8b5cf6" },
    { id: "pomodoro", label: t("history_page.filter_pomodoro", "Pomodoro"), icon: Timer, count: activeStats.pomodoro_count, color: "#f43f5e" },
  ];

  const periodOptions = [
    { id: "1", label: t("history_page.period_today", "Today") },
    { id: "7", label: t("history_page.period_7days", "7 Days") },
    { id: "30", label: t("history_page.period_30days", "30 Days") },
    { id: "all", label: t("history_page.period_all", "All Time") },
  ];

  return (
    <div className="space-y-4">
      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Hours Logged */}
        <div 
          className="p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between"
          style={{ 
            background: "var(--habit-panel)", 
            borderColor: "rgba(59, 130, 246, 0.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
              {t("history_page.kpi_hours", "Focus Time")}
            </span>
            <span className="p-1 rounded-md bg-blue-500/10 text-blue-500">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-hud text-[var(--habit-text)]">
              {activeStats.total_hours || 0}
            </span>
            <span className="text-xs font-semibold text-blue-500">h</span>
          </div>
        </div>

        {/* Tasks Completed */}
        <div 
          className="p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between"
          style={{ 
            background: "var(--habit-panel)", 
            borderColor: "rgba(16, 185, 129, 0.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
              {t("history_page.kpi_tasks", "Tasks Done")}
            </span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-hud text-[var(--habit-text)]">
              {activeStats.tasks_completed_count || 0}
            </span>
            <span className="text-[10px] text-emerald-500 font-semibold uppercase">quests</span>
          </div>
        </div>

        {/* Total XP Earned */}
        <div 
          className="p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between"
          style={{ 
            background: "var(--habit-panel)", 
            borderColor: "rgba(168, 85, 247, 0.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
              {t("history_page.kpi_xp", "Total XP")}
            </span>
            <span className="p-1 rounded-md bg-purple-500/10 text-purple-500">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-hud text-purple-500">
              +{activeStats.total_xp || 0}
            </span>
          </div>
        </div>

        {/* Current Day / Best Day Rank */}
        <div 
          className="p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between"
          style={{ 
            background: "var(--habit-panel)", 
            borderColor: "rgba(245, 158, 11, 0.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
              {t("history_page.kpi_rank", "Today Rank")}
            </span>
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-500">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {(() => {
              const todayKey = new Date().toDateString();
              const todayRank = dailyRankMap[todayKey]?.rank || getRankDisplayData(profile?.rank_info?.current_id || "E");
              return (
                <span 
                  className="font-hud text-xs px-2 py-0.5 rounded border"
                  style={{ 
                    color: todayRank.color, 
                    borderColor: `${todayRank.color}44`,
                    background: `${todayRank.color}18` 
                  }}
                >
                  {todayRank.id} RANK
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH CONTROLS ── */}
      <div className="space-y-2.5">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {filterTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  isActive 
                    ? "text-white shadow-sm" 
                    : "text-[var(--habit-dim)] hover:text-[var(--habit-text)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={{
                  fontFamily: "'Nunito'",
                  background: isActive ? (tab.color || "var(--habit-purple)") : "transparent",
                  border: isActive ? "1px solid transparent" : "1px solid var(--habit-border)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span 
                    className="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "var(--habit-border)",
                      color: isActive ? "#fff" : "var(--habit-dim)"
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-bar: Period Filter + Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg border border-[var(--habit-border)] shrink-0 self-start">
            {periodOptions.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  period === p.id 
                    ? "bg-[var(--habit-panel)] text-[var(--habit-text)] shadow-xs" 
                    : "text-[var(--habit-dim)] hover:text-[var(--habit-text)]"
                }`}
                style={{ fontFamily: "'Nunito'" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--habit-dim)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("history_page.search_placeholder", "Search history...")}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-[var(--habit-panel)] border border-[var(--habit-border)] text-[var(--habit-text)] placeholder-[var(--habit-dim)] focus:outline-none focus:border-[var(--habit-purple)] transition-colors"
              style={{ fontFamily: "'Nunito'" }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--habit-dim)] hover:text-[var(--habit-text)]"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN TIMELINE & ITEMS FEED ── */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--habit-purple)] border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-mono text-[var(--habit-dim)]">Loading timeline...</span>
        </div>
      ) : groupedByDay.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--habit-border)] bg-[var(--habit-panel)]">
          <div className="text-4xl mb-3">📜</div>
          <h4 className="font-bold text-sm text-[var(--habit-text)] font-hud mb-1">
            {searchQuery || filterType !== "all" 
              ? t("history_page.empty_filtered", "No records found matching this filter")
              : t("history_page.empty_title", "History timeline is empty")
            }
          </h4>
          <p className="text-xs text-[var(--habit-dim)] max-w-sm mx-auto" style={{ fontFamily: "'Nunito'" }}>
            {t("history_page.empty_desc", "Trigger habits, complete dailies, and log focus hours — your timeline will appear here.")}
          </p>
        </div>
      ) : (
        <div className="space-y-5 md:max-h-[620px] md:overflow-y-auto pr-1">
          {groupedByDay.map((group) => {
            const dayData = dailyRankMap[group.dayKey];
            const rank = dayData?.rank;

            return (
              <div key={group.dayKey} className="space-y-2">
                {/* Day Header */}
                <div 
                  className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 rounded-lg border backdrop-blur-md"
                  style={{ 
                    background: "var(--habit-bg)", 
                    borderColor: "var(--habit-border)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[var(--habit-text)] font-hud">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[var(--habit-dim)] font-mono">
                      ({group.items.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Day Summary Stats Badge */}
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-[var(--habit-dim)]">
                      {group.totalHours > 0 && <span>⏱️ {group.totalHours.toFixed(1)}h</span>}
                      {group.dailiesDone > 0 && <span>📅 {group.dailiesDone}d</span>}
                      {group.habitsDone > 0 && <span>⚡ {group.habitsDone}h</span>}
                      {group.totalXp > 0 && <span className="text-purple-500 font-bold">+{group.totalXp} XP</span>}
                    </div>

                    {rank && (
                      <span
                        className="font-game text-[9px] px-2 py-0.5 rounded border"
                        style={{
                          color: rank.color,
                          background: `${rank.color}15`,
                          borderColor: `${rank.color}35`,
                        }}
                      >
                        {rank.id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Items List */}
                <div className="space-y-1.5 pl-1">
                  <AnimatePresence>
                    {group.items.map((item, idx) => (
                      <motion.div
                        key={item.id || idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(0.2, idx * 0.03) }}
                      >
                        <HistoryItemCard item={item} tasks={tasks} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Visual Card for individual activity items
 */
function HistoryItemCard({ item, tasks = [] }) {
  const { t } = useTranslation();
  const date = new Date(item.created_at);
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const isStudy = item.activity_type === "study";
  const isDaily = item.activity_type === "daily" || item.activity_type === "daily_uncomplete";
  const isHabitPos = item.activity_type === "habit_pos";
  const isHabitNeg = item.activity_type === "habit_neg";
  const isTodo = item.activity_type === "todo" || item.activity_type === "todo_uncomplete";
  const isPomodoro = item.activity_type === "pomodoro";

  // Category Color Accent
  const categoryColor = CATEGORY_ACCENTS[item.category] || CATEGORY_ACCENTS.Other;

  // Cognitive gains
  const gains = Object.entries(METRIC_CONFIG)
    .filter(([mk]) => (item.cognitive_gains?.[mk] || 0) > 0)
    .map(([mk, mc]) => ({ mk, mc, val: item.cognitive_gains[mk] }));

  // Icon Resolver
  const renderIcon = () => {
    if (item.icon && item.icon.length <= 4) return item.icon;
    if (isStudy) return "📚";
    if (isDaily) return "📅";
    if (isHabitPos) return "⚡";
    if (isHabitNeg) return "💔";
    if (isTodo) return "✅";
    if (isPomodoro) return "⏱️";
    return "📌";
  };

  // Card Border / Badge Accent
  const cardBorderAccent = isHabitNeg 
    ? "rgba(239, 68, 68, 0.35)" 
    : isDaily 
    ? "rgba(16, 185, 129, 0.25)"
    : isStudy
    ? "rgba(59, 130, 246, 0.25)"
    : "var(--habit-border)";

  return (
    <div
      className="p-3 rounded-xl border transition-all hover:border-[var(--habit-purple)] hover:shadow-sm"
      style={{
        background: "var(--habit-panel)",
        borderColor: cardBorderAccent,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left Side: Icon, Title, Category, Details */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base shadow-xs"
            style={{ 
              background: isHabitNeg ? "rgba(239, 68, 68, 0.12)" : `${categoryColor}15`,
              border: `1px solid ${isHabitNeg ? "rgba(239, 68, 68, 0.3)" : `${categoryColor}30`}`
            }}
          >
            {renderIcon()}
          </div>

          <div className="min-w-0">
            {/* Title & Category Badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span 
                className="font-bold text-xs text-[var(--habit-text)] truncate"
                style={{ fontFamily: "'Nunito'" }}
              >
                {item.title}
              </span>

              {item.category && item.category !== "Other" && (
                <span 
                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider"
                  style={{ 
                    background: `${categoryColor}15`, 
                    color: categoryColor,
                    border: `1px solid ${categoryColor}30`,
                    fontFamily: "'Nunito'"
                  }}
                >
                  {item.category}
                </span>
              )}
            </div>

            {/* Sub-info line: Type, Duration/Focus, Time */}
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
              <span className="font-semibold">{timeStr}</span>

              {isStudy && item.hours > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-blue-500 font-bold">
                    <Clock className="w-3 h-3" />
                    {item.hours}h
                  </span>
                </>
              )}

              {isStudy && item.focus_rating && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                    <Zap className="w-3 h-3" />
                    {t("history_page.focus_label", "Focus")} {item.focus_rating}/10
                  </span>
                </>
              )}

              {isPomodoro && item.hours > 0 && (
                <>
                  <span>·</span>
                  <span className="text-rose-500 font-bold">
                    {Math.round(item.hours * 60)} min
                  </span>
                </>
              )}

              {isDaily && item.streak_value > 0 && (
                <>
                  <span>·</span>
                  <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                    <Flame className="w-3 h-3" />
                    {t("history_page.streak_days", { val: item.streak_value })}
                  </span>
                </>
              )}

              {isHabitPos && item.streak_value > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    <Flame className="w-3 h-3" />
                    {t("history_page.streak_pos", { val: item.streak_value })}
                  </span>
                </>
              )}

              {isHabitNeg && (
                <>
                  <span>·</span>
                  <span className="text-red-500 font-bold flex items-center gap-0.5">
                    <ShieldAlert className="w-3 h-3" />
                    {t("history_page.streak_neg", { val: item.streak_value || 1 })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Rewards, Boss DMG, or HP Loss */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.xp_earned > 0 && (
            <span 
              className="text-[10px] font-game px-2 py-0.5 rounded font-bold"
              style={{ color: "var(--habit-purple)", background: "var(--habit-purple-light)" }}
            >
              +{item.xp_earned} XP
            </span>
          )}

          {item.gold_earned > 0 && (
            <span className="text-[10px] font-game text-amber-500">
              +{item.gold_earned} G
            </span>
          )}

          {item.boss_damage > 0 && (
            <span className="text-[9px] font-mono text-red-500 font-bold">
              ⚔️ {item.boss_damage} DMG
            </span>
          )}

          {item.hp_lost > 0 && (
            <span className="text-[10px] font-game text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/30">
              💔 -{item.hp_lost} HP
            </span>
          )}
        </div>
      </div>

      {/* Cognitive Gains Tags for study sessions */}
      {gains.length > 0 && (
        <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-[var(--habit-border)] flex-wrap">
          {gains.map(({ mk, mc, val }) => (
            <span
              key={mk}
              className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs"
              style={{
                fontFamily: "'Nunito'",
                background: COLOR_MAP[mk] || "#7b61ff",
              }}
            >
              <span>{mc.abbr}</span>
              <span>+{val.toFixed(3)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}