import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";

export default function OfflineSummaryModal({ profile }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const queryClient = useQueryClient();

  // Подписываемся на данные энкаунтеров, чтобы обновиться, когда они загрузятся
  const { data: encountersData } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
  });

  useEffect(() => {
    // Only show if offline for more than 1 hour (3600 seconds)
    // For testing purposes, we can show it for > 60 seconds.
    if (profile?.offline_seconds && profile.offline_seconds > 60) {
      // Use the reactive encountersData
      const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);
      const activeEncounter = encounters.find(e => !e.is_defeated);
      
      const hoursOffline = Math.floor(profile.offline_seconds / 3600);
      const minutesOffline = Math.floor((profile.offline_seconds % 3600) / 60);
      
      let idleDamage = 0;
      let offlineXP = 0; // Johan's XP

      if (activeEncounter && activeEncounter.idle_damage_applied > 0) {
        idleDamage = activeEncounter.idle_damage_applied;
      }
      
      // Calculate fake Johan XP for demonstration
      offlineXP = Math.floor(profile.offline_seconds / 3600 * 15) || Math.floor(profile.offline_seconds / 60); // 1 XP per minute fallback

      // If encounters haven't loaded yet, idleDamage is 0, but it will update when they do load
      setSummaryData({
        hours: hoursOffline,
        minutes: minutesOffline,
        seconds: profile.offline_seconds % 60,
        idleDamage,
        offlineXP
      });

      setIsOpen(true);
    }
  }, [profile?.offline_seconds, encountersData]);

  if (!summaryData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
            WHILE YOU WERE OFFLINE
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="text-center space-y-1">
            <div className="text-zinc-400 text-sm uppercase tracking-widest font-mono">Time Away</div>
            <div className="text-3xl font-black font-mono text-white">
              {summaryData.hours > 0 && `${summaryData.hours}h `}
              {summaryData.minutes > 0 && `${summaryData.minutes}m `}
              {summaryData.hours === 0 && summaryData.minutes === 0 && `${summaryData.seconds}s`}
            </div>
          </div>

          <div className="w-full space-y-3">
            {summaryData.idleDamage > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-900/50 flex items-center justify-center text-xl border border-red-700/50">
                    ⚔️
                  </div>
                  <div>
                    <div className="font-bold text-red-100 text-sm">Passive Boss Damage</div>
                    <div className="text-xs text-red-400/80 font-mono">Your party kept fighting</div>
                  </div>
                </div>
                <div className="text-xl font-black font-mono text-red-400">
                  {summaryData.idleDamage.toLocaleString()}
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center text-xl border border-blue-700/50">
                  👥
                </div>
                <div>
                  <div className="font-bold text-blue-100 text-sm">Rival Progress (Johan)</div>
                  <div className="text-xs text-blue-400/80 font-mono">Aggregate XP gained</div>
                </div>
              </div>
              <div className="text-xl font-black font-mono text-blue-400">
                +{summaryData.offlineXP.toLocaleString()} XP
              </div>
            </motion.div>
          </div>

          <Button 
            onClick={() => setIsOpen(false)}
            className="w-full h-12 text-lg font-black tracking-widest bg-zinc-100 text-zinc-900 hover:bg-white"
          >
            CONTINUE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
