// @ts-nocheck
import { useState, memo, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProfileMount } from '@/utils/perf';
import { useTranslation } from 'react-i18next';
import { Plus } from "lucide-react";

import HabitsColumn from "./HabitsColumn";
import DailiesColumn from "./DailiesColumn";
import TodosColumn from "./TodosColumn";
import ActivityLogger from "./ActivityLogger";
import CreateTaskModal from "./CreateTaskModal";
import TabGuideModal from "./TabGuideModal";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "./RewardToast";
import PillTabBar from "@/components/ui/PillTabBar";

const TASK_TABS = [
  { id: 'tasks',     labelKey: 'task_modal.tab_tasks', defaultLabel: 'Tasks' },
  { id: 'activities', labelKey: 'task_modal.tab_activities', defaultLabel: 'Activities' },
];

function TasksPanel({ tasks = [], onXpGain, onBossDamage, onRankXP, subTab, onRewardFly, onLog, profile, logs = [], subjectTotals = {} }) {
  useProfileMount("TasksPanel");
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('tasks');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [formType, setFormType] = useState('habit');
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Other', difficulty: 'medium',
    notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
  });

  // Normalize to always be an array — guards against cache being temporarily
  // set to a paginated object `{ results: [...] }` which causes `.filter is not a function`
  const taskList = useMemo(() => {
    const rawTasks = /** @type {any} */ (tasks);
    return Array.isArray(rawTasks) ? rawTasks : (rawTasks?.results ?? []);
  }, [tasks]);

  const habits = useMemo(() => taskList.filter(t => t.type === 'habit'), [taskList]);
  const dailies = useMemo(() => taskList.filter(t => t.type === 'daily'), [taskList]);
  const todos = useMemo(() => taskList.filter(t => t.type === 'todo'), [taskList]);

  // Sync subTab from header if provided (e.g. from mobile header or parent tab selector)
  useEffect(() => {
    if (subTab && (subTab === 'tasks' || subTab === 'activities')) {
      setTaskTab(subTab);
    }
  }, [subTab]);

  // Listen for widget quick-action deep links
  useEffect(() => {
    const onOpenModal = (e) => {
      const type = e.detail?.type || 'habit';
      setFormType(type);
      setForm(prev => ({ ...prev, type }));
      setTaskTab('tasks');
      setCreateModalOpen(true);
    };
    window.addEventListener('mindos:open_task_modal', onOpenModal);
    return () => window.removeEventListener('mindos:open_task_modal', onOpenModal);
  }, []);

  const createTask = async () => {
    if (!form.name.trim()) return;

    try {
      const created = await djangoApi.tasks.create({
        title: form.name,
        task_type: form.type,
        category: form.category || 'Other',
        difficulty: form.difficulty || 'medium',
        notes: form.notes || '',
        due_date: form.dueDate || null,
        scheduled_time: form.scheduledTime || null,
        scheduled_end_time: form.scheduledEndTime || null,
        show_in_calendar: !!form.showInCalendar,
        repeat_weekdays: form.repeatWeekdays !== undefined ? form.repeatWeekdays : 127,
      });

      console.log('Успешно создано:', created);

      if (!created || !created.id) throw new Error("No ID returned from server");

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateModalOpen(false);
      setForm({ name: '', type: 'habit', category: 'Other', difficulty: 'medium', notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127 });
    } catch (e) {
      console.error('Django task create failed:', e.response?.data || e.message || e);
      showRewardToast({ label: `Error: Could not create task on server` });
    }
  };

  return (
    <>
      <TabGuideModal guideId="tasks" profile={profile} />

      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Toggle pill: Tasks vs Activities */}
        <div className="flex bg-muted/30 p-1 rounded-xl border border-border/40">
          {TASK_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTaskTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-pixel uppercase tracking-wider transition-all duration-200 ${
                taskTab === tab.id
                   ? 'bg-primary text-primary-foreground shadow-sm font-bold scale-[1.02]'
                   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
               }`}
            >
              {t(tab.labelKey, tab.defaultLabel)}
            </button>
          ))}
        </div>

        {/* Create Task Button: Only visible on 'tasks' tab */}
        {taskTab === 'tasks' && (
          <button
            onClick={() => { setFormType('habit'); setCreateModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-pixel uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-primary/30 to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400/70 transition-all shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:shadow-[0_0_16px_rgba(245,158,11,0.35)] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {t('task_modal.new_task_btn', 'New Task')}
          </button>
        )}
      </div>

      {/* Mobile: show only the active tab */}
      <div className="md:hidden">
        {taskTab === 'tasks' && (
          <div className="flex flex-col gap-3 md:gap-6">
            <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('habit'); setCreateModalOpen(true); }} />
            <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('daily'); setCreateModalOpen(true); }} />
            <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('todo'); setCreateModalOpen(true); }} />
          </div>
        )}
        {taskTab === 'activities' && <ActivityLogger onLog={onLog} profile={profile} logs={logs} tasks={tasks} subjectTotals={subjectTotals} isLogging={false} />}
      </div>

      {/* Desktop: side-by-side layout (unchanged) */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('habit'); setCreateModalOpen(true); }} />
        <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('daily'); setCreateModalOpen(true); }} />
        <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('todo'); setCreateModalOpen(true); }} />
      </div>

      <CreateTaskModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </>
  );
}

export default memo(TasksPanel);
