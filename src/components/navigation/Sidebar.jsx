import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Brain, Sparkles } from "lucide-react";
import PixelIcon from "./PixelIcon";
import { prefetchTab } from "@/lib/prefetch";

const APPS = [
  { id: "mind", label: "MIND OS", icon: Brain },
  { id: "life", label: "LIFE OS", icon: Sparkles },
];

const SECTION_GROUPS = [
  {
    label: null,
    sections: [
      { id: "dashboard", label: "Dashboard",   icon: "dashboard",   subItems: [] },
      { id: "train",     label: "Training",    icon: "training",    subItems: [] },
      { id: "stats",     label: "Projections", icon: "projections", subItems: [] },
    ],
  },
  {
    label: null,
    sections: [
      { id: "tasks", label: "Tasks", icon: "tasks", subItems: [] },
    ],
  },
  {
    label: "CHARACTER",
    sections: [
      { id: "character", label: "Character", icon: "character", subItems: [
        { id: "overview",     label: "Overview" },
        { id: "skills",       label: "Skills" },
        { id: "skill_tree",   label: "Skill Tree" },
        { id: "allies",       label: "Allies" },
        { id: "achievements", label: "Achievements" },
        { id: "mutators",     label: "Mutators" },
        { id: "shop",         label: "Shop" },
      ]},
      { id: "rival", label: "Rival", icon: "rival", subItems: [] },
    ],
  },
  {
    label: "SYSTEM",
    sections: [
      { id: "tools", label: "Tools", icon: "tools", subItems: [
        { id: "history",  label: "History" },
        { id: "pomodoro", label: "Pomodoro" },
        { id: "calendar", label: "Calendar" },
      ]},
      { id: "settings", label: "Settings", icon: "settings", subItems: [
        { id: "metrics",       label: "Metrics" },
        { id: "appearance",    label: "Appearance" },
        { id: "notifications", label: "Notifications" },
        { id: "account",       label: "Account" },
        { id: "gameplay",      label: "Gameplay" },
        { id: "privacy",       label: "Privacy" },
        { id: "data",          label: "Data" },
        { id: "reset",         label: "Reset" },
      ]},
    ],
  },
];

