import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Calendar, Timer, ChevronDown, UserCog, Lock, Globe, Ghost } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { AnimatePresence } from "framer-motion";
import PremiumUpgradeModal from "./PremiumUpgradeModal";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import LanguagePanel from "@/components/mindos/LanguagePanel";
import { useTranslation } from "react-i18next";

const WEEK_START_OPTIONS = [
  { id: "monday", label: "Monday" },
  { id: "sunday", label: "Sunday" },
  { id: "saturday", label: "Saturday" },
];



const JOHAN_DIFFICULTIES = [
  { id: "EASY",    label: "Easy",    desc: "Johan trains slow.",      xp_mult: "×0.6 XP",  color: "#00cc88" },
  { id: "NORMAL",  label: "Normal",  desc: "Balanced challenge.",      xp_mult: "×0.9 XP",  color: "#00e5ff" },
  { id: "HARD",    label: "Hard",    desc: "Johan pushes hard.",       xp_mult: "×1.2 XP",  color: "#f59e0b" },
  { id: "EXTREME", label: "Extreme", desc: "No mercy. No catch-up.",  xp_mult: "×1.6 XP",  color: "#ef4444" },
];



const TIME_OPTIONS = [
  "00:00","01:00","02:00","03:00","04:00","05:00",
  "06:00","07:00","08:00","09:00","10:00","11:00",
  "12:00","13:00","14:00","15:00","16:00","17:00",
  "18:00","19:00","20:00","21:00","22:00","23:00",
];

const TIMEZONES = [
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "Eastern Time (US)" },
  { id: "America/Chicago", label: "Central Time (US)" },
  { id: "America/Denver", label: "Mountain Time (US)" },
  { id: "America/Los_Angeles", label: "Pacific Time (US)" },
  { id: "Europe/London", label: "London (UK)" },
  { id: "Europe/Berlin", label: "Central European Time" },
  { id: "Europe/Moscow", label: "Moscow (Russia)" },
  { id: "Asia/Dubai", label: "Dubai (UAE)" },
  { id: "Asia/Kolkata", label: "India Standard Time" },
  { id: "Asia/Shanghai", label: "China Standard Time" },
  { id: "Asia/Tokyo", label: "Tokyo (Japan)" },
  { id: "Australia/Sydney", label: "Sydney (Australia)" },
];

