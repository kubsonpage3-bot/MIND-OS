// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_WATER_KEY, NUTRITION_MEALS_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Droplets, Plus, Minus, Edit3, CheckCircle2 } from 'lucide-react';

// ── SVG Wave Fill Component ────────────────────────────────────────────────────
function WaveFill({ percentage, isGoalReached }) {
  const clampedPct = Math.min(percentage, 100);
  // The bar is horizontal, so the fill has to be clipped from the right.
  // (It used to clip from the top, which made every value look 100 % full.)
  const rightClip = 100 - clampedPct;

  const waveColor = isGoalReached
    ? 'rgba(16,185,129,0.85)'
    : 'rgba(56,189,248,0.82)';
  const waveColor2 = isGoalReached
    ? 'rgba(16,185,129,0.45)'
    : 'rgba(14,165,233,0.48)';
  const glowColor = isGoalReached
    ? '0 0 22px rgba(16,185,129,0.65)'
    : '0 0 18px rgba(56,189,248,0.5)';

  return (
    <div
      className="w-full relative overflow-hidden rounded-full"
      style={{ height: 18, background: 'var(--habit-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.25)' }}
    >
      {/* SVG wave container */}
      <motion.div
        className="absolute inset-0 flex items-end"
        style={{ width: '100%', height: '100%' }}
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: `inset(0 ${rightClip}% 0 0)` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Background fill */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: isGoalReached
              ? 'linear-gradient(90deg, #10b981 0%, #38bdf8 100%)'
              : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 60%, #50b5e9 100%)',
            boxShadow: glowColor,
          }}
        />
        {/* Wave 1 - main shimmer */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${waveColor} 50%, transparent 100%)`,
            width: '200%',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
        />
        {/* Wave 2 - subtle offset shimmer */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 20%, ${waveColor2} 50%, transparent 80%)`,
            width: '200%',
          }}
          animate={{ x: ['0%', '-200%'] }}
          transition={{ repeat: Infinity, duration: 3.6, ease: 'linear' }}
        />
        {/* Surface gloss */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: '5px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
            borderRadius: '999px 999px 0 0',
          }}
        />
      </motion.div>
    </div>
  );
}

// ── Ripple Burst on log ─────────────────────────────────────────────────────────
function RippleBurst({ trigger }) {
  return (
    <AnimatePresence>
      {trigger && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: '2px solid rgba(56,189,248,0.8)' }}
          initial={{ scale: 0.85, opacity: 0.9 }}
          animate={{ scale: 1.6, opacity: 0 }}
          exit={{}}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

export default function WaterTracker({ dateStr, goalMl = 2000 }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [customAmount, setCustomAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [splashKey, setSplashKey] = useState(0);

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
      setSplashKey((k) => k + 1);
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
      animate={justLogged ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.35 }}
      className="p-4 rounded-2xl transition-all relative overflow-hidden"
      style={{
        background: 'var(--habit-panel)',
        border: isGoalReached ? '1px solid rgba(56,189,248,0.4)' : '1px solid var(--habit-border)',
        fontFamily: "'Nunito', sans-serif",
        boxShadow: isGoalReached
          ? '0 0 28px rgba(56,189,248,0.18), 0 0 60px rgba(16,185,129,0.08)'
          : 'none',
        transition: 'border-color 0.4s, box-shadow 0.5s',
      }}
    >
      {/* Goal reached celebration glow */}
      <AnimatePresence>
        {isGoalReached && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 70%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <motion.div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(80, 181, 233, 0.15)',
                color: 'var(--habit-blue, #50b5e9)',
                border: '1px solid rgba(80, 181, 233, 0.3)',
                boxShadow: '0 0 10px rgba(80, 181, 233, 0.2)',
              }}
              animate={justLogged ? { rotate: [0, -15, 15, -8, 0] } : {}}
              transition={{ duration: 0.45 }}
            >
              <Droplets size={18} />
            </motion.div>
            {/* Ripple on log */}
            <RippleBurst trigger={splashKey > 0} key={splashKey} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
                {t('nutrition.water.title', 'Water Intake')}
              </span>
              <AnimatePresence>
                {isGoalReached && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                  >
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
              <motion.span
                key={amountMl}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{ color: isGoalReached ? '#10b981' : 'var(--habit-blue, #50b5e9)', fontWeight: 900 }}
              >
                {amountMl}
              </motion.span>
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

      {/* Wave Progress Bar */}
      <div className="mb-3">
        <WaveFill percentage={percentage} isGoalReached={isGoalReached} />
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
          className="p-2.5 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: 'var(--habit-border)',
            color: 'var(--habit-text)',
            opacity: amountMl <= 0 ? 0.3 : 0.7,
            cursor: amountMl <= 0 ? 'not-allowed' : 'pointer',
          }}
          title={`-250 ${t('nutrition.ml', 'ml')}`}
        >
          <Minus size={14} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(56,189,248,0.3)' }}
          onClick={() => handleDelta(250)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(56,189,248,0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.3)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>+250 ml</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(56,189,248,0.4)' }}
          onClick={() => handleDelta(500)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(56,189,248,0.2)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.45)',
            boxShadow: '0 2px 10px rgba(56,189,248,0.15)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>+500 ml</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
