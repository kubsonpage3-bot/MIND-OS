// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_WEIGHT_KEY, NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Dot,
} from 'recharts';
import { Scale, Plus, Trash2, Target, ChevronDown, ChevronUp } from 'lucide-react';

const DAYS_OPTIONS = [30, 60, 90];

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div
        className="p-2.5 rounded-xl text-xs font-mono shadow-xl border"
        style={{
          background: 'var(--habit-panel, #1a1a1f)',
          borderColor: 'var(--habit-border, #333)',
          color: 'var(--habit-text, #fff)',
        }}
      >
        <div className="font-bold mb-1">{d.date}</div>
        <div style={{ color: 'var(--habit-green, #10b981)' }}>⚖️ {d.weight_kg} кг</div>
        {d.note && <div className="opacity-60 mt-0.5 italic">{d.note}</div>}
      </div>
    );
  }
  return null;
}

export default function BodyWeightTracker({ goalData }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [isOpen, setIsOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data, isLoading } = useQuery({
    queryKey: NUTRITION_WEIGHT_KEY(days),
    queryFn: () => djangoApi.nutrition.getWeight(days),
    staleTime: 60_000,
  });

  const series = data?.series || [];
  const targetWeight = data?.target_weight_kg ?? goalData?.target_weight_kg ?? null;
  const latestEntry = series[series.length - 1] || null;
  const firstEntry = series[0] || null;
  const weightDelta = latestEntry && firstEntry && series.length > 1
    ? (latestEntry.weight_kg - firstEntry.weight_kg).toFixed(1)
    : null;

  const logWeightMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.logWeight(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'weight'] });
      setWeightInput('');
      setNoteInput('');
      toast({ title: '⚖️ ' + t('weight.logged', 'Weight logged!') });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const deleteWeightMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteWeight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'weight'] });
    },
  });

  const updateTargetMut = useMutation({
    mutationFn: (target) => djangoApi.nutrition.updateGoal({ target_weight_kg: target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'weight'] });
      queryClient.invalidateQueries({ queryKey: NUTRI_GOAL_KEY });
      setEditingTarget(false);
      toast({ title: '🎯 ' + t('weight.target_saved', 'Target weight saved!') });
    },
  });

  function handleLog() {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    logWeightMut.mutate({ date: today, weight_kg: val, note: noteInput });
  }

  const chartData = series.map((s) => ({ ...s, label: s.date.slice(5) }));

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4"
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--habit-green, #10b981)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)',
            }}
          >
            <Scale size={17} />
          </div>
          <div className="text-left">
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
              {t('weight.title', 'Body Weight')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
              {latestEntry ? (
                <>
                  <span style={{ color: 'var(--habit-green, #10b981)', fontWeight: 900 }}>
                    {latestEntry.weight_kg} kg
                  </span>
                  {targetWeight && (
                    <span className="ml-1.5 opacity-70">
                      → {t('weight.goal', 'Goal')}: {targetWeight} kg
                    </span>
                  )}
                  {weightDelta !== null && (
                    <span
                      className="ml-1.5"
                      style={{ color: parseFloat(weightDelta) <= 0 ? 'var(--habit-green, #10b981)' : 'var(--habit-red, #f74e52)' }}
                    >
                      ({parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta} kg / {days}d)
                    </span>
                  )}
                </>
              ) : (
                t('weight.no_data', 'No data yet — log your weight')
              )}
            </div>
          </div>
        </div>
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Days Toggle */}
              <div className="flex gap-1 p-0.5 rounded-xl w-fit" style={{ background: 'var(--habit-border)' }}>
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: days === d ? 'var(--habit-panel)' : 'transparent',
                      color: days === d ? 'var(--habit-green, #10b981)' : 'var(--habit-dim, #888)',
                      cursor: 'pointer',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Chart */}
              {chartData.length > 1 ? (
                <div style={{ height: 160, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 8, left: -25, bottom: 0 }}>
                      <XAxis dataKey="label" stroke="var(--habit-dim, #888)" fontSize={9} tickLine={false} />
                      <YAxis
                        stroke="var(--habit-dim, #888)"
                        fontSize={9}
                        tickLine={false}
                        domain={['dataMin - 1', 'dataMax + 1']}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {targetWeight && (
                        <ReferenceLine
                          y={targetWeight}
                          stroke="var(--habit-gold, #f59e0b)"
                          strokeDasharray="4 4"
                          label={{ value: `Goal ${targetWeight}`, fill: 'var(--habit-gold, #f59e0b)', fontSize: 9 }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="weight_kg"
                        stroke="var(--habit-green, #10b981)"
                        strokeWidth={2.5}
                        dot={<Dot r={3} fill="var(--habit-green, #10b981)" strokeWidth={0} />}
                        activeDot={{ r: 5, fill: 'var(--habit-green, #10b981)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed text-center"
                  style={{ borderColor: 'var(--habit-border)', color: 'var(--habit-dim, #888)' }}
                >
                  <Scale size={28} className="opacity-25 mb-2" />
                  <div className="text-xs font-semibold">{t('weight.chart_empty', 'Log at least 2 entries to see the chart')}</div>
                </div>
              )}

              {/* Recent entries */}
              {series.length > 0 && (
                <div className="space-y-1.5">
                  {[...series].reverse().slice(0, 3).map((entry, i) => (
                    <div
                      key={entry.date}
                      className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: 'var(--habit-border)' }}
                    >
                      <div>
                        <span className="text-xs font-bold" style={{ color: 'var(--habit-text)' }}>
                          {entry.weight_kg} kg
                        </span>
                        <span className="text-[10px] ml-2 opacity-50">{entry.date}</span>
                        {entry.note && (
                          <span className="text-[10px] ml-2 italic opacity-40">· {entry.note}</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteWeightMut.mutate(entry.id)}
                        className="p-1 opacity-30 hover:opacity-100 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Log today */}
              <div
                className="p-3 rounded-xl space-y-2"
                style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: 'var(--habit-green, #10b981)' }}>
                  + {t('weight.log_today', 'Log Today')}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="500"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="75.5"
                    className="flex-1 px-3 py-1.5 rounded-xl text-sm font-bold text-center outline-none"
                    style={{
                      background: 'var(--habit-border)',
                      color: 'var(--habit-text)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  />
                  <span className="self-center text-xs font-bold opacity-60">kg</span>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={handleLog}
                    disabled={!weightInput || logWeightMut.isPending}
                    className="px-4 py-1.5 rounded-xl text-xs font-black transition-all"
                    style={{
                      background: weightInput ? 'var(--habit-green, #10b981)' : 'var(--habit-border)',
                      color: weightInput ? '#fff' : 'var(--habit-dim)',
                      cursor: weightInput ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Plus size={14} />
                  </motion.button>
                </div>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={t('weight.note_placeholder', 'Note (optional)...')}
                  className="w-full px-3 py-1.5 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>

              {/* Target weight */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--habit-dim)' }}>
                  <Target size={13} style={{ color: 'var(--habit-gold, #f59e0b)' }} />
                  {t('weight.target', 'Goal weight')}:{' '}
                  <span style={{ color: 'var(--habit-gold, #f59e0b)' }}>
                    {targetWeight ? `${targetWeight} kg` : '—'}
                  </span>
                </div>
                {editingTarget ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="20"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder="70"
                      className="w-20 px-2 py-1 rounded-lg text-xs text-center outline-none font-bold"
                      style={{
                        background: 'var(--habit-border)',
                        color: 'var(--habit-text)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => updateTargetMut.mutate(parseFloat(targetInput) || null)}
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--habit-gold, #f59e0b)', color: '#000' }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingTarget(false)}
                      className="px-2 py-1 rounded-lg text-xs opacity-60"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setTargetInput(targetWeight || ''); setEditingTarget(true); }}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--habit-border)' }}
                  >
                    {t('weight.set_target', 'Set')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
