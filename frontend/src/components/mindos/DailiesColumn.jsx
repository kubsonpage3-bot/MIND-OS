// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckSquare, Square, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { playSound } from '@/lib/soundEffects.js';
import { useHaptic } from '@/hooks/useHaptic';
import { showRewardToast } from '@/components/mindos/RewardToast';
import { djangoApi } from '@/api/djangoClient';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTaskDndSensors } from '../../utils/dndConfig';
import { SortableTaskItem, DragHandle } from './SortableTaskItem';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
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

function TaskItemRow({ task, completeMutation, deleteTask, onEdit, t, completeDaily }) {
  const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
  const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
  const tv = task.value ?? task.rpgValue ?? 0;
  const tvColor = getTaskValueColor(tv);
  const { bursts, trigger: triggerBurst } = usePixelBurst();
  const [justCompleted, setJustCompleted] = useState(false);

  const isScheduledToday = (() => {
    if (task.repeat_weekdays === undefined || task.repeat_weekdays === null) return true;
    const jsDay = new Date().getDay();
    const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1;
    const flag = 1 << pythonWeekday;
    return (task.repeat_weekdays & flag) > 0;
  })();

  const handleComplete = () => {
    if (!isScheduledToday) return;
    if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
    if (!task.is_completed) {
      triggerBurst(accentColor, 12);
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 700);
    }
    completeDaily(task);
  };

  const longPressProps = useLongPress(
    () => onEdit(task),
    handleComplete,
  );

  return (
    <motion.div
      className={`relative flex-1 min-w-0 flex items-center gap-2.5 rounded-xl pr-3 overflow-hidden transition-all duration-200 group ${
        !isScheduledToday
          ? 'opacity-40 cursor-default'
          : task.is_completed
          ? 'opacity-50 cursor-pointer bg-[var(--habit-panel)]/60'
          : 'task-card bg-[var(--habit-panel)] hover:bg-[var(--habit-panel)]/95 shadow-[0_2px_12px_rgba(0,0,0,0.2)] cursor-pointer'
      }`}
      style={{
        border: justCompleted 
          ? `1px solid ${accentColor}` 
          : task.is_completed
            ? '1px solid rgba(255,255,255,0.05)'
            : '1px solid var(--habit-border)',
        boxShadow: justCompleted ? `0 0 16px ${accentColor}55` : undefined,
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
        ...longPressProps.style,
      }}
      whileHover={isScheduledToday ? { y: -1, borderColor: `${accentColor}50` } : {}}
      animate={justCompleted ? { scale: [1, 1.03, 0.98, 1] } : {}}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      {...longPressProps}
    >
      {/* Pixel burst overlay */}
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
        style={{ color: task.is_completed ? accentColor : 'var(--habit-dim)' }}
      >
        {task.is_completed ? (
          <CheckSquare size={19} strokeWidth={2.2} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
        ) : (
          <Square size={19} strokeWidth={1.8} className="text-slate-400 hover:text-purple-300 transition-colors" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1 py-2.5 overflow-hidden">
        <div className={`font-bold text-sm truncate tracking-tight ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
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

          {(task.streak || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[9.5px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              <Flame size={11} strokeWidth={2.5} className="text-amber-400" />
              <span>{task.streak}</span>
            </span>
          )}

          {tv !== 0 && (
            <span className="text-[9.5px] font-mono font-bold" style={{ color: tvColor }}>
              TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
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

export default function DailiesColumn({ dailies, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { success, error } = useHaptic();
  // Strictly deterministic sorting by order, then id
  const tasks = useMemo(
    () => [...dailies].sort(taskComparator),
    [dailies]
  );
  const [cronMsg, setCronMsg] = useState(null);
  const [deathMsg, setDeathMsg] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'daily', category: 'Other', difficulty: 'medium',
    notes: '', dueDate: '', scheduledTime: '', scheduledEndTime: '', showInCalendar: false, repeatWeekdays: 127,
  });
  const [formType, setFormType] = useState('daily');
  const [editingTask, setEditingTask] = useState(null);

  // Запускаем cron при монтировании и при возвращении в приложение (смена вкладки)
  useEffect(() => {
    const runCron = async () => {
      try {
        const res = await djangoApi.tasks.processMissed();
        if (res.fired) {
          if (res.profile) {
            queryClient.setQueryData(["userprofile"], res.profile);
          }
          
          // Синхронизируем задачи с бэкенда
          queryClient.invalidateQueries({ queryKey: ["tasks"] });

          if (res.total_dmg > 0) {
            const missedCount = (res.log || []).filter(l => l.type === 'daily_missed').length;
            setCronMsg(`🌙 New day: -${Math.round(res.total_dmg * 10) / 10} HP for ${missedCount} missed daily task(s)`);
            setTimeout(() => setCronMsg(null), 6000);
            
            if (res.died) {
              setDeathMsg('💀 You died from accumulated damage! HP restored, Rank demoted.');
              setTimeout(() => setDeathMsg(null), 8000);
              playSound('death');
            }
          }
        }
      } catch (e) {
        console.error("Failed to execute daily cron on backend:", e);
      }
    };
    
    runCron();

    // Запускаем при возвращении на вкладку (если прошел час с последнего запуска или настал новый день)
    let lastRun = Date.now();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRun > 1000 * 60 * 60) { // 1 час
          lastRun = now;
          runCron();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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

    queryClient.setQueryData(["tasks"], (/** @type {any[]} */ oldTasks) => {
      if (!oldTasks) return oldTasks;
      const normalized = Array.isArray(oldTasks) ? oldTasks : (oldTasks?.results ?? []);
      const newTasks = [...normalized];

      const columnType = 'daily';
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
      type: task.type || 'daily',
      category: task.category || 'Other',
      difficulty: task.difficulty || 'medium',
      notes: task.notes || '',
      dueDate: task.due_date || '',
      scheduledTime: task.scheduled_time || '',
      scheduledEndTime: task.scheduled_end_time || '',
      showInCalendar: task.show_in_calendar || false,
      repeatWeekdays: task.repeat_weekdays !== undefined ? task.repeat_weekdays : 127,
    });
    setFormType(task.type || 'daily');
    setEditingTask(task);
    setShowForm(true);
  };


  const completeMutation = useMutation({
    mutationFn: async (/** @type {{task: any, isCompleting: boolean}} */ { task, isCompleting }) => {
      const res = await djangoApi.tasks.complete(task.id, isCompleting);
      return { res, task, isCompleting };
    },
    onMutate: async (/** @type {{task: any, isCompleting: boolean}} */ { task, isCompleting }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData(["tasks"]);

      // Optimistic Update
      queryClient.setQueryData(["tasks"], (/** @type {any} */ old) => {
        if (!old) return old;
        const patchedTask = {
          ...task,
          is_completed: isCompleting,
          done: isCompleting,
          completedToday: isCompleting
        };
        if (Array.isArray(old)) {
          return old.map((t) => (t.id === task.id ? patchedTask : t));
        }
        if (old.results) {
          return { ...old, results: old.results.map((t) => (t.id === task.id ? patchedTask : t)) };
        }
        return old;
      });

      playSound(isCompleting ? 'daily_complete' : 'habit_negative');
      if (isCompleting) {
        success();
      } else {
        error();
      }

      return { previousTasks };
    },
    onError: (/** @type {any} */ err, variables, context) => {
      queryClient.setQueryData(["tasks"], context.previousTasks);
      const errorMsg = err.data?.detail || err.message || "Task could not be updated on server";
      showRewardToast({ label: `Error: ${errorMsg}` });
    },
    onSuccess: (/** @type {any} */ { res, task, isCompleting }) => {
      if (res?.profile) queryClient.setQueryData(["userprofile"], res.profile);
      
      // Update cache with authoritative response
      if (res?.task) {
        const dt = res.task;
        const patchedTask = {
          ...task,
          id: dt.id, type: dt.task_type || task.type || 'daily', name: dt.title || task.name || 'Task', category: dt.category || task.category || 'Coding',
          difficulty: dt.difficulty || task.difficulty || 'medium', notes: dt.notes !== undefined ? dt.notes : (task.notes || ''), done: dt.is_completed || false,
          is_completed: dt.is_completed || false, completedToday: dt.is_completed || false,
          last_completed_at: dt.last_completed_at || task.last_completed_at || null, rpgValue: dt.value || task.rpgValue || 0, value: dt.value || task.value || 0,
          streak: dt.streak || task.streak || 0, posStreak: dt.pos_streak || task.posStreak || 0, negStreak: dt.neg_streak || task.negStreak || 0, createdAt: dt.created_at || task.createdAt,
        };
        queryClient.setQueryData(["tasks"], (/** @type {any} */ old) => {
          if (!old) return old;
          if (Array.isArray(old)) return old.map((t) => (t.id === patchedTask.id ? patchedTask : t));
          if (old.results) return { ...old, results: old.results.map((t) => (t.id === patchedTask.id ? patchedTask : t)) };
          return old;
        });
      }

      // Handle rewards
      const combatResult = res?.combat;
      const xpEarned = res?.xp_earned || 0;
      const goldEarned = res?.gold_earned || 0;
      const bossDmg = combatResult?.damage_dealt || 0;
      const effectNotes = combatResult?.effect_notes || [];
      const isCrit = res?.gamification_result?.is_crit || false;
      const itemDropped = res?.gamification_result?.item_dropped || null;
      const bossDefeated = combatResult?.boss_defeated || false;
      const bossGold = combatResult?.rewards?.boss_gold || res?.rewards?.boss_gold || 0;
      const bossXp = combatResult?.rewards?.boss_xp || res?.rewards?.boss_xp || 0;

      if (isCompleting) {
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
        onRankXP?.(-xpEarned);
        showRewardToast({ label: `Reverted: ${task.name}` });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["activityHistory"] });
      queryClient.invalidateQueries({ queryKey: ["combat_encounters"] });
      queryClient.invalidateQueries({ queryKey: ["active_effects"] });
    }
  });

  const completeDaily = (task) => {
    if (task.id > 1000000000 || typeof task.id === 'string') {
      console.error('Task has a local frontend ID. Cannot complete on server. ID:', task.id);
      showRewardToast({ label: `Error: Task is out of sync. Please refresh.` });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      return;
    }
    const isCompleting = !task.is_completed;
    console.log(`[DAILY DEBUG] task.id=${task.id} task.is_completed=${task.is_completed} → sending is_positive=${isCompleting}`);
    completeMutation.mutate({ task, isCompleting });
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      console.warn('Django daily delete failed:', e);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border w-full mx-auto overflow-hidden bg-[var(--habit-panel)]/95 backdrop-blur-md border-purple-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-purple-500/30 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(147,51,234,0.25) 0%, rgba(107,33,168,0.15) 50%, rgba(15,10,20,0.8) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs shadow-[0_0_8px_rgba(168,85,247,0.3)]">
            🛡️
          </span>
          <span className="font-pixel text-xs font-bold tracking-wider text-purple-300 uppercase">
            {t('lifeos_columns.dailies', 'DAILIES')}
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {tasks.filter(t => t.is_completed).length}/{tasks.length}
          </span>
        </div>
        <button 
          onClick={onAddClick} 
          className="w-7 h-7 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-[0_0_8px_rgba(168,85,247,0.2)] hover:scale-105"
          title={t('task_modal.new_daily', 'Add Daily')}
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Cron notification */}
      <AnimatePresence>
        {cronMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 text-center text-xs"
            style={{ background: '#1a1a2e', color: '#ff9800', fontFamily: "'PixeloidSans'", fontSize: 7, lineHeight: 1.6 }}
          >
            {cronMsg}
          </motion.div>
        )}
        {deathMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-3 py-2 text-center"
            style={{ background: '#1a0000', color: '#ff4444', fontFamily: "'PixeloidSans'", fontSize: 7 }}
          >
            {deathMsg}
          </motion.div>
        )}
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
                <div className="text-4xl mb-2">📅</div>
                <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>{t('dashboard.no_dailies')}</div>
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
                    completeDaily={completeDaily}
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