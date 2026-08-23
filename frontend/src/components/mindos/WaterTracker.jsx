import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_WATER_KEY, NUTRITION_MEALS_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Droplet, Plus, Minus, Edit2 } from 'lucide-react';

export default function WaterTracker({ dateStr, goalMl = 2000 }) {
  const queryClient = useQueryClient();
  const [customAmount, setCustomAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: waterData, isLoading } = useQuery({
    queryKey: NUTRITION_WATER_KEY(dateStr),
    queryFn: () => djangoApi.nutrition.getWater(dateStr),
    staleTime: 30_000,
  });

  const amountMl = waterData?.amount_ml || 0;
  const currentGoal = waterData?.goal_ml || goalMl || 2000;
  const percentage = Math.min(Math.round((amountMl / currentGoal) * 100), 150);

  const updateWaterMut = useMutation({
    mutationFn: (payload) => djangoApi.nutrition.updateWater(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_WATER_KEY(dateStr) });
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(dateStr) });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
    },
    onError: (e) => toast({ title: 'Ошибка обновления воды', description: e?.message, variant: 'destructive' }),
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
    <div
      className="p-4 rounded-2xl transition-all"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--habit-blue, #3b82f6)' }}
          >
            <Droplet size={17} className="fill-current" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
              Водный баланс
            </div>
            <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 600 }}>
              {amountMl} / {currentGoal} мл ({percentage}%)
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          style={{ background: 'var(--habit-border)' }}
          title="Ввести вручную"
        >
          <Edit2 size={13} />
        </button>
      </div>

      {/* Progress Bar */}
      <div
        className="w-full h-3 rounded-full overflow-hidden mb-3 relative"
        style={{ background: 'var(--habit-border)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #38bdf8, var(--habit-blue, #3b82f6))',
            boxShadow: '0 0 10px rgba(59,130,246,0.5)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Custom Input Drawer */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-2 mb-3"
        >
          <input
            type="number"
            min={0}
            step={50}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={`${amountMl} мл`}
            className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--habit-border)',
              color: 'var(--habit-text)',
              border: '1px solid transparent',
            }}
            autoFocus
          />
          <button
            onClick={handleSetAmount}
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'var(--habit-blue, #3b82f6)', color: '#fff' }}
          >
            Сохранить
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-2 py-1.5 rounded-xl text-xs opacity-60"
          >
            Отмена
          </button>
        </motion.div>
      )}

      {/* Quick Add Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleDelta(-250)}
          disabled={amountMl <= 0 || updateWaterMut.isPending}
          className="p-2 rounded-xl flex items-center justify-center transition-opacity"
          style={{
            background: 'var(--habit-border)',
            color: 'var(--habit-text)',
            opacity: amountMl <= 0 ? 0.4 : 1,
            cursor: amountMl <= 0 ? 'not-allowed' : 'pointer',
          }}
          title="-250 мл"
        >
          <Minus size={14} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleDelta(250)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(59,130,246,0.12)',
            color: 'var(--habit-blue, #3b82f6)',
            border: '1px solid rgba(59,130,246,0.3)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>+250 мл (стакан)</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleDelta(500)}
          disabled={updateWaterMut.isPending}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(59,130,246,0.18)',
            color: 'var(--habit-blue, #3b82f6)',
            border: '1px solid rgba(59,130,246,0.4)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          <span>+500 мл (бутылка)</span>
        </motion.button>
      </div>
    </div>
  );
}
