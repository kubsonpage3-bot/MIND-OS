// @ts-nocheck
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
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
import ConfirmDeleteButton from './ConfirmDeleteButton';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { useLongPress } from '@/hooks/useLongPress';
import { usePixelBurst, PixelBurstLayer } from '@/components/mindos/PixelParticles';

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

function TaskItemRow({ task, completeMutation, deleteTask, onEdit, t, habitClick }) {
  const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
  const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
  const tv = task.value ?? task.rpgValue ?? 0;
  const tvColor = getTaskValueColor(tv);
  const con = getConStat();
  const nextDmg = previewHabitDamage(tv, task.difficulty || 'medium', con);

  const { bursts, trigger: triggerBurst } = usePixelBurst();
  const longPressProps = useLongPress(() => onEdit(task));

  return (
    <motion.div
      className={`relative flex-1 min-w-0 flex items-center gap-2.5 rounded-xl pr-3 overflow-hidden cursor-pointer transition-all duration-200 group ${
        task.is_completed ? 'opacity-40' : 'bg-[var(--habit-panel)] hover:bg-[var(--habit-panel)]/95 shadow-[0_2px_12px_rgba(0,0,0,0.2)]'
      }`}
      style={{
        border: '1px solid var(--habit-border)',
        ...longPressProps.style
      }}
      whileHover={{ y: -1, borderColor: `${accentColor}50` }}
      {...longPressProps}
    >
      {/* Pixel burst overlay */}
      <PixelBurstLayer bursts={bursts} />

      {/* Tactile + / - buttons on left edge */}
      <div className="flex flex-col shrink-0 w-9 self-stretch border-r border-white/5 overflow-hidden">
        <motion.button
          whileTap={{ scale: 0.90 }}
          onClick={(e) => {
            e.stopPropagation();
            if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
            triggerBurst(accentColor, 10);
            habitClick(task, true);
          }}
          className="flex-1 flex items-center justify-center font-bold text-sm bg-emerald-500/15 hover:bg-emerald-500/30 active:bg-emerald-500/45 text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer border-b border-white/5"
          style={{ opacity: completeMutation.isPending && completeMutation.variables?.task?.id === task.id ? 0.5 : 1 }}
          title="Positive Habit (+)"
        >
          +
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.90 }}
          onClick={(e) => {
            e.stopPropagation();
            if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
            triggerBurst('#f43f5e', 10);
            habitClick(task, false);
          }}
          className="flex-1 flex items-center justify-center font-bold text-sm bg-rose-500/15 hover:bg-rose-500/30 active:bg-rose-500/45 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
          style={{ opacity: completeMutation.isPending && completeMutation.variables?.task?.id === task.id ? 0.5 : 1 }}
          title="Negative Habit (-)"
        >
          −
        </motion.button>
      </div>

      <DragHandle />

      {/* Task Value color bar */}
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

      {/* Info */}
      <div className="flex-1 min-w-0 py-2.5">
        <div className="truncate flex items-center gap-1.5 text-slate-100 font-bold text-sm tracking-tight">
          <span className="truncate">{task.name}</span>
          {task.posStreak >= 5 && <span className="text-xs" title={`Hot streak: ${task.posStreak}!`}>🔥</span>}
          {task.negStreak >= 5 && <span className="text-xs" title={`Neg streak: ${task.negStreak}!`}>💀</span>}
        </div>

        {/* Metadata row */}
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

          <span className="text-[9.5px] font-mono font-bold" style={{ color: tvColor }}>
            TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
          </span>
        </div>

        {/* Streaks + next damage preview */}
        <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono">
          <div className="flex gap-2.5 font-bold">
            <span className="text-emerald-400 flex items-center gap-0.5">+{task.posStreak || 0}</span>
            <span className="text-rose-400 flex items-center gap-0.5">−{task.negStreak || 0}</span>
          </div>
          {(task.negStreak || 0) > 0 && (
            <span className="text-amber-400 font-semibold">
              next: -{Math.round(nextDmg * 10) / 10} HP
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <div className="shrink-0 flex items-center h-full ml-1">
        <ConfirmDeleteButton onDelete={() => deleteTask(task.id)} />
      </div>
    </motion.div>
  );
}




const taskComparator = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || ((a.id ?? 0) - (b.id ?? 0));

