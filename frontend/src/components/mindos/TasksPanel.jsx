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

  // DEBUG: on-screen log visible on mobile without DevTools
  const [debugLog, setDebugLog] = useState([]);
  const dbg = (msg) => {
    const line = `${new Date().toISOString().slice(11,19)} ${msg}`;
    console.log('[DND DEBUG]', line);
    setDebugLog(prev => [line, ...prev].slice(0, 12));
  };

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

  const handleDragStart = (start) => {
    document.body.classList.add('is-dragging-task');
    dbg(`START draggableId=${start.draggableId} src=${start.source.index} col=${start.source.droppableId}`);
  };

  const handleDragEnd = async (result) => {
    document.body.classList.remove('is-dragging-task');

    if (!result.destination) {
      dbg(`END no-destination (dropped outside) — snap back expected`);
      return;
    }

    const { source, destination, draggableId } = result;
    dbg(`END id=${draggableId} src=${source.index}->${destination.index} col=${source.droppableId}->${destination.droppableId}`);

    if (source.droppableId !== destination.droppableId) {
      dbg(`SKIP cross-column move`);
      return;
    }
    if (source.index === destination.index) {
      dbg(`SKIP same index`);
      return;
    }

    queryClient.setQueryData(["tasks"], (oldTasks) => {
      if (!oldTasks) {
        dbg(`CACHE null — setQueryData skipped`);
        return oldTasks;
      }
      dbg(`CACHE size=${oldTasks.length} isArray=${Array.isArray(oldTasks)}`);

      const newTasks = [...oldTasks];
      const columnType = source.droppableId;

      const columnTasks = newTasks.filter(t => t.type === columnType);
      const otherTasks = newTasks.filter(t => t.type !== columnType);

      dbg(`COL=${columnType} colTasks=${columnTasks.length}`);

      const [movedTask] = columnTasks.splice(source.index, 1);
      if (!movedTask) {
        dbg(`ERROR: movedTask undefined at index ${source.index}`);
        return oldTasks;
      }
      columnTasks.splice(destination.index, 0, movedTask);

      columnTasks.forEach((t, i) => { t.order = i; });

      const updates = columnTasks.map(t => ({ id: t.id, order: t.order }));
      dbg(`API calling reorder with ${updates.length} tasks`);

      djangoApi.tasks.reorder(updates)
        .then(() => dbg(`API reorder SUCCESS`))
        .catch(e => {
          dbg(`API reorder FAILED: ${e?.message || e}`);
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        });

      return [...otherTasks, ...columnTasks];
    });
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <TabGuideModal guideId="tasks" profile={profile} />

      {/* DEBUG OVERLAY — remove after diagnosis */}
      {debugLog.length > 0 && (
        <div
          style={{
            position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace',
            fontSize: 10, padding: '6px 8px', maxHeight: 160, overflowY: 'auto',
            borderTop: '1px solid #0f0',
          }}
          onClick={() => setDebugLog([])}
        >
          <div style={{ color: '#ff0', marginBottom: 2 }}>🐛 DND DEBUG (tap to clear)</div>
          {debugLog.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

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