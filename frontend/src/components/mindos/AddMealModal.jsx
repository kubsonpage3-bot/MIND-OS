import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_MEALS_KEY,
  GLOBAL_FOOD_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Search, Star, Camera, X, Globe, User, Loader2 } from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', key: 'breakfast', defaultLabel: 'Breakfast', icon: '🌅' },
  { id: 'lunch',     key: 'lunch',     defaultLabel: 'Lunch',     icon: '☀️' },
  { id: 'dinner',    key: 'dinner',    defaultLabel: 'Dinner',    icon: '🌙' },
  { id: 'snack',     key: 'snack',     defaultLabel: 'Snack',     icon: '🍎' },
];

const QUICK_PORTIONS = [50, 100, 150, 200, 300];

export default function AddMealModal({ dateStr, initialMealType = 'breakfast', onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [tab, setTab] = useState('search'); // 'search' | 'new'
  const [mealType, setMealType] = useState(initialMealType);
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState(null); // { id, name, calories_per_100, protein_per_100, fat_per_100, carbs_per_100, unit, is_custom, brand }
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');

  // New custom food form
  const [newFood, setNewFood] = useState({
    name: '',
    calories_per_100: '',
    protein_per_100: '',
    fat_per_100: '',
    carbs_per_100: '',
    unit: 'g',
  });

  const today = dateStr || new Date().toISOString().split('T')[0];

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: GLOBAL_FOOD_KEY(search),
    queryFn: () => djangoApi.nutrition.searchGlobal(search),
    staleTime: 30_000,
  });

  const userFoods = searchResults?.user_foods || [];
  const globalFoods = searchResults?.global_foods || [];

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(today) });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
    queryClient.invalidateQueries({ queryKey: ['nutrition', 'trends'] });
  };

  const addMealMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.addMeal(data),
    onSuccess: () => {
      invalidate();
      toast({
        title: t('nutrition.add_modal.added_toast_title', '🍽️ Meal added!'),
        description: `${selectedFood?.name} — ${amount}${selectedFood?.unit || t('nutrition.g', 'g')} (${Math.round((selectedFood?.calories_per_100 * amount) / 100)} ${t('nutrition.kcal', 'kcal')})`,
      });
      onClose();
    },
    onError: (e) =>
      toast({ title: t('nutrition.add_modal.add_error', 'Failed to add meal'), description: e?.message || 'Try again', variant: 'destructive' }),
  });

  const createFoodMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.createFood(data),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'search-global'] });
      setSelectedFood({ ...item, is_custom: true });
      setTab('search');
      toast({ title: t('nutrition.add_modal.food_saved_toast', '✅ Food saved to catalog'), description: item.name });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const toggleFavMut = useMutation({
    mutationFn: ({ id, is_favorite }) => djangoApi.nutrition.updateFood(id, { is_favorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'search-global'] });
    },
  });

  // ── Computed ─────────────────────────────────────────────────────────────────
  const preview = selectedFood
    ? {
        calories: ((selectedFood.calories_per_100 * amount) / 100).toFixed(1),
        protein: ((selectedFood.protein_per_100 * amount) / 100).toFixed(1),
        fat: ((selectedFood.fat_per_100 * amount) / 100).toFixed(1),
        carbs: ((selectedFood.carbs_per_100 * amount) / 100).toFixed(1),
      }
    : null;

  const canSubmit = selectedFood && amount > 0;

  function handleAddMeal() {
    if (!canSubmit) return;

    const payload = {
      date: today,
      meal_type: mealType,
      amount: Number(amount),
      note,
      photo_url: photoPreview,
    };

    if (selectedFood.is_custom) {
      payload.food_item_id = selectedFood.id;
    } else {
      payload.global_food_id = selectedFood.id;
    }

    addMealMut.mutate(payload);
  }

  function handleCreateFood() {
    const { name, calories_per_100 } = newFood;
    if (!name.trim()) return toast({ title: t('nutrition.add_modal.enter_name_error', 'Enter food name'), variant: 'destructive' });
    if (!calories_per_100) return toast({ title: t('nutrition.add_modal.enter_cal_error', 'Enter calories per 100g'), variant: 'destructive' });

    createFoodMut.mutate({
      name: newFood.name.trim(),
      calories_per_100: Number(newFood.calories_per_100),
      protein_per_100: Number(newFood.protein_per_100 || 0),
      fat_per_100: Number(newFood.fat_per_100 || 0),
      carbs_per_100: Number(newFood.carbs_per_100 || 0),
      unit: newFood.unit || 'g',
    });
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--habit-panel)',
          border: '1px solid var(--habit-border)',
          borderRadius: '20px 20px 0 0',
          padding: 20,
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
            {t('nutrition.add_modal.title', '🍽️ Add Meal')}
          </span>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">
            ×
          </button>
        </div>

        {/* Meal Type Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {MEAL_TYPES.map(({ id, key, defaultLabel, icon }) => (
            <button
              key={id}
              onClick={() => setMealType(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: mealType === id ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                color: mealType === id ? '#000' : 'var(--habit-text)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {icon} {t(`nutrition.meals.${key}`, defaultLabel)}
            </button>
          ))}
        </div>

        {/* Tabs: Search vs New Food */}
        <div className="flex gap-2 mb-4">
          {[
            ['search', t('nutrition.add_modal.search_tab', '🔍 Search Food')],
            ['new', t('nutrition.add_modal.create_tab', '➕ Create Food')],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: tab === id ? 'rgba(245,158,11,0.18)' : 'transparent',
                color: tab === id ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
                border: `1px solid ${tab === id ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)'}`,
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('nutrition.add_modal.search_placeholder', 'Search by name, brand, or database...')}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none font-medium"
                style={{
                  background: 'var(--habit-border)',
                  color: 'var(--habit-text)',
                  border: '1px solid transparent',
                }}
                autoFocus
              />
              {isSearching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--habit-gold,#f59e0b)]" />
              )}
            </div>

            {/* Search Results List */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-4 scrollbar-thin">
              {userFoods.length === 0 && globalFoods.length === 0 && !isSearching && (
                <div className="text-center py-6 opacity-40 text-xs">
                  {search
                    ? t('nutrition.add_modal.not_found', 'Nothing found in database')
                    : t('nutrition.add_modal.search_hint', 'Enter food name or switch to «Create Food»')}
                </div>
              )}

              {/* My Custom / Favorite Foods */}
              {userFoods.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--habit-dim)] mb-1 px-1 flex items-center gap-1">
                    <User size={11} /> {t('nutrition.add_modal.my_saved_foods', 'My Saved Foods')}
                  </div>
                  <div className="space-y-1">
                    {userFoods.map((food) => {
                      const isSelected = selectedFood?.id === food.id && selectedFood?.is_custom;
                      return (
                        <motion.button
                          key={`user-${food.id}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedFood(food)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all w-full"
                          style={{
                            background: isSelected ? 'rgba(245,158,11,0.18)' : 'var(--habit-border)',
                            border: `1px solid ${isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-bold text-xs truncate text-[var(--habit-text)]">
                              {food.name}
                            </div>
                            <div className="text-[10px] text-[var(--habit-gold,#f59e0b)] font-mono font-bold mt-0.5">
                              {food.calories_per_100} {t('nutrition.kcal', 'kcal')} / 100{food.unit || t('nutrition.g', 'g')} · {t('nutrition.macros.p_short', 'P')}:{food.protein_per_100} {t('nutrition.macros.f_short', 'F')}:{food.fat_per_100} {t('nutrition.macros.c_short', 'C')}:{food.carbs_per_100}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavMut.mutate({ id: food.id, is_favorite: !food.is_favorite });
                            }}
                            className="opacity-60 hover:opacity-100 p-1"
                          >
                            <Star
                              size={14}
                              fill={food.is_favorite ? '#f59e0b' : 'none'}
                              color={food.is_favorite ? '#f59e0b' : 'currentColor'}
                            />
                          </button>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Global Open Food Facts Items */}
              {globalFoods.length > 0 && (
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--habit-dim)] mb-1 px-1 flex items-center gap-1">
                    <Globe size={11} /> {t('nutrition.add_modal.global_database', 'Global Database (Open Food Facts)')}
                  </div>
                  <div className="space-y-1">
                    {globalFoods.map((food) => {
                      const isSelected = selectedFood?.id === food.id && !selectedFood?.is_custom;
                      return (
                        <motion.button
                          key={`global-${food.id}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedFood(food)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all w-full"
                          style={{
                            background: isSelected ? 'rgba(59,130,246,0.18)' : 'var(--habit-border)',
                            border: `1px solid ${isSelected ? 'var(--habit-blue, #3b82f6)' : 'transparent'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-bold text-xs truncate text-[var(--habit-text)]">
                              {food.name}
                              {food.brand && <span className="opacity-50 text-[10px] ml-1">({food.brand})</span>}
                            </div>
                            <div className="text-[10px] text-[var(--habit-blue,#3b82f6)] font-mono font-bold mt-0.5">
                              {food.calories_per_100} {t('nutrition.kcal', 'kcal')} / 100{t('nutrition.g', 'g')} · {t('nutrition.macros.p_short', 'P')}:{food.protein_per_100} {t('nutrition.macros.f_short', 'F')}:{food.fat_per_100} {t('nutrition.macros.c_short', 'C')}:{food.carbs_per_100}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: New Custom Food Form ────────────────────────────────────────── */}
        {tab === 'new' && (
          <div className="flex flex-col gap-2.5 mb-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--habit-dim)] mb-1 block">
                {t('nutrition.add_modal.food_name_label', 'Food Name *')}
              </label>
              <input
                type="text"
                value={newFood.name}
                onChange={(e) => setNewFood((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('nutrition.add_modal.food_name_placeholder', 'e.g. Boiled oatmeal porridge')}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-[var(--habit-gold,#f59e0b)] mb-1 block">
                  {t('nutrition.add_modal.calories_label', 'Calories per 100g *')}
                </label>
                <input
                  type="number"
                  value={newFood.calories_per_100}
                  onChange={(e) => setNewFood((p) => ({ ...p, calories_per_100: e.target.value }))}
                  placeholder="130"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none font-bold"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--habit-blue,#3b82f6)] mb-1 block">
                  {t('nutrition.add_modal.protein_label', 'Protein (g)')}
                </label>
                <input
                  type="number"
                  value={newFood.protein_per_100}
                  onChange={(e) => setNewFood((p) => ({ ...p, protein_per_100: e.target.value }))}
                  placeholder="4.5"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--habit-orange,#f97316)] mb-1 block">
                  {t('nutrition.add_modal.fat_label', 'Fat (g)')}
                </label>
                <input
                  type="number"
                  value={newFood.fat_per_100}
                  onChange={(e) => setNewFood((p) => ({ ...p, fat_per_100: e.target.value }))}
                  placeholder="1.2"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--habit-green,#10b981)] mb-1 block">
                  {t('nutrition.add_modal.carbs_label', 'Carbs (g)')}
                </label>
                <input
                  type="number"
                  value={newFood.carbs_per_100}
                  onChange={(e) => setNewFood((p) => ({ ...p, carbs_per_100: e.target.value }))}
                  placeholder="25"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
                />
              </div>
            </div>

            <button
              onClick={handleCreateFood}
              disabled={createFoodMut.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-xs mt-1 transition-opacity"
              style={{
                background: 'var(--habit-green, #10b981)',
                color: '#fff',
                opacity: createFoodMut.isPending ? 0.6 : 1,
                cursor: 'pointer',
              }}
            >
              {createFoodMut.isPending
                ? t('nutrition.add_modal.saving', 'Saving...')
                : t('nutrition.add_modal.save_to_catalog', '✅ Save to Catalog')}
            </button>
          </div>
        )}

        {/* ── Selected Food & Portion Setup ───────────────────────────────────── */}
        {selectedFood && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3.5 rounded-2xl border"
            style={{
              background: 'rgba(245,158,11,0.06)',
              borderColor: 'rgba(245,158,11,0.25)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--habit-gold, #f59e0b)' }}>
                {selectedFood.name}
              </span>
              <span className="text-[10px] opacity-60 font-mono">
                {t('nutrition.add_modal.base_macro', 'Base: {{calories}} kcal / 100{{unit}}', {
                  calories: selectedFood.calories_per_100,
                  unit: selectedFood.unit || t('nutrition.g', 'g'),
                })}
              </span>
            </div>

            {/* Quick portion buttons */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
              {QUICK_PORTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: amount === p ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                    color: amount === p ? '#000' : 'var(--habit-text)',
                    cursor: 'pointer',
                  }}
                >
                  {p}{selectedFood.unit || t('nutrition.g', 'g')}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="flex items-center gap-2 mb-2.5">
              <label className="text-xs font-bold opacity-60">{t('nutrition.add_modal.exact_weight', 'Exact weight:')}</label>
              <input
                type="number"
                value={amount}
                min={1}
                step={10}
                onChange={(e) => setAmount(e.target.value)}
                className="w-24 px-2.5 py-1 rounded-lg text-sm text-center outline-none font-bold"
                style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
              />
              <span className="text-xs opacity-60 font-bold">{selectedFood.unit || t('nutrition.g', 'g')}</span>
            </div>

            {/* Calculated Macros Preview */}
            {preview && (
              <div className="flex gap-3 text-xs font-bold pt-2 border-t border-[rgba(245,158,11,0.15)]">
                <span style={{ color: 'var(--habit-gold, #f59e0b)' }}>{preview.calories} {t('nutrition.kcal', 'kcal')}</span>
                <span style={{ color: 'var(--habit-blue, #3b82f6)' }}>{t('nutrition.macros.p_short', 'P')} {preview.protein}{t('nutrition.g', 'g')}</span>
                <span style={{ color: 'var(--habit-orange, #f97316)' }}>{t('nutrition.macros.f_short', 'F')} {preview.fat}{t('nutrition.g', 'g')}</span>
                <span style={{ color: 'var(--habit-green, #10b981)' }}>{t('nutrition.macros.c_short', 'C')} {preview.carbs}{t('nutrition.g', 'g')}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Note & Photo Attachment Row */}
        <div className="space-y-2 mb-4">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('nutrition.add_modal.note_placeholder', 'Meal note (optional)...')}
            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
          />

          <div className="flex items-center justify-between">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold opacity-70 hover:opacity-100 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <Camera size={14} />
              <span>{photoPreview ? t('nutrition.add_modal.change_photo', 'Change photo') : t('nutrition.add_modal.attach_photo', 'Attach photo')}</span>
            </button>

            {photoPreview && (
              <div className="relative flex items-center gap-2">
                <img
                  src={photoPreview}
                  alt="preview"
                  className="w-8 h-8 rounded-lg object-cover border border-white/20"
                />
                <button
                  type="button"
                  onClick={() => setPhotoPreview('')}
                  className="text-red-400 opacity-60 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAddMeal}
          disabled={!canSubmit || addMealMut.isPending}
          className="w-full py-3 rounded-xl font-black text-sm transition-all"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)'
              : 'var(--habit-border)',
            color: canSubmit ? '#000' : 'var(--habit-text)',
            opacity: addMealMut.isPending ? 0.7 : 1,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 0 20px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          {addMealMut.isPending ? t('nutrition.add_modal.saving', 'Saving...') : t('nutrition.add_modal.add_to_diary', '🍽️ Add to Diary')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
