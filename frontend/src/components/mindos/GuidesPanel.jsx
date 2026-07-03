import React, { useState } from "react";
import TabGuideModal from "./TabGuideModal";

const ALL_GUIDES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "training", label: "Training" },
  { id: "tasks", label: "Tasks" },
  { id: "character", label: "Character" },
  { id: "skill_tree", label: "Skill Tree" },
  { id: "allies", label: "Allies" },
  { id: "mutators", label: "Mutators" },
  { id: "shop", label: "Shop" },
  { id: "rival", label: "Rival" },
  { id: "party", label: "Party" },
];

export default function GuidesPanel() {
  const [activeGuide, setActiveGuide] = useState(null);

  return (
    <div className="space-y-6">
      <div className="mb-4 text-sm text-white/60">
        Replay any of the introductory guides for the various sections of MIND OS.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALL_GUIDES.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGuide(g)}
            className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-left flex items-center justify-between group cursor-pointer"
          >
            <span className="font-mono text-sm text-white/80 group-hover:text-white transition-colors uppercase tracking-wider">
              {g.label}
            </span>
            <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs font-bold">
              VIEW
            </span>
          </button>
        ))}
      </div>

      {activeGuide && (
        <TabGuideModal
          guideId={activeGuide.id}
          title={activeGuide.label}
          forceOpen={true}
          onCloseCallback={() => setActiveGuide(null)}
        >
          Placeholder text for the {activeGuide.label} guide. We will replace this with final copy later.
        </TabGuideModal>
      )}
    </div>
  );
}
