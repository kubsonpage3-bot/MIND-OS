// @ts-nocheck
// Theme configurations
export const THEMES = {
  solid_light: {
    label: "☀️ Light Gray",
    darkMode: false,
    preview: ["#eaedf2", "#f6f8fb", "#d2d8e2", "#6366f1", "#7B61FF"],
    wallpaper: null,
    description: "Soft matte light gray",
    hpColor: "#f74e52",
    mpColor: "#3b82f6",
    xpColor: "#6366f1",
    bgOverlay: "#eaedf2",
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
    preview: ["#0e1f14", "#1b3826", "#2d5e3f", "#ffb7c5", "#b4f0c3"],
    wallpaper: "/images/webp/theme_anime.webp",
    description: "Fantasy Emerald Field",
    hpColor: "#ff8da1",
    mpColor: "#5eead4",
    xpColor: "#4ade80",
    bgOverlay: "#0e1f14",
  },
  cyberpunk: {
    label: "⚡ Cyberpunk",
    darkMode: true,
    preview: ["#090914", "#160b2e", "#00f0ff", "#ff007f", "#ffe600"],
    wallpaper: "/images/webp/theme_cyberpunk.webp",
    description: "Neon Tokyo Matrix",
    hpColor: "#ff007f",
    mpColor: "#00f0ff",
    xpColor: "#ffe600",
    bgOverlay: "#090914",
  },
  steampunk: {
    label: "⚙️ Steampunk",
    darkMode: true,
    preview: ["#150a08", "#2d160e", "#b87333", "#d4af37", "#f4a261"],
    wallpaper: "/images/webp/theme_steampunk.webp",
    description: "Victorian Clockwork City",
    hpColor: "#e76f51",
    mpColor: "#2a9d8f",
    xpColor: "#d4af37",
    bgOverlay: "#150a08",
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
    darkMode: true,
    preview: ["#1c1002", "#3a2205", "#d4af37", "#f3e5ab", "#ffb703"],
    wallpaper: "/images/webp/theme_christian.webp",
    description: "Golden Byzantine Cathedral",
    hpColor: "#e63946",
    mpColor: "#48cae4",
    xpColor: "#ffd700",
    bgOverlay: "#1c1002",
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

  // Update OS Status Bar Color
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = "theme-color";
    document.head.appendChild(metaThemeColor);
  }
  const bgColor = theme.bgOverlay || "#121215";
  metaThemeColor.content = bgColor;

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Dynamically import to avoid breaking non-Capacitor builds
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      const isLightBg = themeName === "solid_light";
      StatusBar.setStyle({ style: isLightBg ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: bgColor }).catch(() => {});
    }).catch(() => {});
  }
}