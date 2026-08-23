import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_MEALS_KEY,
  NUTRITION_CALENDAR_KEY,
  NUTRI_GOAL_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import MacroRings from './MacroRings';
import WaterTracker from './WaterTracker';
import {
  Plus,
  Settings,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  TrendingUp,
  Utensils,
} from 'lucide-react';

const AddMealModal = lazy(() => import('./AddMealModal'));
const NutriGoalModal = lazy(() => import('./NutriGoalModal'));
const NutriCalendarModal = lazy(() => import('./NutriCalendarModal'));
const SavedCombosModal = lazy(() => import('./SavedCombosModal'));
const NutritionTrends = lazy(() => import('./NutritionTrends'));

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
  snack:     { label: 'Перекусы & Снэки', icon: '🍎' },
};

const CARD_STYLE = {
  background: 'var(--habit-panel)',
  border: '1px solid var(--habit-border)',
  borderRadius: 16,
  fontFamily: "'Nunito', sans-serif",
};

// ─── Mini Strip Calendar ──────────────────────────────────────────────────────
function DateStrip({ selected, onSelect, calendarData, onOpenCalendar }) {
  const calMap = {};
  (calendarData || []).forEach((d) => {
    calMap[d.date] = d;
  });

  const days = [];
  for (let i = -6; i <= 0; i++) days.push(addDays(todayStr(), i));

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none">
      {days.map((d) => {
        const entry = calMap[d];
        const isToday = d === todayStr();
        const isSel = d === selected;
        const cal = entry?.calories || 0;

        let dot = null;
        if (cal > 0) {
          const pct = cal / 2000;
          dot = pct >= 0.8 && pct <= 1.2 ? 'var(--habit-green, #10b981)' : pct > 1.2 ? 'var(--habit-red, #ef4444)' : 'var(--habit-gold, #f59e0b)';
        }

        const [, , dd] = d.split('-');
        return (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all min-w-[42px] flex-1"
            style={{
              background: isSel
                ? 'var(--habit-gold, #f59e0b)'
                : isToday
                ? 'rgba(245,158,11,0.12)'
                : 'var(--habit-border)',
              border: isSel
                ? '1px solid var(--habit-gold, #f59e0b)'
                : isToday
                ? '1px solid rgba(245,158,11,0.35)'
                : '1px solid transparent',
              color: isSel ? '#000' : 'var(--habit-text)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: isSel ? '#000' : 'var(--habit-dim, #888)',
              }}
            >
              {new Date(d + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase()}
            </span>
            <span style={{ fontSize: 13, fontWeight: 900 }}>{dd}</span>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: dot || 'transparent',
                border: dot ? 'none' : '1px solid var(--habit-border)',
              }}
            />
          </button>
        );
      })}

      {/* Calendar modal trigger */}
      <button
        onClick={onOpenCalendar}
        className="p-2.5 rounded-xl flex items-center justify-center transition-all opacity-80 hover:opacity-100 shrink-0"
        style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
        title="Открыть полный календарь"
      >
        <CalendarIcon size={16} />
      </button>
    </div>
  );
}

