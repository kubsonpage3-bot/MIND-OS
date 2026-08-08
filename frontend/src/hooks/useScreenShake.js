import { useCallback } from "react";
import { useAnimation } from "framer-motion";

/**
 * useScreenShake — wraps a framer-motion AnimationControls reference.
 * Usage:
 *   const { controls, shake } = useScreenShake();
 *   <motion.div animate={controls}>...</motion.div>
 *   shake("light")  // or "medium" | "heavy" | "death"
 */
export function useScreenShake() {
  const controls = useAnimation();

  const shake = useCallback(
    (intensity = "medium") => {
      const presets = {
        light: {
          x: [-3, 3, -2, 2, 0],
          transition: { duration: 0.35, ease: "easeInOut" },
        },
        medium: {
          x: [-6, 6, -4, 4, -2, 2, 0],
          transition: { duration: 0.50, ease: "easeInOut" },
        },
        heavy: {
          x: [-10, 10, -7, 7, -4, 4, -2, 2, 0],
          y: [-3, 3, -2, 2, 0],
          transition: { duration: 0.65, ease: "easeInOut" },
        },
        death: {
          x: [-12, 12, -8, 8, -5, 5, -3, 3, -1, 1, 0],
          y: [-4, 4, -3, 3, -2, 2, 0],
          transition: { duration: 0.90, ease: "easeInOut" },
        },
      };

      controls.start(presets[intensity] || presets.medium);
    },
    [controls]
  );

  return { controls, shake };
}
