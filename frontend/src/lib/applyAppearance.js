// Accent palette definitions - maps to CSS variables
export const ACCENT_PALETTES = [
  { id: "default", label: "Default Blue", colors: { primary: "210 100% 60%", gf: "210 100% 60%", gc: "142 70% 50%", ps: "43 100% 58%", vm: "270 80% 65%" } },
  { id: "indigo_moon", label: "Indigo Moon", colors: { primary: "239 84% 67%", gf: "239 84% 67%", gc: "160 74% 35%", ps: "45 93% 55%", vm: "292 73% 72%" } },
  { id: "blood_crimson", label: "Blood Crimson", colors: { primary: "0 72% 51%", gf: "0 72% 51%", gc: "142 72% 40%", ps: "32 95% 55%", vm: "270 70% 58%" } },
  { id: "amber_ember", label: "Amber Ember", colors: { primary: "38 92% 50%", gf: "38 92% 50%", gc: "84 81% 44%", ps: "25 95% 55%", vm: "292 73% 72%" } },
  { id: "ocean_depths", label: "Ocean Depths", colors: { primary: "199 89% 48%", gf: "199 89% 48%", gc: "174 72% 40%", ps: "45 93% 55%", vm: "270 80% 65%" } },
];

export const FONT_SIZES = {
  small: { base: "13px", heading: "0.85rem" },
  medium: { base: "15px", heading: "1rem" },
  large: { base: "17px", heading: "1.15rem" },
};

export function applyAppearanceSettings(settings) {
  const root = document.documentElement;

  // Zoom
  if (settings.zoom) {
    root.style.setProperty("--zoom-scale", settings.zoom);
  }

  // Accent palette → CSS custom properties
  if (settings.accentPalette) {
    const palette = ACCENT_PALETTES.find(p => p.id === settings.accentPalette);
    if (palette) {
      root.style.setProperty("--primary", palette.colors.primary);
      root.style.setProperty("--ring", palette.colors.primary);
      root.style.setProperty("--gf-color", palette.colors.gf);
      root.style.setProperty("--gc-color", palette.colors.gc);
      root.style.setProperty("--ps-color", palette.colors.ps);
      root.style.setProperty("--vm-color", palette.colors.vm);
    }
  }

  // Font size
  if (settings.fontSize) {
    const fs = FONT_SIZES[settings.fontSize];
    if (fs) {
      root.style.setProperty("--font-size-base", fs.base);
      root.style.fontSize = fs.base;
      document.body.style.fontSize = fs.base;
    }
  }

  // Reduce motion
  if (settings.reduceMotion) {
    root.style.setProperty("--motion-duration", "0s");
    root.classList.add("reduce-motion");
  } else {
    root.style.removeProperty("--motion-duration");
    root.classList.remove("reduce-motion");
  }
}