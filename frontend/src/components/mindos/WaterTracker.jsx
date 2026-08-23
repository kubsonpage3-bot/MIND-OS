import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_WATER_KEY, NUTRITION_MEALS_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Droplets, Plus, Minus, Edit3, CheckCircle2 } from 'lucide-react';

export default function WaterTracker({ dateStr, goalMl = 2000 }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [customAmount, setCustomAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const { data: waterData } = useQuery({
    queryKey: NUTRITION_WATER_KEY(dateStr),
    queryFn: () => djangoApi.nutrition.getWater(dateStr),
    staleTime: 30_000,
  });

  const amountMl = waterData?.amount_ml || 0;
  const currentGoal = waterData?.goal_ml || goalMl || 2000;
  const rawPct = currentGoal > 0 ? (amountMl / currentGoal) * 100 : 0;
  const percentage = Math.min(Math.round(rawPct), 150);
  const isGoalReached = amountMl >= currentGoal && currentGoal > 0;

  const updateWaterMut = useMutation({
    mutationFn: (payload) => djangoApi.nutrition.updateWater(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_WATER_KEY(dateStr) });
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(dateStr) });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 700);
    },
    onError: (e) =>
      toast({
        title: t('nutrition.water.update_error', 'Water update error'),
        description: e?.message,
        variant: 'destructive',
      }),
  });

  const handleDelta = (delta) => {
    updateWaterMut.mutate({ date: dateStr, delta_ml: delta });
  };

  const handleSetAmount = () => {
    const val = Number(customAmount);
    if (!isNaN(val) && val >= 0) {
      updateWaterMut.mutate({ date: dateStr, amount_ml: val });
      setIsEditing(false);
      setCustomAmount('');
    }
  };

  return (
    <motion.div
      animate={justLogged ? { scale: [1, 1.012, 1] } : {}}
      transition={{ duration: 0.3 }}
      className="p-4 rounded-2xl transition-all relative overflow-hidden"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform"
            style={{
              background: 'rgba(80, 181, 233, 0.15)',
              color: 'var(--habit-blue, #50b5e9)',
              border: '1px solid rgba(80, 181, 233, 0.3)',
              boxShadow: '0 0 10px rgba(80, 181, 233, 0.2)',
            }}
          >
            <Droplets size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
                {t('nutrition.water.title', 'Water Intake')}
              </span>
              {isGoalReached && (
                <CheckCircle2 size={13} className="text-emerald-400" />
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
              <span style={{ color: 'var(--habit-blue, #50b5e9)', fontWeight: 900 }}>
                {amountMl}
              </span>
              {' '}/ {currentGoal} {t('nutrition.ml', 'ml')}
              <span className="ml-1 opacity-75">({percentage}%)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          style={{ background: 'var(--habit-border)' }}
          title={t('nutrition.water.enter_manually', 'Enter manually')}
        >
          <Edit3 size={13} />
        </button>
      </div>

      {/* Fluid Liquid Progress Bar */}
      <div
        className="w-full h-3 rounded-full overflow-hidden mb-3 relative"
        style={{
          background: 'var(--habit-border)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
        }}
      >
        <motion.div
          className="h-full rounded-full relative"
          style={{
            background: 'linear-gradient(90deg, #38bdf8 0%, var(--habit-blue, #50b5e9) 100%)',
            boxShadow: '0 0 10px rgba(80, 181, 233, 0.5)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: 'rgba(255, 255, 255, 0.4)' }}
          />
        </motion.div>
      </div>

      {/* Custom Input Drawer */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 mb-3 overflow-hidden"
          >
            <input
              type="number"
              min={0}
              step={50}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`${amountMl} ${t('nutrition.ml', 'ml')}`}
              className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none font-bold"
              style={{
                background: 'var(--habit-border)',
                color: 'var(--habit-text)',
                border: '1px solid rgba(80, 181, 233, 0.4)',
              }}
              autoFocus
            />
            <button
              onClick={handleSetAmount}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'var(--habit-blue, #50b5e9)', color: '#fff' }}
            >
              {t('nutrition.water.save', 'Save')}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1.5 rounded-xl text-xs opacity-60 hover:opacity-100"
            >
              {t('nutrition.water.cancel', 'Cancel')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => handleDelta(-250)}
          disabled={amountMl <= 0 || updateWaterMut.isPending}
          className="p-2 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: 'var(--habit-border)',
            color: 'var(--habit-text)',
            opacity: amountMl <= 0 ? 0.35 : 0.8,
            cursor: amountMl <= 0 ? 'not-allowed' : 'pointer',
          }}
          title={`-250 ${t('nutrition.ml', 'ml')}`}
        >
          <Minus size={14} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ y: -1 }}
          onClick={() => handleDelta(250)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(80, 181, 233, 0.12)',
            color: 'var(--habit-blue, #50b5e9)',
            border: '1px solid rgba(80, 181, 233, 0.3)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>{t('nutrition.water.glass_btn', '+250 ml (glass)')}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ y: -1 }}
          onClick={() => handleDelta(500)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(80, 181, 233, 0.18)',
            color: 'var(--habit-blue, #50b5e9)',
            border: '1px solid rgba(80, 181, 233, 0.45)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>{t('nutrition.water.bottle_btn', '+500 ml (bottle)')}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
