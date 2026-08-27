// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTierColor, getGearClassColor, GEAR_CLASS_NAMES } from '@/lib/gameState';
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";
import { Package, Zap, Coins } from "lucide-react";
import { getMediaUrl, djangoApi } from "@/api/djangoClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import GameCard from "@/components/ui/GameCard";
import { useTranslation } from "react-i18next";
import ConsumableDetailModal from "./ConsumableDetailModal";
// Consumable effects are handled server-side via the shop buy endpoint.
// Do NOT track consumable state in localStorage — use the backend profile as SSOT.

const GEAR_TIER_BASE_COSTS = {
  E: 100,
  D: 250,
  C: 600,
  B: 1500,
  A: 3500,
  S: 8000,
  SS: 20000,
  SSS: 50000,
};

function getItemSellValue(item) {
  const baseCost = item.cost || (item.gear_class ? (GEAR_TIER_BASE_COSTS[item.gear_class] || 100) : 10);
  return Math.max(1, Math.floor(baseCost * 0.30));
}

export default function InventoryPanel({ gs, onSave, onToggleEquip }) {
  const [tab, setTab] = useState("gear");
  const [toast, setToast] = useState(null);
  const [usedId, setUsedId] = useState(null);
  const [selectedConsumable, setSelectedConsumable] = useState(null);
  const { bursts, trigger: triggerBurst } = usePixelBurst();
  const queryClient = useQueryClient();
  const { t } = useTranslation();


  const sellMutation = useMutation({
    mutationFn: (itemId) => djangoApi.shop.sell(itemId, 1),
    onSuccess: (/** @type {any} */ data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      showToast(data?.detail || "Item sold", "#fbbf24");
    },
    onError: (error) => {
      showToast(error.message || "Failed to sell", "#ef4444");
    }
  });

  const inventory = gs.inventory || [];
  const consumables_active = gs.consumables || {};

  const gearOwned = inventory.filter(i => !i.consumable);
  const consumablesOwned = inventory.filter(i => i.consumable);

  const isEquipped = (item) => item.is_equipped;

  const consumeMutation = useMutation({
    mutationFn: (itemCode) => djangoApi.inventory.consume(itemCode),
    onSuccess: (/** @type {any} */ data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["active_effects"] });
      triggerBurst("#22c55e", 12);
      showToast(data?.detail || "Item used!", "#22c55e");
    },
    onError: (error) => {
      showToast(error.message || "Failed to use item", "#ef4444");
    }
  });

  const applyConsumable = (item) => {
    const itemCode = item.code || item.id;
    if (!itemCode) {
      console.error('[InventoryPanel] Cannot consume: item.code is missing', item);
      return;
    }
    setUsedId(item.id || itemCode);
    consumeMutation.mutate(itemCode);
    setTimeout(() => setUsedId(null), 800);
  };

  const showToast = (msg, color) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">{t('inventory_panel.title')}</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          ({gearOwned.length} {t('inventory_panel.gear_tab')} · {consumablesOwned.length} {t('inventory_panel.consumables_tab')})
        </span>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-3 py-2 rounded-lg text-xs font-mono text-center"
            style={{ background: `${toast.color}20`, color: toast.color, border: `1px solid ${toast.color}50` }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-tabs */}
      <div className="flex gap-1">
        {["gear", "consumables"].map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3 py-1 text-[10px] font-mono uppercase rounded transition-all cursor-pointer ${tab === tb ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >{t(`inventory_panel.${tb}_tab`, tb)}</button>
        ))}
      </div>

      {/* Active consumable indicators */}
      {tab === "consumables" && Object.entries(consumables_active).some(([, v]) => v?.active) && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">{t('inventory_panel.active_effects')}</div>
          {Object.entries(consumables_active).map(([id, c]) => {
            if (!c?.active) return null;
            const expired = c.expiresAt && Date.now() > c.expiresAt;
            if (expired) return null;
            if (expired) return null;
            const effectColor = "#8b5cf6"; // Default buff color
            const effectName = c.skill_id ? c.skill_id.replace(/_/g, " ") : "Buff";
            const timeLeft = c.expiresAt ? Math.max(0, Math.ceil((c.expiresAt - Date.now()) / 3600000)) + "h left" : "1 session";
            return (
              <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono"
                style={{ background: `${effectColor}15`, border: `1px solid ${effectColor}40` }}>
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                  style={{ color: effectColor }}>■</motion.span>
                <span style={{ color: effectColor }}>{effectName}</span>
                <span className="ml-auto text-muted-foreground/40">{timeLeft}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Gear list */}
      {tab === "gear" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
          {gearOwned.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground/40 font-mono text-xs">{t('inventory_panel.no_gear')}</div>
          ) : gearOwned.map((item, idx) => {
            const tierColor = item.gear_class
              ? getGearClassColor(item.gear_class)
              : getTierColor(item.tier);
            const equipped_now = isEquipped(item);
            return (
              <GameCard key={`${item.id}-${idx}`}
                isActive={equipped_now}
                borderColor={tierColor}
                glowColor={tierColor}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex flex-col text-center p-3 relative"
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                {/* Icon */}
                {(() => {
                  const itemName = item.label || item.name || item.code || "Item";
                  const statsObj = item.stats || item.stat_bonuses;
                  const statsFormatted = statsObj && Object.keys(statsObj).length > 0
                    ? Object.entries(statsObj).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')
                    : item.effect || "No stats";

                  return (
                    <>
                      <div className="mx-auto shrink-0 w-12 h-12 rounded-none border overflow-hidden bg-gray-100 dark:bg-gray-800/50 mb-2 relative"
                        style={{ imageRendering: "pixelated", borderColor: `${tierColor}60` }}>
                        {item.icon_url
                          ? <img src={getMediaUrl(item.icon_url)} alt={itemName} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                          : <div className="w-full h-full flex items-center justify-center font-mono text-xs font-black text-gray-900 dark:text-gray-200" style={{ color: tierColor === '#ffffff' ? undefined : tierColor }}>{itemName[0]}</div>
                        }
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-start">
                        <div className="flex items-center justify-center gap-1 px-1">
                          {item.gear_class && (
                            <span
                              className="text-[8px] font-mono font-black px-1 rounded shrink-0"
                              style={{ background: `${tierColor}25`, color: tierColor, border: `1px solid ${tierColor}50` }}
                            >
                              {item.gear_class}
                            </span>
                          )}
                          <div className="font-mono text-[11px] font-bold text-gray-900 dark:text-gray-200 truncate" style={{ color: tierColor }}>
                            {itemName}
                          </div>
                        </div>
                        {equipped_now && <div className="mt-1"><span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded" style={{ background: `${tierColor}30`, color: tierColor }}>{t('inventory_panel.equipped', 'EQUIPPED')}</span></div>}
                        <div className="text-[9px] font-mono text-muted-foreground/80 font-semibold mt-1 truncate px-1" style={{ color: `${tierColor}d0` }}>
                          {statsFormatted}
                        </div>
                        {item.gear_class && (
                          <div className="text-[8px] font-mono mt-0.5 tracking-wider" style={{ color: `${tierColor}80` }}>
                            {GEAR_CLASS_NAMES[item.gear_class]}
                          </div>
                        )}
                        <div className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-0.5">{item.slot?.replace('_', ' ')}</div>
                      </div>
                    </>
                  );
                })()}

                <div className="mt-3 shrink-0 flex flex-col gap-1 z-10 relative">
                  {!equipped_now ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                      className="w-full px-2 py-1.5 text-[9px] font-mono font-bold rounded border transition-all cursor-pointer"
                      style={{ borderColor: `${tierColor}60`, color: tierColor, background: `${tierColor}15` }}
                    >{t('inventory_panel.equip', 'EQUIP')}</motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                      className="w-full px-2 py-1.5 text-[9px] font-mono font-bold rounded border transition-all opacity-50 cursor-pointer"
                      style={{ borderColor: "#1e293b", color: "#4a4060", background: "transparent" }}
                    >{t('inventory_panel.unequip', 'UNEQUIP')}</motion.button>
                  )}

                  {!equipped_now && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => sellMutation.mutate(item.id)}
                      disabled={sellMutation.isPending}
                      className="w-full px-2 py-1.5 text-[9px] font-mono font-bold rounded border transition-all border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Coins className="w-3 h-3" />
                      {t('inventory_panel.sell', 'SELL')} (+{getItemSellValue(item)}G)
                    </motion.button>
                  )}
                </div>
              </GameCard>
            );
          })}
        </div>
      )}

      {/* Consumables list */}
      {tab === "consumables" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
          {consumablesOwned.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground/40 font-mono text-xs">{t('inventory_panel.no_consumables')}</div>
          ) : consumablesOwned.map((item, idx) => {
            const tierColor = getTierColor(item.tier);
            const effectColor = tierColor || "#8b5cf6";
            const isUsed = usedId === (item.id || item.code);
            const itemCode = item.code || item.id;
            const alreadyActive = consumables_active[itemCode]?.active && (!consumables_active[itemCode]?.expiresAt || Date.now() < consumables_active[itemCode]?.expiresAt);
            // Count how many of this item in inventory
            const count = item.quantity || consumablesOwned.filter(i => (i.id === item.id || i.code === itemCode)).length;

            // Only render first occurrence per id to avoid duplicate rows
            const firstIdx = consumablesOwned.findIndex(i => (i.id === item.id || (i.code && i.code === itemCode)));
            if (firstIdx !== idx) return null;

            return (
              <GameCard key={item.id}
                isActive={alreadyActive || isUsed}
                borderColor={effectColor}
                glowColor={effectColor}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, scale: isUsed ? [1, 1.03, 1] : 1 }}
                transition={{ delay: idx * 0.04, scale: isUsed ? { duration: 0.3 } : {} }}
                className="flex flex-col text-center p-3 relative cursor-pointer hover:border-opacity-80 transition-all"
                onClick={() => setSelectedConsumable(item)}
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                <PixelFlash active={isUsed} color={effectColor} />
                {isUsed && <PixelBurstLayer bursts={bursts} />}

                <div className="mx-auto shrink-0 w-12 h-12 rounded-none border overflow-hidden relative mb-2"
                  style={{ imageRendering: "pixelated", background: "var(--habit-panel)", borderColor: `${effectColor}60` }}>
                  <img src={getMediaUrl(item.icon_url) || '/static/items/default.webp'} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                  {count > 1 && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-black shadow"
                      style={{ background: effectColor, color: "#000" }}>{count}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-start">
                  <div className="font-mono text-[11px] font-bold truncate px-1" style={{ color: tierColor }}>{item.label}</div>
                  {alreadyActive && (
                    <div className="mt-1">
                      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                        className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${effectColor}30`, color: effectColor }}>{t('inventory_panel.active', 'ACTIVE')}</motion.span>
                    </div>
                  )}
                  <div className="text-[9px] font-mono mt-1 text-muted-foreground/50 truncate px-1" style={{ color: `${effectColor}bb` }}>
                    {String(t(`consumable_effects.${item.id}`, item.description || item.effect || "Temporary Buff"))}
                  </div>
                </div>

                {/* Direct quick action buttons */}
                <div className="mt-3 shrink-0 flex flex-col gap-1 z-10 relative" onClick={(e) => e.stopPropagation()}>
                  <motion.button
                    onClick={() => applyConsumable(item)}
                    disabled={alreadyActive}
                    whileTap={!alreadyActive && !consumeMutation.isPending ? { scale: 0.9 } : {}}
                    className="w-full px-2 py-1.5 text-[9px] font-mono font-black rounded border transition-all relative overflow-hidden flex items-center justify-center gap-1 cursor-pointer"
                    style={{
                      borderColor: alreadyActive ? "#1e293b" : effectColor,
                      color: alreadyActive ? "#4a4060" : effectColor,
                      background: alreadyActive ? "transparent" : `${effectColor}20`,
                      opacity: alreadyActive ? 0.5 : 1,
                    }}
                  >
                    {!alreadyActive && (
                      <motion.div className="absolute inset-0 pointer-events-none"
                        animate={{ x: ["-100%", "120%"] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 2.5 }}
                        style={{ background: `linear-gradient(90deg, transparent, ${effectColor}35, transparent)`, width: "55%" }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-1">
                      {alreadyActive ? `■ ${t('inventory_panel.active', 'ACTIVE')}` : <><Zap className="w-3 h-3" /> {t('inventory_panel.use', 'USE')}</>}
                    </span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => sellMutation.mutate(item.id)}
                    disabled={sellMutation.isPending}
                    className="w-full px-2 py-1.5 text-[9px] font-mono font-black rounded border transition-all border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center cursor-pointer"
                  >
                    <Coins className="w-3 h-3 mr-1" />
                    {t('inventory_panel.sell', 'SELL')}
                  </motion.button>
                </div>
              </GameCard>
            );
          })}
        </div>
      )}

      {/* Consumable Detail Modal (Allies Style) */}
      <ConsumableDetailModal
        item={selectedConsumable}
        isOpen={!!selectedConsumable}
        onClose={() => setSelectedConsumable(null)}
        count={selectedConsumable ? (selectedConsumable.quantity || consumablesOwned.filter(i => (i.id === selectedConsumable.id || (selectedConsumable.code && i.code === selectedConsumable.code))).length) : 1}
        isActive={selectedConsumable ? (consumables_active[selectedConsumable.code || selectedConsumable.id]?.active && (!consumables_active[selectedConsumable.code || selectedConsumable.id]?.expiresAt || Date.now() < consumables_active[selectedConsumable.code || selectedConsumable.id]?.expiresAt)) : false}
        activeData={selectedConsumable ? consumables_active[selectedConsumable.code || selectedConsumable.id] : null}
        onConsume={applyConsumable}
        onSell={(itemToSell) => sellMutation.mutate(itemToSell.id)}
        isConsuming={consumeMutation.isPending}
        isSelling={sellMutation.isPending}
      />
    </div>
  );
}