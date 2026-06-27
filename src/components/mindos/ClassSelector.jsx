import { useState } from "react";
import { CLASSES, CLASS_SPRITES } from "@/lib/rpgSystem";
import { motion, AnimatePresence } from "framer-motion";

export default function ClassSelector({ onChoose }) {
  const [hovered, setHovered] = useState(null);
  const [confirming, setConfirming] = useState(null);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Class Selection</div>
        <div className="font-mono text-sm text-foreground/70">Choose your path. This choice is permanent.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.values(CLASSES).map(cls => {
          const isHovered = hovered === cls.id;
          return (
            <motion.button
              key={cls.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setConfirming(cls)}
              onMouseEnter={() => setHovered(cls.id)}
              onMouseLeave={() => setHovered(null)}
              className="p-4 rounded-xl border text-left transition-all space-y-2 overflow-hidden relative"
              style={{
                borderColor: isHovered ? cls.color : "#1e1a38",
                background: isHovered ? `${cls.color}12` : "#0a0818",
                boxShadow: isHovered ? `0 0 20px ${cls.color}40` : "none",
              }}
            >
              {/* Character sprite */}
              <div className="flex justify-center mb-1 relative h-20">
                <motion.img
                  src={CLASS_SPRITES[cls.id]}
                  alt={cls.name}
                  className="h-20 object-contain"
                  style={{
                    imageRendering: "pixelated",
                    filter: isHovered
                      ? `drop-shadow(0 0 8px ${cls.color}) drop-shadow(0 0 16px ${cls.color}80)`
                      : `drop-shadow(0 0 2px ${cls.color}40) brightness(0.85)`,
                    transition: "filter 0.3s ease",
                  }}
                  animate={isHovered ? { y: [0, -4, 0] } : { y: 0 }}
                  transition={isHovered ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                />
              </div>

              <div className="font-mono text-xs font-bold" style={{ color: cls.color }}>{cls.name}</div>
              <div className="text-[10px] font-mono text-muted-foreground/50 italic leading-relaxed line-clamp-2">"{cls.lore}"</div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {Object.entries(cls.stats).slice(0, 4).map(([k, v]) => (
                  <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${cls.color}18`, color: cls.color }}>
                    {k.toUpperCase()} {v}
                  </span>
                ))}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/40">MANA {cls.maxMana}</div>
            </motion.button>
          );
        })}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="rounded-2xl border p-6 max-w-sm w-full space-y-4 text-center"
              style={{ borderColor: confirming.color, background: "#0a0818", boxShadow: `0 0 32px ${confirming.color}40` }}
            >
              {/* Animated character sprite */}
              <div className="flex justify-center">
                <motion.img
                  src={CLASS_SPRITES[confirming.id]}
                  alt={confirming.name}
                  className="h-28 object-contain"
                  style={{
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 0 12px ${confirming.color}) drop-shadow(0 0 24px ${confirming.color}80)`,
                  }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="font-mono font-black text-lg" style={{ color: confirming.color }}>{confirming.name}</div>
              <div className="text-xs font-mono text-muted-foreground/60 italic">"{confirming.lore}"</div>
              <div className="text-xs font-mono text-red-400/80 bg-red-900/10 border border-red-900/30 rounded-lg p-2">
                ⚠ This choice is permanent until Prestige.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(null)} className="flex-1 py-2 text-xs font-mono rounded-lg border border-border text-muted-foreground hover:bg-muted/20">
                  CANCEL
                </button>
                <button
                  onClick={() => onChoose(confirming.id)}
                  className="flex-1 py-2 text-xs font-mono rounded-lg font-bold transition-all"
                  style={{ background: confirming.color, color: "#000" }}
                >
                  CHOOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}