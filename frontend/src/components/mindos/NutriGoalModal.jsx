import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';

const PRESETS = [
  { label: '🏃 Похудение',    calories: 1600, protein: 140, fat: 50, carbs: 150 },
  { label: '⚖️ Поддержание',  calories: 2000, protein: 150, fat: 65, carbs: 250 },
  { label: '💪 Набор массы',  calories: 2600, protein: 200, fat: 80, carbs: 310 },
];

/**
 * Модалка настройки целей питания.
 * @param {{ currentGoal: object, onClose: () => void }} props
 */
export default function NutriGoalModal({ currentGoal = {}, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    calories: currentGoal.calories ?? 2000,
    protein:  currentGoal.protein  ?? 150,
    fat:      currentGoal.fat      ?? 65,
    carbs:    currentGoal.carbs    ?? 250,
  });

  const updateGoalMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.updateGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRI_GOAL_KEY });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'meals'] });
      toast({ title: '✅ Цели сохранены!' });
      onClose();
    },
    onError: (e) => toast({ title: 'Ошибка', description: e?.message, variant: 'destructive' }),
  });

  function applyPreset(preset) {
    setForm({ calories: preset.calories, protein: preset.protein, fat: preset.fat, carbs: preset.carbs });
  }

  const FIELDS = [
    { key: 'calories', label: 'Калории', unit: 'ккал', color: '#f59e0b' },
    { key: 'protein',  label: 'Белки',   unit: 'г',    color: '#3b82f6' },
    { key: 'fat',      label: 'Жиры',    unit: 'г',    color: '#f97316' },
    { key: 'carbs',    label: 'Углеводы', unit: 'г',   color: '#10b981' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-md p-5"
        style={{
          background: 'var(--habit-panel)',
          border: '1px solid var(--habit-border)',
          borderRadius: '20px 20px 0 0',
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
            🎯 Цели питания
          </span>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>
        </div>

        {/* Пресеты */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)', cursor: 'pointer', border: 'none' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Поля */}
        <div className="flex flex-col gap-3 mb-5">
          {FIELDS.map(({ key, label, unit, color }) => (
            <div key={key} className="flex items-center justify-between">
              <label style={{ fontWeight: 700, fontSize: 14, color }}>
                {label} <span style={{ opacity: 0.5, fontWeight: 400 }}>({unit})</span>
              </label>
              <input
                type="number"
                min={0}
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-24 px-3 py-1.5 rounded-xl text-center text-sm font-bold outline-none"
                style={{ background: 'var(--habit-border)', color, border: `1px solid ${color}40` }}
              />
            </div>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => updateGoalMut.mutate({
            calories: Number(form.calories),
            protein:  Number(form.protein),
            fat:      Number(form.fat),
            carbs:    Number(form.carbs),
          })}
          disabled={updateGoalMut.isPending}
          className="w-full py-3 rounded-xl font-black text-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#000',
            opacity: updateGoalMut.isPending ? 0.7 : 1,
            cursor: 'pointer',
          }}
        >
          {updateGoalMut.isPending ? 'Сохраняю...' : '💾 Сохранить цели'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
