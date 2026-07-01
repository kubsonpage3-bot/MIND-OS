import { useState } from "react";
import { Settings, User, Zap, Heart, RotateCcw, Info, ChevronDown, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";

import AccountPanel from "@/components/mindos/AccountPanel";
import PrestigePanel from "@/components/mindos/PrestigePanel";
import ResetPanel from "@/components/mindos/ResetPanel";
import AboutPanel from "@/components/mindos/AboutPanel";

function AccordionSection({ id, icon: Icon, label, activeId, setActiveId, children }) {
  const isOpen = activeId === id;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}
    >
      <button
        onClick={() => setActiveId(isOpen ? null : id)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: "var(--habit-purple)" }} />
          <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, color: "var(--habit-text)" }}>
            {label}
          </span>
        </div>
        <ChevronDown
          className="w-4 h-4 transition-transform duration-200"
          style={{
            color: "var(--habit-dim)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--habit-border)]">
          {children}
        </div>
      )}
    </div>
  );
}

function HpFormulaDisplay({ profile }) {
  const prestigeCount = profile?.prestige_count ?? 0;
  const baseHp = 100;
  const hpPerPrestige = 50;
  const computedMaxHp = baseHp + prestigeCount * hpPerPrestige;
  const storedMaxHp = profile?.hp_max ?? computedMaxHp;

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: "var(--habit-bg, rgba(0,0,0,0.15))", border: "1px solid var(--habit-border)" }}
      >
        <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 12, color: "var(--habit-dim)" }}>
          MAX HP FORMULA
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: "var(--habit-text)" }}>
          100 + (Prestige × 50) = <span style={{ color: "#ef4444", fontWeight: 700 }}>{computedMaxHp} HP</span>
        </div>
        <div className="flex gap-4 pt-1">
          <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }}>
            Base HP: <span style={{ color: "var(--habit-text)", fontWeight: 700 }}>100</span>
          </div>
          <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }}>
            Prestige level: <span style={{ color: "#a855f7", fontWeight: 700 }}>{prestigeCount}</span>
          </div>
          <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }}>
            Bonus: <span style={{ color: "#22c55e", fontWeight: 700 }}>+{prestigeCount * hpPerPrestige}</span>
          </div>
        </div>
        <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)", opacity: 0.6 }}>
          Current max HP stored on server: {storedMaxHp}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPanel({ activeSubTab, onBack = undefined }) {
  const [activeId, setActiveId] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ["userprofile"],
    queryFn: djangoApi.profile.get,
    staleTime: 10000,
  });

  return (
    <div className="space-y-3">
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
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>
          SYSTEM SETTINGS
        </span>
      </div>

      {/* Accordion sections */}
      <AccordionSection id="account" icon={User} label="Account" activeId={activeId} setActiveId={setActiveId}>
        <AccountPanel />
      </AccordionSection>

      <AccordionSection id="prestige" icon={Zap} label="Prestige" activeId={activeId} setActiveId={setActiveId}>
        <PrestigePanel
          prestige={{ count: profile?.prestige_count ?? 0 }}
          rankXP={profile?.rank_xp ?? 0}
          onPrestige={() => {}}
        />
        <div className="mt-3 text-xs" style={{ fontFamily: "'Nunito'", color: "var(--habit-dim)" }}>
          Prestige resets your XP to 0 and grants permanent multiplier bonuses (+10% damage, +10% gold, +5% XP).
          IQ ceilings increase by 15%. Requires 8000 Rank XP.
        </div>
      </AccordionSection>

      <AccordionSection id="hp" icon={Heart} label="HP Calculation" activeId={activeId} setActiveId={setActiveId}>
        <HpFormulaDisplay profile={profile} />
      </AccordionSection>

      <AccordionSection id="reset" icon={RotateCcw} label="Reset" activeId={activeId} setActiveId={setActiveId}>
        <ResetPanel />
      </AccordionSection>

      <AccordionSection id="about" icon={Info} label="About" activeId={activeId} setActiveId={setActiveId}>
        <AboutPanel />
      </AccordionSection>
    </div>
  );
}