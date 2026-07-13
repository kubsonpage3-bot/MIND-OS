import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, BarChart2, CalendarDays, Settings } from 'lucide-react';
import PillTabBar from "@/components/ui/PillTabBar";

import PomodoroTimer from './PomodoroTimer';
import PomodoroStats from './PomodoroStats';
import PomodoroHistory from './PomodoroHistory';
import PomodoroSettings from './PomodoroSettings';

export default function PomodoroPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("timer");

  const TABS = [
    { id: "timer", label: t('pomodoro.tabs.timer', 'Timer'), icon: Clock },
    { id: "stats", label: t('pomodoro.tabs.stats', 'Stats'), icon: BarChart2 },
    { id: "history", label: t('pomodoro.tabs.history', 'History'), icon: CalendarDays },
    { id: "settings", label: t('pomodoro.tabs.settings', 'Settings'), icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Navigation */}
      <div className="px-1">
        <PillTabBar 
          tabs={TABS} 
          activeTab={activeTab} 
          onChange={setActiveTab} 
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "timer" && <PomodoroTimer />}
        {activeTab === "stats" && <PomodoroStats />}
        {activeTab === "history" && <PomodoroHistory />}
        {activeTab === "settings" && <PomodoroSettings />}
      </div>
    </div>
  );
}
