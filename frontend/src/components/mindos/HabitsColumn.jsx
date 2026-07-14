
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { playSound } from '@/lib/soundEffects.js';
import { useHaptic } from '@/hooks/useHaptic';
import { showRewardToast } from '@/components/mindos/RewardToast';
import { djangoApi } from '@/api/djangoClient';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTaskDndSensors } from '../../utils/dndConfig';
import { SortableTaskItem, DragHandle } from "./SortableTaskItem";
import { useState } from 'react';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { useLongPress } from '@/hooks/useLongPress';

function getTaskValueColor(tv) {
  if (tv > 0) return '#22c55e';
  if (tv < 0) return '#ef4444';
  return '#f59e0b';
}

function previewHabitDamage(tv, difficulty, con) {
  // Purely cosmetic fallback since backend handles real damage
  return Math.max(1, Math.abs(tv) * 1.5);
}

function getConStat() {
  return 5;
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

function TaskItemRow({ task, completeMutation, deleteTask, onEdit, t, habitClick }) {
  const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
  const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
  const hp = task.task_hp ?? 10;
  const maxHp = 10;
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hpColor = hpPct <= 25 ? '#ef4444' : hpPct <= 60 ? '#f59e0b' : '#22c55e';
  const tv = task.value ?? task.rpgValue ?? 0;
  const tvColor = getTaskValueColor(tv);
  const con = getConStat();
  const nextDmg = previewHabitDamage(tv, task.difficulty || 'medium', con);

  const longPressProps = useLongPress(() => onEdit(task));

  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-2 rounded-xl pr-2.5 overflow-hidden cursor-pointer transition-all duration-150 ${task.is_completed ? 'opacity-50' : 'task-card bg-[var(--habit-panel)]'}`}
      style={{ border: '1px solid var(--habit-border)', ...longPressProps.style }}
      {...longPressProps}
    >
      <DragHandle />
      {/* Task Value color bar */}
      <div
        style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: tvColor, transition: 'background 0.6s' }}
        title={`Task Value: ${tv.toFixed(1)}`}
      />

      {/* +/- buttons */}
      <div className="flex flex-col gap-1 shrink-0">
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => {
            if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
            habitClick(task, true);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-base"
          style={{ background: '#22c55e', opacity: completeMutation.isPending && completeMutation.variables?.task?.id === task.id ? 0.5 : 1 }}
        >+</motion.button>
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => {
            if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
            habitClick(task, false);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-base"
          style={{ background: '#ef4444', color: 'white', opacity: completeMutation.isPending && completeMutation.variables?.task?.id === task.id ? 0.5 : 1 }}
        >−</motion.button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="truncate flex items-center gap-1.5 text-gray-900 dark:text-gray-100" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14 }}>
          <span>{task.name}</span>
          {task.posStreak >= 5 && <span className="text-xs" title={`Hot streak: ${task.posStreak}!`}>🔥</span>}
          {task.negStreak >= 5 && <span className="text-xs" title={`Neg streak: ${task.negStreak}!`}>💀</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{String(t("categories." + task.category, task.category))}</span>
          <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
          <span className="text-[10px] font-mono" style={{ color: tvColor }}>
            TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
          </span>
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span style={{ fontFamily: "'PixeloidSans'", fontSize: 5, color: '#f74e52', minWidth: 12 }}>HP</span>
          <div className="flex-1 relative" style={{ height: 6, background: '#fee2e2', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{ height: '100%', background: hpColor, borderRadius: 2, width: `${hpPct}%`, transition: 'width 0.4s ease-out' }}
            />
          </div>
          <span style={{ fontFamily: "'PixeloidSans'", fontSize: 5, color: '#878190', minWidth: 28, textAlign: 'right' }}>
            {Math.round(hp)}/{maxHp}
          </span>
        </div>

        {/* Streaks + next damage preview */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-2">
            <span style={{ fontFamily: "'PixeloidSans'", fontSize: 5, color: '#22c55e' }}>+{task.posStreak || 0}</span>
            <span style={{ fontFamily: "'PixeloidSans'", fontSize: 5, color: '#ef4444' }}>−{task.negStreak || 0}</span>
          </div>
          {(task.negStreak || 0) > 0 && (
            <span style={{ fontFamily: "'PixeloidSans'", fontSize: 5, color: '#f59e0b' }}>
              next: -{Math.round(nextDmg * 10) / 10}hp
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <div className="shrink-0 flex items-center h-full ml-1">
        <ConfirmDeleteButton onDelete={() => deleteTask(task.id)} />
      </div>
    </div>
  );
}




export default function HabitsColumn({ habits, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { success, error } = useHaptic();
  const tasks = habits;

  const { profile } = useDjangoAuth();
  const hp = profile?.hp ?? 100;
  const maxHp = profile?.hp_max ?? 100;

  const sensors = useTaskDndSensors();
  const [activeId, setActiveId] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Other', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
  });
  const [formType, setFormType] = useState('habit');
  const [editingTask, setEditingTask] = useState(null);

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
      const normalized = Array.isArray(oldTasks) ? oldTasks : (oldTasks?.results ?? []);
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

  const updateTaskMutation = useMutation({
    mutationFn: (taskData) => djangoApi.tasks.update(taskData.id, taskData),
    onSuccess: (res, taskData) => {
      // Optimistically update just this task in the cache — avoids tasks disappearing
      // during the refetch cycle that invalidateQueries would trigger
      queryClient.setQueryData(['tasks'], (old) => {
        const list = Array.isArray(old) ? old : (old?.results ?? []);
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
      // Full refetch on error to restore real server state
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const handleSave = () => {
    if (!form.name.trim() || !editingTask) return;
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
  };

  const handleEdit = (task) => {
    setForm({
      name: task.name,
      type: task.type || 'habit',
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
    setFormType(task.type || 'habit');
    setEditingTask(task);
    setShowForm(true);
  };

  const completeMutation = useMutation({
    mutationFn: (/** @type {any} */ { task, positive }) => djangoApi.tasks.complete(task.id, positive),
    onMutate: async ({ task, positive }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData(["tasks"]);
      return { previousTasks };
    },
    onSuccess: (/** @type {any} */ res, /** @type {any} */ { task, positive }) => {
      console.log("--> RAW BACKEND RESPONSE:", res);
      console.log("--> PENALTY VALUE:", res?.penalty?.hp);

      if (res?.profile) {
        queryClient.setQueryData(["userprofile"], res.profile);
      }

      if (positive) {
        playSound('habit_positive');
        success();

        const xpEarned = res?.xp_earned > 0 ? res.xp_earned : 0;
        const goldEarned = res?.gold_earned > 0 ? res.gold_earned : 0;
        const combatResult = res?.combat;
        const bossDmg = combatResult?.damage_dealt || 0;
        const effectNotes = combatResult?.effect_notes || [];
        const isCrit = res?.gamification_result?.is_crit || false;
        const itemDropped = res?.gamification_result?.item_dropped || null;

        onRankXP?.(xpEarned);
        if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard', combatResult?.boss_defeated, combatResult, res?.rewards);

        playSound('gold_earned');
        showRewardToast({ xp: xpEarned, gold: goldEarned, boss: bossDmg, effectNotes, label: task.name, isCrit, itemDropped });
      } else {
        playSound('habit_negative');
        error();

        let dmg = 0;
        // Check !== undefined to correctly parse exactly 0 if backend sent it, otherwise use actual damage
        if (res?.penalty?.hp !== undefined) {
          dmg = Math.round(Math.abs(res.penalty.hp));
        }

        if (dmg > 0) {
          showRewardToast({ label: `${task.name}: -${dmg} HP` });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["combat_encounters"] });
    },
    onError: (error, variables, context) => {
      console.error('Django habit complete failed:', error);
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const errorMsg = error?.["data"]?.detail || error.message || "Task could not be updated on server";
      showRewardToast({ label: `Error: ${errorMsg}` });
    }
  });

  const habitClick = (task, positive) => {
    if (task.id > 1000000000 || typeof task.id === 'string') {
      console.error('Task has a local frontend ID. Cannot complete on server. ID:', task.id);
      showRewardToast({ label: `Error: Task is out of sync. Please refresh.` });
      // Remove this invalid task locally
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      return;
    }

    console.log('Sending habit complete for ID:', task.id);
    completeMutation.mutate({ task, positive });
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      console.warn('Django habit delete failed:', e);
    }
  };

  return (
    <div className="flex flex-col rounded-none border-x-0 mx-0 w-full md:rounded-xl md:border-x md:mx-auto md:max-w-2xl border-y overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-red, #f74e52)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>HABITS</span>
        <button onClick={onAddClick} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Death banner */}
      <AnimatePresence>
      </AnimatePresence>

      {/* Task list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div 
          className="flex-1 p-3 space-y-2" 
          style={{ background: 'var(--habit-panel)', minHeight: 120 }}
        >
          <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🌱</div>
                <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>{t('dashboard.no_habits')}</div>
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
                    completeMutation={completeMutation}
                    deleteTask={deleteTask}
                    onEdit={handleEdit}
                    t={t}
                    habitClick={habitClick}
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