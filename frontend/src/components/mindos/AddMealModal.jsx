// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { hapticLight } from '@/hooks/useHaptic';

const MEAL_TYPES = [
  { id: 'breakfast', key: 'breakfast', defaultLabel: 'Breakfast', icon: '🌅', color: '#f59e0b' },
  { id: 'lunch',     key: 'lunch',     defaultLabel: 'Lunch',     icon: '☀️', color: '#f97316' },
  { id: 'dinner',    key: 'dinner',    defaultLabel: 'Dinner',    icon: '🌙', color: '#7B61FF' },
  { id: 'snack',     key: 'snack',     defaultLabel: 'Snack',     icon: '🍎', color: '#10b981' },
];

const QUICK_PORTIONS = [50, 100, 150, 200, 250, 300];

function getFoodEmoji(name = '') {
  const lower = (name || '').toLowerCase();
  if (lower.includes('pizza') || lower.includes('piz') || lower.includes('пицц')) return '🍕';
  if (lower.includes('oat') || lower.includes('porridge') || lower.includes('овсян') || lower.includes('каша')) return '🥣';
  if (lower.includes('pancake') || lower.includes('сырник') || lower.includes('блин')) return '🥞';
  if (lower.includes('egg') || lower.includes('omelet') || lower.includes('яйц') || lower.includes('яичниц')) return '🍳';
  if (lower.includes('chicken') || lower.includes('poultry') || lower.includes('куриц') || lower.includes('филе')) return '🍗';
  if (lower.includes('beef') || lower.includes('steak') || lower.includes('meat') || lower.includes('стейк') || lower.includes('мясо')) return '🥩';
  if (lower.includes('fish') || lower.includes('salmon') || lower.includes('tuna') || lower.includes('лосос') || lower.includes('рыб')) return '🐟';
  if (lower.includes('rice') || lower.includes('рис')) return '🍚';
  if (lower.includes('pasta') || lower.includes('spaghetti') || lower.includes('noodle') || lower.includes('макарон')) return '🍝';
  if (lower.includes('potato') || lower.includes('картоф')) return '🥔';
  if (lower.includes('cheese') || lower.includes('cottage') || lower.includes('творог') || lower.includes('сыр')) return '🧀';
  if (lower.includes('milk') || lower.includes('yogurt') || lower.includes('молок') || lower.includes('йогурт')) return '🥛';
  if (lower.includes('protein') || lower.includes('shake') || lower.includes('шейк')) return '🥤';
  if (lower.includes('burger') || lower.includes('бургер')) return '🍔';
  if (lower.includes('shawarma') || lower.includes('wrap') || lower.includes('шаурм')) return '🌯';
  if (lower.includes('coffee') || lower.includes('cappuccino') || lower.includes('latte') || lower.includes('tea') || lower.includes('кофе') || lower.includes('чай')) return '☕';
  if (lower.includes('banana') || lower.includes('банан')) return '🍌';
  if (lower.includes('apple') || lower.includes('яблок')) return '🍎';
  if (lower.includes('avocado') || lower.includes('авокадо')) return '🥑';
  if (lower.includes('salad') || lower.includes('салат')) return '🥗';
  if (lower.includes('soup') || lower.includes('борщ') || lower.includes('суп')) return '🍲';
  return '🍽️';
}

