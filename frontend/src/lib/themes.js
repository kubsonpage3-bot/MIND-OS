// Theme configurations
export const THEMES = {
  solid_light: {
    label: "☀️ Light",
    darkMode: false,
    preview: ["#f6f6f9", "#ffffff", "#e5e3eb", "#7B61FF", "#9461f5"],
    wallpaper: null,
    description: "Clean solid white",
    hpColor: "#f74e52",
    mpColor: "#50b5e9",
    xpColor: "#7B61FF",
    bgOverlay: "#f6f6f9",
  },
  solid_dark: {
    label: "🌙 Dark",
    darkMode: true,
    preview: ["#121215", "#1a1a1f", "#2a2a2f", "#9461f5", "#7B61FF"],
    wallpaper: null,
    description: "Clean solid dark",
    hpColor: "#f74e52",
    mpColor: "#50b5e9",
    xpColor: "#9461f5",
    bgOverlay: "#121215",
  },
  dark: {
    label: "🌌 Cosmos",
    darkMode: true,
    preview: ["#0d0820", "#1a1040", "#2d1a5e", "#9d7cff", "#7B61FF"],
    wallpaper: "/images/webp/theme_dark.webp",
    description: "Starry night cosmos",
    hpColor: "#9d7cff",
    mpColor: "#2d1a5e",
    xpColor: "#7B61FF",
    bgOverlay: "#0d0820",
  },
  anime: {
    label: "🌸 Anime",
    darkMode: true,
    preview: ["#1a3020", "#2d5a3a", "#4a8c5c", "#ffb7b2", "#a8d8a8"],
    wallpaper: "/images/webp/theme_anime.webp",
    description: "Fantasy field (Re:Zero)",
    hpColor: "#ffb7b2",
    mpColor: "#a8d8a8",
    xpColor: "#4a8c5c",
    bgOverlay: "#1a3020",
  },
  cyberpunk: {
    label: "⚡ Cyberpunk",
    darkMode: true,
    preview: ["#0d0d1a", "#1a0030", "#00ffcc", "#ff00ff", "#00ffcc"],
    wallpaper: null,
    description: "Neon grid city",
    hpColor: "#ff00ff",
    mpColor: "#00ffcc",
    xpColor: "#00ffcc",
    bgOverlay: "#0d0d1a",
  },
  steampunk: {
    label: "⚙️ Steampunk",
    darkMode: true,
    preview: ["#1a0d0d", "#2d1a10", "#5a3a20", "#d4af37", "#b08c68"],
    wallpaper: "/images/webp/theme_steampunk.webp",
    description: "Purple clockwork city",
    hpColor: "#d4af37",
    mpColor: "#b08c68",
    xpColor: "#d4af37",
    bgOverlay: "#1a0d0d",
  },
  dark_fantasy: {
    label: "🩸 Dark Fantasy",
    darkMode: true,
    preview: ["#120008", "#2a0010", "#5a0020", "#cc1040", "#ff4060"],
    wallpaper: "/images/webp/theme_dark_fantasy.webp",
    description: "Gothic castle, blood moon",
    hpColor: "#ff4060",
    mpColor: "#5a0020",
    xpColor: "#cc1040",
    bgOverlay: "#120008",
  },
  christian: {
    label: "✝️ Orthodox",
    darkMode: false,
    preview: ["#2d1a00", "#5a3800", "#c87820", "#f0c040", "#fff8e0"],
    wallpaper: "/images/webp/theme_christian.webp",
    description: "Golden Orthodox cathedral",
    hpColor: "#c87820",
    mpColor: "#f0c040",
    xpColor: "#f0c040",
    bgOverlay: "#2d1a00",
  },
};

export function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.solid_dark;
  const root = document.documentElement;

  // Set data-theme attribute for CSS to handle backgrounds
  root.setAttribute('data-theme', themeName);

  // Apply dark mode class
  if (theme.darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}