import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext } from '@hello-pangea/dnd';
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

export default function TasksPanel({ tasks = [], onXpGain, onBossDamage, onRankXP, subTab, onRewardFly, onLog, profile, logs = [] }) {
  const queryClient = useQueryClient();
  const [taskTab, setTaskTab] = useState('tasks');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [formType, setFormType] = useState('habit');
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Other', difficulty: 'medium',
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
        category: form.category || 'Other',
        difficulty: form.difficulty || 'medium',
        notes: form.notes || '',
        due_date: form.dueDate || null,
        scheduled_time: form.scheduledTime || null,
        show_in_calendar: !!form.showInCalendar,
      });

      console.log('Успешно создано:', created);

      if (!created || !created.id) throw new Error("No ID returned from server");

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateModalOpen(false);
      setForm({ name: '', type: 'habit', category: 'Other', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
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

  const handleDragStart = () => {
    // Add class to body to disable native scrolling and enforce touch-action: none globally
    document.body.classList.add('is-dragging-task');
  };

  const handleDragEnd = async (result) => {
    document.body.classList.remove('is-dragging-task');
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    queryClient.setQueryData(["tasks"], (oldTasks) => {
      if (!oldTasks) return oldTasks;
      const newTasks = [...oldTasks];
      const columnType = source.droppableId; 
      
      const columnTasks = newTasks.filter(t => t.type === columnType);
      const otherTasks = newTasks.filter(t => t.type !== columnType);

      const [movedTask] = columnTasks.splice(source.index, 1);
      columnTasks.splice(destination.index, 0, movedTask);

      columnTasks.forEach((t, i) => {
        t.order = i;
      });

      const updates = columnTasks.map(t => ({ id: t.id, order: t.order }));
      djangoApi.tasks.reorder(updates).catch(e => {
        console.error("Reorder failed", e);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      });

      return [...otherTasks, ...columnTasks];
    });
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <TabGuideModal guideId="tasks" profile={profile} />

      {/* Mobile sub-tab bar — hidden on md: desktop shows all columns */}
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
    </DragDropContext>
  );
}