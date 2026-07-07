import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { GUIDE_CONTENT } from "@/constants/guideContent";

/**
 * TabGuideModal
 * Displays a dismissible popup to explain tab mechanics on first visit.
 * @param {Object} props
 * @param {string} props.guideId - The unique ID for this guide (e.g. 'tasks', 'rival').
 * @param {boolean} [props.forceOpen] - If true, bypasses the seen check and shows the modal (used in Settings).
 * @param {Function} [props.onCloseCallback] - Optional callback for when modal is closed (e.g. from Settings).
 * @param {Object} props.profile - User profile data containing seen_guides.
 */
export default function TabGuideModal({
  guideId,
  forceOpen = false,
  onCloseCallback,
  profile,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const content = GUIDE_CONTENT[guideId] || {
    icon: "🤖",
    title: "Guide",
    body: "No guide content available.",
  };

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    if (onCloseCallback) {
      onCloseCallback();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-bg-dark/95 p-6 shadow-2xl backdrop-blur-md custom-scrollbar"
            style={{
              boxShadow: "0 0 40px rgba(0,229,255,0.1), inset 0 0 20px rgba(255,255,255,0.02)",
            }}
          >
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 text-white/50 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-neon-cyan">{content.icon}</span> {content.title}
            </h2>

            {/* Content - Using whitespace-pre-line to respect newline bullet points */}
            <div className="text-white/80 space-y-4 text-sm leading-relaxed mb-6 whitespace-pre-line">
              {content.body}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-lg font-bold text-bg-dark bg-neon-cyan hover:bg-white transition-colors uppercase tracking-wider text-sm cursor-pointer"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
