import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, BarChart2, CalendarDays, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

import PomodoroTimer from './PomodoroTimer';
import PomodoroStats from './PomodoroStats';
import PomodoroHistory from './PomodoroHistory';
import PomodoroSettings from './PomodoroSettings';

const TAB_COLORS = {
  timer:    { active: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  stats:    { active: '#3b82f6', glow: 'rgba(59,130,246,0.35)' },
  history:  { active: '#22c55e', glow: 'rgba(34,197,94,0.35)'  },
  settings: { active: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
};

export default function PomodoroPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('timer');

  const TABS = [
    { id: 'timer',    label: t('pomodoro.tabs.timer',    'Timer'),    icon: Clock },
    { id: 'stats',    label: t('pomodoro.tabs.stats',    'Stats'),    icon: BarChart2 },
    { id: 'history',  label: t('pomodoro.tabs.history',  'History'),  icon: CalendarDays },
    { id: 'settings', label: t('pomodoro.tabs.settings', 'Set'),      icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Compact segmented tab bar ── */}
      <div className="px-3 pt-2 pb-1">
        <div
          className="relative flex w-full rounded-xl p-0.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Sliding active indicator */}
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-[10px] pointer-events-none"
            style={{
              width: `calc(${100 / TABS.length}% - 4px)`,
              left: `calc(${TABS.findIndex(t => t.id === activeTab) * (100 / TABS.length)}% + 2px)`,
              background: TAB_COLORS[activeTab]?.active,
              boxShadow: `0 0 12px ${TAB_COLORS[activeTab]?.glow}, 0 0 4px ${TAB_COLORS[activeTab]?.glow}`,
            }}
            layout
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />

          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-200 active:scale-95"
              >
                <Icon
                  className="w-3.5 h-3.5 transition-all duration-200"
                  style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.35)' }}
                />
                <span
                  className="font-mono text-[9px] uppercase tracking-wider leading-none transition-all duration-200"
                  style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.35)' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timer'    && <PomodoroTimer />}
        {activeTab === 'stats'    && <PomodoroStats />}
        {activeTab === 'history'  && <PomodoroHistory />}
        {activeTab === 'settings' && <PomodoroSettings />}
      </div>
    </div>
  );
}
