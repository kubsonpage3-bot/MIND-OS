import { useState, useEffect } from "react";
import { Settings, Palette, Bell, User, Gamepad2, Shield, Globe, RotateCcw, Info, ChevronLeft, Brain, BookOpen } from "lucide-react";

import NotificationsPanel from "@/components/mindos/NotificationsPanel";
import AccountPanel from "@/components/mindos/AccountPanel";
import GameplayPanel from "@/components/mindos/GameplayPanel";
import PrivacyPanel from "@/components/mindos/PrivacyPanel";
import AppearancePanel from "@/components/mindos/AppearancePanel";
import ResetPanel from "@/components/mindos/ResetPanel";
import LanguagePanel from "@/components/mindos/LanguagePanel";
import AboutPanel from "@/components/mindos/AboutPanel";
import MetricsPanel from "@/components/mindos/MetricsPanel";
import GuidesPanel from "@/components/mindos/GuidesPanel";
import ChangelogPanel from "@/components/mindos/ChangelogPanel";
import changelogData from "@/data/changelog.json";

export const SETTINGS_TABS = [
  { id: "metrics", label: "Metrics", icon: Brain },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: User },
  { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "language", label: "Language", icon: Globe },
  { id: "guides", label: "Guides", icon: BookOpen },
  { id: "changelog", label: "Updates", icon: Info },
  { id: "reset", label: "Reset", icon: RotateCcw },
  { id: "about", label: "About", icon: Info },
];
export default function SettingsPanel({ activeSubTab, onBack = undefined }) {
  const [showDataTab, setShowDataTab] = useState(activeSubTab || "appearance");
  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  // Sync with activeSubTab prop
  useEffect(() => {
    if (activeSubTab) {
      setShowDataTab(activeSubTab);
    }
  }, [activeSubTab]);

  useEffect(() => {
    const checkChangelog = () => {
      if (changelogData && changelogData.length > 0) {
        const latestVersion = changelogData[0].version;
        const lastSeen = localStorage.getItem("mindos_last_seen_changelog");
        setHasNewChangelog(lastSeen !== latestVersion);
      }
    };
    checkChangelog();
    window.addEventListener("changelogViewed", checkChangelog);
    return () => window.removeEventListener("changelogViewed", checkChangelog);
  }, []);

  return (
    <div className="space-y-4">
      {/* Mobile Navigation - matches TasksPanel pattern */}
      <div 
        className="
          md:hidden
          flex gap-2 overflow-x-auto scrollbar-hide
          px-4 py-3 sticky top-0 z-30
          bg-black/40 backdrop-blur-md border-b border-white/10
          items-center
        "
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-colors bg-white/10 text-white/80 hover:bg-white/20 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setShowDataTab(tab.id)}
            className={`
              font-pixel text-xl uppercase tracking-widest
              px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 relative
              transition-all duration-150 active:scale-95
              ${showDataTab === tab.id
                ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
              }
            `}
          >
            <tab.icon className="w-4 h-4 mb-0.5" />
            {tab.label}
            {tab.id === "changelog" && hasNewChangelog && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
          </button>
        ))}
      </div>

      {/* METRICS */}
      {showDataTab === "metrics" && <MetricsPanel />}

      {/* APPEARANCE */}
      {showDataTab === "appearance" && <AppearancePanel />}

      {/* NOTIFICATIONS */}
      {showDataTab === "notifications" && <NotificationsPanel />}

      {/* ACCOUNT */}
      {showDataTab === "account" && <AccountPanel />}

      {/* GAMEPLAY */}
      {showDataTab === "gameplay" && <GameplayPanel />}

      {/* PRIVACY */}
      {showDataTab === "privacy" && <PrivacyPanel />}

      {/* LANGUAGE */}
      {showDataTab === "language" && <LanguagePanel />}

      {/* GUIDES */}
      {showDataTab === "guides" && <GuidesPanel />}

      {/* CHANGELOG */}
      {showDataTab === "changelog" && <ChangelogPanel />}

      {/* RESET */}
      {showDataTab === "reset" && <ResetPanel />}

      {/* ABOUT */}
      {showDataTab === "about" && <AboutPanel />}
    </div>
  );
}