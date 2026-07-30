import { useState } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { useTranslation } from "react-i18next";
import { saveSettings } from "@/utils/settings";

const LANGUAGES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "de", label: "Deutsch", flag: "🇩🇪", disabled: true },
  { id: "ru", label: "Русский", flag: "🇷🇺" },
  { id: "fr", label: "Français", flag: "🇫🇷", disabled: true },
  { id: "es", label: "Español", flag: "🇪🇸", disabled: true },
  { id: "ja", label: "日本語", flag: "🇯🇵", disabled: true },
];

export default function LanguagePanel() {
  const { i18n, t } = useTranslation();
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_settings") || "{}"); } catch { return {}; }
  });
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const currentLang = LANGUAGES.find(l => l.id === (settings.language || "en")) || LANGUAGES[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4" style={{ color: "var(--habit-dim)" }} />
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--habit-dim)" }}>
          {t("settings.language_region", "Language & Region")}
        </span>
      </div>

      {/* Language card — theme-aware via CSS vars */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{
          background: "var(--habit-panel)",
          border: "1px solid var(--habit-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" style={{ color: "var(--habit-dim)" }} />
          <span className="font-mono text-xs font-bold" style={{ color: "var(--habit-text)" }}>
            {t("settings.interface_language", "Interface Language")}
          </span>
        </div>

        {/* Selector trigger */}
        <button
          onClick={() => setLangSheetOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
          style={{
            background: "var(--habit-bg)",
            border: "1px solid var(--habit-border)",
            color: "var(--habit-text)",
          }}
        >
          <span className="flex items-center gap-2 font-mono text-sm">
            <span>{currentLang.flag}</span>
            <span>{currentLang.label}</span>
          </span>
          <ChevronDown className="w-4 h-4" style={{ color: "var(--habit-dim)" }} />
        </button>
      </div>

      {/* Language picker BottomSheet */}
      <BottomSheet isOpen={langSheetOpen} onClose={() => setLangSheetOpen(false)} title={t("settings.select_language", "Select Language")}>
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
                    i18n.changeLanguage(lang.id);
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
                  <span className="font-mono text-sm" style={{ color: "var(--habit-text)" }}>{lang.label}</span>
                  {lang.disabled && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--habit-dim)", border: "1px solid var(--habit-border)" }}>Soon</span>
                  )}
                </span>
                {isActive && <Check className="w-4 h-4" style={{ color: "var(--habit-purple)" }} />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
