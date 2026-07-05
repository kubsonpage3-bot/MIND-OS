import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import FantasyIcon from "@/components/navigation/FantasyIcon";

/**
 * BottomSheet - панель, выезжающая снизу (mobile-native UX)
 * Можно закрыть жестом вниз или кликом на overlay
 */
export default function BottomSheet({ isOpen, onClose, title, children }) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[50] bg-black/85 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet - taller for task form */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[51] bg-card border-t border-border rounded-t-3xl max-h-[95vh] overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(22,20,18,0.98) 0%, rgba(15,13,11,0.99) 100%)",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
            }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center py-3" onClick={onClose}>
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40">
              <span className="font-mono text-sm font-bold tracking-wider text-foreground">{title}</span>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <FantasyIcon size={20}><X /></FantasyIcon>
              </button>
            </div>

            {/* Content - scrollable with more space */}
            <div className="overflow-y-auto p-5 pb-10" style={{ maxHeight: "calc(95vh - 80px)" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}