import { useState, memo, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProfileMount } from '@/utils/perf';

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
  { id: 'tasks',     label: 'Tasks' },
  { id: 'activities', label: 'Activities' },
];

function TasksPanel({ tasks = [], onXpGain, onBossDamage, onRankXP, subTab, onRewardFly, onLog, profile, logs = [] }) {
  useProfileMount("TasksPanel");
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('tasks');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [formType, setFormType] = useState('habit');
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Other', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
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
      setForm({ name: '', type: 'habit', category: 'Other', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127 });
    } catch (e) {
      console.error('Django task create failed:', e.response?.data || e.message || e);
      showRewardToast({ label: `Error: Could not create task on server` });
    }
  };

  const openCreateModal = (type) => {
    setFormType(type);
    setForm(prev => ({ ...prev, type: type, name: '' }));
    setCreateModalOpen(true);
  };


  return (
    <>
      <TabGuideModal guideId="tasks" profile={profile} />

      {/* Mobile sub-tab bar */}
      <PillTabBar tabs={TASK_TABS} activeTab={taskTab} onChange={setTaskTab} sticky={true} />

      {/* Mobile: show only the active tab */}
      <div className="md:hidden">
        {taskTab === 'tasks' && (
          <div className="flex flex-col gap-6">
            <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('habit'); setCreateModalOpen(true); }} />
            <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('daily'); setCreateModalOpen(true); }} />
            <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} />
          </div>
        )}
        {taskTab === 'activities' && <ActivityLogger onLog={onLog} profile={profile} logs={logs} tasks={tasks} isLogging={false} />}
      </div>

      {/* Desktop: side-by-side layout (unchanged) */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('habit'); setCreateModalOpen(true); }} />
        <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => { setFormType('daily'); setCreateModalOpen(true); }} />
        <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} />
      </div>

      <CreateTaskModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </>
  );
}

export default memo(TasksPanel);