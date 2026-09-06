// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/soundEffects";

const TUTORIAL_STEPS = [
  {
    icon: "⚔️",
    id: "tasks",
    targetSelector: '[data-tour="tasks"]',
  },
  {
    icon: "🧠",
    id: "training",
    targetSelector: '[data-tour="train"], [data-tour="dashboard"]',
  },
  {
    icon: "🏅",
    id: "character",
    targetSelector: '[data-tour="character"]',
  },
  {
    icon: "🛒",
    id: "shop",
    targetSelector: '[data-tour="character"]',
  },
  {
    icon: "🏆",
    id: "ranks",
    targetSelector: '[data-tour="dashboard"]',
  },
  {
    icon: "📚",
    id: "explore",
    targetSelector: '[data-tour="tools"], [data-tour="settings"]',
  },
];

export default function BalatroTutorialToast({ profile, forceOpen = false, onCloseCallback }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const queryClient = useQueryClient();

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      return await djangoApi.profile.markGuideSeen("main_tutorial");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["userprofile"] });
      const previousProfile = queryClient.getQueryData(["userprofile"]);
      if (previousProfile) {
        queryClient.setQueryData(["userprofile"], {
          ...previousProfile,
          seen_guides: {
            ...(previousProfile.seen_guides || {}),
            main_tutorial: true,
          },
        });
      }
      return { previousProfile };
    },
    onError: (err, _variables, context) => {
      console.error("Failed to mark main_tutorial as seen:", err);
      if (context?.previousProfile) {
        queryClient.setQueryData(["userprofile"], context.previousProfile);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    },
  });

  useEffect(() => {
    if (forceOpen) {
      setCurrentStep(0);
      setIsVisible(true);
    } else if (profile && profile.seen_guides) {
      // Only show automatically if user has selected a real class
      const hasClass = profile.character_class && profile.character_class !== "Wanderer";
      // And has already seen the welcome splash
      const seenSplash = profile.seen_guides["welcome_splash"];
      if (hasClass && seenSplash && !profile.seen_guides["main_tutorial"]) {
        setIsVisible(true);
      }
    }
  }, [forceOpen, profile]);

  // Update spotlight target bounding box
  const updateSpotlight = () => {
    if (!isVisible) {
      setTargetRect(null);
      return;
    }
    const step = TUTORIAL_STEPS[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: Math.max(0, rect.top - 6),
          left: Math.max(0, rect.left - 6),
          width: rect.width + 12,
          height: rect.height + 12,
        });
        return;
      }
    }
    setTargetRect(null);
  };

  useEffect(() => {
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [currentStep, isVisible]);

  const handleClose = () => {
    playSound("button_click");
    setIsVisible(false);
    setTargetRect(null);
    markSeenMutation.mutate();
    if (onCloseCallback) {
      onCloseCallback();
    }
  };

  const nextStep = () => {
    playSound("button_click");
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      playSound("task_complete");
      handleClose();
    }
  };

  const prevStep = () => {
    playSound("button_click");
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Glowing Spotlight Cutout around active UI element */}
          {targetRect && (
            <motion.div
              layoutId="tutorial-spotlight"
              initial={false}
              animate={{
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height,
              }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="fixed pointer-events-none z-[9995] rounded-2xl border-2 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.9),inset_0_0_12px_rgba(168,85,247,0.4)] ring-4 ring-purple-500/20"
            >
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-purple-600 border border-purple-400 text-white font-mono text-[10px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.8)] whitespace-nowrap animate-bounce flex items-center gap-1">
                <span>▼</span>
                <span>{TUTORIAL_STEPS[currentStep].icon}</span>
              </div>
            </motion.div>
          )}

          {/* Interactive Tutorial Card (positioned securely above mobile bottom nav) */}
          <div className="fixed bottom-[calc(var(--bottom-bar-height,68px)+16px)] md:bottom-10 left-4 right-4 z-[10000] flex justify-center pointer-events-none">
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="pointer-events-auto relative w-full max-w-md rounded-2xl border border-indigo-500/40 bg-slate-950/95 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(99,102,241,0.35)] backdrop-blur-xl overflow-hidden select-none"
            >
              {/* Subtle ambient pulse */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  background:
                    "radial-gradient(ellipse at top right, rgba(99,102,241,0.4), transparent 70%)",
                }}
              />

              {/* Progress Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-mono font-bold tracking-widest text-indigo-300 uppercase">
                    {t("onboarding_tour.step_counter", {
                      current: currentStep + 1,
                      total: TUTORIAL_STEPS.length,
                      defaultValue: `STEP ${currentStep + 1} OF ${TUTORIAL_STEPS.length}`,
                    })}
                  </span>
                  <div className="w-20 md:w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%`,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="text-xs font-mono font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer px-2 py-1"
                >
                  {t("onboarding_tour.skip", "Skip")}
                </button>
              </div>

              {/* Step Content */}
              <div className="relative z-10">
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.3)]">
                    {TUTORIAL_STEPS[currentStep].icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-mono text-sm font-black text-white uppercase tracking-wide">
                      {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.title`)}
                    </h3>
                    <div className="text-[10px] text-indigo-300 font-mono uppercase tracking-wider mt-0.5">
                      {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.refersTo`)}
                    </div>
                  </div>
                </div>

                <p className="font-mono text-xs text-slate-200/90 leading-relaxed mb-5 bg-slate-900/60 p-3 rounded-xl border border-white/5">
                  {t(`onboarding_tour.steps.${TUTORIAL_STEPS[currentStep].id}.description`)}
                </p>
              </div>

              {/* Controls */}
              <div className="relative z-10 flex items-center justify-between">
                {currentStep > 0 ? (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    <span>{t("onboarding_tour.back", "Back")}</span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={nextStep}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-mono font-bold text-white uppercase tracking-wider shadow-[0_0_15px_rgba(99,102,241,0.5)] active:scale-95 transition-all cursor-pointer"
                >
                  <span>
                    {currentStep === TUTORIAL_STEPS.length - 1
                      ? t("onboarding_tour.finish", "Finish")
                      : t("onboarding_tour.next", "Next")}
                  </span>
                  {currentStep < TUTORIAL_STEPS.length - 1 && <ChevronRight size={14} />}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