export default function GameplayPanel() {
  const queryClient = useQueryClient();
  const { profile } = useDjangoAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const rivalDiffMutation = useMutation({
    /**
     * @param {string} diffId - one of EASY | NORMAL | HARD | EXTREME
     */
    mutationFn: (diffId) => {
      const current = profile?.rival_data || {};
      return djangoApi.profile.update({
        rival_data: { ...current, rivalDifficulty: diffId, lastUpdated: null },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["rival"] });
    },
  });

  const tzMutation = useMutation({
    mutationFn: (/** @type {string} */ tz) => djangoApi.profile.update({ timezone: tz }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [gameplay, setGameplay] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_gameplay_settings") || "{}");
    } catch {
      return {};
    }
  });

  const updateSetting = (key, value) => {
    const newSettings = { ...gameplay, [key]: value };
    setGameplay(newSettings);
    localStorage.setItem("mindos_gameplay_settings", JSON.stringify(newSettings));
  };



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Gamepad2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('settings.gameplaySettings')}</span>
      </div>

      {/* LanguagePanel embedded */}
      <div>
        <LanguagePanel />
        <div className="h-px w-full bg-border/30 my-4" />
      </div>

      {/* Week Start */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.weekStartDay')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.weekStartDayDesc')}</p>
        <div className="flex gap-1">
          {WEEK_START_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => updateSetting("weekStart", opt.id)}
              className={`flex-1 py-2 text-xs font-mono rounded border transition-all ${
                gameplay.weekStart === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--habit-border)]/40 text-muted-foreground hover:border-[var(--habit-border)]"
              }`}
            >
              {t(`settings.weekday_${opt.id}`, opt.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Day Start */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.customDayStart')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.customDayStartDesc')}</p>
        <button
          onClick={() => setShowTimePicker(true)}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--habit-border)] bg-background text-foreground font-mono text-sm flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <span>{gameplay.dayStart || "00:00"}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <BottomSheet isOpen={showTimePicker} onClose={() => setShowTimePicker(false)} title={t('settings.customDayStart')}>
          <div className="grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => { updateSetting("dayStart", t); setShowTimePicker(false); }}
                className={`py-3 text-sm font-mono rounded-lg border transition-all ${
                  (gameplay.dayStart || "00:00") === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--habit-border)]/40 text-muted-foreground hover:border-[var(--habit-border)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>

      {/* Timezone Setting */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.timezone')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.timezoneDesc')}</p>
        <button
          onClick={() => setShowTzPicker(true)}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--habit-border)] bg-background text-foreground font-mono text-sm flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <span>
            {profile?.timezone 
              ? TIMEZONES.find(t => t.id === profile.timezone)?.label || profile.timezone 
              : "UTC"}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <BottomSheet isOpen={showTzPicker} onClose={() => setShowTzPicker(false)} title={t('settings.selectTimezone')}>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 pb-6">
            {TIMEZONES.map(t => (
              <button
                key={t.id}
                onClick={() => { 
                  tzMutation.mutate(t.id);
                  setShowTzPicker(false); 
                }}
                className={`py-3 px-4 text-sm font-mono rounded-lg border transition-all text-left ${
                  (profile?.timezone || "UTC") === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--habit-border)]/40 text-muted-foreground hover:border-[var(--habit-border)]"
                }`}
              >
                {t.label} <span className="text-[10px] opacity-50 ml-2">({t.id})</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>



      {/* Johan Rival Difficulty */}
      <div className="p-4 rounded-xl border space-y-3 relative overflow-hidden"
        style={{ borderColor: "rgba(0,229,255,0.25)", background: "linear-gradient(to bottom, rgba(0,10,20,0.6), rgba(5,10,18,0.9))" }}
      >
        <div className="flex items-center gap-2">
          <Ghost className="w-4 h-4" style={{ color: "#00e5ff" }} />
          <span className="font-mono text-xs font-bold" style={{ color: "#00e5ff" }}>RIVAL — JOHAN DIFFICULTY</span>
        </div>
        <p className="text-[10px] font-mono italic" style={{ color: "rgba(0,229,255,0.5)" }}>Controls how fast Johan accumulates XP and how aggressive his surge days are.</p>
        <div className="grid grid-cols-2 gap-3">
          {JOHAN_DIFFICULTIES.map(diff => {
            const current = profile?.rival_data?.rivalDifficulty || "NORMAL";
            const isActive = current === diff.id;
            return (
              <button
                key={diff.id}
                onClick={() => rivalDiffMutation.mutate(diff.id)}
                className="py-3 px-2 text-xs font-mono rounded-lg border transition-all text-left"
                style={{
                  borderColor: isActive ? diff.color : "rgba(255,255,255,0.08)",
                  background: isActive ? `${diff.color}18` : "rgba(0,0,0,0.4)",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                  boxShadow: isActive ? `0 0 14px ${diff.color}33` : "none",
                }}
              >
                <div className="font-bold tracking-wider mb-1" style={{ color: isActive ? diff.color : "inherit" }}>{diff.label.toUpperCase()}</div>
                <div className="flex flex-col gap-0.5 text-[9px] opacity-80">
                  <span style={{ color: isActive ? diff.color : "inherit" }}>{diff.xp_mult}</span>
                  <span>{diff.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
        {rivalDiffMutation.isPending && (
          <div className="text-[9px] font-mono text-center" style={{ color: "rgba(0,229,255,0.4)" }}>Syncing with Johan...</div>
        )}
      </div>

      {/* Change Class */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.changeClass')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.changeClassDesc')}</p>
        <button
          onClick={() => {
            if (!profile?.is_premium) {
              setShowPremiumModal(true);
            } else {
              navigate("/select-class", { state: { changingClass: true } });
            }
          }}
          className="w-full py-2.5 px-4 text-xs font-mono rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2 tracking-widest"
        >
          {profile?.is_premium ? t('settings.recalibrateClass') : <><Lock className="w-3.5 h-3.5" /> {t('settings.recalibratePremium')}</>}
        </button>
      </div>






      <AnimatePresence>
        {showPremiumModal && (
          <PremiumUpgradeModal onClose={() => setShowPremiumModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}