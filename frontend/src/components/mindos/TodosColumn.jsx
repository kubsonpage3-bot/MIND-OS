import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playSound } from '@/lib/soundEffects.js';
import { queueAutoSync } from '@/lib/cloudSync';
import { applyBossDamageModifiers } from '@/lib/mutatorEngine';
import { showRewardToast } from '@/components/mindos/RewardToast';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { applyBuffPipeline } from '@/lib/rpgEngine';
import { getActiveBuffs } from '@/lib/gameState';
import {
  getTaskValueColor, calcNewValue, calcReward,
  getLckStat, addGoldToGS, addManaToGS,
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

/** Проверяет, просрочен ли To-Do (есть due_date и она в прошлом) */
function isOverdue(task) {
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date();
}

export default function TodosColumn({ onXpGain, onBossDamage, onRankXP }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'todo', category: 'Math', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });
  const [formType, setFormType] = useState('todo');

  const { data: todosData, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: () => djangoApi.tasks.getAll({ task_type: 'todo' })
  });

  const tasks = Array.isArray(todosData) ? todosData : (todosData?.results || []);

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => djangoApi.tasks.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setShowForm(false);
      setForm({ name: '', type: 'todo', category: 'Math', difficulty: 'medium', notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false });
    }
  });

  const createTask = () => {
    if (!form.name.trim()) return;
    createTaskMutation.mutate({
      title: form.name,
      task_type: 'todo',
      category: form.category,
      difficulty: form.difficulty,
      notes: form.notes || '',
      due_date: form.dueDate || null,
    });
  };

  const toggleMutation = useMutation({
    mutationFn: (todoId) => djangoApi.tasks.toggle(todoId),
    onSuccess: (data) => {
      const sign = data.xp_change > 0 ? '+' : '';
      const icon = data.completed ? '✅' : '↩️';
      showRewardToast({
        xp: Math.abs(data.xp_change),
        gold: Math.abs(data.gold_change),
        label: `${icon} ${sign}${data.xp_change} XP  ${sign}${data.gold_change} Gold`,
      });
      if (data.completed) playSound('task_complete');
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    },
    onError: () => showRewardToast({ label: '❌ Failed to update task' }),
  });

  const completeTodo = (task) => {
    toggleMutation.mutate(task.id);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => djangoApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    }
  });

  const deleteTask = (id) => {
    deleteMutation.mutate(id);
  };

  const activeTodos = tasks.filter(t => !t.is_completed);
  const doneTodos = tasks.filter(t => t.is_completed);

  // Сортировка: просроченные вверху
  const sortedActive = [...activeTodos].sort((a, b) => {
    const aOver = isOverdue(a) ? -1 : 0;
    const bOver = isOverdue(b) ? -1 : 0;
    return aOver - bOver;
  });

  return (
    <div className="flex flex-col rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
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
            const tv = task.value ?? 0;
            const tvColor = getTaskValueColor(tv);
            const overdue = isOverdue(task);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: task.is_completed ? 0.45 : 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="flex items-center gap-2 rounded-xl p-2.5 cursor-pointer"
                style={{
                  background: 'var(--habit-panel)',
                  border: `1px solid ${overdue && !task.is_completed ? 'var(--habit-red, #ef4444)' : 'var(--habit-border)'}`,
                }}
                onClick={() => !toggleMutation.isPending && completeTodo(task)}
              >
                {/* Task Value bar (только для активных) */}
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
                    ? <CheckSquare size={20} strokeWidth={2} style={{ color: 'var(--habit-orange, #ff8800)' }} />
                    : <Square size={20} strokeWidth={2} style={{ color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-dim)' }} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: task.is_completed ? 'var(--habit-dim)' : overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-text)',
                    textDecoration: task.is_completed ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{task.category}</span>
                    <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
                    {/* Task Value — показывает, насколько упала награда */}
                    {!task.is_completed && (
                      <span className="text-[10px] font-mono" style={{ color: tvColor }}>
                        TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
                      </span>
                    )}
                    {/* Due date */}
                    {task.due_date && !task.is_completed && (
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: overdue ? 'var(--habit-red)' : 'var(--habit-dim)' }}>
                        <Clock size={8} />
                        {new Date(task.due_date).toLocaleDateString()}
                        {overdue && ' ⚠️'}
                      </span>
                    )}
                  </div>
                  {/* Предупреждение о снижении награды */}
                  {!task.is_completed && tv < -5 && (
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