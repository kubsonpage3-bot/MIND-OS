import { useTranslation } from 'react-i18next';
import { usePomodoro } from '@/hooks/usePomodoro';
import { Brain, Clock, Zap, Target, Award, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PomodoroStats() {
  const { t } = useTranslation();
  const { statsData, isStatsLoading } = usePomodoro();

  if (isStatsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { 
      id: "today_pomodoros", 
      label: t('pomodoro.stats.todayPomodoros', "Today's Sessions"), 
      value: statsData?.today_pomodoros || 0,
      icon: Target,
      color: "text-pink-400"
    },
    { 
      id: "today_hours", 
      label: t('pomodoro.stats.todayHours', "Today's Hours"), 
      value: `${statsData?.today_hours || 0}h`,
      icon: Clock,
      color: "text-purple-400"
    },
    { 
      id: "current_streak", 
      label: t('pomodoro.stats.currentStreak', "Current Streak"), 
      value: `${statsData?.current_streak || 0} ${t('common.days', 'days')}`,
      icon: Zap,
      color: "text-amber-400"
    },
    { 
      id: "total_pomodoros", 
      label: t('pomodoro.stats.totalPomodoros', "Total Sessions"), 
      value: statsData?.total_pomodoros || 0,
      icon: Brain,
      color: "text-blue-400"
    },
    { 
      id: "total_hours", 
      label: t('pomodoro.stats.totalHours', "Total Hours"), 
      value: `${statsData?.total_hours || 0}h`,
      icon: Award,
      color: "text-emerald-400"
    },
    { 
      id: "active_days", 
      label: t('pomodoro.stats.activeDays', "Active Days"), 
      value: statsData?.active_days || 0,
      icon: Calendar,
      color: "text-indigo-400"
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <div className="text-2xl font-mono font-bold mt-auto">
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Space for future sparkline / progress bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center py-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          {t('pomodoro.stats.moreComingSoon', 'More analytics coming soon...')}
        </p>
      </div>
    </div>
  );
}
