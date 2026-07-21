import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useTranslation } from "react-i18next";

const TUTORIAL_STEPS = [
  {
    icon: "⚔️",
    id: "tasks"
  },
  {
    icon: "🧠",
    id: "training"
  },
  {
    icon: "🏅",
    id: "character"
  },
  {
    icon: "🛒",
    id: "shop"
  },
  {
    icon: "🏆",
    id: "ranks"
  },
  {
    icon: "📚",
    id: "explore"
  }
];

export default function BalatroTutorialToast({ profile, forceOpen = false, onCloseCallback }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const queryClient = useQueryClient();

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      return await djangoApi.profile.markGuideSeen("main_tutorial");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    },
    onError: (err) => {
      console.error("Failed to mark main_tutorial as seen:", err);
    }
  });

  useEffect(() => {
    if (forceOpen) {
      setCurrentStep(0);
      setIsVisible(true);
    } else if (profile && profile.seen_guides) {
      if (!profile.seen_guides["main_tutorial"]) {
        setIsVisible(true);
      }
    }
  }, [forceOpen, profile]);

  const handleClose = () => {
    setIsVisible(false);
    if (!forceOpen && profile && profile.seen_guides && !profile.seen_guides["main_tutorial"]) {
      markSeenMutation.mutate();
    }
    if (onCloseCallback) {
      setTimeout(() => onCloseCallback(), 300); // Wait for exit animation
    }
  };

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-[10000] p-4 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom,16px)] md:pb-6">
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="pointer-events-auto relative w-full max-w-sm rounded-xl border bg-bg-dark/95 p-5 shadow-2xl backdrop-blur-md overflow-hidden"
            style={{
              borderColor: "var(--habit-purple)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 20px var(--habit-purple-glow), inset 0 0 10px rgba(255,255,255,0.05)"
            }}
          >
            {/* Active pulse overlay for that juicy feel */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0, 0.05, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              style={{ backgroundColor: "var(--habit-purple)" }}
            />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl drop-shadow-lg">{TUTORIAL_STEPS[currentStep].icon}</div>
              <div className="flex-1">
                <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-1">
                  {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.title`)}
                </h3>
                <div className="text-[10px] text-neon-cyan font-mono uppercase tracking-wider mb-2">
                  {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.refersTo`)}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-[48px] mb-5">
              <p className="font-mono text-xs text-white/80 leading-relaxed min-h-[40px]">
                {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.description`)}
              </p>
            </div>

            {/* Footer controls */}
            <div className="flex items-center justify-between">
              {/* Progress dots */}
              <div className="flex gap-1.5">
                {TUTORIAL_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep ? "w-4 bg-white" : "w-1.5 bg-white/20"
                    }`}
                    style={{
                      boxShadow: idx === currentStep ? "0 0 8px var(--habit-purple)" : "none"
                    }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
                >
                  {t('onboarding_tour.skip')}
                </button>
                
                <div className="flex gap-1">
                  {currentStep > 0 && (
                    <button
                      onClick={prevStep}
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-1 px-4 py-1.5 rounded font-bold text-bg-dark transition-all uppercase tracking-wider text-xs cursor-pointer"
                    style={{
                      backgroundColor: "var(--habit-purple)",
                      boxShadow: "0 0 10px var(--habit-purple-glow)"
                    }}
                  >
                    {currentStep === TUTORIAL_STEPS.length - 1 ? t('onboarding_tour.finish') : t('onboarding_tour.next')}
                    {currentStep < TUTORIAL_STEPS.length - 1 && <ChevronRight size={14} className="-mr-1" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
