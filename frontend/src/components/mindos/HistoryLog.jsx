// @ts-nocheck
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Flame, CheckCircle2, XCircle, Search,
  Calendar, Award, Sparkles, Zap, BookOpen,
  CheckSquare, Timer, ShieldAlert, Trophy,
  Star, Swords, Coins, Activity
} from "lucide-react";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useProfileMount } from "@/utils/perf";
import { METRIC_CONFIG, getActivityDetails } from "@/lib/cognitiveEngine";

const CATEGORY_ACCENTS = {
  STEM: "#3b82f6", sciences: "#3b82f6",
  Languages: "#00cc88", languages: "#00cc88",
  "Humanities & Arts": "#eab308", humanities: "#eab308",
  "Health & Fitness": "#ef4444", body: "#ef4444",
  "Rest & Recovery": "#f97316",
  Mindfulness: "#9944ff", spirit: "#9944ff",
  "Social & Communication": "#a855f7",
  "Reading & Writing": "#22c55e",
  "Work & Career": "#64748b",
  Other: "#7b61ff",
};

const TYPE_CONFIG = {
  daily: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.28)",
    glow: "rgba(16,185,129,0.35)",
    iconImg: "/images/pixel-icons/daily.png",
    emoji: "📅",
    label: "Daily",
  },
  todo: {
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.28)",
    glow: "rgba(139,92,246,0.35)",
    iconImg: "/images/pixel-icons/todo.png",
    emoji: "✅",
    label: "To-Do",
  },
  habit_pos: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.28)",
    glow: "rgba(245,158,11,0.35)",
    iconImg: "/images/pixel-icons/habit_pos.png",
    emoji: "⚡",
    label: "Habit+",
  },
  habit_neg: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.28)",
    glow: "rgba(239,68,68,0.35)",
    iconImg: "/images/pixel-icons/habit_neg.png",
    emoji: "💔",
    label: "Habit−",
  },
  study: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.28)",
    glow: "rgba(59,130,246,0.35)",
    iconImg: "/images/pixel-icons/study.png",
    emoji: "📚",
    label: "Study",
  },
  pomodoro: {
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.10)",
    border: "rgba(244,63,94,0.28)",
    glow: "rgba(244,63,94,0.35)",
    iconImg: "/images/pixel-icons/pomodoro.png",
    emoji: "🍅",
    label: "Pomodoro",
  },
  achievement: {
    color: "#f0c040",
    bg: "rgba(240,192,64,0.10)",
    border: "rgba(240,192,64,0.28)",
    glow: "rgba(240,192,64,0.35)",
    iconImg: null,
    emoji: "🏆",
    label: "Achievement",
  },
  boss_defeat: {
    color: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    border: "rgba(168,85,247,0.28)",
    glow: "rgba(168,85,247,0.35)",
    iconImg: null,
    emoji: "👑",
    label: "Boss Defeated",
  },
};

