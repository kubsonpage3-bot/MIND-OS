import { useState } from "react";
import { MUTATORS, saveRPGData } from "@/lib/rpgSystem";

const CAT_LABELS = {
  amplifier: { label: "AMPLIFIERS", color: "#3b82f6" },
  economy: { label: "ECONOMY", color: "#f0c040" },
  streak: { label: "STREAK", color: "#f59e0b" },
  challenge: { label: "CHALLENGE", color: "#ef4444" },
  synergy: { label: "SYNERGY BUILDERS", color: "#aa44ff" },
  wild: { label: "WILD", color: "#00e5ff" },
};

const MAX_ACTIVE = 3;

export default function MutatorsPanel({ mutators, onUpdate, gold, onSpendGold }) {
  const [confirmIronman, setConfirmIronman] = useState(false);
  const active = mutators.active || [];
  const purchased = mutators.purchased || [];

  const isActive = (id) => active.some(m => m.id === id);
  const isPurchased = (id) => purchased.includes(id);

  const getActiveSynergyIds = () => active.map(m => m.id);

  const isSynergyActive = (mut) => {
    if (!mut.synergy) return false;
    return isActive(mut.id) && isActive(mut.synergy);
  };

  const activate = (mutator) => {
    if (mutator.id === "ironman" && !isActive(mutator.id)) { setConfirmIronman(true); return; }
    if (!isPurchased(mutator.id) && mutator.cost > 0 && gold < mutator.cost) return;
    if (active.length >= MAX_ACTIVE && !isActive(mutator.id)) return;

    // Conflict check
    if (!isActive(mutator.id) && mutator.conflicts) {
      const hasConflict = mutator.conflicts.some(c => isActive(c));
      if (hasConflict) return;
    }

    const now = Date.now();
    let newActive;
    if (isActive(mutator.id)) {
      if (mutator.permanent_lock) return; // ironman cannot toggle off
      newActive = active.filter(m => m.id !== mutator.id);
    } else {
      newActive = [...active, { id: mutator.id, activatedAt: now, duration: mutator.durationDays }];
    }
    const newPurchased = isPurchased(mutator.id) ? purchased : [...purchased, mutator.id];
    const newData = { ...mutators, active: newActive, purchased: newPurchased };
    saveRPGData("mindos_mutators", newData);
    onUpdate(newData);
    if (!isPurchased(mutator.id) && mutator.cost > 0) onSpendGold(mutator.cost);
  };

  const confirmIronmanActivate = () => {
    const newActive = [...active, { id: "ironman", activatedAt: Date.now(), duration: null }];
    const newPurchased = [...purchased, "ironman"];
    const newData = { ...mutators, active: newActive, purchased: newPurchased };
    saveRPGData("mindos_mutators", newData);
    onUpdate(newData);
    onSpendGold(3000);
    setConfirmIronman(false);
  };

  const byCategory = {};
  MUTATORS.forEach(m => { if (!byCategory[m.cat]) byCategory[m.cat] = []; byCategory[m.cat].push(m); });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Mutators</div>
        <div className="text-[10px] font-mono font-bold" style={{ color: active.length >= MAX_ACTIVE ? "#ef4444" : "#00cc88" }}>
          {active.length}/{MAX_ACTIVE} активно
        </div>
      </div>

      {Object.entries(CAT_LABELS).map(([cat, cfg]) => {
        const muts = byCategory[cat] || [];
        if (!muts.length) return null;
        return (
          <div key={cat} className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: cfg.color }}>
              {cfg.label}
            </div>
            {muts.map(mut => {
              const active_ = isActive(mut.id);
              const purchased_ = isPurchased(mut.id);
              const synActive = isSynergyActive(mut);
              const canActivate = active.length < MAX_ACTIVE || active_;
              const canAfford = purchased_ || gold >= mut.cost;
              const conflicted = !isActive(mut.id) && mut.conflicts?.some(c => isActive(c));

              const borderColor = active_ ? "#f0c040" : purchased_ ? "#00aa8840" : "#1e1a38";
              const bgColor = active_ ? "#f0c04008" : purchased_ ? "#00aa8808" : "#0a0818";
              const glowColor = active_ ? "0 0 12px #f0c04040" : "none";

              return (
                <div key={mut.id} className="p-3 rounded-xl border transition-all"
                  style={{ borderColor, background: bgColor, boxShadow: glowColor }}>
                  <div className="flex items-start gap-2.5">
                    {/* Pixel art icon */}
                    <div className="shrink-0 w-9 h-9 rounded-lg border overflow-hidden"
                      style={{ imageRendering: "pixelated", background: "#050310", borderColor: active_ ? "#f0c04060" : "#1e1a38" }}>
                      <img src={mut.icon} alt={mut.name} className="w-full h-full object-contain"
                        style={{ imageRendering: "pixelated" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-black tracking-wide"
                          style={{ color: active_ ? "#f0c040" : purchased_ ? "#00cc88" : "#e8e0ff" }}>
                          {mut.name}
                        </span>
                        {active_ && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "#f0c04025", color: "#f0c040", border: "1px solid #f0c04040" }}>ACTIVE</span>}
                        {purchased_ && !active_ && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: "#00aa8815", color: "#00aa88", border: "1px solid #00aa8840" }}>КУПЛЕНО</span>}
                        {mut.toggle && <span className="text-[8px] font-mono text-muted-foreground/40">[toggle]</span>}
                        {mut.durationDays && <span className="text-[8px] font-mono text-muted-foreground/40">{mut.durationDays}d</span>}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{mut.desc}</div>

                      {/* Synergy line */}
                      {mut.synergy && (
                        <div className="mt-1 text-[8px] font-mono italic"
                          style={{ color: synActive ? "#f0c040" : "#4a4060" }}>
                          {synActive ? `⚡ Синергия: ${MUTATORS.find(m => m.id === mut.synergy)?.name} — АКТИВНА ✦` : `Синергия: ${MUTATORS.find(m => m.id === mut.synergy)?.name}`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => activate(mut)}
                      disabled={(!canAfford && !purchased_) || (!canActivate && !active_) || conflicted}
                      className="shrink-0 px-2.5 py-1.5 text-[9px] font-mono font-bold rounded-lg border transition-all"
                      style={{
                        borderColor: active_ ? "#f0c040" : canAfford && canActivate && !conflicted ? "#555" : "#1e1a38",
                        color: active_ ? "#000" : canAfford && canActivate && !conflicted ? "#e8e0ff" : "#4a4060",
                        background: active_ ? "#f0c040" : canAfford && canActivate && !conflicted ? "#ffffff10" : "transparent",
                        opacity: conflicted ? 0.4 : 1,
                      }}
                    >
                      {active_ ? (mut.permanent_lock ? "🔒" : "ON") : purchased_ ? "OFF" : conflicted ? "×" : `${mut.cost}G`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {confirmIronman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="rounded-2xl border border-red-900/60 bg-card p-6 max-w-sm w-full space-y-4 text-center">
            <div className="text-2xl">💀</div>
            <div className="font-mono font-black text-red-400 tracking-widest">IRONMAN MODE</div>
            <div className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              Если HP достигнет 0 — prestige будет активирован принудительно. Это <span className="text-red-400">нельзя отменить</span>.
              В обмен: все Rank XP +15% навсегда.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmIronman(false)} className="flex-1 py-2 text-xs font-mono rounded-lg border border-border text-muted-foreground">ОТМЕНА</button>
              <button onClick={confirmIronmanActivate} className="flex-1 py-2 text-xs font-mono rounded-lg bg-red-600 text-white font-bold">ПОДТВЕРДИТЬ — 3000G</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}