import { useState, useEffect } from "react";
import { Palette, Type, Volume2, VolumeX, Waves, Smartphone } from "lucide-react";
import { THEMES, applyTheme } from "@/lib/themes";
import { ACCENT_PALETTES, applyAppearanceSettings } from "@/lib/applyAppearance";
import { useTranslation } from "react-i18next";

export default function AppearancePanel() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_settings") || "{}"); } catch { return {}; }
  });

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem("mindos_settings", JSON.stringify(newSettings));
    applyAppearanceSettings(newSettings);
    if (key === "theme") applyTheme(value);
  };

  useEffect(() => {
    applyAppearanceSettings(settings);
    if (settings.theme) applyTheme(settings.theme);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('settings.appearanceSettings')}</span>
      </div>

      {/* Theme */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.themeTitle')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.themeDesc')}</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(THEMES).map(([key, theme]) => {
            const isActive = settings.theme === key;
            return (
              <button
                key={key}
                onClick={() => updateSetting("theme", key)}
                className={`relative overflow-hidden rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? "border-primary shadow-lg shadow-primary/30 scale-[1.03]"
                    : "border-border/40 hover:border-border hover:scale-[1.01]"
                }`}
                style={{ minHeight: 80 }}
              >
                {theme.wallpaper ? (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${theme.wallpaper})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${(theme.preview || ["#0d0d1a","#1a0030"]).slice(0,2).join(", ")})`,
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-black/45" />
                <div className="relative z-10 p-2 flex flex-col gap-1 h-full">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-white drop-shadow">{theme.label}</span>
                    {isActive && (
                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-primary text-white">✓</span>
                    )}
                  </div>
                  {theme.description && (
                    <span className="text-[9px] text-white/70 font-mono">{theme.description}</span>
                  )}
                  <div className="flex gap-0.5 mt-auto">
                    {(theme.preview || []).map((color, i) => (
                      <div
                        key={i}
                        className="flex-1 h-2 rounded-sm"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Palette */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.accentPalette')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.accentPaletteDesc')}</p>
        <div className="space-y-2">
          {ACCENT_PALETTES.map(palette => {
            const previewColors = Object.values(palette.colors).slice(0, 5);
            return (
              <button
                key={palette.id}
                onClick={() => updateSetting("accentPalette", palette.id)}
                className={`w-full p-3 rounded-lg border transition-all text-left ${
                  settings.accentPalette === palette.id
                    ? "border-primary bg-primary/10"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-foreground">{palette.label}</span>
                  <div className="flex gap-1">
                    {previewColors.map((hsl, idx) => (
                      <div key={idx} className="w-4 h-4 rounded" style={{ background: `hsl(${hsl})` }} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* UI Scale */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.uiScale')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.uiScaleDesc')}</p>
        <div className="flex gap-1.5 flex-wrap">
          {[0.75, 0.85, 1.0, 1.15, 1.25].map(zoom => (
            <button
              key={zoom}
              onClick={() => updateSetting("zoom", zoom)}
              className={`px-3 py-1.5 text-[10px] font-mono rounded border transition-all ${
                (settings.zoom || 1.0) === zoom
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {Math.round(zoom * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('settings.fontSize')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.fontSizeDesc')}</p>
        <div className="flex gap-1">
          {["small", "medium", "large"].map(size => (
            <button
              key={size}
              onClick={() => updateSetting("fontSize", size)}
              className={`flex-1 py-2 text-xs font-mono rounded border transition-all ${
                (settings.fontSize || "medium") === size
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {t(`settings.fontSize_${size}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Reduce Animations */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t('settings.reduceMotion')}</span>
          </div>
          <button
            onClick={() => updateSetting("reduceMotion", !settings.reduceMotion)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              settings.reduceMotion
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {settings.reduceMotion ? t('settings.on') : t('settings.off')}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.reduceMotionDesc')}</p>
      </div>

      {/* Sound */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t('settings.soundEffects')}</span>
          </div>
          <button
            onClick={() => updateSetting("soundEnabled", settings.soundEnabled === false ? true : false)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all flex items-center gap-1 ${
              settings.soundEnabled !== false
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {settings.soundEnabled !== false ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {settings.soundEnabled !== false ? t('settings.on') : t('settings.off')}
          </button>
        </div>
        {settings.soundEnabled !== false && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground">{t('settings.volume')}: {settings.soundVolume || 50}%</div>
            <input
              type="range" min="0" max="100"
              onPointerDown={(e) => e.stopPropagation()}
              value={settings.soundVolume || 50}
              onChange={e => updateSetting("soundVolume", parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Haptics */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t('settings.hapticFeedback')}</span>
          </div>
          <button
            onClick={() => updateSetting("hapticsEnabled", !settings.hapticsEnabled)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              settings.hapticsEnabled
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {settings.hapticsEnabled ? t('settings.on') : t('settings.off')}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('settings.hapticFeedbackDesc')}</p>
      </div>
    </div>
  );
}