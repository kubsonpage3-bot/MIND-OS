import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";

export default function SubscriptionBadge({ compact = false }) {
  // In a real app, this would check actual subscription status
  const isBuilderPlus = true;
  
  if (!isBuilderPlus) return null;
  
  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        />
        <Crown className="w-3 h-3 text-amber-400 relative z-10" />
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 relative overflow-hidden group"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
      />
      <motion.div
        animate={{ rotate: [0, 12, -12, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <Crown className="w-4 h-4 text-amber-400 relative z-10" />
      </motion.div>
      <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider relative z-10">Builder+</span>
      <Sparkles className="w-3 h-3 text-amber-300 relative z-10" />
    </motion.div>
  );
}