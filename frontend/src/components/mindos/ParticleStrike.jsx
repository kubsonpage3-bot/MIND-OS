import { motion } from "framer-motion";

// Particle types: spark (bright sparks), shard (angular fragments), orb (glowing orbs)
export default function ParticleStrike({ triggerKey, color = "#f0c040", intensity = "medium" }) {
  // Generate random particles
  const particleCount = intensity === "critical" ? 24 : intensity === "heavy" ? 16 : 8;
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    type: Math.random() > 0.6 ? "shard" : Math.random() > 0.3 ? "spark" : "orb",
    angle: Math.random() * 30 - 15, // slight spread
    speed: Math.random() * 0.3 + 0.7,
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.1,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[1000]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: typeof window !== "undefined" ? Math.random() * window.innerWidth : 400,
            y: typeof window !== "undefined" ? window.innerHeight + 50 : 600,
            opacity: 0,
            scale: 0,
            rotate: p.rotation,
          }}
          animate={{
            x: typeof window !== "undefined" ? window.innerWidth * 0.5 + (p.angle * 8) : 400,
            y: typeof window !== "undefined" ? window.innerHeight * 0.3 : 250,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 0.8, 0],
            rotate: p.rotation + (p.type === "shard" ? 720 : 0),
          }}
          transition={{
            duration: 0.8 * p.speed,
            delay: p.delay,
            ease: "easeOut",
          }}
          className="absolute"
          style={{
            width: p.type === "orb" ? p.size : p.size * 0.6,
            height: p.type === "orb" ? p.size : p.size * 0.6,
            background: p.type === "orb"
              ? `radial-gradient(circle, ${color}ee, ${color}00)`
              : "transparent",
            boxShadow: p.type === "orb" ? `0 0 12px ${color}` : "none",
          }}
        >
          {p.type === "shard" && (
            <svg width={p.size} height={p.size} viewBox="0 0 20 20" className="absolute">
              <polygon
                points="10,0 12,8 20,10 12,12 10,20 8,12 0,10 8,8"
                fill={color}
                opacity="0.9"
                style={{ filter: `drop-shadow(0 0 6px ${color})` }}
              />
            </svg>
          )}
          {p.type === "spark" && (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(45deg, ${color}, transparent)`,
                clipPath: "polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)",
                boxShadow: `0 0 8px ${color}`,
              }}
            />
          )}
        </motion.div>
      ))}

      {/* Impact flash at boss position */}
      <motion.div
        initial={{ opacity: 0.8, scale: 0.5 }}
        animate={{ opacity: 0, scale: 2.5 }}
        transition={{ duration: 0.4 }}
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}66 0%, ${color}00 70%)`,
          boxShadow: `0 0 40px ${color}`,
        }}
      />

      {/* Shockwave ring */}
      <motion.div
        initial={{ opacity: 0.6, scale: 0.3, borderWidth: 4 }}
        animate={{ opacity: 0, scale: 3, borderWidth: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{
          width: 80,
          height: 80,
          borderColor: color,
          boxShadow: `0 0 20px ${color}`,
        }}
      />
    </div>
  );
}