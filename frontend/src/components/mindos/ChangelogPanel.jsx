import React, { useEffect } from "react";
import GameCard from "@/components/ui/GameCard";
import changelogData from "@/data/changelog.json";

export default function ChangelogPanel() {
  // When viewed, mark latest version as seen
  useEffect(() => {
    if (changelogData.length > 0) {
      const latestVersion = changelogData[0].version;
      localStorage.setItem("mindos_last_seen_changelog", latestVersion);
      // Dispatch custom event to notify Settings/Tabs that badge should be cleared
      window.dispatchEvent(new Event("changelogViewed"));
    }
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

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col mb-6">
        <span className="font-mono text-2xl font-bold tracking-widest text-white uppercase">System Updates</span>
        <span className="text-sm text-muted-foreground">Recent changes, patches, and features.</span>
      </div>

      <div className="space-y-8">
        {changelogData.map((release, i) => (
          <GameCard key={release.version} className="p-6 relative overflow-hidden group">
            {i === 0 && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
            )}
            
            <div className="flex items-baseline gap-4 border-b border-white/10 pb-4 mb-4">
              <h3 className="font-mono text-3xl font-black text-white tracking-tighter">v{release.version}</h3>
              <span className="font-mono text-sm text-muted-foreground/60">{release.date}</span>
              {i === 0 && (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full bg-green-500/10">Latest</span>
              )}
            </div>
            
            <div className="space-y-3">
              {release.changes.map((change, j) => (
                <div key={j} className="flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${getTypeColor(change.type)}`}>
                    {change.type}
                  </span>
                  <span className="text-sm text-slate-300 leading-relaxed">
                    {change.text}
                  </span>
                </div>
              ))}
            </div>
          </GameCard>
        ))}
      </div>
    </div>
  );
}
