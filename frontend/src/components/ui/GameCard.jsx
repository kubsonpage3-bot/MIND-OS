import { motion } from "framer-motion";

/**
 * A standardized card component for MIND OS game elements (Shop, Inventory, Allies, Mutators).
 * Applies the reference standard design (Dashboard/Training) with support for rarity colors
 * and active/glowing states.
 */
export default function GameCard({
  children,
  className = "",
  isActive = false,
  isHoverable = false,
  isEdgeToEdgeMobile = false,
  borderColor,
  glowColor,
  onClick,
  style = {},
  animate,
  transition,
  ...props
}) {
  const defaultBorder = "var(--habit-border)";
  const finalBorder = isActive ? (borderColor || "var(--habit-purple)") : (borderColor || defaultBorder);
  
  const activeGlow = glowColor || borderColor || "var(--habit-purple-glow)";
  // Only apply idle shadow if no active glow
  const finalShadow = isActive ? `0 0 16px ${activeGlow}40` : "0 1px 4px rgba(0,0,0,0.05)";

  const baseClasses = `
    relative overflow-hidden p-3 border-[1.5px] bg-[var(--habit-panel)]
    ${isHoverable ? "cursor-pointer" : ""}
    ${isEdgeToEdgeMobile ? "rounded-none border-x-0 mx-0 w-full md:rounded-xl md:border-x md:mx-auto" : "rounded-xl"}
    ${className}
  `.trim().replace(/\s+/g, " ");

  return (
    <motion.div
      layout
      onClick={onClick}
      className={baseClasses}
      style={{
        borderColor: finalBorder,
        boxShadow: finalShadow,
        ...style
      }}
      animate={animate ? { ...animate, boxShadow: isActive ? [`0 0 10px ${activeGlow}30`, `0 0 20px ${activeGlow}50`, `0 0 10px ${activeGlow}30`] : finalShadow } : (isActive ? {
        boxShadow: [`0 0 10px ${activeGlow}30`, `0 0 20px ${activeGlow}50`, `0 0 10px ${activeGlow}30`],
      } : {
        boxShadow: finalShadow
      })}
      transition={transition ? { ...transition, ...(isActive && !transition.boxShadow ? { boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } } : {}) } : (isActive ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {})}
      {...props}
    >
      {children}
    </motion.div>
  );
}
