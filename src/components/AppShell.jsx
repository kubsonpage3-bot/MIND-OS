import { useState, useEffect, useCallback } from "react";
import { Brain, Sparkles, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/navigation/Sidebar";
import BottomNav from "@/components/navigation/BottomNav";
import CharacterStatusBar from "@/components/navigation/CharacterStatusBar";
import Dashboard from "@/pages/Dashboard";
import LifeOS from "@/pages/LifeOS";
import { applyTheme } from "@/lib/themes";
import { queueAutoSync } from "@/lib/cloudSync";
import { applyAppearanceSettings } from "@/lib/applyAppearance";
import RewardToast from "@/components/mindos/RewardToast";

function loadRankXP() {
  try { return JSON.parse(localStorage.getItem("mindos_rank_xp") || "{}"); } catch { return { rankXP: 0, currentRank: "F" }; }
}

const APPS = [
  { id: "mind", label: "MIND OS", icon: Brain, color: "text-primary" },
  { id: "life", label: "LIFE OS", icon: Sparkles, color: "text-purple-400" },
];

// Parse section/subItem from URL search params
function parseNav(search) {
  const p = new URLSearchParams(search);
  return {
    app: p.get("app") || "mind",
    section: p.get("section") || "dashboard",
    subItem: p.get("sub") || null,
  };
}

export default function AppShell({ defaultTab = "mind" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { app: activeApp, section: activeSection, subItem: activeSubItem } = parseNav(location.search);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [rankXPData, setRankXPData] = useState(loadRankXP());
  const [currentTheme, setCurrentTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_settings") || "{}").theme || 'dark'; } catch { return 'dark'; }
  });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [hpFlash, setHpFlash] = useState(false);

  // Navigation helpers — push to history so Android back button works
  const setNav = useCallback((app, section, subItem) => {
    const p = new URLSearchParams();
    p.set("app", app);
    p.set("section", section);
    if (subItem) p.set("sub", subItem);
    navigate(`/?${p.toString()}`);
  }, [navigate]);

  const setActiveApp = (app) => setNav(app, "dashboard", null);
  const handleSectionChange = (section) => setNav(activeApp, section, null);
  const handleSubItemChange = (sub) => setNav(activeApp, activeSection, sub);
  const handleNavigate = (section, sub) => setNav(activeApp, section, sub ?? null);

  // HP damage flash detection
  useEffect(() => {
    let lastHp = null;
    const check = () => {
      try {
        const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
        const hp = gs.hp ?? 100;
        if (lastHp !== null && hp < lastHp) {
          setHpFlash(true);
          if (window.navigator?.vibrate) window.navigator.vibrate([30, 15, 30]);
          setTimeout(() => setHpFlash(false), 500);
        }
        lastHp = hp;
      } catch {}
    };
    const interval = setInterval(check, 800);
    return () => clearInterval(interval);
  }, []);

  // Sync rank data + zoom + theme
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem("mindos_rank_xp");
        if (raw) setRankXPData(JSON.parse(raw));
        const settings = JSON.parse(localStorage.getItem("mindos_settings") || "{}");
        applyAppearanceSettings(settings);
        if (settings.theme && settings.theme !== currentTheme) {
          setCurrentTheme(settings.theme);
        }
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [currentTheme]);

  // Apply theme + appearance settings
  useEffect(() => { applyTheme(currentTheme); }, [currentTheme]);
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem("mindos_settings") || "{}");
      applyAppearanceSettings(settings);
    } catch {}
  }, []);

  // Initial cloud sync on mount
  useEffect(() => {
    setSyncStatus("synced");
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    const handleStorageChange = () => queueAutoSync();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleManualSync = () => {
    setSyncStatus("syncing");
    setTimeout(() => {
      setSyncStatus("synced");
      setLastSync(new Date());
    }, 800);
  };

  const currentRank = rankXPData.currentRank || "F";

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row h-dvh overflow-hidden bg-transparent text-[var(--habit-text)] transition-colors duration-300">
      {/* HP damage red screen flash */}
      {hpFlash && (
        <motion.div
          className="fixed inset-0 z-[999] pointer-events-none"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.3) 0%, rgba(180,30,30,0.15) 100%)" }}
        />
      )}

      {/* Left sidebar — desktop only */}
      <Sidebar
        activeApp={activeApp}
        onAppChange={setActiveApp}
        activeSection={activeSection}
        activeSubItem={activeSubItem}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main content area */}
      <div className={`flex flex-col transition-all duration-300 ${sidebarCollapsed ? "md:ml-16" : "md:ml-64"} flex-1 w-full h-dvh overflow-hidden`}>
        {activeApp === "mind" && (
          <>
            <div className="relative shrink-0 z-40">
              <CharacterStatusBar rankXP={rankXPData.rankXP} currentRankId={currentRank} onToggleSidebar={() => setMobileSidebarOpen(true)} />
              <button
                onClick={handleManualSync}
                className="absolute top-2 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full transition-all"
                style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)", fontFamily: "'Nunito'", fontSize: 11, fontWeight: 700, color: "var(--habit-dim)" }}
              >
                {syncStatus === "syncing" && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: "var(--habit-purple)" }} />}
                {syncStatus === "synced" && <Cloud className="w-3 h-3" style={{ color: "#1ca830" }} />}
                {syncStatus === "error" && <CloudOff className="w-3 h-3" style={{ color: "#f74e52" }} />}
                {syncStatus === "idle" && <Cloud className="w-3 h-3" style={{ color: "var(--habit-dim)" }} />}
                <span className="hidden sm:inline">
                  {syncStatus === "syncing" ? "Sync..." : syncStatus === "synced" ? "Synced" : syncStatus === "error" ? "Error" : "Sync"}
                </span>
              </button>
            </div>
            <div className="overflow-y-auto overscroll-y-auto overflow-x-hidden flex-1 w-full pb-[130px] md:pb-8">
              <Dashboard
                activeSection={activeSection}
                activeSubItem={activeSubItem}
                onSectionChange={handleSectionChange}
                onSubItemChange={handleSubItemChange}
              />
            </div>
          </>
        )}
        {activeApp === "life" && (
          <div className="overflow-y-auto overscroll-y-auto overflow-x-hidden flex-1 w-full pb-[130px] md:pb-8">
            <LifeOS />
          </div>
        )}
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav
        activeSection={activeSection}
        activeSubItem={activeSubItem}
        onNavigate={handleNavigate}
      />

      <RewardToast />
    </div>
  );
}