// ─── Collapsible Meal Section ─────────────────────────────────────────────────
function CollapsibleMealCard({ type, entries = [], onAddClick, onDeleteItem }) {
  const [isOpen, setIsOpen] = useState(true);
  const meta = MEAL_META[type];

  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totalP = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const totalF = entries.reduce((s, e) => s + (e.fat || 0), 0);
  const totalC = entries.reduce((s, e) => s + (e.carbs || 0), 0);

  return (
    <div
      className="rounded-2xl transition-all overflow-hidden mb-3"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
      }}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-[var(--habit-border)]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-left flex-1"
          style={{ cursor: 'pointer' }}
        >
          <span className="text-base">{meta.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--habit-text)' }}>
              {meta.label}
            </div>
            {entries.length > 0 ? (
              <div className="flex gap-2 text-[10px] font-bold mt-0.5">
                <span style={{ color: 'var(--habit-gold, #f59e0b)' }}>{Math.round(totalCal)} ккал</span>
                <span style={{ color: 'var(--habit-blue, #3b82f6)' }}>Б:{Math.round(totalP)}г</span>
                <span style={{ color: 'var(--habit-orange, #f97316)' }}>Ж:{Math.round(totalF)}г</span>
                <span style={{ color: 'var(--habit-green, #10b981)' }}>У:{Math.round(totalC)}г</span>
              </div>
            ) : (
              <div className="text-[10px] text-[var(--habit-dim)] font-medium">Нет записей</div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onAddClick(type)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all"
            style={{
              background: 'rgba(245,158,11,0.14)',
              color: 'var(--habit-gold, #f59e0b)',
              border: '1px solid rgba(245,158,11,0.3)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            <span>Добавить</span>
          </motion.button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity"
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Items List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-2.5 space-y-1.5"
          >
            {entries.length === 0 ? (
              <div className="py-4 text-center text-xs opacity-40 font-medium">
                Нажми «Добавить», чтобы записать {meta.label.toLowerCase()}
              </div>
            ) : (
              entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl group transition-all"
                  style={{ background: 'var(--habit-border)' }}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    {entry.photo_url ? (
                      <img
                        src={entry.photo_url}
                        alt="meal"
                        className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-30 shrink-0"
                        style={{ background: 'var(--habit-panel)' }}
                      >
                        <Utensils size={13} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate text-[var(--habit-text)]">
                          {entry.food_name}
                        </span>
                        <span className="text-[10px] opacity-60 font-mono shrink-0">
                          {entry.amount}{entry.unit}
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px] font-bold mt-0.5">
                        <span style={{ color: 'var(--habit-gold, #f59e0b)' }}>{entry.calories} ккал</span>
                        <span style={{ color: 'var(--habit-blue, #3b82f6)' }}>Б {entry.protein}г</span>
                        <span style={{ color: 'var(--habit-orange, #f97316)' }}>Ж {entry.fat}г</span>
                        <span style={{ color: 'var(--habit-green, #10b981)' }}>У {entry.carbs}г</span>
                        {entry.note && (
                          <span className="opacity-50 italic truncate max-w-[120px] font-normal">
                            · {entry.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(entry.id)}
                    className="p-1 opacity-30 hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                    title="Удалить запись"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main NutritionTab ────────────────────────────────────────────────────────
export default function NutritionTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [targetAddMealType, setTargetAddMealType] = useState('breakfast');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCombosModal, setShowCombosModal] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(selectedDate) });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
      toast({ title: '🗑️ Запись удалена' });
    },
    onError: (e) => toast({ title: 'Ошибка', description: e?.message, variant: 'destructive' }),
  });

  const totals = dayData?.totals || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const goalData = dayData?.goal || goal || { calories: 2000, protein: 150, fat: 65, carbs: 250, water_ml: 2000 };
  const meals = dayData?.meals || {};

  const isToday = selectedDate === todayStr();
  const remainingCal = Math.round(goalData.calories - totals.calories);

  const handleOpenAddModal = (mealType = 'breakfast') => {
    setTargetAddMealType(mealType);
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-col gap-3 pb-24 font-sans">
      {/* ── Top Bar & Actions ──────────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-4">
        <div className="flex items-center justify-between mb-3">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div className="px-1 text-center">
              <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--habit-text)' }}>
                {isToday ? 'Сегодня' : formatDate(selectedDate)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--habit-dim, #888)', fontWeight: 600 }}>
                {new Date(selectedDate + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long' })}
              </div>
            </div>

            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase ml-1"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: 'var(--habit-gold, #f59e0b)',
                }}
              >
                Сегодня
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCombosModal(true)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              title="Сохранённые комбо-блюда"
            >
              <Utensils size={15} />
            </button>

            <button
              onClick={() => setShowTrends(!showTrends)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{
                background: showTrends ? 'rgba(245,158,11,0.2)' : 'var(--habit-border)',
                color: showTrends ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-text)',
              }}
              title="Тренды и аналитика"
            >
              <TrendingUp size={15} />
            </button>

            <button
              onClick={() => setShowGoalModal(true)}
              className="p-2 rounded-xl transition-all opacity-80 hover:opacity-100"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              title="Настроить цели питания"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>

        {/* Macro Rings */}
        <MacroRings totals={totals} goal={goalData} />

        {/* Calories Remaining Banner */}
        <div className="text-center mt-2 pt-2 border-t border-[var(--habit-border)]">
          <span style={{ fontSize: 12, color: 'var(--habit-dim, #888)', fontWeight: 600 }}>
            Осталось:{' '}
            <span
              style={{
                color: remainingCal >= 0 ? 'var(--habit-green, #10b981)' : 'var(--habit-red, #ef4444)',
                fontWeight: 800,
                fontFamily: "'VT323', monospace",
                fontSize: 16,
              }}
            >
              {remainingCal >= 0 ? `${remainingCal} ккал` : `+${Math.abs(remainingCal)} ккал (перебор)`}
            </span>
          </span>
        </div>
      </div>

      {/* ── 7-Day Strip Navigation ─────────────────────────────────────────── */}
      <div style={CARD_STYLE} className="p-2.5">
        <DateStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          calendarData={calendarData}
          onOpenCalendar={() => setShowCalendarModal(true)}
        />
      </div>

      {/* ── Toggable Trends & Analytics Drawer ─────────────────────────────── */}
      <AnimatePresence>
        {showTrends && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Suspense fallback={null}>
              <NutritionTrends />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Water Tracker ──────────────────────────────────────────────────── */}
      <WaterTracker dateStr={selectedDate} goalMl={goalData.water_ml} />

      {/* ── Collapsible Meal Categories ─────────────────────────────────────── */}
      <div>
        {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
          <CollapsibleMealCard
            key={type}
            type={type}
            entries={meals[type] || []}
            onAddClick={handleOpenAddModal}
            onDeleteItem={(id) => deleteMealMut.mutate(id)}
          />
        ))}
      </div>

      {/* ── Floating Add Button for Mobile ─────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => handleOpenAddModal('breakfast')}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-black text-sm shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)',
            color: '#000',
            boxShadow: '0 8px 24px rgba(245,158,11,0.4)',
          }}
        >
          <Plus size={18} />
          <span>Добавить блюдо</span>
        </motion.button>
      </div>

      {/* ── Lazy Loaded Modals ─────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showAddModal && (
            <AddMealModal
              dateStr={selectedDate}
              initialMealType={targetAddMealType}
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

        <AnimatePresence>
          {showCalendarModal && (
            <NutriCalendarModal
              selectedDate={selectedDate}
              goalCalories={goalData.calories}
              onSelectDate={setSelectedDate}
              onClose={() => setShowCalendarModal(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCombosModal && (
            <SavedCombosModal
              dateStr={selectedDate}
              onClose={() => setShowCombosModal(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
