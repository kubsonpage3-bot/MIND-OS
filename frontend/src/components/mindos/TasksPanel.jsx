import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import HabitsColumn from "./HabitsColumn";
import DailiesColumn from "./DailiesColumn";
import TodosColumn from "./TodosColumn";
import ActivityLogger from "./ActivityLogger";
import CreateTaskModal from "./CreateTaskModal";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "./RewardToast";

const TASK_TABS = [
  { id: 'habits',     label: 'Habits' },
  { id: 'dailies',   label: 'Dailies' },
  { id: 'todos',     label: 'To-Dos' },
  { id: 'activities', label: 'Activities' },
];

export default function TasksPanel({ tasks, onXpGain, onBossDamage, onRankXP, subTab, onRewardFly }) {
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('habits');
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
      {/* Mobile sub-tab bar — hidden on md: desktop shows all columns */}
      <div className="
        md:hidden
        flex gap-2 overflow-x-auto scrollbar-hide
        px-4 py-3 sticky top-0 z-30
        bg-black/40 backdrop-blur-md border-b border-white/10
      ">
        {TASK_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTaskTab(tab.id)}
            className={`
              text-xs font-bold uppercase tracking-widest
              px-4 py-2 rounded-full whitespace-nowrap
              transition-all duration-150 active:scale-95
              ${taskTab === tab.id
                ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
              }
            `}
            style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile: show only the active tab */}
      <div className="md:hidden">
        {taskTab === 'habits'     && <HabitsColumn habits={habits} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('habit')} />}
        {taskTab === 'dailies'    && <DailiesColumn dailies={dailies} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('daily')} />}
        {taskTab === 'todos'      && <TodosColumn todos={todos} onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} onAddClick={() => openCreateModal('todo')} />}
        {taskTab === 'activities' && <ActivityLogger />}
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