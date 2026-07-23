import { useTranslation } from 'react-i18next';
import { usePomodoro } from '@/hooks/usePomodoro';
import { Brain, Clock, Zap, Target, Award, Calendar, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

/** Compute sessions per day for the last 7 days from heatmapData */
function useWeeklyData(heatmapData) {
  return useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      result.push({
        label: days[d.getDay()],
        date: key,
        count: heatmapData?.[key] || 0,
        isToday: i === 0,
      });
    }
    return result;
  }, [heatmapData]);
}

/** Efficiency score: ratio of days with sessions in last 30 days vs 30 */
function useEfficiency(heatmapData) {
  return useMemo(() => {
    if (!heatmapData) return { score: 0, bestDay: null };
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0..Sat=6
    let activeDays = 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);

    for (const [dateStr, count] of Object.entries(heatmapData)) {
      const d = new Date(dateStr);
      if (d >= cutoff && count > 0) {
        activeDays++;
        dayCounts[d.getDay()] += count;
      }
    }

    const score = Math.min(100, Math.round((activeDays / 30) * 100));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
    const bestDay = Math.max(...dayCounts) > 0 ? dayNames[bestDayIndex] : null;

    return { score, bestDay };
  }, [heatmapData]);
}

export default function PomodoroStats() {
  const { t } = useTranslation();
  const { statsData, isStatsLoading, heatmapData } = usePomodoro();
  const weeklyData = useWeeklyData(heatmapData);
  const { score: efficiencyScore, bestDay } = useEfficiency(heatmapData);
  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1);

  if (isStatsLoading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const topStats = [
    {
      id: 'today_pomodoros',
      label: t('pomodoro.stats.todayPomodoros', "Today's Sessions"),
      value: statsData?.today_pomodoros || 0,
      icon: Target,
      color: '#f472b6',
    },
    {
      id: 'today_hours',
      label: t('pomodoro.stats.todayHours', "Today's Hours"),
      value: `${statsData?.today_hours || 0}h`,
      icon: Clock,
      color: '#a78bfa',
    },
    {
      id: 'current_streak',
      label: t('pomodoro.stats.currentStreak', 'Current Streak'),
      value: `${statsData?.current_streak || 0}d`,
      icon: Zap,
      color: '#fbbf24',
    },
    {
      id: 'best_streak',
      label: t('pomodoro.stats.bestStreak', 'Best Streak'),
      value: `${statsData?.best_streak || 0}d`,
      icon: Trophy,
      color: '#f97316',
    },
    {
      id: 'total_pomodoros',
      label: t('pomodoro.stats.totalPomodoros', 'Total Sessions'),
      value: statsData?.total_pomodoros || 0,
      icon: Brain,
      color: '#60a5fa',
    },
    {
      id: 'total_hours',
      label: t('pomodoro.stats.totalHours', 'Total Hours'),
      value: `${statsData?.total_hours || 0}h`,
      icon: Award,
      color: '#34d399',
    },
    {
      id: 'active_days',
      label: t('pomodoro.stats.activeDays', 'Active Days'),
      value: statsData?.active_days || 0,
      icon: Calendar,
      color: '#818cf8',
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* ── Stat cards grid ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {topStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-3 flex flex-col"
              style={{ borderColor: `${s.color}25` }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider leading-tight">
                  {s.label}
                </span>
              </div>
              <div className="text-xl font-mono font-bold mt-auto" style={{ color: s.color }}>
                {s.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Weekly Bar Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {t('pomodoro.stats.lastWeek', 'Last 7 Days')}
          </span>
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {weeklyData.map((day, i) => {
            const pct = maxWeeklyCount > 0 ? (day.count / maxWeeklyCount) * 100 : 0;
            const isToday = day.isToday;
            return (
              <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 48 }}>
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.35 + i * 0.05, duration: 0.4, ease: 'easeOut' }}
                    style={{
                      height: `${Math.max(pct, day.count > 0 ? 8 : 0)}%`,
                      minHeight: day.count > 0 ? 4 : 0,
                      background: isToday
                        ? 'linear-gradient(to top, #a855f7, #7c3aed)'
                        : day.count > 0
                        ? 'rgba(168,85,247,0.45)'
                        : 'rgba(255,255,255,0.05)',
                      borderRadius: 3,
                      transformOrigin: 'bottom',
                      boxShadow: isToday ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                    }}
                  />
                </div>
                <span
                  className="text-[8px] font-mono"
                  style={{ color: isToday ? '#a855f7' : 'rgba(255,255,255,0.35)' }}
                >
                  {day.label}
                </span>
                {day.count > 0 && (
                  <span className="text-[8px] font-mono text-white/50">{day.count}</span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Efficiency Score ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {t('pomodoro.stats.efficiency', '30-Day Consistency')}
          </span>
          <span className="text-lg font-mono font-bold" style={{ color: efficiencyScore > 60 ? '#34d399' : efficiencyScore > 30 ? '#fbbf24' : '#f87171' }}>
            {efficiencyScore}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${efficiencyScore}%` }}
            transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: efficiencyScore > 60
                ? 'linear-gradient(90deg, #059669, #34d399)'
                : efficiencyScore > 30
                ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                : 'linear-gradient(90deg, #dc2626, #f87171)',
            }}
          />
        </div>
        {bestDay && (
          <p className="text-[9px] font-mono text-muted-foreground mt-2">
            ⚡ {t('pomodoro.stats.bestDayHint', `You focus most on ${bestDay}s`)}
          </p>
        )}
      </motion.div>
    </div>
  );
}
