import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Calendar, Timer, Swords, Archive, Brain, ChevronDown, UserCog, Lock, Globe } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { AnimatePresence } from "framer-motion";
import PremiumUpgradeModal from "./PremiumUpgradeModal";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import LanguagePanel from "@/components/mindos/LanguagePanel";

const WEEK_START_OPTIONS = [
  { id: "monday", label: "Monday" },
  { id: "sunday", label: "Sunday" },
  { id: "saturday", label: "Saturday" },
];

const POMODORO_PRESETS = [
  { work: 25, break: 5, label: "Classic (25/5)" },
  { work: 50, break: 10, label: "Extended (50/10)" },
  { work: 90, break: 15, label: "Deep Work (90/15)" },
];

const BOSS_DIFFICULTIES = [
  { id: "easy", label: "Easy", hp: 500, reward: 0.8 },
  { id: "normal", label: "Normal", hp: 1000, reward: 1.0 },
  { id: "hard", label: "Hard", hp: 2000, reward: 1.5 },
  { id: "extreme", label: "Extreme", hp: 5000, reward: 2.5 },
];

const DOMAIN_WEIGHTS = {
  Math: ["gf", "gc"],
  Physics: ["gf", "ps"],
  English: ["vm", "gc"],
  Philosophy: ["gc", "gf"],
  Coding: ["gf", "ps"],
  Sleep: ["gf", "gc", "ps", "vm"],
  Nutrition: ["gf", "gc", "ps"],
  Reading: ["vm", "gc"],
  Social: ["vm", "gc"],
  Mindfulness: ["gf", "vm"],
  Exercise: ["ps", "gf"],
};

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
  
  const difficultyMutation = useMutation({
    /**
     * @param {string} diffId
     */
    mutationFn: (diffId) => djangoApi.profile.update({ boss_difficulty: diffId.toUpperCase() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
  });

  const tzMutation = useMutation({
    mutationFn: (tz) => djangoApi.profile.update({ timezone: tz }),
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

  const updateDomainWeight = (domain, stats) => {
    const current = gameplay.domainWeights || {};
    const newWeights = { ...current, [domain]: stats };
    updateSetting("domainWeights", newWeights);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Gamepad2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Gameplay Settings</span>
      </div>

      {/* LanguagePanel embedded */}
      <div>
        <LanguagePanel />
        <div className="h-px w-full bg-border/30 my-4" />
      </div>

      {/* Week Start */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Week Start Day</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Determines when Weekly XP resets and boss cycles</p>
        <div className="flex gap-1">
          {WEEK_START_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => updateSetting("weekStart", opt.id)}
              className={`flex-1 py-2 text-xs font-mono rounded border transition-all ${
                gameplay.weekStart === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Day Start */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Custom Day Start</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Time when daily tasks reset (default: midnight)</p>
        <button
          onClick={() => setShowTimePicker(true)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-sm flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <span>{gameplay.dayStart || "00:00"}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <BottomSheet isOpen={showTimePicker} onClose={() => setShowTimePicker(false)} title="Custom Day Start">
          <div className="grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => { updateSetting("dayStart", t); setShowTimePicker(false); }}
                className={`py-3 text-sm font-mono rounded-lg border transition-all ${
                  (gameplay.dayStart || "00:00") === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>

      {/* Timezone Setting */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Local Timezone</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Used for accurate daily resets on the server</p>
        <button
          onClick={() => setShowTzPicker(true)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground font-mono text-sm flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <span>
            {profile?.timezone 
              ? TIMEZONES.find(t => t.id === profile.timezone)?.label || profile.timezone 
              : "UTC"}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <BottomSheet isOpen={showTzPicker} onClose={() => setShowTzPicker(false)} title="Select Timezone">
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
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {t.label} <span className="text-[10px] opacity-50 ml-2">({t.id})</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>

      {/* Pomodoro Preset */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Pomodoro Duration</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Default work/break intervals</p>
        <div className="space-y-2">
          {POMODORO_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => updateSetting("pomodoro", { work: preset.work, break: preset.break })}
              className={`w-full py-2 text-xs font-mono rounded border transition-all text-left px-3 ${
                gameplay.pomodoro?.work === preset.work
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Boss Difficulty */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3 relative overflow-hidden" style={{ borderColor: "rgba(240,192,64,0.3)", background: "linear-gradient(to bottom, rgba(15,10,20,0.5), rgba(10,5,15,0.8))" }}>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4" style={{ color: "#f0c040" }} />
          <span className="font-mono text-sm font-bold tracking-widest text-white shadow-sm">BOSS DIFFICULTY</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 font-mono italic">Affects boss HP and reward multipliers</p>
        <div className="grid grid-cols-2 gap-3">
          {BOSS_DIFFICULTIES.map(diff => {
            const backendDiff = profile?.boss_difficulty || "NORMAL";
            const isActive = backendDiff === diff.id.toUpperCase();
            return (
              <button
                key={diff.id}
                onClick={() => difficultyMutation.mutate(diff.id)}
                className="py-3 px-2 text-xs font-mono rounded-lg border transition-all relative"
                style={{
                  borderColor: isActive ? "#dc2626" : "rgba(255,255,255,0.1)",
                  background: isActive ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.4)",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  boxShadow: isActive ? "0 0 12px rgba(220,38,38,0.2)" : "none",
                }}
              >
                <div className="font-bold tracking-wider mb-1" style={{ color: isActive ? "#f87171" : "inherit" }}>{diff.label.toUpperCase()}</div>
                <div className="flex flex-col gap-0.5 text-[9px] opacity-80">
                  <span>{diff.hp} HP</span>
                  <span style={{ color: isActive ? "#fcd34d" : "inherit" }}>×{diff.reward.toFixed(1)} REWARDS</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Change Class */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Change Class</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Select a new baseline neural architecture. Your current rank and progress will be preserved.</p>
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
          {profile?.is_premium ? "RECALIBRATE CLASS" : <><Lock className="w-3.5 h-3.5" /> RECALIBRATE (PREMIUM)</>}
        </button>
      </div>

      {/* Streak Freeze */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Streak Freeze</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Allow skipping days without losing streak</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Enable streak freeze</span>
          <button
            onClick={() => updateSetting("streakFreeze", !gameplay.streakFreeze)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              gameplay.streakFreeze
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {gameplay.streakFreeze ? "ON" : "OFF"}
          </button>
        </div>
        {gameplay.streakFreeze && (
          <div className="text-[10px] text-muted-foreground/70 font-mono mt-2">
            Freezes available: {gameplay.freezeUses || 3}/month
          </div>
        )}
      </div>

      {/* Auto-archive Todos */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Auto-archive To-Dos</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Automatically archive completed to-dos after N days</p>
        <div className="flex gap-1">
          {[0, 1, 3, 7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => updateSetting("autoArchiveDays", days)}
              className={`flex-1 py-1.5 text-[10px] font-mono rounded border transition-all ${
                gameplay.autoArchiveDays === days
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {days === 0 ? "Never" : `${days}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Weights */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Domain Weights</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Which stats each category trains</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.entries(DOMAIN_WEIGHTS).map(([domain, defaultStats]) => {
            const currentStats = gameplay.domainWeights?.[domain] || defaultStats;
            return (
              <div key={domain} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <span className="text-xs font-mono text-foreground">{domain}</span>
                <div className="flex gap-1">
                  {["gf", "gc", "ps", "vm"].map(stat => (
                    <button
                      key={stat}
                      onClick={() => {
                        const newStats = currentStats.includes(stat)
                          ? currentStats.filter(s => s !== stat)
                          : [...currentStats, stat];
                        updateDomainWeight(domain, newStats);
                      }}
                      className={`w-6 h-6 text-[9px] font-mono rounded transition-all ${
                        currentStats.includes(stat)
                          ? `bg-${stat === 'gf' ? 'blue' : stat === 'gc' ? 'green' : stat === 'ps' ? 'yellow' : 'purple'}-500/20 border border-${stat === 'gf' ? 'blue' : stat === 'gc' ? 'green' : stat === 'ps' ? 'yellow' : 'purple'}-400 text-${stat === 'gf' ? 'blue' : stat === 'gc' ? 'green' : stat === 'ps' ? 'yellow' : 'purple'}-400`
                          : "border-border/40 text-muted-foreground"
                      }`}
                    >
                      {stat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <AnimatePresence>
        {showPremiumModal && (
          <PremiumUpgradeModal onClose={() => setShowPremiumModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}