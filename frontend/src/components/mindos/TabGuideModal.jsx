import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { GUIDE_CONTENT } from "@/constants/guideContent";
import { useTranslation } from "react-i18next";
import { useHardwareBack } from "@/utils/modalStack";

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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  useHardwareBack(isOpen, () => handleDismiss());

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
            className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl border bg-bg-dark/95 p-5 shadow-2xl backdrop-blur-md overflow-hidden custom-scrollbar"
            style={{
              borderColor: "var(--habit-purple)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 20px var(--habit-purple-glow), inset 0 0 10px rgba(255,255,255,0.05)",
            }}
          >
            {/* Active pulse overlay for that juicy feel */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0, 0.05, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              style={{ backgroundColor: "var(--habit-purple)" }}
            />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 text-white/40 hover:text-white transition-colors z-10"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="text-2xl drop-shadow-lg">{content.icon}</div>
              <div className="flex-1">
                <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-1">
                  {String(t(`section_guides.${guideId}.title`, content.title))}
                </h3>
                <div className="text-[10px] text-neon-cyan font-mono uppercase tracking-wider mb-2">
                  {t("section_guides.subtitle", "SETTINGS GUIDE")}
                </div>
              </div>
            </div>

            {/* Content - Using whitespace-pre-line to respect newline bullet points */}
            <div className="font-mono text-xs text-white/80 leading-relaxed space-y-4 mb-5 whitespace-pre-line relative z-10">
              {String(t(`section_guides.${guideId}.body`, content.body))}
            </div>

            {/* Dismiss Button */}
            <div className="flex justify-end relative z-10">
              <button
                onClick={handleDismiss}
                className="flex items-center gap-1 px-4 py-1.5 rounded font-bold text-bg-dark transition-all uppercase tracking-wider text-xs cursor-pointer"
                style={{
                  backgroundColor: "var(--habit-purple)",
                  boxShadow: "0 0 10px var(--habit-purple-glow)",
                }}
              >
                {t('section_guides.gotIt')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