// Shared nav content renderer
function NavContent({ activeApp, onAppChange, activeSection, activeSubItem, onNavigate, collapsed, setCollapsed, expandedSection, setExpandedSection, onClose }) {
  const handleSectionClick = (section) => {
    setExpandedSection(prev => prev === section.id ? null : section.id);
    if (section.subItems?.length > 0) {
      if (section.id === "tools") {
        onNavigate(section.subItems[0].id, null);
      } else {
        onNavigate(section.id, section.subItems[0].id);
      }
    } else {
      onNavigate(section.id, null);
    }
    onClose?.();
  };

  const handleSubItemClick = (sectionId, subItemId) => {
    if (sectionId === "tools") {
      onNavigate(subItemId, null);
    } else {
      onNavigate(sectionId, subItemId);
    }
    onClose?.();
  };

  return (
    <>
      {/* App switcher */}
      <div className="p-3 space-y-1.5 shrink-0" style={{ borderBottom: "1px solid var(--habit-sidebar-border)" }}>
        {APPS.map((app) => {
          const Icon = app.icon;
          const isActive = activeApp === app.id;
          return (
            <button
              key={app.id}
              onClick={() => { onAppChange(app.id); onClose?.(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors min-h-[44px]"
              style={{
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-sidebar-text)",
                boxShadow: isActive ? "0 2px 12px var(--habit-purple-glow)" : "none",
              }}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && (
                <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.04em" }}>
                  {app.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle — desktop only */}
      {setCollapsed && (
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--habit-sidebar-border)" }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--habit-sidebar-dim)", background: "var(--habit-sidebar-hover)" }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="px-2 py-2 flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {SECTION_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {!collapsed && group.label && (
              <div className="px-3 mb-1 mt-1">
                <span style={{ fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800, color: "var(--habit-sidebar-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  {group.label}
                </span>
              </div>
            )}
            {collapsed && group.label && gi > 0 && (
              <div className="mx-3 mb-2 mt-1" style={{ height: 1, background: "var(--habit-sidebar-border)" }} />
            )}
            <div className="space-y-0.5">
              {group.sections.map((section) => {
                const hasSubItems = section.subItems?.length > 0;
                const isExpanded = expandedSection === section.id;
                const isActive = hasSubItems
                  ? activeSection === section.id || section.subItems.some(sub => activeSection === sub.id || activeSubItem === sub.id)
                  : activeSection === section.id;

                return (
                  <div key={section.id}>
                    <motion.button
                      onClick={() => handleSectionClick(section)}
                      onMouseEnter={() => prefetchTab(section.id)}
                      onTouchStart={() => prefetchTab(section.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors min-h-[44px]"
                      style={{
                        background: isActive ? "var(--habit-purple)" : "transparent",
                        color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-sidebar-text)",
                        boxShadow: isActive ? "0 2px 12px var(--habit-purple-glow)" : "none",
                      }}
                      whileHover={{ background: isActive ? "var(--habit-purple)" : "var(--habit-sidebar-hover)", color: "var(--habit-sidebar-hover-text, white)" }}
                    >
                      <PixelIcon name={section.icon} size={20} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left" style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13 }}>
                            {section.label}
                          </span>
                          {hasSubItems && (
                            <ChevronRight size={14} className="shrink-0 transition-transform duration-200"
                              style={{ opacity: 0.6, transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                          )}
                        </>
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {!collapsed && isExpanded && hasSubItems && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-1 mb-1 rounded-lg py-1"
                            style={{ background: "var(--habit-sidebar-sub-bg)", borderLeft: "2px solid var(--habit-purple)", marginLeft: 12 }}>
                            {section.subItems.map((sub) => {
                              const subActive =
                                (section.id === "tools" && activeSection === sub.id) ||
                                (section.id !== "tools" && activeSubItem === sub.id);
                              return (
                                <motion.button
                                  key={sub.id}
                                  onClick={() => handleSubItemClick(section.id, sub.id)}
                                  onMouseEnter={() => prefetchTab(section.id)}
                                  onTouchStart={() => prefetchTab(section.id)}
                                  className="w-full text-left pl-4 pr-3 py-1.5 rounded-md transition-colors min-h-[32px]"
                                  style={{
                                    fontFamily: "'Nunito'",
                                    fontSize: 12,
                                    fontWeight: subActive ? 800 : 600,
                                    color: subActive ? "var(--habit-purple)" : "var(--habit-sidebar-sub-text)",
                                    background: subActive ? "var(--habit-purple-light)" : "transparent",
                                  }}
                                  whileHover={{ color: subActive ? "var(--habit-purple)" : "var(--habit-sidebar-hover-text, white)", background: subActive ? "var(--habit-purple-light-hover)" : "var(--habit-sidebar-hover)" }}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    {subActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--habit-purple)", display: "inline-block" }} />}
                                    {sub.label}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 h-4" />
    </>
  );
}

export default function Sidebar({ 
  activeApp, 
  onAppChange, 
  activeSection, 
  activeSubItem, 
  onNavigate, 
  collapsed, 
  setCollapsed,
  mobileOpen: propMobileOpen,
  setMobileOpen: propSetMobileOpen
}) {
  const [expandedSection, setExpandedSection] = useState("tasks");
  const [localMobileOpen, setLocalMobileOpen] = useState(false);

  const mobileOpen = propMobileOpen !== undefined ? propMobileOpen : localMobileOpen;
  const setMobileOpen = propSetMobileOpen !== undefined ? propSetMobileOpen : setLocalMobileOpen;

  return (
    <>
      {/* Desktop sidebar — always full height, never moves */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 z-40"
        style={{
          width: collapsed ? 64 : 256,
          height: "100dvh",
          background: "var(--habit-sidebar)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.25)",
          transition: "width 0.25s ease, background-color 0.3s ease",
        }}
      >
        <NavContent
          activeApp={activeApp} onAppChange={onAppChange}
          activeSection={activeSection} activeSubItem={activeSubItem}
          onNavigate={onNavigate}
          collapsed={collapsed} setCollapsed={setCollapsed}
          expandedSection={expandedSection} setExpandedSection={setExpandedSection}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="md:hidden fixed left-0 top-0 z-50 flex flex-col w-64"
              style={{ background: "var(--habit-sidebar)", boxShadow: "4px 0 20px rgba(0,0,0,0.35)", height: "100dvh" }}
            >
              <NavContent
                activeApp={activeApp} onAppChange={onAppChange}
                activeSection={activeSection} activeSubItem={activeSubItem}
                onNavigate={onNavigate}
                collapsed={false} setCollapsed={null}
                expandedSection={expandedSection} setExpandedSection={setExpandedSection}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}