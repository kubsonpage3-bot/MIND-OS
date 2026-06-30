import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { playSound } from '@/lib/soundEffects.js';
import { useHaptic } from '@/hooks/useHaptic';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import {
  getTaskValueColor,
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



function getDayStartHour() {
  try {
    const s = JSON.parse(localStorage.getItem('mindos_settings') || '{}');
    return s.dayStartHour || 0;
  } catch { return 0; }
}

export default function DailiesColumn({ dailies, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const { success, error } = useHaptic();
  const tasks = dailies;
  const [cronMsg, setCronMsg] = useState(null);
  const [deathMsg, setDeathMsg] = useState(null);

  // Запускаем cron при монтировании
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
            const missedCount = res.log.filter(l => l.type === 'daily_missed').length;
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
  }, []);



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

      playSound(isCompleting ? 'task_complete' : 'habit_negative');
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
          id: dt.id, type: dt.task_type || 'daily', name: dt.title || 'Task', category: 'Coding',
          difficulty: dt.difficulty || 'medium', notes: dt.notes || '', done: dt.is_completed || false,
          is_completed: dt.is_completed || false, completedToday: dt.is_completed || false,
          last_completed_at: dt.last_completed_at || null, rpgValue: dt.value || 0, value: dt.value || 0,
          streak: dt.streak || 0, posStreak: dt.pos_streak || 0, negStreak: dt.neg_streak || 0, createdAt: dt.created_at,
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
      const bossDmg = combatResult?.damage_dealt || applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);
      const effectNotes = combatResult?.effect_notes || [];
      const isCrit = res?.gamification_result?.is_crit || false;
      const itemDropped = res?.gamification_result?.item_dropped || null;

      if (isCompleting) {
        onRankXP?.(xpEarned);
        if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard', combatResult?.boss_defeated, combatResult, res?.rewards);
        playSound('gold_earned');
        showRewardToast({ xp: xpEarned, gold: goldEarned, boss: bossDmg, effectNotes, label: task.name, isCrit, itemDropped });
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
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-purple)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>DAILIES</span>
        <button onClick={onAddClick} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Cron notification */}
      <AnimatePresence>
        {cronMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 text-center text-xs"
            style={{ background: '#1a1a2e', color: '#ff9800', fontFamily: "'Pixeltype'", fontSize: 7, lineHeight: 1.6 }}
          >
            {cronMsg}
          </motion.div>
        )}
        {deathMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-3 py-2 text-center"
            style={{ background: '#1a0000', color: '#ff4444', fontFamily: "'Pixeltype'", fontSize: 7 }}
          >
            {deathMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      <div className="flex-1 p-3 space-y-2" style={{ background: 'var(--habit-panel)', minHeight: 120 }}>
        {tasks.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📅</div>
            <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>No dailies yet. Add a routine!</div>
          </div>
        )}
        <AnimatePresence>
          {tasks.map(task => {
            const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
            const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
            const tv = task.value ?? task.rpgValue ?? 0;
            const tvColor = getTaskValueColor(tv);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: task.is_completed ? 0.5 : 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className={`flex items-center gap-2 rounded-xl p-2.5 cursor-pointer ${task.is_completed ? '' : 'task-card bg-white dark:bg-gray-900'}`}
                style={{
                  border: '1px solid var(--habit-border)'
                }}
                onClick={() => {
                  if (completeMutation.isPending && completeMutation.variables?.task?.id === task.id) return;
                  completeDaily(task);
                }}
              >
                {/* Task Value bar */}
                {!task.is_completed && (
                  <motion.div
                    animate={{ background: tvColor }}
                    transition={{ duration: 0.6 }}
                    style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}
                    title={`Task Value: ${tv.toFixed(1)}`}
                  />
                )}

                {/* Checkbox */}
                <div className="shrink-0">
                  {task.is_completed
                    ? <CheckSquare size={20} strokeWidth={2} style={{ color: 'var(--habit-purple)' }} />
                    : <Square size={20} strokeWidth={2} style={{ color: 'var(--habit-dim)' }} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${task.is_completed ? '' : 'text-gray-900 dark:text-gray-100'}`} style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: task.is_completed ? 'var(--habit-dim)' : undefined,
                    textDecoration: task.is_completed ? 'line-through' : 'none',
                  }}>
                    {task.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{task.category}</span>
                    <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
                    {(task.streak || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400">
                        <Flame size={9} />
                        {task.streak}
                      </span>
                    )}
                    <span className="text-[10px] font-mono" style={{ color: tvColor }}>
                      TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
                    </span>
                  </div>
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