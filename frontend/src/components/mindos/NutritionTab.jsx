import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_MEALS_KEY, NUTRITION_CALENDAR_KEY, NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import MacroRings from './MacroRings';
import { Plus, Settings, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const AddMealModal   = lazy(() => import('./AddMealModal'));
const NutriGoalModal = lazy(() => import('./NutriGoalModal'));

// ─── Utils ─────────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const MEAL_META = {
  breakfast: { label: 'Завтрак', icon: '🌅' },
  lunch:     { label: 'Обед',    icon: '☀️' },
  dinner:    { label: 'Ужин',    icon: '🌙' },
  snack:     { label: 'Снэк',    icon: '🍎' },
};

const CARD_STYLE = {
  background: 'var(--habit-panel)',
  border: '1px solid var(--habit-border)',
  borderRadius: 16,
  fontFamily: "'Nunito', sans-serif",
};

// ─── Mini Strip Calendar ──────────────────────────────────────────────────────
function DateStrip({ selected, onSelect, calendarData }) {
  const calMap = {};
  (calendarData || []).forEach(d => { calMap[d.date] = d; });

  const days = [];
  for (let i = -6; i <= 0; i++) days.push(addDays(todayStr(), i));

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
      {days.map(d => {
        const entry = calMap[d];
        const isToday = d === todayStr();
        const isSel = d === selected;
        const cal = entry?.calories || 0;

        let dot = null;
        if (cal > 0) {
          const pct = cal / 2000;
          dot = pct >= 0.8 ? '#22c55e' : pct >= 0.4 ? '#f59e0b' : '#ef4444';
        }

        const [, , dd] = d.split('-');
        return (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all min-w-[40px]"
            style={{
              background: isSel ? '#f59e0b' : isToday ? 'rgba(245,158,11,0.15)' : 'var(--habit-border)',
              border: `1px solid ${isSel ? '#f59e0b' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: isSel ? '#000' : 'var(--habit-text)', opacity: 0.6 }}>
              {new Date(d + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: isSel ? '#000' : 'var(--habit-text)' }}>
              {dd}
            </span>
            <div
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: dot || 'transparent',
                border: dot ? 'none' : '1px solid var(--habit-border)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Single Meal Section ──────────────────────────────────────────────────────
function MealSection({ type, entries, dateStr, onDelete }) {
  const meta = MEAL_META[type];
  if (!entries || entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.calories, 0);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--habit-text)', opacity: 0.7 }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
          {Math.round(total)} ккал
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map(entry => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: 'var(--habit-border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--habit-text)' }}>
                  {entry.food_name}
                </span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>
                  {entry.amount}{entry.unit}
                </span>
              </div>
              <div className="flex gap-2 mt-0.5">
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>{entry.calories} ккал</span>
                <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>Б {entry.protein}г</span>
                <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>Ж {entry.fat}г</span>
                <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>У {entry.carbs}г</span>
              </div>
            </div>
            <button
              onClick={() => onDelete(entry.id)}
              className="ml-2 opacity-30 hover:opacity-70 transition-opacity"
            >
              <Trash2 size={13} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main NutritionTab ────────────────────────────────────────────────────────
export default function NutritionTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const currentMonth = monthStr(new Date(selectedDate + 'T12:00'));

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: dayData, isLoading } = useQuery({
    queryKey: NUTRITION_MEALS_KEY(selectedDate),
    queryFn: () => djangoApi.nutrition.getMeals(selectedDate),
    staleTime: 30_000,
  });

  const { data: calendarData } = useQuery({
    queryKey: NUTRITION_CALENDAR_KEY(currentMonth),
    queryFn: () => djangoApi.nutrition.getCalendar(currentMonth),
    staleTime: 60_000,
  });

  const { data: goal } = useQuery({
    queryKey: NUTRI_GOAL_KEY,
    queryFn: () => djangoApi.nutrition.getGoal(),
    staleTime: 5 * 60_000,
  });

  // ── Delete mutation ───────────────────────────────────────────────────────────
  const deleteMealMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'meals', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      toast({ title: '🗑️ Запись удалена' });
    },
    onError: (e) => toast({ title: 'Ошибка', description: e?.message, variant: 'destructive' }),
  });

  const totals = dayData?.totals || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const goalData = dayData?.goal || goal || { calories: 2000, protein: 150, fat: 65, carbs: 250 };
  const meals = dayData?.meals || {};
  const hasMeals = Object.values(meals).some(arr => arr.length > 0);

  const isToday = selectedDate === todayStr();

  return (
    <div className="flex flex-col gap-3 pb-24">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
              🍽️ Дневник питания
            </div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 1 }}>
              {isToday ? 'Сегодня' : formatDate(selectedDate)}
            </div>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="p-2 rounded-xl transition-all hover:opacity-70"
            style={{ background: 'var(--habit-border)', border: 'none', cursor: 'pointer' }}
            title="Настроить цели"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Кольца КБЖУ */}
        <MacroRings totals={totals} goal={goalData} />

        {/* Прогресс ккал в числах */}
        <div className="text-center mt-1">
          <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>
            Осталось: <span style={{ color: totals.calories > goalData.calories ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
              {Math.round(Math.max(0, goalData.calories - totals.calories))} ккал
            </span>
          </span>
        </div>
      </div>

      {/* ── Date Strip ─────────────────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-3">
        <DateStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          calendarData={calendarData}
        />
      </div>

      {/* ── Meals List ─────────────────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
            Приёмы пищи
          </span>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(245,158,11,0.35)',
            }}
          >
            <Plus size={14} />
            Добавить
          </motion.button>
        </div>

        {isLoading && (
          <div className="py-8 text-center opacity-40 text-sm">Загрузка...</div>
        )}

        {!isLoading && !hasMeals && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-10 text-center"
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 14, opacity: 0.4, fontWeight: 700 }}>
              Пока ничего не добавлено
            </div>
            <div style={{ fontSize: 12, opacity: 0.3, marginTop: 4 }}>
              Нажми «Добавить» чтобы начать
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {!isLoading && ['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
            <MealSection
              key={type}
              type={type}
              entries={meals[type]}
              dateStr={selectedDate}
              onDelete={(id) => deleteMealMut.mutate(id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showAddModal && (
            <AddMealModal
              dateStr={selectedDate}
              onClose={() => setShowAddModal(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showGoalModal && (
            <NutriGoalModal
              currentGoal={goalData}
              onClose={() => setShowGoalModal(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
