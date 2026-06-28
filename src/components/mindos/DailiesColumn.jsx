import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { playSound } from '@/lib/soundEffects.js';
import { queueAutoSync } from '@/lib/cloudSync';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { applyBuffPipeline } from '@/lib/rpgEngine';
import { getActiveBuffs } from '@/lib/gameState';
import {
  getTaskValueColor, calcReward, getLckStat,
  checkAndRunDailyCron,
} from '@/lib/taskEngine';
import { djangoApi } from '@/api/djangoClient';

const DIFFICULTIES = [
  { id: 'easy',     label: 'Easy',     color: '#22c55e' },
  { id: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { id: 'hard',     label: 'Hard',     color: '#ef4444' },
  { id: 'critical', label: 'Critical', color: '#a855f7' },
];

const CATEGORY_COLORS = {
  Math: '#3b82f6', Physics: '#3b82f6', Coding: '#3b82f6',
  English: '#00cc88', Reading: '#22c55e', Philosophy: '#22c55e',
  Exercise: '#ef4444', Sleep: '#f59e0b', Nutrition: '#f59e0b',
  Social: '#a855f7', Mindfulness: '#9944ff',
};

const TASK_BOSS_DAMAGE = { easy: 25, medium: 50, hard: 75, critical: 100 };

function loadTasks() {
  try { return JSON.parse(localStorage.getItem('mindos_tasks') || '[]'); } catch { return []; }
}
function saveTasks(tasks) { localStorage.setItem('mindos_tasks', JSON.stringify(tasks)); queueAutoSync(); }

function getDayStartHour() {
  try {
    const s = JSON.parse(localStorage.getItem('mindos_settings') || '{}');
    return s.dayStartHour || 0;
  } catch { return 0; }
}

export default function DailiesColumn({ onXpGain, onBossDamage, onRankXP }) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState(() => loadTasks().filter(t => t.type === 'daily'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'daily', category: 'Math', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });
  const [formType, setFormType] = useState('daily');
  const [cronMsg, setCronMsg] = useState(null);
  const [deathMsg, setDeathMsg] = useState(null);

  // Запускаем cron при монтировании
  useEffect(() => {
    const dayStartHour = getDayStartHour();
    const result = checkAndRunDailyCron(dayStartHour);
    if (result.fired && result.totalDmg > 0) {
      const missed = result.log.filter(l => l.type === 'daily_missed');
      setCronMsg(`🌙 New day: -${Math.round(result.totalDmg * 10) / 10} HP for ${missed.length} missed daily task(s)`);
      setTimeout(() => setCronMsg(null), 6000);
      if (result.died) {
        setDeathMsg('💀 You died from accumulated damage! -1 Level.');
        setTimeout(() => setDeathMsg(null), 8000);
      }
      // Перезагружаем задачи после крона
      setTasks(loadTasks().filter(t => t.type === 'daily'));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(loadTasks().filter(t => t.type === 'daily'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const update = (dailies) => {
    const all = loadTasks();
    saveTasks([...all.filter(t => t.type !== 'daily'), ...dailies]);
    setTasks(dailies);
  };

  const createTask = async () => {
    if (!form.name.trim()) return;

    let djangoId = Date.now();
    try {
      const created = await djangoApi.tasks.create({
        title: form.name,
        task_type: 'daily',
        difficulty: form.difficulty,
        notes: form.notes || '',
      });
      if (created?.id) djangoId = created.id;
    } catch (e) {
      console.warn('Django daily create failed:', e);
    }

    const task = {
      id: djangoId, type: 'daily', name: form.name, category: form.category,
      difficulty: form.difficulty, notes: form.notes, priority: form.priority,
      completedToday: false,
      streak: 0,         // streak по этой конкретной задаче
      rpgValue: 0,       // Task Value
      createdAt: new Date().toISOString(),
    };
    update([...tasks, task]);
    setShowForm(false);
    setForm({ name: '', type: 'daily', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
  };

  const completeDaily = async (task) => {
    const isCompleting = !task.completedToday;
    playSound(isCompleting ? 'task_complete' : 'habit_negative');

    let combatResult = null;
    let xpEarned = 0;
    let goldEarned = 0;

    try {
      const res = await djangoApi.tasks.complete(task.id, isCompleting);
      if (res && res.combat) {
        combatResult = res.combat;
      }
      if (res && res.xp_earned) xpEarned = res.xp_earned;
      if (res && res.gold_earned) goldEarned = res.gold_earned;
      if (res && res.profile) {
        queryClient.setQueryData(["userprofile"], res.profile);
      }
    } catch (e) {
      console.warn('Django daily complete failed:', e);
    }

    const { combinedEffects } = applyBuffPipeline(getActiveBuffs());
    const tv = task.rpgValue ?? 0;
    const lck = getLckStat();

    // Локальный фолбек для наград
    const reward = calcReward(tv, task.difficulty || 'medium', 'daily', {
      xpBonus: combinedEffects.xpBonus || 0,
      goldBonus: combinedEffects.goldBonus || 0,
      lckStat: lck,
    });

    const finalXp = xpEarned > 0 ? xpEarned : Math.round(reward.xp);
    const finalGold = goldEarned > 0 ? goldEarned : Math.round(reward.gold);

    const bossDmg = combatResult?.damage_dealt || applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);
    const effectNotes = combatResult?.effect_notes || [];

    if (isCompleting) {
      onRankXP?.(finalXp);
      if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard' || task.difficulty === 'critical', combatResult?.boss_defeated);

      const critLabel = reward.critBonus > 0 ? ' ✨CRIT' : '';
      playSound('gold_earned');
      showRewardToast({ xp: finalXp, gold: finalGold, boss: bossDmg, effectNotes, label: task.name + critLabel });
    } else {
      onRankXP?.(-finalXp);
      showRewardToast({ label: `Reverted: ${task.name}` });
    }

    update(tasks.map(t => t.id === task.id ? { ...t, completedToday: isCompleting } : t));
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
    } catch (e) {
      console.warn('Django daily delete failed:', e);
    }
    update(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-purple)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>DAILIES</span>
        <button onClick={() => setShowForm(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Cron notification */}
      <AnimatePresence>
        {cronMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 text-center text-xs"
            style={{ background: '#1a1a2e', color: '#ff9800', fontFamily: "'Press Start 2P'", fontSize: 7, lineHeight: 1.6 }}
          >
            {cronMsg}
          </motion.div>
        )}
        {deathMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-3 py-2 text-center"
            style={{ background: '#1a0000', color: '#ff4444', fontFamily: "'Press Start 2P'", fontSize: 7 }}
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
            const tv = task.rpgValue ?? 0;
            const tvColor = getTaskValueColor(tv);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: task.completedToday ? 0.5 : 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className={`flex items-center gap-2 rounded-xl p-2.5 cursor-pointer ${task.completedToday ? '' : 'task-card'}`}
                style={{
                  background: task.completedToday ? 'transparent' : '#000',
                  border: '1px solid var(--habit-border)'
                }}
                onClick={() => completeDaily(task)}
              >
                {/* Task Value bar */}
                {!task.completedToday && (
                  <motion.div
                    animate={{ background: tvColor }}
                    transition={{ duration: 0.6 }}
                    style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}
                    title={`Task Value: ${tv.toFixed(1)}`}
                  />
                )}

                {/* Checkbox */}
                <div className="shrink-0">
                  {task.completedToday
                    ? <CheckSquare size={20} strokeWidth={2} style={{ color: 'var(--habit-purple)' }} />
                    : <Square size={20} strokeWidth={2} style={{ color: 'var(--habit-dim)' }} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: task.completedToday ? 'var(--habit-dim)' : 'var(--habit-text)',
                    textDecoration: task.completedToday ? 'line-through' : 'none',
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

      <CreateTaskModal isOpen={showForm} onClose={() => setShowForm(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </div>
  );
}