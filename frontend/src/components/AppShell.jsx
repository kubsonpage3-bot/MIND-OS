import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Sparkles, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/navigation/Sidebar";
import BottomNav, { MOBILE_SECTIONS } from "@/components/navigation/BottomNav";
import CharacterStatusBar from "@/components/navigation/CharacterStatusBar";
import Dashboard from "@/pages/Dashboard";
import LifeOS from "@/pages/LifeOS";
import { applyTheme } from "@/lib/themes";
import { applyAppearanceSettings } from "@/lib/applyAppearance";
import RewardToast from "@/components/mindos/RewardToast";
import BalatroTutorialToast from "@/components/mindos/BalatroTutorialToast";
import GameplayInsightCard from "@/components/mindos/GameplayInsightCard";
import { THEMES } from "@/lib/themes";
import PullToRefresh from "@/components/mindos/PullToRefresh";
import { useQueryClient } from "@tanstack/react-query";

import { useDjangoAuth } from "@/lib/DjangoAuthContext";
// Removed getRankFromXP

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
  const { t } = useTranslation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const SWIPE_THRESHOLD = 80;
  const SWIPE_TABS = MOBILE_SECTIONS.map(s => s.navTarget);
  const { profile: djangoProfile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();
  const [currentTheme, setCurrentTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_settings") || "{}").theme || 'dark'; } catch { return 'dark'; }
  });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [hpFlash, setHpFlash] = useState(false);
  const [forceTutorialOpen, setForceTutorialOpen] = useState(false);

  useEffect(() => {
    const handleReplay = () => setForceTutorialOpen(true);
    window.addEventListener("replayMainTutorial", handleReplay);
    return () => window.removeEventListener("replayMainTutorial", handleReplay);
  }, []);

  // Capacitor hardware back button handling
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        const backListener = App.addListener('backButton', async () => {
          // 1. Try to close custom modals registered with useHardwareBack
          const { closeTopModal } = await import('@/utils/modalStack');
          if (closeTopModal()) return;

          // 2. Try to close Radix UI dialogs (by simulating Escape key)
          const hasDialog = document.querySelector('[role="dialog"], [data-state="open"]');
          if (hasDialog) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            return; // Assume the dialog handles its own close
          }

          // 3. Fallback to router navigation
          const search = new URLSearchParams(window.location.search);
          const app = search.get("app") || "mind";
          const section = search.get("section") || "dashboard";
          const subItem = search.get("sub") || null;
          
          if (app === "mind" && section === "dashboard" && !subItem) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });
        return () => {
          backListener.then(l => l.remove());
        };
      }).catch(() => {});
    }
  }, []);

  // Navigation helpers — push to history so Android back button works
  const setNav = useCallback((app, section, subItem, extraParams) => {
    const p = new URLSearchParams();
    p.set("app", app);
    p.set("section", section);
    if (subItem) p.set("sub", subItem);
    if (extraParams?.shopTab) p.set("shopTab", extraParams.shopTab);
    navigate(`/?${p.toString()}`);
  }, [navigate]);

  const setActiveApp = (app) => setNav(app, "dashboard", null);
  const handleSectionChange = (section) => setNav(activeApp, section, null);
  const handleSubItemChange = (sub) => setNav(activeApp, activeSection, sub);
  const handleNavigate = (section, sub, extraParams) => setNav(extraParams?.app || activeApp, section, sub ?? null, extraParams);

  // HP damage flash detection
  useEffect(() => {
    let lastHp = null;
    const hp = djangoProfile?.hp ?? 100;
    if (lastHp !== null && hp < lastHp) {
      setHpFlash(true);
      if (window.navigator?.vibrate) window.navigator.vibrate([30, 15, 30]);
      setTimeout(() => setHpFlash(false), 500);
    }
    lastHp = hp;
  }, [djangoProfile?.hp]);

  // Sync rank data + zoom + theme
  useEffect(() => {
    const refresh = () => {
      try {
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

  // Apply theme
  useEffect(() => { applyTheme(currentTheme); }, [currentTheme]);


  // Initial cloud sync on mount
  useEffect(() => {
    setSyncStatus("synced");
    setLastSync(new Date());
  }, []);


  const handleManualSync = async () => {
    setSyncStatus("syncing");
    try {
      if (refreshProfile) {
        await refreshProfile();
      }
      await queryClient.invalidateQueries();
      setSyncStatus("synced");
      setLastSync(new Date());
    } catch (e) {
      console.error("Sync failed:", e);
      setSyncStatus("error");
    }
  };

  const rankXP = djangoProfile?.rank_xp || 0;
  const currentRank = djangoProfile?.rank_info?.current_id || "F";

  const mainScrollRef = useRef(null);

  // Temporary Debug HUD for edge-to-edge spacer tracking
  const showDebugHUD = new URLSearchParams(location.search).get("debug") === "1";
  const [computedBottomBarHeight, setComputedBottomBarHeight] = useState("0px");
  const [scrollMetrics, setScrollMetrics] = useState({ scrollHeight: 0, clientHeight: 0 });

  useEffect(() => {
    if (!showDebugHUD) return;
    const updateMetrics = () => {
      const height = window.getComputedStyle(document.documentElement).getPropertyValue('--bottom-bar-height') || "not set";
      setComputedBottomBarHeight(height);

      if (mainScrollRef.current) {
        setScrollMetrics({
          scrollHeight: mainScrollRef.current.scrollHeight,
          clientHeight: mainScrollRef.current.clientHeight
        });
      }
    };
    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);
    window.addEventListener('resize', updateMetrics);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [showDebugHUD, activeSection]);

  const getRenderedItemCount = () => {
    if (activeSection === "tasks") {
      const tasksData = queryClient.getQueryData(["tasks"]);
      return Array.isArray(tasksData) ? tasksData.length : 0;
    }
    if (activeSection === "history") {
      const logsData = queryClient.getQueryData(["trainingLogs"])?.log;
      return Array.isArray(logsData) ? logsData.length : 0;
    }
    return "N/A";
  };
  const itemCount = getRenderedItemCount();

  const getSwipeIndex = (section) => {
    if (["history", "pomodoro", "calendar", "stats"].includes(section)) {
      return SWIPE_TABS.indexOf("history");
    }
    return SWIPE_TABS.indexOf(section);
  };

  const currentIndex = getSwipeIndex(activeSection);
  const prevSection = currentIndex > 0 ? MOBILE_SECTIONS[currentIndex - 1] : null;
  const nextSection = currentIndex !== -1 && currentIndex < MOBILE_SECTIONS.length - 1 ? MOBILE_SECTIONS[currentIndex + 1] : null;

  // Native swipe is now handled beautifully by Framer Motion drag="x" in Dashboard.jsx
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

      {/* Peek layer (mobile only) */}
      <div className="md:hidden fixed inset-0 z-0 flex items-center justify-between px-8 pointer-events-none" style={{ top: "env(safe-area-inset-top)", bottom: "calc(60px + env(safe-area-inset-bottom))" }}>
        {prevSection ? (
          <div className="flex flex-col items-start opacity-50" style={{ color: "var(--habit-text)" }}>
            <prevSection.icon className="w-10 h-10 mb-2 opacity-50" />
            <span className="font-mono text-sm uppercase tracking-wider">{t(`nav.${prevSection.id}`)}</span>
          </div>
        ) : <div/>}
        {nextSection ? (
          <div className="flex flex-col items-end opacity-50" style={{ color: "var(--habit-text)" }}>
            <nextSection.icon className="w-10 h-10 mb-2 opacity-50" />
            <span className="font-mono text-sm uppercase tracking-wider">{t(`nav.${nextSection.id}`)}</span>
          </div>
        ) : <div/>}
      </div>

      <div
        ref={mainScrollRef}
        className={`relative z-10 overflow-y-auto overscroll-y-none overflow-x-hidden md:transition-all md:duration-300 ${sidebarCollapsed ? "md:ml-16" : "md:ml-64"} md:pb-8 flex-1 w-full flex flex-col`}
        style={{ background: "var(--habit-bg)" }}
      >
        <PullToRefresh onRefresh={handleManualSync} scrollRef={mainScrollRef}>
          {activeApp === "mind" && (
            <>
              <div className="relative">
              <CharacterStatusBar rankXP={rankXP} currentRankId={currentRank} onToggleSidebar={() => setMobileSidebarOpen(true)} theme={THEMES[currentTheme]} />
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
            <Dashboard
              activeSection={activeSection}
              activeSubItem={activeSubItem}
              onSectionChange={handleSectionChange}
              onSubItemChange={handleSubItemChange}
            />
          </>
        )}
        {activeApp === "life" && <LifeOS />}
        </PullToRefresh>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav
        activeSection={activeSection}
        activeSubItem={activeSubItem}
        onNavigate={handleNavigate}
      />

      <GameplayInsightCard onNavigate={handleNavigate} />
      <BalatroTutorialToast 
        profile={djangoProfile} 
        forceOpen={forceTutorialOpen} 
        onCloseCallback={() => setForceTutorialOpen(false)} 
      />
      <RewardToast />
      {showDebugHUD && (
        <div 
          className="fixed top-4 right-4 z-[9999] bg-black/90 text-emerald-400 p-4 rounded-xl border border-emerald-500/30 font-mono text-[10px] space-y-1.5 shadow-2xl pointer-events-none"
          style={{ maxWidth: "280px" }}
        >
          <div className="font-bold border-b border-emerald-500/20 pb-1 mb-1">MIND OS DEBUG HUD</div>
          <div>Tab: <span className="text-white">{activeSection}</span></div>
          <div>--bottom-bar-height: <span className="text-white">{computedBottomBarHeight}</span></div>
          <div>Scroll Height: <span className="text-white">{scrollMetrics.scrollHeight}px</span></div>
          <div>Client Height: <span className="text-white">{scrollMetrics.clientHeight}px</span></div>
          <div>Rendered Items Count: <span className="text-white">{itemCount}</span></div>
        </div>
      )}
    </div>
  );
}