import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_MEALS_KEY, FOOD_ITEMS_KEY, NUTRITION_CALENDAR_KEY, NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Search, Plus, Star, Trash2, ChevronDown } from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Завтрак', icon: '🌅' },
  { id: 'lunch',     label: 'Обед',    icon: '☀️' },
  { id: 'dinner',    label: 'Ужин',    icon: '🌙' },
  { id: 'snack',     label: 'Снэк',    icon: '🍎' },
];

const PANEL_STYLE = {
  background: 'var(--habit-panel)',
  border: '1px solid var(--habit-border)',
  borderRadius: 16,
  fontFamily: "'Nunito', sans-serif",
};

/**
 * Модалка добавления блюда.
 * @param {{ dateStr: string, onClose: () => void }} props
 */
export default function AddMealModal({ dateStr, onClose }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('search');    // 'search' | 'new'
  const [mealType, setMealType] = useState('breakfast');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');

  // New food form
  const [newFood, setNewFood] = useState({
    name: '', calories_per_100: '', protein_per_100: '', fat_per_100: '', carbs_per_100: '', unit: 'g',
  });

  const today = dateStr || new Date().toISOString().split('T')[0];

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: foods = [] } = useQuery({
    queryKey: FOOD_ITEMS_KEY(search),
    queryFn: () => djangoApi.nutrition.getFoods(search),
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'meals', today] });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
  };

  const addMealMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.addMeal(data),
    onSuccess: () => {
      invalidate();
      toast({ title: '🍽️ Добавлено!', description: `${selectedFood?.name} — ${amount}${selectedFood?.unit || 'г'}` });
      onClose();
    },
    onError: (e) => toast({ title: 'Ошибка', description: e?.message || 'Не удалось добавить', variant: 'destructive' }),
  });

  const createFoodMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.createFood(data),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
      setSelectedFood(item);
      setTab('search');
      toast({ title: '✅ Продукт создан', description: item.name });
    },
    onError: (e) => toast({ title: 'Ошибка', description: e?.message, variant: 'destructive' }),
  });

  const toggleFavMut = useMutation({
    mutationFn: ({ id, is_favorite }) => djangoApi.nutrition.updateFood(id, { is_favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] }),
  });

  // ── Computed ─────────────────────────────────────────────────────────────────
  const preview = selectedFood
    ? {
        calories: ((selectedFood.calories_per_100 * amount) / 100).toFixed(1),
        protein:  ((selectedFood.protein_per_100  * amount) / 100).toFixed(1),
        fat:      ((selectedFood.fat_per_100      * amount) / 100).toFixed(1),
        carbs:    ((selectedFood.carbs_per_100    * amount) / 100).toFixed(1),
      }
    : null;

  const canSubmit = selectedFood && amount > 0;

  function handleAddMeal() {
    if (!canSubmit) return;
    addMealMut.mutate({
      food_item_id: selectedFood.id,
      date: today,
      meal_type: mealType,
      amount: Number(amount),
      note,
    });
  }

  function handleCreateFood() {
    const { name, calories_per_100 } = newFood;
    if (!name.trim()) return toast({ title: 'Введи название продукта', variant: 'destructive' });
    if (!calories_per_100) return toast({ title: 'Введи калории', variant: 'destructive' });
    createFoodMut.mutate({
      ...newFood,
      calories_per_100: Number(newFood.calories_per_100),
      protein_per_100:  Number(newFood.protein_per_100 || 0),
      fat_per_100:      Number(newFood.fat_per_100 || 0),
      carbs_per_100:    Number(newFood.carbs_per_100 || 0),
    });
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto"
        style={{ ...PANEL_STYLE, borderRadius: '20px 20px 0 0', padding: 20 }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
            🍽️ Добавить блюдо
          </span>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>
        </div>

        {/* Meal type selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {MEAL_TYPES.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setMealType(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all"
              style={{
                background: mealType === id ? '#f59e0b' : 'var(--habit-border)',
                color: mealType === id ? '#000' : 'var(--habit-text)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Tabs: поиск / новый */}
        <div className="flex gap-2 mb-4">
          {[['search', '🔍 Поиск'], ['new', '➕ Новый']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: tab === id ? 'rgba(245,158,11,0.2)' : 'transparent',
                color: tab === id ? '#f59e0b' : 'var(--habit-text)',
                border: `1px solid ${tab === id ? '#f59e0b' : 'var(--habit-border)'}`,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Search ─────────────────────────────────────────────────────── */}
        {tab === 'search' && (
          <div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск продукта..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--habit-border)',
                  color: 'var(--habit-text)',
                  border: '1px solid transparent',
                }}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-3">
              {foods.length === 0 && (
                <p className="text-center py-6 opacity-40 text-sm">
                  {search ? 'Не найдено' : 'Список пуст — добавь продукт'}
                </p>
              )}
              {foods.map(food => (
                <motion.button
                  key={food.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedFood(food)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                  style={{
                    background: selectedFood?.id === food.id ? 'rgba(245,158,11,0.15)' : 'var(--habit-border)',
                    border: `1px solid ${selectedFood?.id === food.id ? '#f59e0b' : 'transparent'}`,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--habit-text)' }}>
                      {food.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 8 }}>
                      {food.calories_per_100} ккал/100{food.unit}
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toggleFavMut.mutate({ id: food.id, is_favorite: !food.is_favorite }); }}
                    className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Star size={13} fill={food.is_favorite ? '#f59e0b' : 'none'} color={food.is_favorite ? '#f59e0b' : 'currentColor'} />
                  </button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: New Food ────────────────────────────────────────────────────── */}
        {tab === 'new' && (
          <div className="flex flex-col gap-2 mb-3">
            {[
              { key: 'name', label: 'Название *', type: 'text', placeholder: 'Куриная грудка' },
              { key: 'calories_per_100', label: 'Калории на 100г *', type: 'number', placeholder: '165' },
              { key: 'protein_per_100',  label: 'Белки г',          type: 'number', placeholder: '31' },
              { key: 'fat_per_100',      label: 'Жиры г',           type: 'number', placeholder: '3.6' },
              { key: 'carbs_per_100',    label: 'Углеводы г',       type: 'number', placeholder: '0' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-bold opacity-60 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={newFood[key]}
                  onChange={e => setNewFood(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>
            ))}
            <button
              onClick={handleCreateFood}
              disabled={createFoodMut.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-sm mt-1 transition-opacity"
              style={{ background: '#10b981', color: '#fff', opacity: createFoodMut.isPending ? 0.6 : 1, cursor: 'pointer' }}
            >
              {createFoodMut.isPending ? 'Создаю...' : '✅ Создать продукт'}
            </button>
          </div>
        )}

        {/* ── Amount + Preview ─────────────────────────────────────────────────── */}
        {selectedFood && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontWeight: 800, fontSize: 13, color: '#f59e0b' }}>
                {selectedFood.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs opacity-60">Количество:</label>
              <input
                type="number"
                value={amount}
                min={1}
                onChange={e => setAmount(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg text-sm text-center outline-none font-bold"
                style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              />
              <span className="text-xs opacity-60">{selectedFood.unit}</span>
            </div>
            {preview && (
              <div className="flex gap-3 text-xs font-bold">
                <span style={{ color: '#f59e0b' }}>{preview.calories} ккал</span>
                <span style={{ color: '#3b82f6' }}>Б {preview.protein}г</span>
                <span style={{ color: '#f97316' }}>Ж {preview.fat}г</span>
                <span style={{ color: '#10b981' }}>У {preview.carbs}г</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Note */}
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Заметка (необязательно)..."
          className="w-full px-3 py-2 rounded-xl text-sm mb-4 outline-none"
          style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
        />

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAddMeal}
          disabled={!canSubmit || addMealMut.isPending}
          className="w-full py-3 rounded-xl font-black text-sm transition-all"
          style={{
            background: canSubmit ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--habit-border)',
            color: canSubmit ? '#000' : 'var(--habit-text)',
            opacity: addMealMut.isPending ? 0.7 : 1,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 0 20px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          {addMealMut.isPending ? '⏳ Добавляю...' : '🍽️ Добавить'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