export default function HistoryLog({ logs = [], tasks = [] }) {
  useProfileMount("HistoryLog");
  const { profile } = useDjangoAuth();
  const { t } = useTranslation();

  const [filterType, setFilterType] = useState("all");
  const [period, setPeriod] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["activityHistory", filterType, period, searchQuery],
    queryFn: () => djangoApi.history.getHistory({ type: filterType, days: period, search: searchQuery }),
    staleTime: 8000,
  });

  const rawResults = historyData?.results;
  const stats = historyData?.stats;

  const activityItems = useMemo(() => {
    if (rawResults && Array.isArray(rawResults)) return rawResults;
    return (logs || []).map(l => {
      const act = getActivityDetails(l.activity_key, tasks);
      return {
        id: `legacy-${l.id}`, activity_type: "study",
        title: act?.label || l.activity_key, icon: act?.icon || "📚",
        category: "Other", hours: l.hours || 0, focus_rating: l.focus_rating || 5,
        xp_earned: l.xp_earned || 0, gold_earned: 0, boss_damage: 0, hp_lost: 0,
        streak_value: 0,
        cognitive_gains: { gf: l.gf_gain||0, gc: l.gc_gain||0, ps: l.ps_gain||0, vm: l.vm_gain||0 },
        created_at: l.created_at,
      };
    });
  }, [rawResults, logs, tasks]);

  const activeStats = useMemo(() => {
    if (stats) return stats;
    const total_hours   = activityItems.reduce((s, i) => s + (i.hours || 0), 0);
    const total_xp      = activityItems.reduce((s, i) => s + (i.xp_earned || 0), 0);
    const total_gold    = activityItems.reduce((s, i) => s + (i.gold_earned || 0), 0);
    const habits_count  = activityItems.filter(i => i.activity_type?.startsWith("habit")).length;
    const dailies_count = activityItems.filter(i => i.activity_type === "daily").length;
    const todos_count   = activityItems.filter(i => i.activity_type === "todo").length;
    const study_count   = activityItems.filter(i => i.activity_type === "study").length;
    const pomodoro_count = activityItems.filter(i => i.activity_type === "pomodoro").length;
    const achievement_count = activityItems.filter(i => i.activity_type === "achievement").length;
    const boss_defeat_count = activityItems.filter(i => i.activity_type === "boss_defeat").length;
    return {
      total_hours: Math.round(total_hours * 10) / 10, total_xp, total_gold,
      habits_count, dailies_count, todos_count, study_count, pomodoro_count,
      achievement_count, boss_defeat_count,
      tasks_completed_count: habits_count + dailies_count + todos_count,
    };
  }, [stats, activityItems]);

  const groupedByDay = useMemo(() => {
    const groups = {};
    const todayStr     = new Date().toDateString();
    const yesterday    = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    activityItems.forEach(item => {
      const d = new Date(item.created_at);
      const dayKey = d.toDateString();
      if (!groups[dayKey]) {
        let label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
        if (dayKey === todayStr)      label = "Today";
        else if (dayKey === yesterdayStr) label = "Yesterday";
        groups[dayKey] = { dayKey, label, dateObj: d, items: [], totalXp: 0, totalHours: 0, dailiesDone: 0, habitsDone: 0, todosDone: 0, pomoDone: 0 };
      }
      groups[dayKey].items.push(item);
      groups[dayKey].totalXp    += item.xp_earned || 0;
      groups[dayKey].totalHours += item.hours || 0;
      if (item.activity_type === "daily")    groups[dayKey].dailiesDone++;
      if (item.activity_type === "habit_pos")groups[dayKey].habitsDone++;
      if (item.activity_type === "todo")     groups[dayKey].todosDone++;
      if (item.activity_type === "pomodoro") groups[dayKey].pomoDone++;
    });
    return Object.values(groups).sort((a, b) => b.dateObj - a.dateObj);
  }, [activityItems]);

  const filterTabs = [
    { id: "all",          label: "All",        Icon: Activity,    iconImg: null,                               count: activityItems.length,           color: "#7b61ff" },
    { id: "study",        label: "Study",      Icon: BookOpen,    iconImg: "/images/pixel-icons/study.png",    count: activeStats.study_count,         color: "#3b82f6" },
    { id: "habit",        label: "Habits",     Icon: Zap,         iconImg: "/images/pixel-icons/habit_pos.png",count: activeStats.habits_count,        color: "#f59e0b" },
    { id: "daily",        label: "Dailies",    Icon: Calendar,    iconImg: "/images/pixel-icons/daily.png",    count: activeStats.dailies_count,       color: "#10b981" },
    { id: "todo",         label: "To-Do",      Icon: CheckSquare, iconImg: "/images/pixel-icons/todo.png",     count: activeStats.todos_count,         color: "#8b5cf6" },
    { id: "pomodoro",     label: "Pomodoro",   Icon: Timer,       iconImg: "/images/pixel-icons/pomodoro.png", count: activeStats.pomodoro_count,      color: "#f43f5e" },
    { id: "achievement",  label: "Achiev.",    Icon: Award,       iconImg: null,                               count: activeStats.achievement_count,   color: "#f0c040" },
    { id: "boss_defeat",  label: "Bosses",     Icon: Trophy,      iconImg: null,                               count: activeStats.boss_defeat_count,   color: "#a855f7" },
  ];

  const periodOptions = [
    { id: "1", label: "Today" }, { id: "7", label: "7 Days" },
    { id: "30", label: "30 Days" }, { id: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-4">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "Focus Hours", value: `${activeStats.total_hours || 0}h`, icon: <Clock className="w-3.5 h-3.5" />, color: "#3b82f6", sub: "" },
          { label: "Tasks Done",  value: activeStats.tasks_completed_count || 0, icon: <Trophy className="w-3.5 h-3.5" />, color: "#10b981", sub: "quests" },
          { label: "XP Earned",   value: `+${activeStats.total_xp || 0}`, icon: <Sparkles className="w-3.5 h-3.5" />, color: "#a855f7", sub: "" },
          { label: "Gold Earned", value: `+${activeStats.total_gold || 0}`, icon: <Coins className="w-3.5 h-3.5" />, color: "#f59e0b", sub: "G" },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label}
            className="p-3.5 rounded-2xl border relative overflow-hidden flex flex-col justify-between"
            style={{ background: "var(--habit-panel)", borderColor: `${color}30`, boxShadow: `0 2px 16px ${color}15` }}
          >
            <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full opacity-15 blur-2xl pointer-events-none" style={{ background: color }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>{label}</span>
              <span className="p-1.5 rounded-lg" style={{ background: `${color}18`, color }}>{icon}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black font-hud text-[var(--habit-text)]" style={{ color: color === "#a855f7" ? color : undefined }}>{value}</span>
              {sub && <span className="text-[10px] font-bold uppercase" style={{ color, opacity: 0.7 }}>{sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {filterTabs.map(({ id, label, Icon, iconImg, count, color }) => {
            const isActive = filterType === id;
            return (
              <button key={id} onClick={() => setFilterType(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${isActive ? "text-white shadow-md" : "text-[var(--habit-dim)] hover:text-[var(--habit-text)]"}`}
                style={{
                  fontFamily: "'Nunito'",
                  background: isActive ? `linear-gradient(135deg, ${color}dd, ${color}88)` : "var(--habit-panel)",
                  border: isActive ? `1px solid ${color}66` : "1px solid var(--habit-border)",
                  boxShadow: isActive ? `0 0 14px ${color}40` : undefined,
                }}
              >
                {iconImg ? (
                  <img src={iconImg} alt={label} className="w-3.5 h-3.5 rounded object-cover" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span>{label}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 rounded-full font-mono"
                    style={{ background: isActive ? "rgba(255,255,255,0.22)" : `${color}22`, color: isActive ? "#fff" : color }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Period + Search */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--habit-border)]" style={{ background: "var(--habit-panel)" }}>
            {periodOptions.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${period === p.id ? "text-[var(--habit-text)]" : "text-[var(--habit-dim)] hover:text-[var(--habit-text)]"}`}
                style={{ fontFamily: "'Nunito'", background: period === p.id ? "var(--habit-bg)" : "transparent", border: period === p.id ? "1px solid var(--habit-border)" : "1px solid transparent" }}
              >{p.label}</button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--habit-dim)]" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or category…"
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border text-[var(--habit-text)] placeholder-[var(--habit-dim)] focus:outline-none transition-all"
              style={{ fontFamily: "'Nunito'", background: "var(--habit-panel)", borderColor: searchQuery ? "var(--habit-purple)" : "var(--habit-border)", boxShadow: searchQuery ? "0 0 0 2px rgba(123,97,255,0.18)" : undefined }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--habit-dim)] hover:text-[var(--habit-text)]">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--habit-purple)] border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-mono text-[var(--habit-dim)]">Loading timeline…</span>
        </div>
      ) : groupedByDay.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed flex flex-col items-center gap-3"
          style={{ borderColor: "var(--habit-border)", background: "var(--habit-panel)" }}>
          <div className="text-5xl">📜</div>
          <h4 className="font-black text-sm text-[var(--habit-text)] font-hud">
            {searchQuery || filterType !== "all" ? "No records match this filter" : "History is empty"}
          </h4>
          <p className="text-xs text-[var(--habit-dim)] max-w-xs" style={{ fontFamily: "'Nunito'" }}>
            Complete dailies, trigger habits, log study sessions — your timeline will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5 md:max-h-[640px] md:overflow-y-auto pr-1">
          {groupedByDay.map(group => (
            <div key={group.dayKey} className="space-y-2">
              {/* Day Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-2 rounded-xl border backdrop-blur-md"
                style={{ background: "color-mix(in srgb, var(--habit-bg) 88%, transparent)", borderColor: "var(--habit-border)" }}>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-[var(--habit-text)] font-hud tracking-tight">{group.label}</span>
                  <span className="text-[10px] text-[var(--habit-dim)] font-mono px-1.5 py-0.5 rounded-full" style={{ background: "var(--habit-border)" }}>
                    {group.items.length}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] font-mono">
                  {group.totalHours > 0 && (
                    <span className="flex items-center gap-1 text-blue-400">
                      <img src="/images/pixel-icons/study.png" alt="study" className="w-3.5 h-3.5 rounded-xs object-cover inline-block" style={{ imageRendering: "pixelated" }} />
                      {group.totalHours.toFixed(1)}h
                    </span>
                  )}
                  {group.dailiesDone > 0 && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <img src="/images/pixel-icons/daily.png" alt="daily" className="w-3.5 h-3.5 rounded-xs object-cover inline-block" style={{ imageRendering: "pixelated" }} />
                      {group.dailiesDone}
                    </span>
                  )}
                  {group.habitsDone > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <img src="/images/pixel-icons/habit_pos.png" alt="habit" className="w-3.5 h-3.5 rounded-xs object-cover inline-block" style={{ imageRendering: "pixelated" }} />
                      {group.habitsDone}
                    </span>
                  )}
                  {group.todosDone > 0 && (
                    <span className="flex items-center gap-1 text-violet-400">
                      <img src="/images/pixel-icons/todo.png" alt="todo" className="w-3.5 h-3.5 rounded-xs object-cover inline-block" style={{ imageRendering: "pixelated" }} />
                      {group.todosDone}
                    </span>
                  )}
                  {group.pomoDone > 0 && (
                    <span className="flex items-center gap-1 text-rose-400">
                      <img src="/images/pixel-icons/pomodoro.png" alt="pomodoro" className="w-3.5 h-3.5 rounded-xs object-cover inline-block" style={{ imageRendering: "pixelated" }} />
                      {group.pomoDone}
                    </span>
                  )}
                  {group.totalXp > 0 && <span className="font-black text-purple-400 ml-1">+{group.totalXp} XP</span>}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 pl-1">
                <AnimatePresence>
                  {group.items.map((item, idx) => (
                    <motion.div key={item.id || idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, delay: Math.min(0.25, idx * 0.04) }}>
                      <HistoryItemCard item={item} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryItemCard({ item }) {
  const date    = new Date(item.created_at);
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const type   = item.activity_type || "study";
  const cfg    = TYPE_CONFIG[type] || TYPE_CONFIG.study;
  const catColor = CATEGORY_ACCENTS[item.category] || CATEGORY_ACCENTS.Other;

  const isHabitNeg    = type === "habit_neg";
  const isStudy       = type === "study";
  const isPomodoro    = type === "pomodoro";
  const isDaily       = type === "daily";
  const isHabitPos    = type === "habit_pos";
  const isTodo        = type === "todo";
  const isAchievement = type === "achievement";
  const isBossDefeat  = type === "boss_defeat";

  // Make achievement IDs readable: "boss_slayer" → "Boss Slayer"
  const displayTitle = isAchievement
    ? item.title.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : item.title;

  const gains = Object.entries(METRIC_CONFIG)
    .filter(([mk]) => (item.cognitive_gains?.[mk] || 0) > 0)
    .map(([mk, mc]) => ({ mk, mc, val: item.cognitive_gains[mk] }));


  return (
    <div className="group p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden hover:shadow-lg"
      style={{ background: "var(--habit-panel)", borderColor: cfg.border }}>
      {/* Left accent bar */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full" style={{ background: cfg.color }} />

      <div className="flex items-start justify-between gap-3 pl-2.5">
        {/* 16-Bit Pixel Art Icon Container */}
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative group-hover:scale-105 transition-transform duration-200"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: `0 0 12px ${cfg.glow}` }}>
          {cfg.iconImg ? (
            <img src={cfg.iconImg} alt={cfg.label} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
          ) : (
            <span className="text-base">{cfg.emoji}</span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-xs text-[var(--habit-text)] truncate" style={{ fontFamily: "'Nunito'" }}>
              {displayTitle}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: "'Nunito'" }}>
              {cfg.label}
            </span>
            {item.category && item.category !== "Other" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase"
                style={{ background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30`, fontFamily: "'Nunito'" }}>
                {item.category}
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-[var(--habit-dim)]" style={{ fontFamily: "'Nunito'" }}>
            <span className="font-bold">{timeStr}</span>
            {(isStudy || isPomodoro) && item.hours > 0 && (
              <span className="flex items-center gap-0.5 font-bold" style={{ color: cfg.color }}>
                <Clock className="w-3 h-3" />
                {isPomodoro ? `${Math.round(item.hours * 60)} min` : `${item.hours}h`}
              </span>
            )}
            {isStudy && item.focus_rating > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                <Star className="w-3 h-3" /> Focus {item.focus_rating}/10
              </span>
            )}
            {isDaily && item.streak_value > 0 && (
              <span className="flex items-center gap-0.5 font-bold" style={{ color: cfg.color }}>
                <Flame className="w-3 h-3" /> Streak {item.streak_value}d
              </span>
            )}
            {isTodo && (
              <span className="flex items-center gap-0.5 font-bold text-violet-400">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            )}
            {isHabitPos && item.streak_value > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                <Flame className="w-3 h-3" /> Streak +{item.streak_value}
              </span>
            )}
            {isHabitNeg && (
              <span className="flex items-center gap-0.5 text-red-500 font-bold">
                <ShieldAlert className="w-3 h-3" /> Penalty
              </span>
            )}
            {item.boss_damage > 0 && (
              <span className="flex items-center gap-0.5 text-red-400 font-bold">
                <Swords className="w-3 h-3" /> {item.boss_damage} DMG
              </span>
            )}
            {isBossDefeat && item.metadata?.boss_level > 0 && (
              <span className="flex items-center gap-0.5 font-bold" style={{ color: cfg.color }}>
                <Star className="w-3 h-3" /> Lv.{item.metadata.boss_level}
              </span>
            )}
            {isAchievement && (
              <span className="flex items-center gap-0.5 font-bold text-yellow-400">
                <Award className="w-3 h-3" /> Unlocked
              </span>
            )}
          </div>
        </div>

        {/* Rewards */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.xp_earned > 0 && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-lg"
              style={{ color: "#c084fc", background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.22)", fontFamily: "'Nunito'" }}>
              +{item.xp_earned} XP
            </span>
          )}
          {item.gold_earned > 0 && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-lg"
              style={{ color: "#fbbf24", background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.2)", fontFamily: "'Nunito'" }}>
              +{item.gold_earned} G
            </span>
          )}
          {item.boss_damage > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{ color: "#f87171", background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.2)", fontFamily: "'Nunito'" }}>
              ⚔ {item.boss_damage}
            </span>
          )}
          {item.hp_lost > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.2)", fontFamily: "'Nunito'" }}>
              💔 -{item.hp_lost} HP
            </span>
          )}
          {isBossDefeat && item.metadata?.sp_reward > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{ color: "#00e5ff", background: "rgba(0,229,255,0.10)", border: "1px solid rgba(0,229,255,0.2)", fontFamily: "'Nunito'" }}>
              +{item.metadata.sp_reward} SP
            </span>
          )}
        </div>
      </div>

      {/* Cognitive gains */}
      {gains.length > 0 && (
        <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[var(--habit-border)] flex-wrap pl-2.5">
          {gains.map(({ mk, mc, val }) => (
            <span key={mk} className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold flex items-center gap-1"
              style={{ fontFamily: "'Nunito'", background: { gf: "#3b82f6", gc: "#22c55e", ps: "#f59e0b", vm: "#a855f7" }[mk] || "#7b61ff" }}>
              {mc.abbr} <span className="opacity-80">+{val.toFixed(3)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