export default function AddMealModal({ dateStr, initialMealType = 'breakfast', onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [tab, setTab] = useState('search'); // 'search' | 'new'
  const [mealType, setMealType] = useState(initialMealType);
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
  const [shakeField, setShakeField] = useState(null);

  // Live macro preview for create form
  const livePreview = {
    calories: Number(newFood.calories_per_100) || 0,
    protein: Number(newFood.protein_per_100) || 0,
    fat: Number(newFood.fat_per_100) || 0,
    carbs: Number(newFood.carbs_per_100) || 0,
  };

  const today = dateStr || new Date().toISOString().split('T')[0];

  // 350ms debounce for search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: GLOBAL_FOOD_KEY(debouncedSearch),
    queryFn: () => djangoApi.nutrition.searchGlobal(debouncedSearch),
    staleTime: 30_000,
    enabled: debouncedSearch.length >= 2,
  });

  // Quick-Add: recently used foods
  const { data: recentFoods = [] } = useQuery({
    queryKey: NUTRITION_RECENT_KEY,
    queryFn: () => djangoApi.nutrition.getRecentFoods(12),
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
    hapticLight();
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
    } else {
      payload.global_food_id = selectedFood.id;
    }

    addMealMut.mutate(payload);
  }

  function handleCreateFood() {
    const { name, calories_per_100 } = newFood;
    if (!name.trim()) {
      setShakeField('name');
      setTimeout(() => setShakeField(null), 600);
      return toast({ title: t('nutrition.add_modal.enter_name_error', 'Enter food name'), variant: 'destructive' });
    }
    if (!calories_per_100) {
      setShakeField('calories');
      setTimeout(() => setShakeField(null), 600);
      return toast({ title: t('nutrition.add_modal.enter_cal_error', 'Enter calories per 100g'), variant: 'destructive' });
    }

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
              GLOBAL DATABASE
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
                  onClick={() => {
                    hapticLight();
                    setMealType(id);
                  }}
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
              ['search', t('nutrition.add_modal.search_tab', '🔍 Search Global Database')],
              ['new', t('nutrition.add_modal.create_tab', '➕ Create Custom Food')],
            ].map(([id, label]) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    hapticLight();
                    setTab(id);
                  }}
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

          {/* ── Tab: Unified Search Global Database ───────────────────────────────────── */}
          {tab === 'search' && (
            <div className="space-y-3">
              {/* Search input bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--habit-text)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('nutrition.add_modal.search_placeholder', 'Search food e.g. pizza, chicken breast, oatmeal...')}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs md:text-sm outline-none font-bold placeholder:font-normal transition-all"
                  style={{
                    background: 'var(--habit-border)',
                    color: 'var(--habit-text)',
                    border: search ? '1px solid var(--habit-gold, #f59e0b)' : '1px solid transparent',
                    boxShadow: search ? '0 0 0 3px rgba(245,158,11,0.1)' : 'none',
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

              {/* ── Results List ───────────────────────────────────────────────── */}
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">

                {/* 0. Recent Foods — shown when search is empty */}
                {!debouncedSearch && recentFoods.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] px-1 flex items-center gap-1">
                      <Zap size={11} /> {t('nutrition.add_modal.recently_used', '⚡ Recently Used')}
                    </div>
                    <AnimatePresence>
                      {recentFoods.slice(0, 6).map((food, i) => {
                        const isSelected = selectedFood?.id === food.id && (selectedFood?.is_custom === (food.is_custom ?? true));
                        const emoji = getFoodEmoji(food.name);
                        return (
                          <motion.button
                            key={`recent-${food.id}-${i}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            whileHover={{ scale: 1.01, x: 2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSelectFood(food, food.is_custom ?? true)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-left w-full border"
                            style={{
                              background: isSelected ? 'rgba(245,158,11,0.22)' : 'var(--habit-border)',
                              borderColor: isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent',
                              boxShadow: isSelected ? '0 0 12px rgba(245,158,11,0.2)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <span className="text-base shrink-0">{emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-xs truncate text-[var(--habit-text)]">{food.name}</div>
                                <div className="flex items-center gap-2 text-[10px] font-mono font-bold mt-0.5">
                                  <span className="text-[var(--habit-gold,#f59e0b)]">🔥 {Math.round(food.calories_per_100)} kcal</span>
                                  <span className="text-[#3b82f6]">P: {food.protein_per_100}g</span>
                                  <span className="text-[#f97316]">F: {food.fat_per_100}g</span>
                                  <span className="text-[#10b981]">C: {food.carbs_per_100}g</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[9px] font-black text-black bg-[var(--habit-gold,#f59e0b)] px-2 py-0.5 rounded-full shrink-0">✓</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* 1. User Saved Custom Foods (if any, when searching) */}
                {userFoods.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] px-1 flex items-center gap-1">
                      <User size={11} /> {t('nutrition.add_modal.my_saved_foods', 'My Saved Foods')}
                    </div>
                    <AnimatePresence>
                      {userFoods.map((food, i) => {
                        const isSelected = selectedFood?.id === food.id && selectedFood?.is_custom;
                        const emoji = getFoodEmoji(food.name);
                        return (
                          <motion.button
                            key={`user-${food.id}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            whileHover={{ scale: 1.01, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelectFood(food, true)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-left w-full border"
                            style={{
                              background: isSelected ? 'rgba(245,158,11,0.22)' : 'var(--habit-border)',
                              borderColor: isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent',
                              boxShadow: isSelected ? '0 0 12px rgba(245,158,11,0.2)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                              <span className="text-base shrink-0">{emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-xs truncate text-[var(--habit-text)]">{food.name}</div>
                                <div className="flex items-center gap-2 text-[10px] font-mono font-bold mt-0.5">
                                  <span className="text-[var(--habit-gold,#f59e0b)]">🔥 {food.calories_per_100} kcal</span>
                                  <span className="text-[#3b82f6]">P: {food.protein_per_100}g</span>
                                  <span className="text-[#f97316]">F: {food.fat_per_100}g</span>
                                  <span className="text-[#10b981]">C: {food.carbs_per_100}g</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleFavMut.mutate({ id: food.id, is_favorite: !food.is_favorite }); }}
                                className="opacity-70 hover:opacity-100 p-1.5 transition-opacity"
                              >
                                <Star size={13} fill={food.is_favorite ? '#f59e0b' : 'none'} color={food.is_favorite ? '#f59e0b' : 'currentColor'} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (confirm(t('nutrition.confirm_delete_food', `Delete "${food.name}" from catalog?`))) { deleteFoodMut.mutate(food.id); } }}
                                className="opacity-40 hover:opacity-100 hover:text-red-400 p-1.5 transition-opacity"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* 2. Global Database (Open Food Facts) Items */}
                {globalFoods.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[var(--habit-dim)] px-1 flex items-center gap-1">
                      <Globe size={11} /> {t('nutrition.add_modal.global_database', 'Global Food Database')}
                    </div>
                    <AnimatePresence>
                      {globalFoods.map((food, i) => {
                        const isSelected = selectedFood?.id === food.id && !selectedFood?.is_custom;
                        const emoji = getFoodEmoji(food.name);
                        return (
                          <motion.button
                            key={`global-${food.id}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.035, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            whileHover={{ scale: 1.01, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelectFood(food, false)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-left w-full border"
                            style={{
                              background: isSelected ? 'rgba(245,158,11,0.22)' : 'var(--habit-border)',
                              borderColor: isSelected ? 'var(--habit-gold, #f59e0b)' : 'transparent',
                              boxShadow: isSelected ? '0 0 12px rgba(245,158,11,0.25)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                              <span className="text-base shrink-0">{emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 font-black text-xs text-[var(--habit-text)] truncate">
                                  <span className="truncate">{food.name}</span>
                                  {food.brand && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/40 text-[var(--habit-dim)] shrink-0">{food.brand}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10.5px] font-mono font-bold mt-0.5">
                                  <span className="text-[var(--habit-gold,#f59e0b)]">🔥 {Math.round(food.calories_per_100)} kcal</span>
                                  <span className="text-[#3b82f6]">P: {food.protein_per_100}g</span>
                                  <span className="text-[#f97316]">F: {food.fat_per_100}g</span>
                                  <span className="text-[#10b981]">C: {food.carbs_per_100}g</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[9px] font-black text-black bg-[var(--habit-gold,#f59e0b)] px-2 py-0.5 rounded-full shrink-0">✓</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  !isSearching && debouncedSearch && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-6 text-xs text-[var(--habit-dim)]"
                    >
                      {t('nutrition.add_modal.no_results', 'No matching foods found. Try another term or create custom.')}
                    </motion.div>
                  )
                )}

                {/* Empty state when no search and no recents */}
                {!debouncedSearch && recentFoods.length === 0 && (
                  <div className="text-center py-4 text-xs text-[var(--habit-dim)] opacity-60">
                    {t('nutrition.add_modal.start_typing', 'Type to search foods...')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: New Custom Food Form ────────────────────────────────────────── */}
          {tab === 'new' && (
            <div className="flex flex-col gap-2.5 mb-4">
              {/* Live macro preview bar */}
              {(livePreview.calories > 0 || livePreview.protein > 0) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-2.5 rounded-xl border"
                  style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.25)' }}
                >
                  <div className="text-[9px] font-black uppercase tracking-wider text-[var(--habit-dim)] mb-1.5">LIVE PREVIEW (per 100g)</div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: 'kcal', value: livePreview.calories, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
                      { label: 'prot', value: livePreview.protein,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
                      { label: 'fat',  value: livePreview.fat,      color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)' },
                      { label: 'carbs',value: livePreview.carbs,    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' },
                    ].map(({ label, value, color, bg, border }) => (
                      <motion.div
                        key={label}
                        className="p-1.5 rounded-lg"
                        style={{ background: bg, border: `1px solid ${border}` }}
                        animate={value > 0 ? { scale: [1, 1.06, 1] } : {}}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="text-[9px] uppercase text-[var(--habit-dim)] font-black">{label}</div>
                        <div className="text-xs font-black font-mono" style={{ color }}>{value}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 }}
                animate={shakeField === 'name' ? { x: [0, -8, 8, -6, 6, 0] } : { opacity: 1, y: 0 }}
              >
                <label className="text-[11px] font-bold text-[var(--habit-dim)] mb-1 block">
                  {t('nutrition.add_modal.food_name_label', 'Food Name *')}
                </label>
                <input
                  type="text"
                  value={newFood.name}
                  onChange={(e) => setNewFood((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t('nutrition.add_modal.food_name_placeholder', 'e.g. Boiled oatmeal porridge')}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all"
                  style={{
                    background: 'var(--habit-border)',
                    color: 'var(--habit-text)',
                    border: shakeField === 'name' ? '1px solid #f74e52' : '1px solid transparent',
                    boxShadow: shakeField === 'name' ? '0 0 0 3px rgba(247,78,82,0.2)' : 'none',
                  }}
                />
              </motion.div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { field: 'calories_per_100', label: t('nutrition.add_modal.calories_label', 'Calories / 100g *'), color: 'var(--habit-gold,#f59e0b)', placeholder: '130', shakeKey: 'calories' },
                  { field: 'protein_per_100',  label: t('nutrition.add_modal.protein_label', 'Protein (g)'),         color: 'var(--habit-blue,#3b82f6)', placeholder: '4.5',  shakeKey: null },
                  { field: 'fat_per_100',      label: t('nutrition.add_modal.fat_label', 'Fat (g)'),                color: 'var(--habit-orange,#f97316)', placeholder: '1.2', shakeKey: null },
                  { field: 'carbs_per_100',    label: t('nutrition.add_modal.carbs_label', 'Carbs (g)'),            color: 'var(--habit-green,#10b981)', placeholder: '25',  shakeKey: null },
                ].map(({ field, label, color, placeholder, shakeKey }, idx) => (
                  <motion.div
                    key={field}
                    initial={{ opacity: 0, y: 8 }}
                    animate={shakeField === shakeKey
                      ? { x: [0, -8, 8, -5, 5, 0], opacity: 1, y: 0 }
                      : { opacity: 1, y: 0 }
                    }
                    transition={{ delay: idx * 0.05, duration: shakeField === shakeKey ? 0.4 : 0.3 }}
                  >
                    <label className="text-[11px] font-bold mb-1 block" style={{ color }}>{label}</label>
                    <input
                      type="number"
                      value={newFood[field]}
                      onChange={(e) => setNewFood((p) => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none font-bold transition-all"
                      style={{
                        background: 'var(--habit-border)',
                        color: 'var(--habit-text)',
                        border: shakeField === shakeKey ? '1px solid #f74e52' : '1px solid transparent',
                        boxShadow: shakeField === shakeKey ? '0 0 0 3px rgba(247,78,82,0.2)' : 'none',
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleCreateFood}
                disabled={createFoodMut.isPending}
                className="w-full py-2.5 rounded-xl font-bold text-xs mt-1 transition-opacity"
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.02 }}
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
              </motion.button>
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
                  <span className="text-base">{getFoodEmoji(selectedFood.name)}</span>
                  <span style={{ fontWeight: 900, fontSize: 13, color: 'var(--habit-gold, #f59e0b)' }} className="truncate">
                    {selectedFood.name}
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
                  onClick={() => {
                    hapticLight();
                    setAmount((prev) => Math.max(10, Number(prev) - 25));
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-border)] hover:bg-[var(--habit-panel)] text-[var(--habit-text)] transition-all shrink-0"
                  title="-25g"
                >
                  -
                </button>
                {QUICK_PORTIONS.map((portion) => {
                  const isActive = Number(amount) === portion;
                  return (
                    <button
                      key={portion}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setAmount(portion);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all shrink-0"
                      style={{
                        background: isActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)',
                        color: isActive ? '#000000' : 'var(--habit-dim, #888)',
                        boxShadow: isActive ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {portion}g
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setAmount((prev) => Number(prev) + 25);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm bg-[var(--habit-border)] hover:bg-[var(--habit-panel)] text-[var(--habit-text)] transition-all shrink-0"
                  title="+25g"
                >
                  +
                </button>
              </div>

              {/* Custom amount input + Macro Summary Grid */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--habit-dim)]">{t('nutrition.add_modal.portion_label', 'Portion')}:</span>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, e.target.value))}
                    className="w-20 px-2 py-1 rounded-xl text-center text-xs font-black outline-none font-mono"
                    style={{ background: 'var(--habit-border)', color: 'var(--habit-text)', border: '1px solid var(--habit-border)' }}
                  />
                  <span className="text-xs font-bold opacity-60">{selectedFood.unit || t('nutrition.g', 'g')}</span>
                </div>
              </div>

              {preview && (
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <div className="text-[10px] font-mono font-bold text-[var(--habit-dim)] uppercase tracking-wider">
                    CALCULATED NUTRITION FOR [{amount}{selectedFood.unit || 'g'}]:
                  </div>
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
