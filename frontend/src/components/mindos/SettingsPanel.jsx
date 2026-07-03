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

  const TABS = [
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-accent"
            style={{ color: "var(--habit-purple)" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <Settings className="w-4 h-4" style={{ color: "var(--habit-purple)" }} />
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>SYSTEM SETTINGS</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: "var(--habit-border)" }}>
        {TABS.map(t => {
          const isActive = showDataTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setShowDataTab(t.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap relative"
              style={{
                fontFamily: "'Nunito'",
                fontWeight: isActive ? 800 : 600,
                fontSize: 11,
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                boxShadow: isActive ? "0 2px 8px var(--habit-purple-glow)" : "none",
              }}
            >
              <t.icon className="w-3 h-3" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.id === "changelog" && hasNewChangelog && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          );
        })}
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