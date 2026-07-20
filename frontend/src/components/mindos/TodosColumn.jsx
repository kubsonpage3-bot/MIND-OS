import { useState } from 'react';
import { Plus, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { playSound } from '@/lib/soundEffects.js';
import { showRewardToast } from '@/components/mindos/RewardToast';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { djangoApi } from '@/api/djangoClient';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTaskDndSensors } from '../../utils/dndConfig';
import { SortableTaskItem, DragHandle } from "./SortableTaskItem";
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { useLongPress } from '@/hooks/useLongPress';

function getTaskValueColor(tv) {
  if (tv > 0) return '#22c55e';
  if (tv < 0) return '#ef4444';
  return '#f59e0b';
}

const DIFFICULTIES = [
  { id: 'easy',     label: 'Easy',     color: '#22c55e' },
  { id: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { id: 'hard',     label: 'Hard',     color: '#ef4444' },
  { id: 'critical', label: 'Critical', color: '#a855f7' },
];

const CATEGORY_COLORS = {
  STEM: '#3b82f6',
  Languages: '#00cc88',
  'Humanities & Arts': '#eab308',
  'Health & Fitness': '#ef4444',
  'Rest & Recovery': '#f97316',
  Mindfulness: '#9944ff',
  'Social & Communication': '#a855f7',
  'Reading & Writing': '#22c55e',
  'Work & Career': '#64748b',
  Other: '#94a3b8',
};



/** Проверяет, просрочен ли To-Do (есть due_date и она в прошлом) */
function isOverdue(task) {
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date();
}

function TaskItemRow({ task, toggleMutation, deleteTask, onEdit, t }) {
  const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
  const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
  const tv = task.value ?? 0;
  const tvColor = getTaskValueColor(tv);
  const overdue = isOverdue(task);

  const longPressProps = useLongPress(
    () => onEdit(task),
    () => { if (!toggleMutation.isPending) toggleMutation.mutate(task.id); }
  );

  return (
    <div
      className="flex-1 min-w-0 flex items-center gap-2 rounded-xl pr-2.5 overflow-hidden cursor-pointer transition-all duration-150"
      style={/** @type {any} */ ({
        background: 'var(--habit-panel)',
        border: `1px solid ${overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-border)'}`,
        ...longPressProps.style
      })}
      {...longPressProps}
    >
      <DragHandle />
      {/* Task Value bar */}
      <div
        style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: tvColor, transition: 'background 0.6s' }}
        title={`Task Value: ${tv.toFixed(1)}`}
      />

      {/* Checkbox */}
      <div className="shrink-0">
        <Square size={20} strokeWidth={2} style={{ color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-dim)' }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{
          fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
          color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-text)',
          textDecoration: 'none',
        }}>
          {task.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{String(t("categories." + task.category, task.category))}</span>
          <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
          {/* Task Value */}
          <span className="text-[10px] font-mono" style={{ color: tvColor }}>
            TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
          </span>
          {/* Due date */}
          {task.due_date && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: overdue ? 'var(--habit-red)' : 'var(--habit-dim)' }}>
              <Clock size={8} />
              {new Date(task.due_date).toLocaleDateString()}
              {overdue && ' ⚠️'}
            </span>
          )}
        </div>
        {/* Предупреждение о снижении награды */}
        {tv < -5 && (
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: 'var(--habit-gold, #f59e0b)', marginTop: 3 }}>
            reward -{ Math.round(Math.abs(tv) * 5) }%
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="shrink-0">
        <ConfirmDeleteButton onDelete={() => deleteTask(task.id)} />
      </div>
    </div>
  );
}

