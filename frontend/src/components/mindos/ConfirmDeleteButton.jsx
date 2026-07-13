import { useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmDeleteButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let timer;
    if (confirming) {
      timer = setTimeout(() => {
        setConfirming(false);
      }, 3000); // Reset after 3 seconds
    }
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleClick = (e) => {
    e.stopPropagation(); // prevent drag or item click
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={handleClick}
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
        confirming ? 'bg-red-500/10 text-red-500' : 'text-slate-400/50 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      aria-label={confirming ? "Confirm delete" : "Delete task"}
    >
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <X size={18} strokeWidth={2.5} />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
