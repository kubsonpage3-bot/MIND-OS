import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_COMBOS_KEY, NUTRITION_MEALS_KEY, FOOD_ITEMS_KEY } from '@/constants/queryKeys';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Utensils, X, Sunrise, Sun, Moon, Apple } from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', key: 'breakfast', defaultLabel: 'Breakfast', icon: Sunrise, color: 'var(--habit-gold, #ffbe5d)' },
  { id: 'lunch',     key: 'lunch',     defaultLabel: 'Lunch',     icon: Sun,     color: 'var(--habit-orange, #ff8800)' },
  { id: 'dinner',    key: 'dinner',    defaultLabel: 'Dinner',    icon: Moon,    color: 'var(--habit-purple, #7B61FF)' },
  { id: 'snack',     key: 'snack',     defaultLabel: 'Snack',     icon: Apple,   color: 'var(--habit-green, #1ca830)' },
];

export default function SavedCombosModal({ dateStr, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [targetMealType, setTargetMealType] = useState('breakfast');
  const [comboName, setComboName] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // [{ food_item_id, food_name, amount, calories_per_100, protein_per_100, fat_per_100, carbs_per_100, unit }]

  const { data: combos = [], isLoading } = useQuery({
    queryKey: NUTRITION_COMBOS_KEY,
    queryFn: () => djangoApi.nutrition.getCombos(),
  });

  const { data: userFoods = [] } = useQuery({
    queryKey: FOOD_ITEMS_KEY(''),
    queryFn: () => djangoApi.nutrition.getFoods(),
  });

  const logComboMut = useMutation({
    mutationFn: ({ comboId, mealType }) =>
      djangoApi.nutrition.logCombo(comboId, { date: dateStr, meal_type: mealType }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_MEALS_KEY(dateStr) });
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'calendar'] });
      toast({ title: t('nutrition.combos.combo_added', '🍱 Combo added to diary!') });
      onClose();
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const createComboMut = useMutation({
    mutationFn: (data) => djangoApi.nutrition.createCombo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_COMBOS_KEY });
      toast({ title: t('nutrition.combos.combo_saved', '✅ Combo saved!') });
      setView('list');
      setComboName('');
      setSelectedItems([]);
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const deleteComboMut = useMutation({
    mutationFn: (id) => djangoApi.nutrition.deleteCombo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NUTRITION_COMBOS_KEY });
      toast({ title: t('nutrition.combos.combo_deleted', '🗑️ Combo deleted') });
    },
    onError: (e) => toast({ title: t('nutrition.error', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const handleAddItemToCombo = (food) => {
    if (selectedItems.some((i) => i.food_item_id === food.id)) return;
    setSelectedItems([
      ...selectedItems,
      {
        food_item_id: food.id,
        food_name: food.name,
        amount: 100,
        calories_per_100: food.calories_per_100,
        protein_per_100: food.protein_per_100,
        fat_per_100: food.fat_per_100,
        carbs_per_100: food.carbs_per_100,
        unit: food.unit || 'g',
      },
    ]);
  };

  const handleSaveCombo = () => {
    if (!comboName.trim()) return toast({ title: t('nutrition.combos.enter_name_error', 'Enter combo name'), variant: 'destructive' });
    if (selectedItems.length === 0) return toast({ title: t('nutrition.combos.add_item_error', 'Add at least one food item'), variant: 'destructive' });

    createComboMut.mutate({
      name: comboName.trim(),
      default_meal_type: targetMealType,
      items: selectedItems.map((i) => ({ food_item_id: i.food_item_id, amount: i.amount })),
    });
  };

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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Utensils size={18} style={{ color: 'var(--habit-gold, #f59e0b)' }} />
            <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--habit-text)' }}>
              {t('nutrition.combos.title', '🍱 Saved Meal Combos')}
            </span>
          </div>
          <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">
            ×
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView('list')}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: view === 'list' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: view === 'list' ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
              border: `1px solid ${view === 'list' ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)'}`,
              cursor: 'pointer',
            }}
          >
            {t('nutrition.combos.my_combos', 'My Combos ({{count}})', { count: combos.length })}
          </button>
          <button
            onClick={() => setView('create')}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
            style={{
              background: view === 'create' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: view === 'create' ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim, #888)',
              border: `1px solid ${view === 'create' ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-border)'}`,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> {t('nutrition.combos.create_combo', 'Create Combo')}
          </button>
        </div>

        {/* ── View: List ──────────────────────────────────────────────────────── */}
        {view === 'list' && (
          <div className="space-y-3">
            {combos.length === 0 && (
              <div className="py-10 text-center opacity-40 text-sm whitespace-pre-line">
                {t('nutrition.combos.empty_desc', 'You have no saved combos yet.\nCreate a set of foods for 1-tap logging!')}
              </div>
            )}

            {combos.map((combo) => (
              <div
                key={combo.id}
                className="p-3.5 rounded-xl border transition-all"
                style={{
                  background: 'var(--habit-border)',
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--habit-text)' }}>
                      {combo.name}
                    </div>
                    <div className="flex gap-2 text-[11px] font-bold mt-0.5">
                      <span style={{ color: 'var(--habit-gold, #f59e0b)' }}>{combo.totals.calories} {t('nutrition.kcal', 'kcal')}</span>
                      <span style={{ color: 'var(--habit-blue, #3b82f6)' }}>{t('nutrition.macros.p_short', 'P')} {combo.totals.protein}{t('nutrition.g', 'g')}</span>
                      <span style={{ color: 'var(--habit-orange, #f97316)' }}>{t('nutrition.macros.f_short', 'F')} {combo.totals.fat}{t('nutrition.g', 'g')}</span>
                      <span style={{ color: 'var(--habit-green, #10b981)' }}>{t('nutrition.macros.c_short', 'C')} {combo.totals.carbs}{t('nutrition.g', 'g')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteComboMut.mutate(combo.id)}
                    className="p-1.5 opacity-40 hover:opacity-100 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Items preview */}
                <div className="text-[11px] text-[var(--habit-dim)] mb-3 pl-1 space-y-0.5">
                  {combo.items.map((it) => (
                    <div key={it.id}>
                      • {it.food_name} — {it.amount}{it.unit || t('nutrition.g', 'g')}
                    </div>
                  ))}
                </div>

                {/* 1-Tap Log Button */}
                <div className="flex gap-1.5 overflow-x-auto pt-1">
                  {MEAL_TYPES.map(({ id, key, defaultLabel, icon: IconComponent, color }) => (
                    <motion.button
                      key={id}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => logComboMut.mutate({ comboId: combo.id, mealType: id })}
                      disabled={logComboMut.isPending}
                      className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: 'var(--habit-panel)',
                        color: 'var(--habit-text)',
                        border: '1px solid var(--habit-border)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <IconComponent size={12} style={{ color }} />
                      <span>{t(`nutrition.meals.${key}`, defaultLabel)}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── View: Create ────────────────────────────────────────────────────── */}
        {view === 'create' && (
          <div className="space-y-3">
            <input
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder={t('nutrition.combos.name_placeholder', 'Combo name (e.g. Oatmeal with banana)...')}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none font-bold"
              style={{ background: 'var(--habit-border)', color: 'var(--habit-text)' }}
            />

            {/* Selected items list */}
            {selectedItems.length > 0 && (
              <div className="space-y-2 p-2.5 rounded-xl border border-[var(--habit-border)]">
                <div className="text-xs font-bold text-[var(--habit-dim)]">{t('nutrition.combos.items_in_combo', 'Foods in combo:')}</div>
                {selectedItems.map((it, idx) => (
                  <div key={it.food_item_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold flex-1 truncate">{it.food_name}</span>
                    <input
                      type="number"
                      min={1}
                      value={it.amount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSelectedItems(
                          selectedItems.map((item, i) =>
                            i === idx ? { ...item, amount: val } : item
                          )
                        );
                      }}
                      className="w-16 px-2 py-1 rounded text-center font-bold outline-none"
                      style={{ background: 'var(--habit-border)' }}
                    />
                    <span className="text-[10px] text-[var(--habit-dim)]">{it.unit || t('nutrition.g', 'g')}</span>
                    <button
                      onClick={() =>
                        setSelectedItems(selectedItems.filter((_, i) => i !== idx))
                      }
                      className="text-red-400 opacity-60 hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* User foods picker */}
            <div>
              <div className="text-xs font-bold text-[var(--habit-dim)] mb-1.5">
                {t('nutrition.combos.select_foods', 'Select foods to add:')}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {userFoods.map((food) => {
                  const isAdded = selectedItems.some((i) => i.food_item_id === food.id);
                  return (
                    <button
                      key={food.id}
                      onClick={() => !isAdded && handleAddItemToCombo(food)}
                      disabled={isAdded}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left text-xs transition-all"
                      style={{
                        background: isAdded ? 'rgba(16,185,129,0.12)' : 'var(--habit-border)',
                        color: 'var(--habit-text)',
                        opacity: isAdded ? 0.6 : 1,
                        cursor: isAdded ? 'default' : 'pointer',
                      }}
                    >
                      <span className="font-bold truncate">{food.name}</span>
                      <span className="text-[var(--habit-gold,#f59e0b)] font-mono ml-2 shrink-0">
                        {food.calories_per_100} {t('nutrition.kcal', 'kcal')}/100{food.unit || t('nutrition.g', 'g')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveCombo}
              disabled={createComboMut.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-sm mt-2"
              style={{
                background: 'linear-gradient(135deg, var(--habit-gold, #f59e0b), #d97706)',
                color: '#000',
                cursor: 'pointer',
              }}
            >
              {createComboMut.isPending ? t('nutrition.combos.saving', 'Saving...') : t('nutrition.combos.save_btn', '💾 Save Combo')}
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