export default function TodosColumn({ todos = [], onXpGain, onBossDamage, onRankXP }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'todo', category: 'Other', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
  });
  const [formType, setFormType] = useState('todo');
  const [editingTask, setEditingTask] = useState(null);

  const activeTodos = todos.filter(t => !t.is_completed);

  const sensors = useTaskDndSensors();
  const [activeId, setActiveId] = useState(null);

  const handleDragStart = (e) => {
    setActiveId(e.active.id);
    document.body.classList.add('dnd-dragging');
  };

  const handleDragEnd = (e) => {
    setActiveId(null);
    document.body.classList.remove('dnd-dragging');
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    queryClient.setQueryData(["tasks"], (oldTasks) => {
      if (!oldTasks) return oldTasks;
      const rawTasks = /** @type {any} */ (oldTasks);
      const normalized = Array.isArray(rawTasks) ? rawTasks : (rawTasks?.results ?? []);
      const newTasks = [...normalized];
      const oldIndex = newTasks.findIndex(t => String(t.id) === active.id);
      const newIndex = newTasks.findIndex(t => String(t.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) return oldTasks;

      const columnType = newTasks[oldIndex].type;
      const columnTasks = newTasks.filter(t => t.type === columnType);
      const otherTasks = newTasks.filter(t => t.type !== columnType);

      const oldColIndex = columnTasks.findIndex(t => String(t.id) === active.id);
      const newColIndex = columnTasks.findIndex(t => String(t.id) === over.id);
      
      const reorderedCol = arrayMove(columnTasks, oldColIndex, newColIndex);
      reorderedCol.forEach((t, i) => { t.order = i; });

      const updates = reorderedCol.map(t => ({ id: t.id, order: t.order }));
      djangoApi.tasks.reorder(updates).catch(err => {
        console.error('Reorder failed', err);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      });

      return [...otherTasks, ...reorderedCol];
    });
  };

  const handleDragCancel = () => {
    setActiveId(null);
    document.body.classList.remove('dnd-dragging');
  };

  const createTaskMutation = useMutation({
    mutationFn: (/** @type {any} */ taskData) => djangoApi.tasks.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowForm(false);
      setForm({ name: '', type: 'todo', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127 });
    }
  });

  /** @type {import('@tanstack/react-query').UseMutationResult<any, any, any, any>} */
  const updateTaskMutation = useMutation({
    mutationFn: (taskData) => djangoApi.tasks.update(taskData.id, taskData),
    onSuccess: (res, taskData) => {
      queryClient.setQueryData(['tasks'], (old) => {
        const rawOld = /** @type {any} */ (old);
        const list = Array.isArray(rawOld) ? rawOld : (rawOld?.results ?? []);
        return list.map(t =>
          t.id === taskData.id
            ? {
                ...t,
                name: taskData.title ?? t.name,
                type: taskData.task_type ?? t.type,
                category: taskData.category ?? t.category,
                difficulty: taskData.difficulty ?? t.difficulty,
                notes: taskData.notes ?? t.notes,
              }
            : t
        );
      });
      setShowForm(false);
      setEditingTask(null);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        title: form.name,
        task_type: formType,
        category: form.category,
        difficulty: form.difficulty,
        notes: form.notes || '',
        due_date: form.dueDate || null,
        scheduled_time: form.scheduledTime || null,
        scheduled_end_time: form.scheduledEndTime || null,
        show_in_calendar: !!form.showInCalendar,
        repeat_weekdays: form.repeatWeekdays !== undefined ? form.repeatWeekdays : 127,
      });
    } else {
      createTaskMutation.mutate({
        title: form.name,
        task_type: formType,
        category: form.category,
        difficulty: form.difficulty,
        notes: form.notes || '',
        due_date: form.dueDate || null,
        scheduled_time: form.scheduledTime || null,
        scheduled_end_time: form.scheduledEndTime || null,
        show_in_calendar: !!form.showInCalendar,
        repeat_weekdays: form.repeatWeekdays !== undefined ? form.repeatWeekdays : 127,
      });
    }
  };

  const handleEdit = (task) => {
    setForm({
      name: task.name,
      type: task.type || 'todo',
      category: task.category || 'Other',
      difficulty: task.difficulty || 'medium',
      notes: task.notes || '',
      priority: task.priority || 'medium',
      dueDate: task.due_date || '',
      scheduledTime: task.scheduled_time || '',
      scheduledEndTime: task.scheduled_end_time || '',
      showInCalendar: task.show_in_calendar || false,
      repeatWeekdays: task.repeat_weekdays !== undefined ? task.repeat_weekdays : 127,
    });
    setFormType(task.type || 'todo');
    setEditingTask(task);
    setShowForm(true);
  };

  const toggleMutation = useMutation({
    mutationFn: (todoId) => djangoApi.tasks.toggle(todoId),
    onMutate: async (todoId) => {
      // Opt-update UI immediately (getQueryData -> filter -> setQueryData)
      const previousTodos = /** @type {any} */ (queryClient.getQueryData(['tasks']));
      if (previousTodos) {
        if (Array.isArray(previousTodos)) {
          queryClient.setQueryData(['tasks'], previousTodos.filter(t => t.id !== todoId));
        } else if (previousTodos.results) {
          queryClient.setQueryData(['tasks'], { ...previousTodos, results: previousTodos.results.filter(t => t.id !== todoId) });
        }
      }
      return { previousTodos };
    },
    onSuccess: (/** @type {any} */ data) => {
      const isCompleting = data.completed;
      const sign = isCompleting ? '+' : '-';
      const icon = isCompleting ? '✅' : '↩️';
      
      const combatResult = data.combat;
      const isCrit = data.gamification_result?.is_crit || false;
      const itemDropped = data.gamification_result?.item_dropped || null;
      const bossDmg = combatResult?.damage_dealt || 0;

      showRewardToast({
        xp: Math.abs(data.xp_change),
        gold: Math.abs(data.gold_change),
        boss: isCompleting ? bossDmg : 0,
        isCrit,
        itemDropped,
        label: `${icon} ${sign}${Math.abs(data.xp_change)} XP  ${sign}${Math.abs(data.gold_change)} Gold`,
      });
      
      if (isCompleting) playSound('task_complete');
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['combat_encounters'] });
      if (itemDropped || !isCompleting) {
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    },
    onError: (err, todoId, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(['tasks'], context.previousTodos);
      }
      showRewardToast({ label: '❌ Failed to update task' });
    },
  });

  const completeTodo = (task) => {
    toggleMutation.mutate(task.id);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => djangoApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const deleteTask = (id) => {
    deleteMutation.mutate(id);
  };

  const sortedActive = activeTodos;

  return (
    <div className="flex flex-col rounded-none border-x-0 mx-0 w-full md:rounded-xl md:border-x md:mx-auto md:max-w-2xl border-y overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-orange, #ff8800)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>TO-DOS</span>
        <button onClick={() => { setEditingTask(null); setShowForm(true); }} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Task list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div 
          className="flex-1 p-3 space-y-2" 
          style={{ background: 'var(--habit-panel)', minHeight: 120 }}
        >
          <SortableContext items={sortedActive.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
            {activeTodos.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📜</div>
                <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>{t('dashboard.no_todos')}</div>
              </div>
            )}
            <AnimatePresence mode="popLayout">
          {sortedActive.map((task, index) => {
            return (
              <motion.div
                key={task.id}
                layout={!activeId}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 40, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <SortableTaskItem id={task.id}>
                  <TaskItemRow
                    task={task}
                    toggleMutation={toggleMutation}
                    deleteTask={deleteTask}
                    onEdit={handleEdit}
                    t={t}
                  />
                </SortableTaskItem>
              </motion.div>
            );
          })}
        </AnimatePresence>
        </SortableContext>

      </div>
      </DndContext>

      <CreateTaskModal isOpen={showForm} onClose={() => setShowForm(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={handleSave} editMode={!!editingTask} />
    </div>
  );
}