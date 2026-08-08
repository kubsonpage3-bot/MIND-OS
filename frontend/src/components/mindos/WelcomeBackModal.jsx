import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Square, Shield, Zap, Star } from 'lucide-react';

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

const DIFF_COLORS = {
  trivial: '#64748b',
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

function DailyCheckItem({ task, checked, onToggle }) {
  const accentColor = CATEGORY_COLORS[task.category] || '#9444ff';
  const diffColor = DIFF_COLORS[task.difficulty] || '#f59e0b';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onToggle(task.id)}
      className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-200"
      style={{
        background: checked
          ? `linear-gradient(135deg, ${accentColor}22, ${accentColor}11)`
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${checked ? accentColor + '55' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200"
        style={{
          background: checked ? accentColor : 'transparent',
          border: `2px solid ${checked ? accentColor : 'rgba(255,255,255,0.25)'}`,
        }}
      >
        {checked && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-tight truncate"
          style={{ color: checked ? '#fff' : 'rgba(255,255,255,0.75)' }}
        >
          {task.title}
        </p>
        {task.streak > 0 && (
          <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>
            🔥 {task.streak} day streak
          </p>
        )}
      </div>

      <div
        className="shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
        style={{
          color: diffColor,
          background: diffColor + '22',
        }}
      >
        {task.difficulty || 'med'}
      </div>
    </motion.button>
  );
}

export default function WelcomeBackModal({ dailies, onSubmit, isSubmitting }) {
  const [checked, setChecked] = useState(new Set());

  const toggleItem = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit([...checked]);
  };

  const handleSkipAll = () => {
    onSubmit([]);
  };

  const checkedCount = checked.size;
  const missedCount = dailies.length - checkedCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1040 0%, #0f0a2a 100%)',
          border: '1px solid rgba(148,68,255,0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(148,68,255,0.2)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-6 pb-4 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(148,68,255,0.15) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(148,68,255,0.15)',
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 14 }}
            className="text-4xl mb-2"
          >
            🌅
          </motion.div>
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: '#c4a3ff' }}
          >
            С возвращением!
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Отметь дейлики, которые ты выполнил вчера:
          </p>
        </div>

        {/* Task list */}
        <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {dailies.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <DailyCheckItem
                task={task}
                checked={checked.has(task.id)}
                onToggle={toggleItem}
              />
            </motion.div>
          ))}
        </div>

        {/* Summary bar */}
        <div
          className="mx-4 mb-3 px-3 py-2 rounded-xl flex items-center justify-between text-xs"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ color: '#22c55e' }}>
            ✅ {checkedCount} выполнено → <span className="font-semibold">+XP +Gold</span>
          </span>
          {missedCount > 0 && (
            <span style={{ color: '#ef4444' }}>
              ❌ {missedCount} пропущено → <span className="font-semibold">-HP</span>
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-5 flex gap-2">
          <button
            onClick={handleSkipAll}
            disabled={isSubmitting}
            className="flex-none px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Пропустить
          </button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #9444ff, #6622cc)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(148,68,255,0.35)',
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                  className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Сохранение...
              </span>
            ) : (
              'Начать новый день! 🚀'
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
