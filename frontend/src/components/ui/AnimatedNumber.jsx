// @ts-nocheck
import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { ANIM_CONFIG } from "@/lib/animations";

/**
 * @param {Object} props
 * @param {number} props.value
 * @param {(v: number) => string | number} [props.formatter]
 * @param {string} [props.className]
 * @param {Object} [props.style]
 */
export default function AnimatedNumber({ 
  value, 
  formatter = (v) => Math.round(v), 
  className = "",
  style = {}
}) {
  const springValue = useSpring(value, ANIM_CONFIG.springNumber);
  const displayValue = useTransform(springValue, (latest) => formatter(latest));

  // Update spring when target value changes
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <motion.span className={className} style={style}>
      {displayValue}
    </motion.span>
  );
}
