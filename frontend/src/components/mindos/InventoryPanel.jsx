import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTierColor } from "@/lib/gameState";
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";
import { Package, Zap } from "lucide-react";
import { getMediaUrl } from "@/api/djangoClient";

// Consumable effects are handled server-side via the shop buy endpoint.
// Do NOT track consumable state in localStorage — use the backend profile as SSOT.



export default function InventoryPanel({ gs, onSave, onToggleEquip }) {
  const [tab, setTab] = useState("gear");
  const [toast, setToast] = useState(null);
  const [usedId, setUsedId] = useState(null);
  const { bursts, trigger: triggerBurst } = usePixelBurst();

  const inventory = gs.inventory || [];
  const consumables_active = gs.consumables || {};

  const gearOwned = inventory.filter(i => !i.consumable);
  const consumablesOwned = inventory.filter(i => i.consumable);

  const isEquipped = (item) => item.is_equipped;

  const applyConsumable = (item) => {
    const effect = CONSUMABLE_EFFECTS[item.id];
    if (!effect) return;

    // Check not already active
    const current = consumables_active[item.id];
    if (current?.active) {
      if (!current.expiresAt || Date.now() < current.expiresAt) {
        showToast("Already active!", "#f59e0b");
        return;
      }
    }

    // Apply the effect
    const newGs = effect.apply(gs);

    // Remove ONE copy of this consumable from inventory
    const idx = (newGs.inventory || []).findIndex(i => i.id === item.id);
    if (idx !== -1) {
      const newInv = [...(newGs.inventory || [])];
      newInv.splice(idx, 1);
      newGs.inventory = newInv;
    }

    onSave(newGs);
    setUsedId(item.id);
    triggerBurst(effect.color, 12);
    setTimeout(() => setUsedId(null), 800);
    showToast(effect.desc, effect.color);
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
            const effect = CONSUMABLE_EFFECTS[id];
            if (!effect) return null;
            const timeLeft = c.expiresAt ? Math.max(0, Math.ceil((c.expiresAt - Date.now()) / 3600000)) + "h left" : "1 session";
            return (
              <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono"
                style={{ background: `${effect.color}15`, border: `1px solid ${effect.color}40` }}>
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                  style={{ color: effect.color }}>■</motion.span>
                <span style={{ color: effect.color }}>{effect.desc.split("—")[0].trim()}</span>
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
              <motion.div key={`${item.id}-${idx}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`flex items-center gap-3 p-3 rounded-xl border relative overflow-hidden bg-white dark:bg-gray-900 transition-all ${equipped_now ? "ring-2 ring-yellow-500" : ""}`}
                style={{ borderColor: equipped_now ? `${tierColor}80` : `${tierColor}25`, background: equipped_now ? `${tierColor}0c` : undefined }}
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
                  {!equipped_now ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                      className="px-2 py-1 text-[10px] font-mono font-bold rounded-none border transition-all"
                      style={{ borderColor: `${tierColor}60`, color: tierColor, background: `${tierColor}15` }}
                    >EQUIP</motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onToggleEquip(item)}
                      className="px-2 py-1 text-[10px] font-mono font-bold rounded-none border transition-all"
                      style={{ borderColor: "#ef444460", color: "#ef4444", background: "#ef444415" }}
                    >UNEQUIP</motion.button>
                  )}
                </div>
              </motion.div>
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
            const effect = CONSUMABLE_EFFECTS[item.id];
            const tierColor = getTierColor(item.tier);
            const effectColor = effect?.color || tierColor;
            const isUsed = usedId === item.id;
            const alreadyActive = consumables_active[item.id]?.active && (!consumables_active[item.id]?.expiresAt || Date.now() < consumables_active[item.id]?.expiresAt);
            // Count how many of this item in inventory
            const count = consumablesOwned.filter(i => i.id === item.id).length;

            // Only render first occurrence per id to avoid duplicate rows
            const firstIdx = consumablesOwned.findIndex(i => i.id === item.id);
            if (firstIdx !== idx) return null;

            return (
              <motion.div key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0, scale: isUsed ? [1, 1.03, 1] : 1 }}
                transition={{ delay: idx * 0.04, scale: isUsed ? { duration: 0.3 } : {} }}
                className="flex items-center gap-3 p-3 rounded-xl border relative overflow-hidden"
                style={{
                  borderColor: isUsed ? `${effectColor}80` : alreadyActive ? `${effectColor}60` : `${tierColor}30`,
                  background: alreadyActive ? `${effectColor}10` : "#0a0818",
                  boxShadow: isUsed ? `0 0 14px ${effectColor}40` : "none",
                }}
              >
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                <PixelFlash active={isUsed} color={effectColor} />
                {isUsed && <PixelBurstLayer bursts={bursts} />}

                <div className="shrink-0 w-10 h-10 rounded-none border overflow-hidden relative"
                  style={{ imageRendering: "pixelated", background: "#0a0818", borderColor: `${effectColor}60` }}>
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
                    {effect?.desc || item.effect}
                  </div>
                </div>

                <motion.button
                  onClick={() => applyConsumable(item)}
                  disabled={alreadyActive}
                  whileTap={!alreadyActive ? { scale: 0.88, y: 2 } : {}}
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
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}