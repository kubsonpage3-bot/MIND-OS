// @ts-nocheck
import { useState, useEffect, memo, lazy, Suspense } from "react";
import { Settings, Palette, Bell, User, Gamepad2, RotateCcw, Info, ChevronLeft, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProfileMount } from "@/utils/perf";

import NotificationsPanel from "@/components/mindos/NotificationsPanel";
import AccountPanel from "@/components/mindos/AccountPanel";
import GameplayPanel from "@/components/mindos/GameplayPanel";
import AppearancePanel from "@/components/mindos/AppearancePanel";
import ResetPanel from "@/components/mindos/ResetPanel";
import AboutPanel from "@/components/mindos/AboutPanel";
import GuidesPanel from "@/components/mindos/GuidesPanel";

// changelog.json holds 250+ releases — code-split it into its own chunk so
// it's only fetched when the user actually opens the "Updates" tab, instead
// of bundling it into the always-loaded Settings chunk.
const ChangelogPanel = lazy(() => import("@/components/mindos/ChangelogPanel"));

export const SETTINGS_TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: User },
  { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
  { id: "guides", label: "Guides", icon: BookOpen },
  { id: "changelog", label: "Updates", icon: Info },
  { id: "reset", label: "Reset", icon: RotateCcw },
  { id: "about", label: "About", icon: Info },
];
function SettingsPanel({ activeSubTab, onBack = undefined }) {
  useProfileMount("SettingsPanel");
  const { t } = useTranslation();
  const [showDataTab, setShowDataTab] = useState(activeSubTab || "appearance");
  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  // Sync with activeSubTab prop
  useEffect(() => {
    if (activeSubTab) {
      setShowDataTab(activeSubTab);
    }
  }, [activeSubTab]);

  useEffect(() => {
    let cancelled = false;
    const checkChangelog = () => {
      import("@/data/changelog.json").then(({ default: changelogData }) => {
        if (cancelled) return;
        if (changelogData && changelogData.length > 0) {
          const latestVersion = changelogData[0].version;
          const lastSeen = localStorage.getItem("mindos_last_seen_changelog");
          setHasNewChangelog(lastSeen !== latestVersion);
        }
      });
    };
    checkChangelog();
    window.addEventListener("changelogViewed", checkChangelog);
    return () => {
      cancelled = true;
      window.removeEventListener("changelogViewed", checkChangelog);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex md:hidden items-center gap-2 px-1">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-accent"
            style={{ color: "var(--habit-purple)" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <Settings className="w-4 h-4" style={{ color: "var(--habit-purple)" }} />
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{t("settings.systemSettings", "SYSTEM SETTINGS")}</span>
      </div>

      {/* Tabs */}
      <div className="flex md:hidden gap-1 p-1 rounded-2xl" style={{ background: "var(--habit-border)" }} onPointerDown={(e) => e.stopPropagation()}>
        {SETTINGS_TABS.map(tTab => {
          const isActive = showDataTab === tTab.id;
          return (
            <button
              key={tTab.id}
              onClick={() => setShowDataTab(tTab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] rounded-xl transition-all relative"
              style={{
                fontFamily: "'Nunito'",
                fontWeight: isActive ? 800 : 600,
                fontSize: 10,
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                boxShadow: isActive ? "0 2px 8px var(--habit-purple-glow)" : "none",
              }}
            >
              <tTab.icon className="w-4 h-4" />
              <span className="hidden xs:block leading-none text-center px-0.5 truncate w-full text-center" style={{ fontSize: 9 }}>
                {t(`sidebar.sections.${tTab.id}`, tTab.label)}
              </span>
              {tTab.id === "changelog" && hasNewChangelog && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* APPEARANCE */}
      {showDataTab === "appearance" && <AppearancePanel />}

      {/* NOTIFICATIONS */}
      {showDataTab === "notifications" && <NotificationsPanel />}

      {/* ACCOUNT */}
      {showDataTab === "account" && <AccountPanel />}

      {/* GAMEPLAY */}
      {showDataTab === "gameplay" && <GameplayPanel />}

      {/* GUIDES */}
      {showDataTab === "guides" && <GuidesPanel />}

      {/* CHANGELOG */}
      {showDataTab === "changelog" && (
        <Suspense fallback={
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--habit-purple)] border-t-transparent animate-spin" />
          </div>
        }>
          <ChangelogPanel />
        </Suspense>
      )}

      {/* RESET */}
      {showDataTab === "reset" && <ResetPanel />}

      {/* ABOUT */}
      {showDataTab === "about" && <AboutPanel />}
    </div>
  );
}

export default memo(SettingsPanel);