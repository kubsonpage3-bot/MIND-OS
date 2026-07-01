import { motion } from "framer-motion";
import { normalizeGold } from "@/lib/utils";

/**
 * FlyingReward - анимация "полета" XP/золота от задачи к статус-бару
 * Trigger: при выполнении задачи создается частица, которая летит от координат клика
 * к верхнему статус-бару (где отображаются HP/Mana/XP)
 */
export default function FlyingReward({ rewards }) {
  // rewards: array of { id, type: 'xp' | 'gold', amount, fromX, fromY, isCrit?: boolean }
  
  // Target position: top status bar (approximately center-top of screen)
  const targetX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
  const targetY = 80; // status bar position

  return (
    <div className="fixed inset-0 pointer-events-none z-[9997]">
      {rewards.map((reward) => (
        <motion.div
          key={reward.id}
          initial={{
            x: reward.fromX || targetX,
            y: reward.fromY || targetY + 200,
            opacity: 1,
            scale: 0.5,
          }}
          animate={{
            x: targetX,
            y: targetY,
            opacity: [1, 1, 0],
            scale: reward.isCrit ? [0.8, 1.8, 1.2, 0.3] : [0.5, 1.2, 0.3],
            rotate: reward.isCrit ? [0, -10, 10, -5, 5, 0] : 0,
          }}
          transition={{
            duration: reward.isCrit ? 1.2 : 0.8,
            ease: "easeInOut",
          }}
          className={`absolute font-mono font-black ${reward.isCrit ? "text-3xl" : "text-xl"}`}
          style={{
            color: reward.type === "xp" ? "#3b82f6" : "#f0c040",
            textShadow: reward.isCrit
              ? "0 0 20px #fff, 0 0 40px #3b82f6, 0 0 60px #3b82f6"
              : reward.type === "xp"
              ? "0 0 12px #3b82f6, 0 0 24px #3b82f6"
              : "0 0 12px #f0c040, 0 0 24px #f0c040",
            WebkitTextStroke: reward.isCrit ? "1px #fff" : "none",
          }}
        >
          {reward.isCrit && "🌟 "}
          {reward.type === "xp"
            ? <>⚡ +{Math.round(reward.amount)}</>
            : <>🪙 +{normalizeGold(reward.amount)}</>
          }
        </motion.div>
      ))}
    </div>
  );
}