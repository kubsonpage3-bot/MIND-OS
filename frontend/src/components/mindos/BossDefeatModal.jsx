import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '@/lib/soundEffects';
import { useHardwareBack } from '@/utils/modalStack';

export default function BossDefeatModal({ isOpen, onClose, combatResult, rewards }) {
  useHardwareBack(isOpen, onClose);
  
  React.useEffect(() => {
    if (isOpen) {
      playSound('level_up');
    }
  }, [isOpen]);

  const bossName = combatResult?.boss_name || "The Boss";
  const bossGold = rewards?.boss_gold ?? 0;
  const bossXp = rewards?.boss_xp ?? 0;
  const bossSp = rewards?.boss_sp ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="relative w-full max-w-sm rounded-2xl border-2 border-yellow-500/50 p-6 text-center shadow-2xl"
            style={{
              background: "linear-gradient(180deg, #1f1a14 0%, #120e0a 100%)",
              boxShadow: "0 0 40px rgba(234, 179, 8, 0.2)",
            }}
          >
            <div className="absolute -top-6 -left-6 text-4xl animate-bounce" style={{ animationDelay: '0.1s' }}>✨</div>
            <div className="absolute -bottom-6 -right-6 text-4xl animate-bounce" style={{ animationDelay: '0.3s' }}>✨</div>
            
            <div className="text-6xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.5))' }}>🏆</div>
            
            <h2 className="font-mono text-2xl font-black text-yellow-400 mb-2">
              VICTORY!
            </h2>
            <p className="font-mono text-sm text-gray-300 mb-6">
              You have slain <span className="font-bold text-red-400">{bossName}</span> and claimed its hoard.
            </p>
 
            <div className="space-y-3 mb-6 bg-black/40 rounded-xl p-4 border border-yellow-900/50">
              {bossGold > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">GOLD REWARD</span>
                  <span className="font-mono font-bold text-yellow-400">+{bossGold.toLocaleString()} G</span>
                </div>
              )}
              {bossXp > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">XP REWARD</span>
                  <span className="font-mono font-bold text-purple-400">+{bossXp.toLocaleString()} XP</span>
                </div>
              )}
              {bossSp > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">SKILL POINTS</span>
                  <span className="font-mono font-bold text-cyan-400">+{bossSp.toLocaleString()} SP</span>
                </div>
              )}
              
              {(bossGold === 0 && bossXp === 0 && bossSp === 0) && (
                <div className="text-center font-mono text-xs text-gray-500 italic">
                  Rewards added to your account.
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-mono text-sm font-black text-black transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{ 
                background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                boxShadow: "0 0 15px rgba(245, 158, 11, 0.4)"
              }}
            >
              CLAIM REWARDS
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
