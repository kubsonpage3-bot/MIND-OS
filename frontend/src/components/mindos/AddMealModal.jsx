// @ts-nocheck
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import {
  NUTRITION_MEALS_KEY,
  GLOBAL_FOOD_KEY,
  NUTRITION_RECENT_KEY,
} from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Search, Star, Camera, X, Globe, User, Loader2, Zap, Trash2 } from 'lucide-react';

import { CURATED_FOODS, CURATED_CATEGORIES } from '@/data/curatedFoods';

const MEAL_TYPES = [
  { id: 'breakfast', key: 'breakfast', defaultLabel: 'Breakfast', icon: '🌅' },
  { id: 'lunch',     key: 'lunch',     defaultLabel: 'Lunch',     icon: '☀️' },
  { id: 'dinner',    key: 'dinner',    defaultLabel: 'Dinner',    icon: '🌙' },
  { id: 'snack',     key: 'snack',     defaultLabel: 'Snack',     icon: '🍎' },
];

const QUICK_PORTIONS = [50, 100, 150, 200, 250, 300];

export default function AddMealModal({ dateStr, initialMealType = 'breakfast', onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [tab, setTab] = useState('search'); // 'search' | 'new'
  const [mealType, setMealType] = useState(initialMealType);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
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
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });

  // Quick-Add: последние использованные продукты
  const { data: recentFoods = [] } = useQuery({
    queryKey: NUTRITION_RECENT_KEY,
    queryFn: () => djangoApi.nutrition.getRecentFoods(12),
    staleTime: 30_000,
  });

  const userFoods = searchResults?.user_foods || [];
  const globalFoods = searchResults?.global_foods || [];

  // Filter curated foods locally (instant, 0ms latency)
  const filteredCuratedFoods = CURATED_FOODS.filter((food) => {
    const matchesCategory = selectedCategory === 'all' || food.category === selectedCategory;
    if (!search.trim()) return matchesCategory;
    const q = search.toLowerCase().trim();
    return matchesCategory && food.name.toLowerCase().includes(q);
  });

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
        title: t('nutrition.add_modal.added_toast_title', '🍽️ Meal logged!'),
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
      setAmount(item.defaultAmount || 100);
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

  const deleteFoodMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteFood(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'foods'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'search-global'] });
      queryClient.invalidateQueries({ queryKey: NUTRITION_RECENT_KEY });
      if (selectedFood?.is_custom && selectedFood?.id === id) {
        setSelectedFood(null);
      }
      toast({ title: t('nutrition.add_modal.food_deleted_toast', '🗑️ Food removed from catalog') });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  // ── Computed ─────────────────────────────────────────────────────────────────
  const preview = selectedFood
    ? {
        calories: ((selectedFood.calories_per_100 * amount) / 100).toFixed(1),
        protein: ((selectedFood.protein_per_100 * amount) / 100).toFixed(1),
        fat: ((selectedFood.fat_per_100 * amount) / 100).toFixed(1),
        carbs: ((selectedFood.carbs_per_100 * amount) / 100).toFixed(1),
        fiber: selectedFood.fiber_per_100 != null ? ((selectedFood.fiber_per_100 * amount) / 100).toFixed(1) : null,
        sugar: selectedFood.sugar_per_100 != null ? ((selectedFood.sugar_per_100 * amount) / 100).toFixed(1) : null,
        sodium: selectedFood.sodium_per_100 != null ? ((selectedFood.sodium_per_100 * amount) / 100).toFixed(0) : null,
        saturatedFat: selectedFood.saturated_fat_per_100 != null ? ((selectedFood.saturated_fat_per_100 * amount) / 100).toFixed(1) : null,
      }
    : null;

  const canSubmit = selectedFood && amount > 0;

  function handleSelectFood(food, isCustom = false) {
    setSelectedFood({ ...food, is_custom: isCustom });
    if (food.defaultAmount) {
      setAmount(food.defaultAmount);
    }
  }

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
    } else if (typeof selectedFood.id === 'string' && selectedFood.id.startsWith('c_')) {
      // Curated item -> save as custom meal record
      payload.food_name = selectedFood.name.split('/')[0].trim();
      payload.calories = Number(preview.calories);
      payload.protein = Number(preview.protein);
      payload.fat = Number(preview.fat);
      payload.carbs = Number(preview.carbs);
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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl md:rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--habit-panel, #120e24)',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.12))',
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b border-[var(--habit-border)]">
          <div className="flex items-center gap-2">
            <span style={{ fontWeight: 900, fontSize: 17, color: 'var(--habit-text)', letterSpacing: '-0.3px' }}>
              {t('nutrition.add_modal.title', '🍽️ Log Meal')}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--habit-gold,#f59e0b)] text-black">
              EAT JOURNAL
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg opacity-60 hover:opacity-100 hover:bg-[var(--habit-border)] transition-all"
            style={{ color: 'var(--habit-text)' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-3.5 scrollbar-thin">
          {/* Meal Type Selector (Clean 4-column grid) */}
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_TYPES.map(({ id, key, defaultLabel, icon }) => {
              const isCurrent = mealType === id;
              return (
                <button
                  key={id}
                  onClick={() => setMealType(id)}
                  className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-black transition-all"
                  style={{
                    background: isCurrent ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                    color: isCurrent ? '#000000' : 'var(--habit-text)',
                    boxShadow: isCurrent ? '0 2px 10px rgba(245,158,11,0.3)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-sm">{icon}</span>
                  <span className="truncate">{t(`nutrition.meals.${key}`, defaultLabel)}</span>
                </button>
              );
            })}
          </div>

          {/* Tabs: Search vs New Custom Food */}
          <div className="flex gap-2">
            {[
              ['search', t('nutrition.add_modal.search_tab', '🔍 Search & Catalog')],
              ['new', t('nutrition.add_modal.create_tab', '➕ Create Custom Food')],
            ].map(([id, label]) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex-1 py-2 rounded-xl text-xs font-black transition-all"
                  style={{
                    background: isActive ? 'rgba(245,158,11,0.18)' : 'transparent',
                    color: isActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
                    border: `1px solid ${isActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ── Tab: Search & Curated Catalog ───────────────────────────────────── */}
          {tab === 'search' && (
            <div className="space-y-3">
              {/* Search input bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--habit-text)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('nutrition.add_modal.search_placeholder', 'Type e.g. pizza, chicken, oatmeal, coffee...')}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs md:text-sm outline-none font-bold placeholder:font-normal transition-all"
                  style={{
                    background: 'var(--habit-border)',
                    color: 'var(--habit-text)',
                    border: search ? '1px solid var(--habit-gold, #f59e0b)' : '1px solid transparent',
                  }}
                  autoFocus
                />
                {isSearching && (
                  <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--habit-gold,#f59e0b)]" />
                )}
                {search && !isSearching && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-xs px-1 text-[var(--habit-text)]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Pills (When not in deep search query) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CURATED_CATEGORIES.map(({ id, label }) => {
                  const isCatActive = selectedCategory === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedCategory(id)}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-black whitespace-nowrap transition-all shrink-0"
                      style={{
                        background: isCatActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                        color: isCatActive ? '#000000' : 'var(--habit-dim)',
                        boxShadow: isCatActive ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── Curated Essentials & Search Results List ──────────────────── */}
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {/* 1. Curated Essential Foods */}
                {filteredCuratedFoods.length > 0 && (
                  <div className="space-y-1">
                    {filteredCuratedFoods.map((food) => {
                      const isSelected = selectedFood?.id === food.id;
                      return (
                        <motion.button
                          key={`curated-${food.id}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectFood(food, false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all w-full group"
                          style={{
                            background: isSelected ? 'rgba(245,158,11,0.22)' : 'var(--habit-border)',
                            border: `1px solid ${isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent'}`,
                            boxShadow: isSelected ? '0 0 12px rgba(245,158,11,0.2)' : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                            <span className="text-base shrink-0">{food.emoji || '🍽️'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-xs truncate text-[var(--habit-text)]">
                                {food.name.split('/')[0].trim()}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-mono font-bold mt-0.5">
                                <span className="text-[var(--habit-gold,#f59e0b)]">🔥 {food.calories_per_100} kcal</span>
                                <span className="text-[#3b82f6]">P: {food.protein_per_100}g</span>
                                <span className="text-[#f97316]">F: {food.fat_per_100}g</span>
                                <span className="text-[#10b981]">C: {food.carbs_per_100}g</span>
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-black text-black bg-[var(--habit-gold,#f59e0b)] px-2 py-0.5 rounded-full shrink-0">
                              SELECTED
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* 2. User Saved Foods */}
                {userFoods.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] px-1 flex items-center gap-1">
                      <User size={11} /> {t('nutrition.add_modal.my_saved_foods', 'My Saved Foods')}
                    </div>
                    {userFoods.map((food) => {
                      const isSelected = selectedFood?.id === food.id && selectedFood?.is_custom;
                      return (
                        <motion.button
                          key={`user-${food.id}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectFood(food, true)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all w-full"
                          style={{
                            background: isSelected ? 'rgba(245,158,11,0.22)' : 'var(--habit-border)',
                            border: `1px solid ${isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-black text-xs truncate text-[var(--habit-text)]">
                              {food.name}
                            </div>
                            <div className="text-[10px] text-[var(--habit-gold,#f59e0b)] font-mono font-bold mt-0.5">
                              🔥 {food.calories_per_100} kcal · P:{food.protein_per_100} F:{food.fat_per_100} C:{food.carbs_per_100}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavMut.mutate({ id: food.id, is_favorite: !food.is_favorite });
                              }}
                              className="opacity-70 hover:opacity-100 p-1.5 transition-opacity"
                            >
                              <Star size={13} fill={food.is_favorite ? '#f59e0b' : 'none'} color={food.is_favorite ? '#f59e0b' : 'currentColor'} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('nutrition.confirm_delete_food', `Delete "${food.name}" from catalog?`))) {
                                  deleteFoodMut.mutate(food.id);
                                }
                              }}
                              className="opacity-40 hover:opacity-100 hover:text-red-400 p-1.5 transition-opacity"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Global Open Food Facts Items */}
                {globalFoods.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] px-1 flex items-center gap-1">
                      <Globe size={11} /> {t('nutrition.add_modal.global_database', 'Global Database (Open Food Facts)')}
                    </div>
                    {globalFoods.map((food) => {
                      const isSelected = selectedFood?.id === food.id && !selectedFood?.is_custom;
                      return (
                        <motion.button
                          key={`global-${food.id}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectFood(food, false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all w-full"
                          style={{
                            background: isSelected ? 'rgba(59,130,246,0.22)' : 'var(--habit-border)',
                            border: `1px solid ${isSelected ? 'var(--habit-blue, #3b82f6)' : 'transparent'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-black text-xs truncate text-[var(--habit-text)]">
                              {food.name}
                              {food.brand && <span className="opacity-50 text-[10px] ml-1 font-normal">({food.brand})</span>}
                            </div>
                            <div className="text-[10px] text-[var(--habit-blue,#3b82f6)] font-mono font-bold mt-0.5">
                              ⚡ {food.calories_per_100} kcal · P:{food.protein_per_100} F:{food.fat_per_100} C:{food.carbs_per_100}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
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
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="p-3.5 rounded-2xl border relative overflow-hidden"
            style={{
              background: 'rgba(245,158,11,0.08)',
              borderColor: 'rgba(245,158,11,0.3)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <span className="text-base">{selectedFood.emoji || '🍽️'}</span>
                <span style={{ fontWeight: 900, fontSize: 13, color: 'var(--habit-gold, #f59e0b)' }} className="truncate">
                  {selectedFood.name.split('/')[0].trim()}
                </span>
              </div>
              <span className="text-[10px] opacity-60 font-mono font-bold shrink-0">
                100{selectedFood.unit || t('nutrition.g', 'g')} = {selectedFood.calories_per_100} kcal
              </span>
            </div>

            {/* Quick portion buttons + Stepper */}
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.max(10, Number(prev) - 25))}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-border)] hover:bg-[var(--habit-panel)] text-[var(--habit-text)] transition-all shrink-0"
                title="-25g"
              >
                -
              </button>
              {QUICK_PORTIONS.map((p) => {
                const isPActive = Number(amount) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-black transition-all shrink-0"
                    style={{
                      background: isPActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                      color: isPActive ? '#000000' : 'var(--habit-text)',
                      boxShadow: isPActive ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {p}{selectedFood.unit || t('nutrition.g', 'g')}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAmount((prev) => Number(prev) + 25)}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-border)] hover:bg-[var(--habit-panel)] text-[var(--habit-text)] transition-all shrink-0"
                title="+25g"
              >
                +
              </button>
            </div>

            {/* Exact Weight Input */}
            <div className="flex items-center justify-between mb-3 bg-[var(--habit-border)] px-3 py-1.5 rounded-xl">
              <label className="text-xs font-black text-[var(--habit-text)] opacity-80">
                {t('nutrition.add_modal.exact_weight', 'Portion size:')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={amount}
                  min={1}
                  step={10}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-20 px-2 py-0.5 rounded-lg text-sm text-center outline-none font-black bg-[var(--habit-panel)] border border-[var(--habit-border)]"
                  style={{ color: 'var(--habit-text)' }}
                />
                <span className="text-xs font-black opacity-70">{selectedFood.unit || t('nutrition.g', 'g')}</span>
              </div>
            </div>

            {/* Calculated Macros Preview (High Contrast Neon Chips) */}
            {preview && (
              <div className="pt-2 border-t border-[rgba(245,158,11,0.2)]">
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)]">
                    <div className="text-[9px] font-black uppercase text-[var(--habit-dim)]">CALORIES</div>
                    <div className="text-xs font-black text-[var(--habit-gold,#f59e0b)] font-mono">{preview.calories}</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)]">
                    <div className="text-[9px] font-black uppercase text-[var(--habit-dim)]">PROTEIN</div>
                    <div className="text-xs font-black text-[#3b82f6] font-mono">{preview.protein}g</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[rgba(249,115,22,0.12)] border border-[rgba(249,115,22,0.25)]">
                    <div className="text-[9px] font-black uppercase text-[var(--habit-dim)]">FAT</div>
                    <div className="text-xs font-black text-[#f97316] font-mono">{preview.fat}g</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.25)]">
                    <div className="text-[9px] font-black uppercase text-[var(--habit-dim)]">CARBS</div>
                    <div className="text-xs font-black text-[#10b981] font-mono">{preview.carbs}g</div>
                  </div>
                </div>
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
        </div>

        {/* Footer with Submit Button */}
        <div className="p-4 border-t border-[var(--habit-border)] shrink-0 bg-[var(--habit-panel)]">
          <motion.button
            whileTap={canSubmit ? { scale: 0.97 } : {}}
            onClick={handleAddMeal}
            disabled={!canSubmit || addMealMut.isPending}
            className="w-full py-3 rounded-xl font-black text-sm transition-all"
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)'
                : 'var(--habit-border)',
              color: canSubmit ? '#000' : 'var(--habit-dim, #888)',
              opacity: !canSubmit ? 0.45 : addMealMut.isPending ? 0.7 : 1,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 0 20px rgba(245,158,11,0.35)' : 'none',
              border: canSubmit ? 'none' : '1px dashed rgba(255,255,255,0.12)',
            }}
          >
            {addMealMut.isPending ? t('nutrition.add_modal.saving', 'Saving...') : t('nutrition.add_modal.add_to_diary', '🍽️ Add to Diary')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
