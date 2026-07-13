import { useState } from 'react';
import { Plus, Trash2, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { playSound } from '@/lib/soundEffects.js';
import { showRewardToast } from '@/components/mindos/RewardToast';
import CreateTaskModal from '@/components/mindos/CreateTaskModal';
import { djangoApi } from '@/api/djangoClient';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import ConfirmDeleteButton from './ConfirmDeleteButton';

function getTaskValueColor(tv) {
  if (tv > 0) return '#22c55e';
  if (tv < 0) return '#ef4444';
  return '#f59e0b';
}

const DIFFICULTIES = [
  { id: 'easy',     label: 'Easy',     color: '#22c55e' },
  { id: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { id: 'hard',     label: 'Hard',     color: '#ef4444' },
  { id: 'critical', label: 'Critical', color: '#a855f7' },
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



/** Проверяет, просрочен ли To-Do (есть due_date и она в прошлом) */
function isOverdue(task) {
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date();
}

export default function TodosColumn({ todos = [], onXpGain, onBossDamage, onRankXP }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'todo', category: 'Other', difficulty: 'medium',
    notes: '', priority: 'medium', dueDate: '', scheduledTime: '', showInCalendar: false,
  });
  const [formType, setFormType] = useState('todo');

  const activeTodos = todos.filter(t => !t.is_completed);

  const createTaskMutation = useMutation({
    mutationFn: (/** @type {any} */ taskData) => djangoApi.tasks.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
      scheduled_time: form.scheduledTime || null,
      show_in_calendar: !!form.showInCalendar,
    });
  };

  const toggleMutation = useMutation({
    mutationFn: (todoId) => djangoApi.tasks.toggle(todoId),
    onMutate: async (todoId) => {
      // Opt-update UI immediately (getQueryData -> filter -> setQueryData)
      const previousTodos = /** @type {any} */ (queryClient.getQueryData(['tasks']));
      if (previousTodos) {
        if (Array.isArray(previousTodos)) {
          queryClient.setQueryData(['tasks'], previousTodos.filter(t => t.id !== todoId));
        } else if (previousTodos.results) {
          queryClient.setQueryData(['tasks'], { ...previousTodos, results: previousTodos.results.filter(t => t.id !== todoId) });
        }
      }
      return { previousTodos };
    },
    onSuccess: (/** @type {any} */ data) => {
      const isCompleting = data.completed;
      const sign = isCompleting ? '+' : '-';
      const icon = isCompleting ? '✅' : '↩️';
      
      const combatResult = data.combat;
      const isCrit = data.gamification_result?.is_crit || false;
      const itemDropped = data.gamification_result?.item_dropped || null;
      const bossDmg = combatResult?.damage_dealt || 0;

      showRewardToast({
        xp: Math.abs(data.xp_change),
        gold: Math.abs(data.gold_change),
        boss: isCompleting ? bossDmg : 0,
        isCrit,
        itemDropped,
        label: `${icon} ${sign}${Math.abs(data.xp_change)} XP  ${sign}${Math.abs(data.gold_change)} Gold`,
      });
      
      if (isCompleting) playSound('task_complete');
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['combat_encounters'] });
      if (itemDropped || !isCompleting) {
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    },
    onError: (err, todoId, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(['tasks'], context.previousTodos);
      }
      showRewardToast({ label: '❌ Failed to update task' });
    },
  });

  const completeTodo = (task) => {
    toggleMutation.mutate(task.id);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => djangoApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const deleteTask = (id) => {
    deleteMutation.mutate(id);
  };

  // Сортировка: просроченные вверху
  const sortedActive = [...activeTodos].sort((a, b) => {
    const aOver = isOverdue(a) ? -1 : 0;
    const bOver = isOverdue(b) ? -1 : 0;
    return aOver - bOver;
  });

  return (
    <div className="flex flex-col rounded-none border-x-0 mx-0 w-full md:rounded-xl md:border-x md:mx-auto md:max-w-2xl border-y overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--habit-orange, #ff8800)' }}>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: 'white' }}>TO-DOS</span>
        <button onClick={() => setShowForm(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
          <Plus size={16} className="text-white" strokeWidth={3} />
        </button>
      </div>

      {/* Task list */}
      <Droppable droppableId="todo">
        {(provided) => (
          <div 
            className="flex-1 p-3 space-y-2" 
            style={{ background: 'var(--habit-panel)', minHeight: 120 }}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {activeTodos.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📜</div>
                <div style={{ fontFamily: "'Nunito'", fontStyle: 'italic', fontSize: 12, color: 'var(--habit-dim)' }}>{t('dashboard.no_todos')}</div>
              </div>
            )}
            <AnimatePresence>
          {sortedActive.map((task, index) => {
            const diff = DIFFICULTIES.find(d => d.id === task.difficulty) || DIFFICULTIES[2];
            const accentColor = CATEGORY_COLORS[task.category] || '#64748b';
            const tv = task.value ?? 0;
            const tvColor = getTaskValueColor(tv);
            const overdue = isOverdue(task);

            return (
              <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={provided.draggableProps.style}
                    className={snapshot.isDragging ? 'z-50' : ''}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: snapshot.isDragging ? 1.05 : 1,
                        boxShadow: snapshot.isDragging ? '0 25px 50px -12px rgba(0,0,0,0.25)' : 'none'
                      }}
                      exit={{ opacity: 0, x: 30 }}
                      className={`flex items-center gap-2 rounded-xl p-2.5 cursor-pointer ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                      style={{
                        background: 'var(--habit-panel)',
                        border: `1px solid ${overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-border)'}`,
                      }}
                      onClick={() => !toggleMutation.isPending && completeTodo(task)}
                    >
                {/* Task Value bar */}
                <motion.div
                  animate={{ background: tvColor }}
                  transition={{ duration: 0.6 }}
                  style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}
                  title={`Task Value: ${tv.toFixed(1)}`}
                />

                {/* Checkbox */}
                <div className="shrink-0">
                  <Square size={20} strokeWidth={2} style={{ color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-dim)' }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{
                    fontFamily: "'Nunito'", fontWeight: 700, fontSize: 14,
                    color: overdue ? 'var(--habit-red, #ef4444)' : 'var(--habit-text)',
                    textDecoration: 'none',
                  }}>
                    {task.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold text-white" style={{ background: accentColor + '99' }}>{String(t("categories." + task.category, task.category))}</span>
                    <span className="text-[10px] font-mono" style={{ color: diff.color }}>{diff.label}</span>
                    {/* Task Value — показывает, насколько упала награда */}
                    <span className="text-[10px] font-mono" style={{ color: tvColor }}>
                      TV:{tv >= 0 ? '+' : ''}{tv.toFixed(0)}
                    </span>
                    {/* Due date */}
                    {task.due_date && (
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: overdue ? 'var(--habit-red)' : 'var(--habit-dim)' }}>
                        <Clock size={8} />
                        {new Date(task.due_date).toLocaleDateString()}
                        {overdue && ' ⚠️'}
                      </span>
                    )}
                  </div>
                  {/* Предупреждение о снижении награды */}
                  {tv < -5 && (
                    <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: 'var(--habit-gold, #f59e0b)', marginTop: 3 }}>
                      reward -{ Math.round(Math.abs(tv) * 5) }%
                    </div>
                  )}
                </div>

                {/* Delete */}
                <div className="shrink-0">
                  <ConfirmDeleteButton onDelete={() => deleteTask(task.id)} />
                </div>
              </motion.div>
            </div>
          )}
        </Draggable>
            );
          })}
        </AnimatePresence>
        {provided.placeholder}
      </div>
      )}
      </Droppable>

      <CreateTaskModal isOpen={showForm} onClose={() => setShowForm(false)}
        formType={formType} setFormType={setFormType} form={form} setForm={setForm} onCreate={createTask} />
    </div>
  );
}