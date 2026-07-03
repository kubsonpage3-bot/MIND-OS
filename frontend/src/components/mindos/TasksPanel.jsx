import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import HabitsColumn from "./HabitsColumn";
import DailiesColumn from "./DailiesColumn";
import TodosColumn from "./TodosColumn";
import ActivityLogger from "./ActivityLogger";
import CreateTaskModal from "./CreateTaskModal";
import TabGuideModal from "./TabGuideModal";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "./RewardToast";

const TASK_TABS = [
  { id: 'tasks',     label: 'Tasks' },
  { id: 'activities', label: 'Activities' },
];

export default function TasksPanel({ tasks = [], onXpGain, onBossDamage, onRankXP, subTab, onRewardFly, onLog, profile, logs = [] }) {
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('tasks');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [formType, setFormType] = useState('habit');
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Math', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });

  const habits = tasks.filter(t => t.type === 'habit');
  const dailies = tasks.filter(t => t.type === 'daily');
  const todos = tasks.filter(t => t.type === 'todo');

  const createTask = async () => {
    if (!form.name.trim()) return;

    try {
      const created = await djangoApi.tasks.create({
        title: form.name,
        task_type: form.type,
        difficulty: form.difficulty,
        notes: form.notes || '',
      });

      console.log('Успешно создано:', created);

      if (!created || !created.id) throw new Error("No ID returned from server");

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateModalOpen(false);
      setForm({ name: '', type: 'habit', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
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
      <TabGuideModal guideId="tasks" title="Tasks" profile={profile}>
        Placeholder text for the Tasks guide. We will replace this with final copy later.
      </TabGuideModal>

      {/* Mobile sub-tab bar — hidden on md: desktop shows all columns */}
      <div 
        className="
          md:hidden
          flex gap-2 overflow-x-auto scrollbar-hide
          px-4 py-3 sticky top-0 z-30
          bg-black/40 backdrop-blur-md border-b border-white/10
        "
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {TASK_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTaskTab(tab.id)}
            className={`
              font-pixel text-xl uppercase tracking-widest
              px-4 py-2 rounded-full whitespace-nowrap
              transition-all duration-150 active:scale-95
              ${taskTab === tab.id
                ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile: show only the active tab */}
      <div className="md:hidden">
        {taskTab === 'tasks' && (
          <div className="flex flex-col gap-6">
            <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('habit')} />
            <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('daily')} />
            <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('todo')} />
          </div>
        )}
        {taskTab === 'activities' && <ActivityLogger onLog={onLog} profile={profile} logs={logs} tasks={tasks} />}
      </div>

      {/* Desktop: side-by-side layout (unchanged) */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('habit')} />
        <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('daily')} />
        <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('todo')} />
      </div>

      <CreateTaskModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </>
  );
}