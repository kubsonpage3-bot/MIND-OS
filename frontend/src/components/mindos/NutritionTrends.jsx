// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_TRENDS_KEY } from '@/constants/queryKeys';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function NutritionTrends() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);

  const { data: trendsData, isLoading } = useQuery({
    queryKey: NUTRITION_TRENDS_KEY(days),
    queryFn: () => djangoApi.nutrition.getTrends(days),
    staleTime: 60_000,
  });

  const dailySeries = trendsData?.daily_series || [];
  const averages = trendsData?.averages || { calories: 0, protein: 0, fat: 0, carbs: 0, logged_days: 0 };
  const goal = trendsData?.goal || { calories: 2000 };

  const CustomTooltip = ({ active, payload, label }) => {
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
          <div className="text-[var(--habit-gold,#f59e0b)] font-bold">
            {d.calories} {t('nutrition.kcal', 'kcal')} ({t('nutrition.goal_modal.title', 'Goal')} {d.target_calories})
          </div>
          <div className="text-[var(--habit-blue,#3b82f6)]">{t('nutrition.macros.protein', 'Protein')}: {d.protein}{t('nutrition.g', 'g')}</div>
          <div className="text-[var(--habit-orange,#f97316)]">{t('nutrition.macros.fat', 'Fat')}: {d.fat}{t('nutrition.g', 'g')}</div>
          <div className="text-[var(--habit-green,#10b981)]">{t('nutrition.macros.carbs', 'Carbs')}: {d.carbs}{t('nutrition.g', 'g')}</div>
          {d.water_ml > 0 && <div className="text-sky-400">{t('nutrition.trends.water', 'Water:')} {d.water_ml} {t('nutrition.ml', 'ml')}</div>}
        </div>
      );
    }
    return null;
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
      {/* Header & Days Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--habit-gold, #f59e0b)' }}
          >
            <TrendingUp size={17} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
              {t('nutrition.trends.title', 'Analytics & Trends')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 600 }}>
              {t('nutrition.trends.subtitle', 'Nutrition dynamics over time')}
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--habit-border)' }}>
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                background: days === d ? 'var(--habit-panel)' : 'transparent',
                color: days === d ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
                cursor: 'pointer',
              }}
            >
              {d}{t('nutrition.trends.days_suffix', 'd')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Averages */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'var(--habit-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
            {t('nutrition.trends.avg_calories', 'Avg Calories')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--habit-gold, #f59e0b)' }}>
            {averages.calories} <span style={{ fontSize: 10 }}>{t('nutrition.kcal', 'kcal')}</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'var(--habit-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
            {t('nutrition.trends.avg_protein', 'Avg Protein')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--habit-blue, #3b82f6)' }}>
            {averages.protein} <span style={{ fontSize: 10 }}>{t('nutrition.g', 'g')}</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'var(--habit-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--habit-dim, #888)', fontWeight: 700 }}>
            {t('nutrition.trends.logged_days', 'Logged')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--habit-green, #10b981)' }}>
            {averages.logged_days} / {days} <span style={{ fontSize: 10 }}>{t('nutrition.trends.days_suffix', 'd')}</span>
          </div>
        </div>
      </div>

      {/* Calories Chart */}
      <div className="mb-4">
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--habit-text)', marginBottom: 8 }}>
          {t('nutrition.trends.calories_vs_goal', 'Calories vs Goal ({{goal}} kcal)', { goal: goal.calories })}
        </div>
        <div style={{ height: 160, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySeries} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <XAxis dataKey="label" stroke="var(--habit-dim, #888)" fontSize={9} tickLine={false} />
              <YAxis stroke="var(--habit-dim, #888)" fontSize={9} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goal.calories} stroke="var(--habit-gold, #f59e0b)" strokeDasharray="3 3" />
              <Bar dataKey="calories" fill="var(--habit-gold, #f59e0b)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Macro Breakdown Stacked Chart */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--habit-text)', marginBottom: 8 }}>
          {t('nutrition.trends.macro_balance', 'Macro Balance (grams)')}
        </div>
        <div style={{ height: 140, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySeries} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <XAxis dataKey="label" stroke="var(--habit-dim, #888)" fontSize={9} tickLine={false} />
              <YAxis stroke="var(--habit-dim, #888)" fontSize={9} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="protein" stackId="macro" fill="var(--habit-blue, #3b82f6)" radius={[0, 0, 0, 0]} maxBarSize={28} />
              <Bar dataKey="fat" stackId="macro" fill="var(--habit-orange, #f97316)" radius={[0, 0, 0, 0]} maxBarSize={28} />
              <Bar dataKey="carbs" stackId="macro" fill="var(--habit-green, #10b981)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
