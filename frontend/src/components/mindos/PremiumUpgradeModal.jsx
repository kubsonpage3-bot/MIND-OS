import { useState } from "react";
import { motion } from "framer-motion";
import { X, Crown, Zap, Shield, Sparkles } from "lucide-react";
import { djangoApi } from "@/api/djangoClient";

export default function PremiumUpgradeModal({ onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await djangoApi.billing.createCheckoutSession();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from server.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to initialize checkout. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-[#0a0a0f] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden relative"
      >
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative p-6 pt-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-8 h-8 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-mono tracking-tight text-white">MIND OS <span className="text-amber-400">PREMIUM</span></h2>
              <p className="text-sm font-mono text-muted-foreground mt-1">Unlock your full potential.</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm font-mono text-left">
                <strong className="text-white block mb-0.5">All Character Classes</strong>
                <span className="text-muted-foreground">Unlock Architect, Linguist, and Warlord paths.</span>
              </div>
            </div>
            
            <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm font-mono text-left">
                <strong className="text-white block mb-0.5">Advanced Tools</strong>
                <span className="text-muted-foreground">Access the integrated Pomodoro and Calendar widgets.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm font-mono text-left">
                <strong className="text-white block mb-0.5">Support Development</strong>
                <span className="text-muted-foreground">Help keep the servers running and fuel future updates.</span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono text-center">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full relative group overflow-hidden rounded-xl font-mono font-bold text-black disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 transition-transform duration-300 group-hover:scale-105" />
            <div className="relative py-4 px-6 flex items-center justify-center gap-2">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>UPGRADE NOW</span>
                </>
              )}
            </div>
          </button>
          
          <div className="mt-4 text-center">
            <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-white transition-colors">
              Maybe later
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
