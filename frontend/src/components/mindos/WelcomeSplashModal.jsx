// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { playSound } from "@/lib/soundEffects";
import { Sparkles, Shield, Cpu, ArrowRight } from "lucide-react";

export default function WelcomeSplashModal({ profile, onComplete }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Only show if user has already picked a class (not Wanderer or empty)
    // and hasn't seen welcome_splash yet
    const hasClass = profile.character_class && profile.character_class !== "Wanderer";
    const seenSplash = profile.seen_guides && profile.seen_guides["welcome_splash"];
    if (hasClass && !seenSplash) {
      setIsOpen(true);
    }
  }, [profile]);

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      return await djangoApi.profile.markGuideSeen("welcome_splash");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    },
  });

  const handleBegin = () => {
    playSound("button_click");
    markSeenMutation.mutate();
    setIsOpen(false);
    if (onComplete) {
      onComplete();
    }
  };

  if (!isOpen) return null;

  const charClass = profile?.character_class || "Operative";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl overflow-hidden select-none">
        {/* Background Grid & Ambient Glows */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 4px)" }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-lg rounded-2xl border border-indigo-500/40 bg-slate-900/90 p-6 md:p-8 shadow-[0_0_50px_rgba(99,102,241,0.35)] text-center overflow-hidden"
        >
          {/* Neon corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400 pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] uppercase tracking-widest mb-4">
            <Cpu className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            <span>{t("welcome_splash.protocol_badge", "PROTOCOL // NEURAL ENHANCEMENT")}</span>
          </div>

          {/* Title with retro glow */}
          <h1 className="text-3xl md:text-4xl font-extrabold font-mono tracking-widest text-white uppercase drop-shadow-[0_0_15px_rgba(99,102,241,0.8)] mb-2">
            MIND OS
          </h1>

          <h2 className="text-sm md:text-base font-bold font-mono text-indigo-200 uppercase tracking-wide mb-3">
            {t("welcome_splash.heading", "You have been selected for neural enhancement.")}
          </h2>

          <p className="text-xs font-mono text-slate-300/80 leading-relaxed mb-6 max-w-md mx-auto">
            {t(
              "welcome_splash.subheading",
              "MIND OS turns your daily life, study, workouts and habits into an RPG journey where every real-world action levels up your mind and character."
            )}
          </p>

          {/* Operator Status HUD Card */}
          <div className="rounded-xl border border-indigo-500/20 bg-slate-950/60 p-4 mb-6 text-left font-mono space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                {t("welcome_splash.class_label", "ASSIGNED CLASS")}
              </span>
              <span className="text-xs font-bold text-purple-300 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {charClass}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {t("welcome_splash.loadout_label", "INITIAL LOADOUT")}
              </span>
              <span className="text-xs font-bold text-amber-300">
                {t("welcome_splash.loadout_desc", "3 Starter Quests loaded • 20 Starter Gold")}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 uppercase tracking-wider">NEURAL LINK</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                ONLINE & SYNCED
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleBegin}
            className="w-full group flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(99,102,241,0.5)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>{t("welcome_splash.begin_btn", "► BEGIN PROTOCOL")}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
