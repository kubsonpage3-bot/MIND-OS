import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, BarChart2, CalendarDays, Settings } from 'lucide-react';

import PomodoroTimer from './PomodoroTimer';
import PomodoroStats from './PomodoroStats';
import PomodoroHistory from './PomodoroHistory';
import PomodoroSettings from './PomodoroSettings';

export default function PomodoroPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('timer');

  const TABS = [
    { id: 'timer',    label: t('pomodoro.tabs.timer',    'Timer'),    icon: Clock },
    { id: 'stats',    label: t('pomodoro.tabs.stats',    'Stats'),    icon: BarChart2 },
    { id: 'history',  label: t('pomodoro.tabs.history',  'History'),  icon: CalendarDays },
    { id: 'settings', label: t('pomodoro.tabs.settings', 'Settings'), icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Tab Navigation — visible on ALL screen sizes */}
      <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/10">
        <div
          className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide items-center"
          style={{ WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
        >
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  font-mono text-xs uppercase tracking-widest
                  flex items-center gap-1.5
                  px-3 py-1.5 rounded-full whitespace-nowrap
                  transition-all duration-150 active:scale-95
                  ${isActive
                    ? 'bg-violet-600 text-white shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                  }
                `}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timer'    && <PomodoroTimer />}
        {activeTab === 'stats'    && <PomodoroStats />}
        {activeTab === 'history'  && <PomodoroHistory />}
        {activeTab === 'settings' && <PomodoroSettings />}
      </div>
    </div>
  );
}
