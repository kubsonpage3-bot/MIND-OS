import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { playSound } from '@/lib/soundEffects.js';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import {
  getTaskValueColor, previewHabitDamage, getConStat,
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


export default function HabitsColumn({ habits, onXpGain, onBossDamage, onRankXP, onAddClick }) {
  const queryClient = useQueryClient();
  const tasks = habits;

  const { data: profile } = useQuery({ queryKey: ["userprofile"], queryFn: djangoApi.profile.get });
  const hp = profile?.hp ?? 100;
  const maxHp = profile?.hp_max ?? 100;

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

        const xpEarned = res?.xp_earned > 0 ? res.xp_earned : 0;
        const goldEarned = res?.gold_earned > 0 ? res.gold_earned : 0;
        const combatResult = res?.combat;
        const bossDmg = combatResult?.damage_dealt || applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);
        const effectNotes = combatResult?.effect_notes || [];
        const isCrit = res?.gamification_result?.is_crit || false;
        const itemDropped = res?.gamification_result?.item_dropped || null;

        onRankXP?.(xpEarned);
        if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard', combatResult?.boss_defeated, combatResult, res?.rewards);

        playSound('gold_earned');
        showRewardToast({ xp: xpEarned, gold: goldEarned, boss: bossDmg, effectNotes, label: task.name, isCrit, itemDropped });
      } else {
        playSound('habit_negative');

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
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
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
      <div className="flex-1 p-3 space-y-2" style={{ background: 'var(--habit-panel)', minHeight: 120 }}>
        {tasks.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">💪</div>
            <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>No habits yet. Build one!</div>
          </div>
        )}
        <AnimatePresence>
          {tasks.map(task => {
            const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
            const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
            const tv = task.value ?? task.rpgValue ?? 0;
            const tvColor = getTaskValueColor(tv);
            const con = getConStat();
            const nextDmg = previewHabitDamage(tv, task.difficulty || 'medium', con);
            const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
            const hpColor = hpPct <= 25 ? '#ef4444' : hpPct <= 60 ? '#f59e0b' : '#22c55e';

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}
                className="task-card flex items-center gap-2 rounded-xl p-2.5 bg-white dark:bg-gray-900"
                style={{ border: '1px solid var(--habit-border)' }}
              >
                {/* Task Value color bar */}
                <motion.div
                  animate={{ background: tvColor }}
                  transition={{ duration: 0.6 }}
                  style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{task.category}</span>
                    <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
                    <span className="text-[10px] font-mono" style={{ color: tvColor }}>
                      TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
                    </span>
                  </div>

                  {/* HP bar */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: '#f74e52', minWidth: 12 }}>HP</span>
                    <div className="flex-1 relative" style={{ height: 6, background: '#fee2e2', borderRadius: 2, overflow: 'hidden' }}>
                      <motion.div
                        animate={{ width: `${hpPct}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        style={{ height: '100%', background: hpColor, borderRadius: 2 }}
                      />
                    </div>
                    <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: '#878190', minWidth: 28, textAlign: 'right' }}>
                      {Math.round(hp)}/{maxHp}
                    </span>
                  </div>

                  {/* Streaks + next damage preview */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex gap-2">
                      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: '#22c55e' }}>+{task.posStreak || 0}</span>
                      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: '#ef4444' }}>−{task.negStreak || 0}</span>
                    </div>
                    {(task.negStreak || 0) > 0 && (
                      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: '#f59e0b' }}>
                        next: -{Math.round(nextDmg * 10) / 10}hp
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <div className="shrink-0">
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => deleteTask(task.id)} style={{ color: 'rgba(148,163,184,0.3)' }}>
                    <Trash2 size={11} strokeWidth={1.5} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}