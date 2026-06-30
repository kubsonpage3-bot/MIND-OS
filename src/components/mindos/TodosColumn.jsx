import { Plus, Trash2, CheckSquare, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { playSound } from '@/lib/soundEffects.js';
import { useHaptic } from '@/hooks/useHaptic';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import {
  getTaskValueColor, calcNewValue,
} from '@/lib/taskEngine';
import { djangoApi } from '@/api/djangoClient';

const DIFFICULTIES = [
  { id: 'trivial',  label: 'Trivial',  color: '#64748b' },
  { id: 'easy',     label: 'Easy',     color: '#22c55e' },
  { id: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { id: 'hard',     label: 'Hard',     color: '#ef4444' },
];

const CATEGORY_COLORS = {
  Math: '#3b82f6', Physics: '#3b82f6', Coding: '#3b82f6',
  English: '#00cc88', Reading: '#22c55e', Philosophy: '#22c55e',
  Exercise: '#ef4444', Sleep: '#f59e0b', Nutrition: '#f59e0b',
  Social: '#a855f7', Mindfulness: '#9944ff',
};

const TASK_BOSS_DAMAGE = { trivial: 10, easy: 25, medium: 50, hard: 75 };



/** Проверяет, просрочен ли To-Do (есть dueDate и она в прошлом) */
function isOverdue(task) {
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < new Date();
}

/** Деградация value для просроченных To-Do (вызывается при монтировании) */
function decayOverdueTodos(todos) {
  const now = new Date();
  return todos.map(task => {
    if (task.done || !task.dueDate) return task;
    const due = new Date(task.dueDate);
    if (due >= now) return task;
    // Каждый пропущенный день снижает value на 1 шаг
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
    const lastDecayDay = task.lastDecayDay || 0;
    const newDecays = Math.max(0, daysOverdue - lastDecayDay);
    if (newDecays === 0) return task;
    let tv = task.rpgValue ?? 0;
    for (let i = 0; i < Math.min(newDecays, 5); i++) {
      tv = calcNewValue(tv, 'fail', 'todo');
    }
    return { ...task, rpgValue: tv, lastDecayDay: daysOverdue };
  });
}

export default function TodosColumn({ todos, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { success, error } = useHaptic();
  const tasks = decayOverdueTodos(todos);

  // Сохранить задекейнные задачи при монтировании

  const completeMutation = useMutation({
    mutationFn: async ({ task, isCompleting }) => {
      const res = await djangoApi.tasks.complete(task.id, isCompleting);
      return { res, task, isCompleting };
    },
    onMutate: async ({ task, isCompleting }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData(["tasks"]);

      queryClient.setQueryData(["tasks"], (old) => {
        if (!old) return old;
        const patchedTask = { ...task, done: isCompleting, is_completed: isCompleting };
        if (Array.isArray(old)) return old.map(t => t.id === task.id ? patchedTask : t);
        if (old.results) return { ...old, results: old.results.map(t => t.id === task.id ? patchedTask : t) };
        return old;
      });

      playSound(isCompleting ? 'task_complete' : 'habit_negative');
      if (isCompleting) {
        success();
      } else {
        error();
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["tasks"], context.previousTasks);
      const errorMsg = err.data?.detail || err.message || "Task could not be updated on server";
      showRewardToast({ label: `Error: ${errorMsg}` });
    },
    onSuccess: ({ res, task, isCompleting }) => {
      if (res?.profile) queryClient.setQueryData(["userprofile"], res.profile);
      
      const combatResult = res?.combat;
      const xpEarned = res?.xp_earned || 0;
      const goldEarned = res?.gold_earned || 0;
      const bossDmg = combatResult?.damage_dealt || applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);
      const effectNotes = combatResult?.effect_notes || [];
      const isCrit = res?.gamification_result?.is_crit || false;
      const itemDropped = res?.gamification_result?.item_dropped || null;

      if (isCompleting) {
        onRankXP?.(xpEarned);
        if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard', combatResult?.boss_defeated, combatResult, res?.rewards);
        const overdueLabel = isOverdue(task) ? ' ⏳ late' : '';
        playSound('gold_earned');
        showRewardToast({ xp: xpEarned, gold: goldEarned, boss: bossDmg, effectNotes, label: task.name + overdueLabel, isCrit, itemDropped });
      } else {
        onRankXP?.(-xpEarned);
        showRewardToast({ label: `Reverted: ${task.name}` });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
  });

  const completeTodo = (task) => {
    if (task.id > 1000000000 || typeof task.id === 'string') {
      console.error('Task has a local frontend ID. Cannot complete on server. ID:', task.id);
      showRewardToast({ label: `Error: Task is out of sync. Please refresh.` });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      return;
    }
    const isCompleting = !task.done;
    console.log('Sending todo complete for ID:', task.id);
    completeMutation.mutate({ task, isCompleting });
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      console.warn('Django task delete failed:', e);
    }
  };

  const activeTodos = tasks.filter(t => !t.done);
  const doneTodos = tasks.filter(t => t.done);

  // Сортировка: просроченные вверху
  const sortedActive = [...activeTodos].sort((a, b) => {
    const aOver = isOverdue(a) ? -1 : 0;
    const bOver = isOverdue(b) ? -1 : 0;
    return aOver - bOver;
  });

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-orange, #ff8800)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>TO-DOS</span>
        <button onClick={onAddClick} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 p-3 space-y-2" style={{ background: 'var(--habit-panel)', minHeight: 120 }}>
        {tasks.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📜</div>
            <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>No to-dos yet. Add a quest!</div>
          </div>
        )}
        <AnimatePresence>
          {[...sortedActive, ...doneTodos].map(task => {
            const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
            const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
            const tv = task.rpgValue ?? 0;
            const tvColor = getTaskValueColor(tv);
            const overdue = isOverdue(task);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: task.done ? 0.45 : 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className={`flex items-center gap-2 rounded-xl p-2.5 cursor-pointer ${task.done ? '' : 'task-card bg-white dark:bg-gray-900'}`}
                style={{
                  border: `1px solid ${overdue && !task.done ? 'var(--habit-red, #ef4444)' : 'var(--habit-border)'}`,
                }}
                onClick={() => {
                  if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
                  completeTodo(task);
                }}
              >
                {/* Task Value bar (только для активных) */}
                {!task.done && (
                  <motion.div
                    animate={{ background: tvColor }}
                    transition={{ duration: 0.6 }}
                    style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}
                    title={`Task Value: ${tv.toFixed(1)}`}
                  />
                )}

                {/* Checkbox */}
                <div className="shrink-0">
                  {task.done
                    ? <CheckSquare size={20} strokeWidth={2} style={{ color: 'var(--habit-orange, #ff8800)' }} />
                    : <Square size={20} strokeWidth={2} style={{ color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-dim)' }} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${task.done ? '' : overdue ? '' : 'text-gray-900 dark:text-gray-100'}`} style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: task.done ? 'var(--habit-dim)' : overdue ? 'var(--habit-red, #ef4444)' : undefined,
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}>
                    {task.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{task.category}</span>
                    <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
                    {/* Task Value — показывает, насколько упала награда */}
                    {!task.done && (
                      <span className="text-[10px] font-mono" style={{ color: tvColor }}>
                        TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
                      </span>
                    )}
                    {/* Due date */}
                    {task.dueDate && !task.done && (
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: overdue ? 'var(--habit-red)' : 'var(--habit-dim)' }}>
                        <Clock size={8} />
                        {new Date(task.dueDate).toLocaleDateString()}
                        {overdue && ' ⚠️'}
                      </span>
                    )}
                  </div>
                  {/* Предупреждение о снижении награды */}
                  {!task.done && tv < -5 && (
                    <div style={{ fontFamily: "'Pixeltype'", fontSize: 6, color: 'var(--habit-gold, #f59e0b)', marginTop: 3 }}>
                      reward -{ Math.round(Math.abs(tv) * 5) }%
                    </div>
                  )}
                </div>

                {/* Delete */}
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                  style={{ color: 'rgba(148,163,184,0.3)' }}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}