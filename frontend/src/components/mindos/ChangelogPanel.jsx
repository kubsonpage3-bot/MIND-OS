// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import GameCard from "@/components/ui/GameCard";
import changelogData from "@/data/changelog.json";
import { djangoApi } from "@/api/djangoClient";

// How many recent releases to render fully expanded on first paint. The rest
// load in on "Show more" so opening Settings doesn't mount hundreds of cards
// at once (changelog.json currently holds 250+ releases).
const INITIAL_VISIBLE = 15;
const PAGE_SIZE = 20;
// Releases older than this are collapsed to just their header by default.
const COLLAPSE_AFTER_DAYS = 90;

export default function ChangelogPanel() {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [expandedVersions, setExpandedVersions] = useState(() => new Set());

  // When viewed, mark latest version as seen
  useEffect(() => {
    if (changelogData.length > 0) {
      const latestVersion = changelogData[0].version;
      localStorage.setItem("mindos_last_seen_changelog", latestVersion);
      // Dispatch custom event to notify Settings/Tabs that badge should be cleared
      window.dispatchEvent(new Event("changelogViewed"));
      djangoApi.analytics.logEvent("changelog_viewed");
    }
  }, []);

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - COLLAPSE_AFTER_DAYS);
    return d;
  }, []);

  const getTypeColor = (type) => {
    switch(type) {
      case "feature": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "fix": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "polish": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "balance": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  const visibleReleases = changelogData.slice(0, visibleCount);
  const remaining = changelogData.length - visibleReleases.length;

  const toggleExpanded = (version) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col mb-6">
        <span className="font-mono text-2xl font-bold tracking-widest text-white uppercase">{t('changelog.title', 'System Updates')}</span>
        <span className="text-sm text-muted-foreground">{t('changelog.subtitle', 'Recent changes, patches, and features.')}</span>
      </div>

      <div className="space-y-8">
        {visibleReleases.map((release, i) => {
          const releaseDate = new Date(release.date);
          const isOld = !isNaN(releaseDate) && releaseDate < cutoffDate;
          const isExpanded = expandedVersions.has(release.version);
          // Old releases start collapsed; recent ones always render open.
          const showChanges = !isOld || isExpanded;

          return (
            <GameCard key={release.version} className="p-6 relative overflow-hidden group">
              {i === 0 && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
              )}

              <button
                type="button"
                onClick={() => isOld && toggleExpanded(release.version)}
                className={`w-full flex items-baseline gap-4 border-b border-white/10 pb-4 mb-4 text-left ${isOld ? "cursor-pointer" : "cursor-default"}`}
              >
                <h3 className="font-mono text-3xl font-black text-white tracking-tighter">v{release.version}</h3>
                <span className="font-mono text-sm text-muted-foreground/60">{release.date}</span>
                {i === 0 && (
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full bg-green-500/10">{t('changelog.latest', 'Latest')}</span>
                )}
                {isOld && (
                  <ChevronDown className={`ml-auto w-4 h-4 text-muted-foreground/60 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                )}
              </button>

              {showChanges && (
                <div className="space-y-3">
                  {release.changes.map((change, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <span className={`shrink-0 mt-0.5 font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${getTypeColor(change.type)}`}>
                        {t(`changelog.types.${change.type}`, change.type)}
                      </span>
                      <span className="text-sm text-slate-300 leading-relaxed">
                        {change.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GameCard>
          );
        })}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground border border-white/10 hover:bg-white/5 transition-colors"
          >
            {t('changelog.showMore', 'Show more')} ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}
