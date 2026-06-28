import { useState } from "react";
import { Globe, Ruler, ChevronDown, Check } from "lucide-react";
import { queueAutoSync } from "@/lib/cloudSync";
import BottomSheet from "@/components/ui/BottomSheet";

const LANGUAGES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "de", label: "Deutsch", flag: "🇩🇪", disabled: true },
  { id: "ru", label: "Russian", flag: "🇷🇺", disabled: true },
  { id: "fr", label: "Français", flag: "🇫🇷", disabled: true },
  { id: "es", label: "Español", flag: "🇪🇸", disabled: true },
  { id: "ja", label: "日本語", flag: "🇯🇵", disabled: true },
];

export default function LanguagePanel() {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_settings") || "{}"); } catch { return {}; }
  });
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem("mindos_settings", JSON.stringify(newSettings));
    queueAutoSync();
  };

  const currentLang = LANGUAGES.find(l => l.id === (settings.language || "en")) || LANGUAGES[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Language & Region</span>
      </div>

      {/* Language */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Interface Language</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Currently English only — more languages coming soon</p>

        {/* Custom selector trigger */}
        <button
          onClick={() => setLangSheetOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-2 font-mono text-sm text-foreground">
            <span>{currentLang.flag}</span>
            <span>{currentLang.label}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Units */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Units</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Measurement system for Exercise category</p>
        <div className="flex gap-1">
          {[
            { id: "metric", label: "Metric (km, kg)" },
            { id: "imperial", label: "Imperial (mi, lbs)" },
          ].map(unit => (
            <button
              key={unit.id}
              onClick={() => updateSetting("units", unit.id)}
              className={`flex-1 py-2.5 text-xs font-mono rounded border transition-all ${
                settings.units === unit.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {unit.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language picker BottomSheet */}
      <BottomSheet isOpen={langSheetOpen} onClose={() => setLangSheetOpen(false)} title="Select Language">
        <div className="space-y-1">
          {LANGUAGES.map(lang => {
            const isActive = (settings.language || "en") === lang.id;
            return (
              <button
                key={lang.id}
                disabled={lang.disabled}
                onClick={() => {
                  if (!lang.disabled) {
                    updateSetting("language", lang.id);
                    setLangSheetOpen(false);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all disabled:opacity-40"
                style={{
                  background: isActive ? "rgba(123,97,255,0.15)" : "transparent",
                  border: isActive ? "1px solid rgba(123,97,255,0.4)" : "1px solid transparent",
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{lang.flag}</span>
                  <span className="font-mono text-sm text-foreground">{lang.label}</span>
                  {lang.disabled && (
                    <span className="text-[9px] font-mono text-muted-foreground/50 border border-border/30 px-1.5 py-0.5 rounded">Soon</span>
                  )}
                </span>
                {isActive && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}