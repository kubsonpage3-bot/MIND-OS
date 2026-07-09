import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show only if no consent choice has been stored yet
    const stored = localStorage.getItem("mindos_consent_analytics");
    if (!stored) {
      setShow(true);
    }
  }, []);

  const { isAuthenticated } = useDjangoAuth();

  const handleChoice = async (choice) => {
    localStorage.setItem("mindos_consent_analytics", choice);
    
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        "analytics_storage": choice,
        "ad_storage": choice,
        "ad_user_data": choice,
        "ad_personalization": choice
      });
    }

    if (isAuthenticated) {
      try {
        await djangoApi.profile.update({ analytics_enabled: choice === "granted" });
      } catch (e) {
        console.error("Failed to sync consent to server:", e);
      }
    }

    // Dispatch a custom event to sync with PrivacyPanel if it's open
    window.dispatchEvent(new CustomEvent("mindos_consent_updated", { detail: choice }));
    
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[9999] p-5 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                We value your privacy
              </h4>
              <p className="text-[10px] text-muted-foreground leading-normal font-mono">
                We use anonymous analytics to optimize your cognitive training experience and track app performance. No personal data is tracked or sold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleChoice("denied")}
              className="px-3.5 py-2 text-[10px] font-mono font-bold text-muted-foreground hover:text-white border border-white/5 hover:border-white/10 rounded-xl transition-all"
            >
              Decline
            </button>
            <button
              onClick={() => handleChoice("granted")}
              className="relative group overflow-hidden px-4 py-2 rounded-xl text-[10px] font-mono font-black text-black transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 transition-transform duration-300 group-hover:scale-105" />
              <span className="relative z-10">Accept</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