export default function HabitsColumn({ habits, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { success, error } = useHaptic();
  // Strictly deterministic sorting by order, then id
  const tasks = useMemo(
    () => [...habits].sort(taskComparator),
    [habits]
  );

  const { profile } = useDjangoAuth();
  const hp = profile?.hp ?? 100;
  const maxHp = profile?.hp_max ?? 100;

  const sensors = useTaskDndSensors();
  const [activeId, setActiveId] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Other', difficulty: 'medium',
    notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
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

      const columnType = 'habit';
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
                value: res?.value ?? res?.rpgValue ?? t.value,
                rpgValue: res?.value ?? res?.rpgValue ?? t.rpgValue,
              }
            : t
        );
      });
      setShowForm(false);
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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

      if (res?.task) {
        const dt = res.task;
        queryClient.setQueryData(["tasks"], (old) => {
          if (!old) return old;
          const list = Array.isArray(old) ? old : (old?.results ?? []);
          const updated = list.map((t) =>
            t.id === dt.id
              ? {
                  ...t,
                  value: dt.value ?? t.value,
                  rpgValue: dt.value ?? t.rpgValue,
                  streak: dt.streak ?? t.streak,
                  posStreak: dt.pos_streak ?? t.posStreak,
                  negStreak: dt.neg_streak ?? t.negStreak,
                }
              : t
          );
          return Array.isArray(old) ? updated : { ...old, results: updated };
        });
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
        const bossDefeated = combatResult?.boss_defeated || false;
        const bossGold = combatResult?.rewards?.boss_gold || res?.rewards?.boss_gold || 0;
        const bossXp = combatResult?.rewards?.boss_xp || res?.rewards?.boss_xp || 0;

        onRankXP?.(xpEarned);
        if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard', bossDefeated, combatResult, res?.rewards);

        playSound('gold_earned');
        showRewardToast({
          xp: xpEarned,
          gold: goldEarned,
          boss: bossDmg,
          effectNotes,
          label: task.name,
          isCrit,
          itemDropped,
          bossDefeated,
          bossGold,
          bossXp,
        });
      } else {
        playSound('habit_negative');
        error();

        let dmg = 0;
        // Check !== undefined to correctly parse exactly 0 if backend sent it, otherwise use actual damage
        if (res?.penalty?.hp !== undefined) {
          dmg = Math.round(Math.abs(res.penalty.hp));
        }

        if (dmg > 0) {
          showRewardToast({ label: `${task.name}: -${dmg} HP`, type: 'error' });
        } else {
          showRewardToast({ label: `${task.name}: 0 HP (Defended)`, type: 'error' });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["activityHistory"] });
      queryClient.invalidateQueries({ queryKey: ["combat_encounters"] });
      queryClient.invalidateQueries({ queryKey: ["active_effects"] });
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
    <div className="flex flex-col rounded-2xl border w-full mx-auto overflow-hidden bg-[var(--habit-panel)]/95 backdrop-blur-md border-rose-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-rose-500/30 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(225,29,72,0.25) 0%, rgba(159,18,57,0.15) 50%, rgba(15,10,20,0.8) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.35)] shrink-0 overflow-hidden p-0.5">
            <img 
              src="/images/tasks/task_habit_lightning.png" 
              alt="Habits" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]" 
            />
          </div>
          <span className="font-pixel text-xs font-bold tracking-wider text-rose-300 uppercase">
            {String(t('lifeos_columns.habits', 'HABITS')).replace(/^[\p{Emoji}\s]+/u, '')}
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            {tasks.length}
          </span>
        </div>
        <button 
          onClick={onAddClick} 
          className="w-7 h-7 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-[0_0_8px_rgba(244,63,94,0.2)] hover:scale-105"
          title={t('task_modal.new_habit', 'Add Habit')}
        >
          <Plus size={14} strokeWidth={2.5} />
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
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-rose-500/30 bg-rose-950/20 backdrop-blur-xs flex flex-col items-center justify-center gap-3 my-2 shadow-[0_0_20px_rgba(244,63,94,0.08)]">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <img src="/images/tasks/task_habit_lightning.png" alt="Habits" className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-mono text-xs font-bold text-rose-200 tracking-wider uppercase">
                    ⚡ {t('empty_state.habits_title', 'No active habits yet')}
                  </h4>
                  <p className="font-mono text-[11px] text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                    {t('empty_state.habits_desc', 'Hit + when you do the right thing, or - when you slip. Build your positive streak.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onAddClick || (() => { setEditingTask(null); setShowForm(true); })}
                  className="mt-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all active:scale-95 shadow-[0_0_12px_rgba(244,63,94,0.4)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>{t('empty_state.add_habit', '+ Forge First Habit')}</span>
                </button>
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