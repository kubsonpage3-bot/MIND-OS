import React, { useState } from "react";
import TabGuideModal from "./TabGuideModal";
import { GUIDE_CONTENT } from "@/constants/guideContent";

const ALL_GUIDES = [
  { id: "dashboard" },
  { id: "training" },
  { id: "tasks" },
  { id: "character" },
  { id: "skill_tree" },
  { id: "allies" },
  { id: "mutators" },
  { id: "shop" },
  { id: "rival" },
  { id: "party" },
];

export default function GuidesPanel() {
  const [activeGuide, setActiveGuide] = useState(null);

  return (
    <div className="space-y-6">
      <div className="mb-4 text-sm text-white/60">
        Replay any of the introductory guides for the various sections of MIND OS.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALL_GUIDES.map((g) => {
          const content = GUIDE_CONTENT[g.id];
          return (
            <button
              key={g.id}
              onClick={() => setActiveGuide(g)}
              className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-left flex items-center justify-between group cursor-pointer"
            >
              <span className="font-mono text-sm text-white/80 group-hover:text-white transition-colors tracking-wider flex items-center gap-2">
                <span>{content?.icon}</span>
                <span className="uppercase">{content?.title || g.id}</span>
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs font-bold">
                VIEW
              </span>
            </button>
          );
        })}
      </div>

      {activeGuide && (
        <TabGuideModal
          guideId={activeGuide.id}
          forceOpen={true}
          onCloseCallback={() => setActiveGuide(null)}
        />
      )}
    </div>
  );
}
