import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, Clock } from 'lucide-react';
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
  getTaskValueColor, calcNewValue, calcReward,
  getLckStat,
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

export default function TodosColumn({ onXpGain, onBossDamage, onRankXP }) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState(() => {
    const raw = loadTasks().filter(t => t.type === 'todo');
    return decayOverdueTodos(raw);
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'todo', category: 'Math', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });
  const [formType, setFormType] = useState('todo');

  // Сохранить задекейнные задачи при монтировании
  useEffect(() => {
    const all = loadTasks();
    const decayed = decayOverdueTodos(all.filter(t => t.type === 'todo'));
    saveTasks([...all.filter(t => t.type !== 'todo'), ...decayed]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(loadTasks().filter(t => t.type === 'todo'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const update = (todos) => {
    const all = loadTasks();
    saveTasks([...all.filter(t => t.type !== 'todo'), ...todos]);
    setTasks(todos);
  };

  const createTask = async () => {
    if (!form.name.trim()) return;

    let djangoId = Date.now();
    try {
      const created = await djangoApi.tasks.create({
        title: form.name,
        task_type: 'todo',
        difficulty: form.difficulty,
        notes: form.notes || '',
      });
      if (created?.id) djangoId = created.id;
    } catch (e) {
      console.warn('Django task create failed:', e);
    }

    const task = {
      id: djangoId, type: 'todo', name: form.name, category: form.category,
      difficulty: form.difficulty, notes: form.notes, priority: form.priority,
      done: false, dueDate: form.dueDate,
      rpgValue: 0, // Task Value
      createdAt: new Date().toISOString(),
    };
    update([...tasks, task]);
    setShowForm(false);
    setForm({ name: '', type: 'todo', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
  };

  const completeTodo = async (task) => {
    const isCompleting = !task.done;
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
      console.warn('Django task complete failed:', e);
    }

    const { combinedEffects } = applyBuffPipeline(getActiveBuffs());
    const tv = task.rpgValue ?? 0;
    const lck = getLckStat();

    // Локальный фолбек для наград (чтобы UI обновлялся сразу, если бэкенд не вернул xp/gold)
    const reward = calcReward(tv, task.difficulty || 'medium', 'todo', {
      xpBonus: combinedEffects.xpBonus || 0,
      goldBonus: combinedEffects.goldBonus || 0,
      lckStat: lck,
    });

    const finalXp = xpEarned > 0 ? xpEarned : Math.round(reward.xp);
    const finalGold = goldEarned > 0 ? goldEarned : Math.round(reward.gold);
    
    // Используем данные с сервера, если есть
    const bossDmg = combatResult?.damage_dealt || applyBossDamageModifiers(TASK_BOSS_DAMAGE[task.difficulty] || 25);
    const effectNotes = combatResult?.effect_notes || [];

    if (isCompleting) {
      onRankXP?.(finalXp);
      if (bossDmg > 0) onBossDamage(bossDmg, task.difficulty === 'hard' || task.difficulty === 'critical', combatResult?.boss_defeated);

      const overdueLabel = isOverdue(task) ? ' ⚠️ late' : '';
      const critLabel = reward.critBonus > 0 ? ' ✨CRIT' : '';
      playSound('gold_earned');
      showRewardToast({ xp: finalXp, gold: finalGold, boss: bossDmg, effectNotes, label: task.name + overdueLabel + critLabel });
    } else {
      onRankXP?.(-finalXp);
      // При откате задачи урон боссу не откатывается на сервере
      showRewardToast({ label: `Reverted: ${task.name}` });
    }

    update(tasks.map(t => t.id === task.id ? { ...t, done: isCompleting } : t));
  };

  const deleteTask = async (id) => {
    try {
      await djangoApi.tasks.delete(id);
    } catch (e) {
      console.warn('Django task delete failed:', e);
    }
    update(tasks.filter(t => t.id !== id));
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
        <button onClick={() => setShowForm(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
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
                className={`flex items-center gap-2 rounded-xl p-2.5 cursor-pointer ${task.done ? '' : 'task-card'}`}
                style={{
                  background: task.done ? 'transparent' : '#000',
                  border: `1px solid ${overdue && !task.done ? 'var(--habit-red, #ef4444)' : 'var(--habit-border)'}`,
                }}
                onClick={() => completeTodo(task)}
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
                  <div className="truncate" style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: task.done ? 'var(--habit-dim)' : overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-text)',
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
                    <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: 'var(--habit-gold, #f59e0b)', marginTop: 3 }}>
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

      <CreateTaskModal isOpen={showForm} onClose={() => setShowForm(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </div>
  );
}