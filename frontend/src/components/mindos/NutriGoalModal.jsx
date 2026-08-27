// @ts-nocheck
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';

const PRESETS = [
  { key: 'preset_cut', defaultLabel: '🏃 Weight Loss',    calories: 1600, protein: 140, fat: 50, carbs: 150, water_ml: 2200 },
  { key: 'preset_maintain', defaultLabel: '⚖️ Maintenance',  calories: 2000, protein: 150, fat: 65, carbs: 250, water_ml: 2000 },
  { key: 'preset_bulk', defaultLabel: '💪 Muscle Gain',  calories: 2600, protein: 200, fat: 80, carbs: 310, water_ml: 2500 },
];

/**
 * Модалка настройки целей питания и воды.
 * @param {{ currentGoal: object, onClose: () => void }} props
 */
export default function NutriGoalModal({ currentGoal = {}, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    calories: currentGoal.calories ?? 2000,
    protein:  currentGoal.protein  ?? 150,
    fat:      currentGoal.fat      ?? 65,
    carbs:    currentGoal.carbs    ?? 250,
    water_ml: currentGoal.water_ml ?? 2000,
  });

  const updateGoalMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.updateGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRI_GOAL_KEY });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'water'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
      toast({ title: t('nutrition.goal_modal.goals_saved', '✅ Goals saved!') });
      onClose();
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  function applyPreset(preset) {
    setForm({
      calories: preset.calories,
      protein: preset.protein,
      fat: preset.fat,
      carbs: preset.carbs,
      water_ml: preset.water_ml,
    });
  }

  const FIELDS = [
    { key: 'calories', label: t('nutrition.goal_modal.calories', 'Calories'), unit: t('nutrition.kcal', 'kcal'), color: 'var(--habit-gold, #f59e0b)' },
    { key: 'protein',  label: t('nutrition.goal_modal.protein', 'Protein'),   unit: t('nutrition.g', 'g'),    color: 'var(--habit-blue, #3b82f6)' },
    { key: 'fat',      label: t('nutrition.goal_modal.fat', 'Fat'),       unit: t('nutrition.g', 'g'),    color: 'var(--habit-orange, #f97316)' },
    { key: 'carbs',    label: t('nutrition.goal_modal.carbs', 'Carbohydrates'), unit: t('nutrition.g', 'g'),   color: 'var(--habit-green, #10b981)' },
    { key: 'water_ml', label: t('nutrition.goal_modal.water', 'Water'),       unit: t('nutrition.ml', 'ml'),   color: '#38bdf8' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
            {t('nutrition.goal_modal.title', '🎯 Nutrition & Water Goals')}
          </span>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">
            ×
          </button>
        </div>

        {/* Presets */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: 'var(--habit-border)',
                color: 'var(--habit-text)',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              {t(`nutrition.goal_modal.${p.key}`, p.defaultLabel)}
            </button>
          ))}
        </div>

        {/* Fields */}
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
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="w-24 px-3 py-1.5 rounded-xl text-center text-sm font-bold outline-none"
                style={{
                  background: 'var(--habit-border)',
                  color,
                  border: `1px solid ${color}40`,
                }}
              />
            </div>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() =>
            updateGoalMut.mutate({
              calories: Number(form.calories),
              protein: Number(form.protein),
              fat: Number(form.fat),
              carbs: Number(form.carbs),
              water_ml: Number(form.water_ml),
            })
          }
          disabled={updateGoalMut.isPending}
          className="w-full py-3 rounded-xl font-black text-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)',
            color: '#000',
            opacity: updateGoalMut.isPending ? 0.7 : 1,
            cursor: 'pointer',
          }}
        >
          {updateGoalMut.isPending ? t('nutrition.goal_modal.saving', 'Saving...') : t('nutrition.goal_modal.save_btn', '💾 Save Goals')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
