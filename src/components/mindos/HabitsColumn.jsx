import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '@/lib/soundEffects.js';
import { queueAutoSync } from '@/lib/cloudSync';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { applyBuffPipeline } from '@/lib/rpgEngine';
import { getActiveBuffs } from '@/lib/gameState';
import {
  getTaskValueColor, calcNewValue, calcDamage, calcReward, previewHabitDamage,
  applyHpDamage, getHpState, getConStat, getLckStat,
  addGoldToGS, addManaToGS,
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

export default function HabitsColumn({ onXpGain, onBossDamage, onRankXP }) {
  const [tasks, setTasks] = useState(() => loadTasks().filter(t => t.type === 'habit'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'habit', category: 'Math', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });
  const [formType, setFormType] = useState('habit');
  const [hpState, setHpState] = useState(() => getHpState());
  const [deathMsg, setDeathMsg] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(loadTasks().filter(t => t.type === 'habit'));
      setHpState(getHpState());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const update = (habits) => {
    const all = loadTasks();
    saveTasks([...all.filter(t => t.type !== 'habit'), ...habits]);
    setTasks(habits);
  };

  const createTask = async () => {
    if (!form.name.trim()) return;

    let djangoId = Date.now();
    try {
      const created = await djangoApi.tasks.create({
        title: form.name,
        task_type: 'habit',
        difficulty: form.difficulty,
        notes: form.notes || '',
      });
      if (created?.id) djangoId = created.id;
    } catch (e) {
      console.warn('Django habit create failed:', e);
    }

    const task = {
      id: djangoId, type: 'habit', name: form.name, category: form.category,
      difficulty: form.difficulty, notes: form.notes, priority: form.priority,
      posStreak: 0, negStreak: 0, weekCount: 0,
      rpgValue: 0, // Task Value начинается с 0 (жёлтый)
      createdAt: new Date().toISOString(),
    };
    update([...tasks, task]);
    setShowForm(false);
    setForm({ name: '', type: 'habit', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
  };

  const habitClick = async (task, positive) => {
    try {
      await djangoApi.tasks.complete(task.id, positive);
    } catch (e) {
      console.warn('Django habit complete failed:', e);
    }

    const { combinedEffects } = applyBuffPipeline(getActiveBuffs());
    const tv = task.rpgValue ?? 0;
    const con = getConStat();
    const lck = getLckStat();

    if (positive) {
      playSound('habit_positive');

      // Награда масштабируется с Task Value
      const reward = calcReward(tv, task.difficulty || 'medium', 'habit', {
        xpBonus: combinedEffects.xpBonus || 0,
        goldBonus: combinedEffects.goldBonus || 0,
        lckStat: lck,
      });

      const bossDmg = applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);

      onXpGain(Math.round(reward.xp));
      onRankXP?.(Math.round(reward.xp));
      onBossDamage(bossDmg, task.difficulty === 'hard' || task.difficulty === 'critical');
      addGoldToGS(reward.gold);
      addManaToGS(2);

      const critLabel = reward.critBonus > 0 ? ' ✨CRIT' : '';
      playSound('gold_earned');
      showRewardToast({ xp: Math.round(reward.xp), gold: Math.round(reward.gold), boss: bossDmg, label: task.name + critLabel });

      // Value растёт (задача "синеет", будущая награда снижается)
      const newTv = calcNewValue(tv, 'complete', 'habit');
      update(tasks.map(t => t.id === task.id ? {
        ...t,
        rpgValue: newTv,
        posStreak: (t.posStreak || 0) + 1,
        negStreak: Math.max(0, (t.negStreak || 0) - 1),
        weekCount: (t.weekCount || 0) + 1,
      } : t));

    } else {
      playSound('habit_negative');

      // Урон зависит от текущего value ПОСЛЕ провала (прогрессия урона)
      const newTv = calcNewValue(tv, 'fail', 'habit');
      const dmg = combinedEffects.noFailDmg ? 0 : calcDamage(newTv, task.difficulty || 'medium', con);

      const result = applyHpDamage(dmg);
      setHpState(getHpState());

      if (result.died) {
        setDeathMsg(`💀 Вы погибли! -1 уровень. ${result.lostItem ? `Потеряно: ${result.lostItem}` : ''}`);
        setTimeout(() => setDeathMsg(null), 5000);
        playSound('death');
      }

      showRewardToast({ label: `${task.name}: -${Math.round(dmg * 10) / 10} HP` });

      // Value падает (задача "краснеет", следующий "-" будет бить сильнее)
      const newTvFail = calcNewValue(tv, 'fail', 'habit');
      update(tasks.map(t => t.id === task.id ? {
        ...t,
        rpgValue: newTvFail,
        negStreak: (t.negStreak || 0) + 1,
        posStreak: Math.max(0, (t.posStreak || 0) - 1),
      } : t));
    }

    setHpState(getHpState());
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
    } catch (e) {
      console.warn('Django habit delete failed:', e);
    }
    update(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[var(--habit-panel)] border border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-red, #f74e52)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>HABITS</span>
        <button onClick={() => setShowForm(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Death banner */}
      <AnimatePresence>
        {deathMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="px-3 py-2 text-center text-xs font-bold"
            style={{ background: '#1a0000', color: '#ff4444', fontFamily: "'Press Start 2P'", fontSize: 8 }}
          >
            {deathMsg}
          </motion.div>
        )}
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
            const tv = task.rpgValue ?? 0;
            const tvColor = getTaskValueColor(tv);
            const con = getConStat();
            const nextDmg = previewHabitDamage(tv, task.difficulty || 'medium', con);
            const hpPct = Math.max(0, Math.min(100, (hpState.hp / hpState.maxHp) * 100));
            const hpColor = hpPct <= 25 ? '#ef4444' : hpPct <= 60 ? '#f59e0b' : '#22c55e';

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}
                className="task-card flex items-center gap-2 rounded-xl p-2.5"
                style={{ background: '#000', border: '1px solid var(--habit-border)' }}
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
                    onClick={() => habitClick(task, true)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-base"
                    style={{ background: '#22c55e' }}
                  >+</motion.button>
                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={() => habitClick(task, false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-base"
                    style={{ background: '#ef4444', color: 'white' }}
                  >−</motion.button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14, color: 'var(--habit-text)' }}>
                    {task.name}
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
                      {Math.round(hpState.hp)}/{hpState.maxHp}
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

      <CreateTaskModal isOpen={showForm} onClose={() => setShowForm(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </div>
  );
}