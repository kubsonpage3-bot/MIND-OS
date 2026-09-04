// @ts-nocheck
import { useState, useMemo } from 'react';
import { Plus, Square, CheckSquare, Clock } from 'lucide-react';
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
import { usePixelBurst, PixelBurstLayer } from '@/components/mindos/PixelParticles';

function getTaskValueColor(tv) {
  if (tv > 0) return '#22c55e';
  if (tv < 0) return '#ef4444';
  return '#f59e0b';
}

const DIFFICULTIES = [
  { id: 'trivial',  label: 'Trivial',  color: '#64748b' },
  { id: 'easy',     label: 'Easy',     color: '#22c55e' },
  { id: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { id: 'hard',     label: 'Hard',     color: '#ef4444' },
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

const CATEGORY_ICONS = {
  STEM: '🔬',
  Languages: '🌐',
  'Humanities & Arts': '📚',
  'Health & Fitness': '💪',
  'Rest & Recovery': '☕',
  Mindfulness: '🧘',
  'Social & Communication': '💬',
  'Reading & Writing': '✍️',
  'Work & Career': '💼',
  Other: '📦',
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
  const { bursts, trigger: triggerBurst } = usePixelBurst();
  const [justCompleted, setJustCompleted] = useState(false);

  const handleToggle = () => {
    if (toggleMutation.isPending) return;
    if (!task.is_completed) {
      triggerBurst(accentColor, 12);
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 700);
    }
    toggleMutation.mutate(task.id);
  };

  const longPressProps = useLongPress(
    () => onEdit(task),
    handleToggle,
  );

  return (
    <motion.div
      className={`relative flex-1 min-w-0 flex items-center gap-2.5 rounded-xl pr-3 overflow-hidden transition-all duration-200 group ${
        task.is_completed 
          ? 'opacity-50 cursor-pointer bg-[var(--habit-panel)]/60' 
          : 'task-card bg-[var(--habit-panel)] hover:bg-[var(--habit-panel)]/95 shadow-[0_2px_12px_rgba(0,0,0,0.2)] cursor-pointer'
      }`}
      style={{
        border: justCompleted
          ? `1px solid ${accentColor}`
          : task.is_completed
          ? '1px solid rgba(255,255,255,0.05)'
          : overdue
          ? '1px solid rgba(239,68,68,0.5)'
          : '1px solid var(--habit-border)',
        boxShadow: justCompleted 
          ? `0 0 16px ${accentColor}55` 
          : overdue && !task.is_completed 
          ? '0 0 10px rgba(239,68,68,0.2)' 
          : undefined,
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
        ...longPressProps.style
      }}
      whileHover={{ y: -1, borderColor: `${accentColor}50` }}
      animate={justCompleted ? { scale: [1, 1.03, 0.98, 1] } : {}}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      {...longPressProps}
    >
      <PixelBurstLayer bursts={bursts} />
      <DragHandle />

      {/* Task Value bar */}
      {!task.is_completed && (
        <div
          style={{ 
            width: 3.5, 
            alignSelf: 'stretch', 
            borderRadius: 2, 
            flexShrink: 0, 
            background: tvColor, 
            boxShadow: `0 0 8px ${tvColor}60`,
            transition: 'background 0.6s' 
          }}
          title={`Task Value: ${tv.toFixed(1)}`}
        />
      )}

      {/* Stylized Gamified Checkbox */}
      <div 
        className="shrink-0 flex items-center justify-center p-1 cursor-pointer transition-transform group-hover:scale-105"
        style={{ color: task.is_completed ? accentColor : (overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-dim)') }}
      >
        {task.is_completed ? (
          <CheckSquare size={19} strokeWidth={2.2} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
        ) : (
          <Square size={19} strokeWidth={1.8} className={overdue ? "text-red-400" : "text-slate-400 hover:text-amber-300 transition-colors"} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 pr-1 py-2.5 overflow-hidden">
        <div className={`font-bold text-sm truncate tracking-tight ${
          task.is_completed 
            ? 'line-through text-slate-500' 
            : overdue 
            ? 'text-red-400' 
            : 'text-slate-100'
        }`}>
          {task.name}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span 
            className="text-[9.5px] px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 border shadow-xs"
            style={{ 
              background: `${accentColor}18`,
              borderColor: `${accentColor}40`,
              color: accentColor 
            }}
          >
            <span>{CATEGORY_ICONS[task.category] || '⭐'}</span>
            <span>{String(t("categories." + task.category, task.category))}</span>
          </span>

          <span 
            className="text-[9.5px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-white/5" 
            style={{ color: diff.color }}
          >
            {t(`difficulties.${diff.id}`, diff.label)}
          </span>

          {/* Task Value */}
          {tv !== 0 && (
            <span className="text-[9.5px] font-mono font-bold" style={{ color: tvColor }}>
              TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
            </span>
          )}

          {/* Due date */}
          {task.due_date && (
            <span className={`flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded border ${
              overdue && !task.is_completed 
                ? 'text-red-400 bg-red-500/10 border-red-500/30 font-bold' 
                : 'text-slate-400 bg-white/5 border-white/5'
            }`}>
              <Clock size={10} />
              <span>{new Date(task.due_date).toLocaleDateString()}</span>
              {overdue && !task.is_completed && '⚠️'}
            </span>
          )}
        </div>

        {/* Penalty warning */}
        {tv < -5 && !task.is_completed && (
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: 'var(--habit-gold, #f59e0b)', marginTop: 4 }}>
            reward -{ Math.round(Math.abs(tv) * 5) }%
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="shrink-0 flex items-center h-full ml-1">
        <ConfirmDeleteButton onDelete={() => deleteTask(task.id)} />
      </div>
    </motion.div>
  );
}

const taskComparator = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || ((a.id ?? 0) - (b.id ?? 0));

export default function TodosColumn({ todos = [], onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'todo', category: 'Other', difficulty: 'medium',
    notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
  });
  const [formType, setFormType] = useState('todo');
  const [editingTask, setEditingTask] = useState(null);

  // Strictly deterministic sorting by order, then id
  const tasks = useMemo(
    () => [...todos].sort(taskComparator),
    [todos]
  );

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

      const columnType = 'todo';
      const columnTasks = newTasks.filter(t => t.type === columnType).sort(taskComparator);
      const otherTasks = newTasks.filter(t => t.type !== columnType);

      const oldColIndex = columnTasks.findIndex(t => String(t.id) === String(active.id));
      const newColIndex = columnTasks.findIndex(t => String(t.id) === String(over.id));
      if (oldColIndex === -1 || newColIndex === -1) return oldTasks;

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
      setForm({ name: '', type: 'todo', category: 'Math', difficulty: 'medium', notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127 });
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
                value: res?.value ?? res?.rpgValue ?? t.value,
                rpgValue: res?.value ?? res?.rpgValue ?? t.rpgValue,
                task_hp: res?.task_hp ?? t.task_hp,
              }
            : t
        );
      });
      setShowForm(false);
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
      const previousTodos = /** @type {any} */ (queryClient.getQueryData(['tasks']));
      if (previousTodos) {
        const toggleItem = (t) => t.id === todoId ? { ...t, is_completed: !t.is_completed } : t;
        if (Array.isArray(previousTodos)) {
          queryClient.setQueryData(['tasks'], previousTodos.map(toggleItem));
        } else if (previousTodos.results) {
          queryClient.setQueryData(['tasks'], { ...previousTodos, results: previousTodos.results.map(toggleItem) });
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
      const bossDefeated = combatResult?.boss_defeated || false;
      const bossGold = combatResult?.rewards?.boss_gold || data?.rewards?.boss_gold || 0;
      const bossXp = combatResult?.rewards?.boss_xp || data?.rewards?.boss_xp || 0;

      showRewardToast({
        xp: Math.abs(data.xp_change),
        gold: Math.abs(data.gold_change),
        boss: isCompleting ? bossDmg : 0,
        isCrit,
        itemDropped,
        bossDefeated: isCompleting && bossDefeated,
        bossGold: isCompleting ? bossGold : 0,
        bossXp: isCompleting ? bossXp : 0,
        label: `${icon} ${sign}${Math.abs(data.xp_change)} XP  ${sign}${Math.abs(data.gold_change)} Gold`,
      });
      
      if (isCompleting) playSound('task_complete');
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['activityHistory'] });
      queryClient.invalidateQueries({ queryKey: ['combat_encounters'] });
      queryClient.invalidateQueries({ queryKey: ['active_effects'] });
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

  return (
    <div className="flex flex-col rounded-2xl border w-full mx-auto overflow-hidden bg-[var(--habit-panel)]/95 backdrop-blur-md border-amber-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-amber-500/30 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.15) 50%, rgba(20,15,10,0.8) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.35)] shrink-0 overflow-hidden p-0.5">
            <img 
              src="/images/tasks/task_todo_scroll.png" 
              alt="To-Dos" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]" 
            />
          </div>
          <span className="font-pixel text-xs font-bold tracking-wider text-amber-300 uppercase">
            {String(t('lifeos_columns.todos', 'TO-DOS')).replace(/^[\p{Emoji}\s]+/u, '')}
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {tasks.filter(t => t.is_completed).length}/{tasks.length}
          </span>
        </div>
        <button 
          onClick={onAddClick || (() => { setEditingTask(null); setShowForm(true); })} 
          className="w-7 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.2)] hover:scale-105"
          title={t('task_modal.new_todo', 'Add To-Do')}
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Task list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div 
          className="flex-1 p-3 space-y-2" 
          style={{ background: 'var(--habit-panel)', minHeight: 120 }}
        >
          <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-2 opacity-85 flex items-center justify-center">
                  <img src="/images/tasks/task_todo_scroll.png" alt="To-Dos" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                </div>
                <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>{t('dashboard.no_todos')}</div>
              </div>
            )}
            <AnimatePresence mode="popLayout">
          {tasks.map((task, index) => {
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