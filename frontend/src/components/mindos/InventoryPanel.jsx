import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTierColor } from "@/lib/gameState";
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";
import { Package, Zap, Coins } from "lucide-react";
import { getMediaUrl, djangoApi } from "@/api/djangoClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import GameCard from "@/components/ui/GameCard";
// Consumable effects are handled server-side via the shop buy endpoint.
// Do NOT track consumable state in localStorage — use the backend profile as SSOT.

export default function InventoryPanel({ gs, onSave, onToggleEquip }) {
  const [tab, setTab] = useState("gear");
  const [toast, setToast] = useState(null);
  const [usedId, setUsedId] = useState(null);
  const { bursts, trigger: triggerBurst } = usePixelBurst();
  const queryClient = useQueryClient();

  const sellMutation = useMutation({
    mutationFn: (itemId) => djangoApi.shop.sell(itemId, 1),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      showToast(data.detail || "Item sold", "#fbbf24");
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["active_effects"] });
      triggerBurst("#22c55e", 12);
      showToast(data.detail || "Item used!", "#22c55e");
    },
    onError: (error) => {
      showToast(error.message || "Failed to use item", "#ef4444");
    }
  });

  const applyConsumable = (item) => {
    setUsedId(item.id);
    consumeMutation.mutate(item.code);
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
        <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Inventory</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          ({gearOwned.length} gear · {consumablesOwned.length} consumables)
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
        {["gear", "consumables"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 text-[10px] font-mono uppercase rounded transition-all ${tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >{t}</button>
        ))}
      </div>

      {/* Active consumable indicators */}
      {tab === "consumables" && Object.entries(consumables_active).some(([, v]) => v?.active) && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">Active Effects</div>
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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {gearOwned.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/40 font-mono text-xs">No gear in inventory. Buy from the shop!</div>
          ) : gearOwned.map((item, idx) => {
            const tierColor = getTierColor(item.tier);
            const equipped_now = isEquipped(item);
            return (
              <GameCard key={`${item.id}-${idx}`}
                isActive={equipped_now}
                borderColor={tierColor}
                glowColor={tierColor}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3"
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                {/* Icon */}
                <div className="shrink-0 w-10 h-10 rounded-none border overflow-hidden bg-gray-100 dark:bg-gray-800/50"
                  style={{ imageRendering: "pixelated", borderColor: `${tierColor}60` }}>
                  {item.icon_url
                    ? <img src={getMediaUrl(item.icon_url)} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                    : <div className="w-full h-full flex items-center justify-center font-mono text-xs text-gray-900 dark:text-gray-200" style={{ color: tierColor === '#ffffff' ? undefined : tierColor }}>{item.label[0]}</div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-200" style={{ color: tierColor === '#ffffff' ? undefined : tierColor }}>{item.label}</span>
                    {equipped_now && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${tierColor}30`, color: tierColor }}>EQUIPPED</span>}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                    {item.stats ? Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : item.effect}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider">{item.slot?.replace("_", " ")}</div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex items-center gap-2">
                    {!equipped_now ? (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                        className="px-2 py-1 text-[10px] font-mono font-bold rounded-none border transition-all"
                        style={{ borderColor: `${tierColor}60`, color: tierColor, background: `${tierColor}15` }}
                      >EQUIP</motion.button>
                    ) : (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                        className="px-2 py-1 text-[10px] font-mono font-bold rounded-none border transition-all opacity-50"
                        style={{ borderColor: "#1e293b", color: "#4a4060", background: "transparent" }}
                      >UNEQUIP</motion.button>
                    )}
                    
                    {!equipped_now && (
                      <motion.button 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => sellMutation.mutate(item.id)}
                        disabled={sellMutation.isPending}
                        className="px-2 py-1 text-[10px] font-mono font-bold rounded-none border transition-all border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                      >
                        <Coins className="w-3 h-3 inline-block mr-1" />
                        SELL
                      </motion.button>
                    )}
                  </div>
                </div>
              </GameCard>
            );
          })}
        </div>
      )}

      {/* Consumables list */}
      {tab === "consumables" && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {consumablesOwned.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/40 font-mono text-xs">No consumables. Buy from the shop!</div>
          ) : consumablesOwned.map((item, idx) => {
            const tierColor = getTierColor(item.tier);
            const effectColor = tierColor || "#8b5cf6";
            const isUsed = usedId === item.id;
            const alreadyActive = consumables_active[item.id]?.active && (!consumables_active[item.id]?.expiresAt || Date.now() < consumables_active[item.id]?.expiresAt);
            // Count how many of this item in inventory
            const count = consumablesOwned.filter(i => i.id === item.id).length;

            // Only render first occurrence per id to avoid duplicate rows
            const firstIdx = consumablesOwned.findIndex(i => i.id === item.id);
            if (firstIdx !== idx) return null;

            return (
              <GameCard key={item.id}
                isActive={alreadyActive || isUsed}
                borderColor={effectColor}
                glowColor={effectColor}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0, scale: isUsed ? [1, 1.03, 1] : 1 }}
                transition={{ delay: idx * 0.04, scale: isUsed ? { duration: 0.3 } : {} }}
                className="flex items-center gap-3"
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                <PixelFlash active={isUsed} color={effectColor} />
                {isUsed && <PixelBurstLayer bursts={bursts} />}

                <div className="shrink-0 w-10 h-10 rounded-none border overflow-hidden relative"
                  style={{ imageRendering: "pixelated", background: "var(--habit-panel)", borderColor: `${effectColor}60` }}>
                  <img src={getMediaUrl(item.icon_url) || '/static/items/default.webp'} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                  {count > 1 && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-black"
                      style={{ background: effectColor, color: "#000" }}>{count}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold" style={{ color: tierColor }}>{item.label}</span>
                    {alreadyActive && (
                      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${effectColor}30`, color: effectColor }}>ACTIVE</motion.span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: `${effectColor}bb` }}>
                    {item.description || item.effect || "Temporary Buff"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => applyConsumable(item)}
                    disabled={alreadyActive}
                    whileTap={!alreadyActive && !consumeMutation.isPending ? { scale: 0.88, y: 2 } : {}}
                    className="shrink-0 px-3 py-1.5 text-[10px] font-mono font-black rounded-none border transition-all relative overflow-hidden"
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
                    <span className="relative z-10 flex items-center gap-1">
                      {alreadyActive ? "■ ACTIVE" : <><Zap className="w-3 h-3" /> USE</>}
                    </span>
                  </motion.button>
                  
                  <motion.button 
                    whileTap={{ scale: 0.9 }} 
                    onClick={() => sellMutation.mutate(item.id)}
                    disabled={sellMutation.isPending}
                    className="shrink-0 px-3 py-1.5 text-[10px] font-mono font-black rounded-none border transition-all border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  >
                    <Coins className="w-3 h-3 inline-block mr-1" />
                    SELL
                  </motion.button>
                </div>
              </GameCard>
            );
          })}
        </div>
      )}
    </div>
  );
}