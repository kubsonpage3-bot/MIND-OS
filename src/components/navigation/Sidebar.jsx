import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Brain, Sparkles, ChevronDown, X } from "lucide-react";
import PixelIcon from "./PixelIcon";
import { prefetchTab } from "@/lib/prefetch";
import { hapticLight } from "@/hooks/useHaptic";

function haptic() {
  hapticLight();
}

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

function NavContent({
  activeApp, onAppChange, activeSection, activeSubItem,
  onNavigate, collapsed, setCollapsed,
  expandedSection, setExpandedSection,
  onClose, isMobile,
}) {
  const handleSectionNavigate = (section) => {
    haptic(10);
    if (section.subItems?.length > 0) {
      if (section.id === "tools") {
        onNavigate(section.subItems[0].id, null);
      } else {
        onNavigate(section.id, section.subItems[0].id);
      }
    } else {
      onNavigate(section.id, null);
      onClose?.();
    }
  };

  const handleToggleExpand = (section, e) => {
    e.stopPropagation();
    haptic(8);
    const willOpen = expandedSection !== section.id;
    setExpandedSection(willOpen ? section.id : null);
    if (willOpen && section.subItems?.length > 0) {
      if (section.id === "tools") {
        onNavigate(section.subItems[0].id, null);
      } else {
        onNavigate(section.id, section.subItems[0].id);
      }
    }
  };

  const handleSubItemClick = (sectionId, subItemId) => {
    haptic(10);
    if (sectionId === "tools") {
      onNavigate(subItemId, null);
    } else {
      onNavigate(sectionId, subItemId);
    }
    onClose?.();
  };

  return (
    <>
      {isMobile && (
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 52, borderBottom: "1px solid var(--habit-sidebar-border)" }}
        >
          <span style={{
            fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13,
            color: "var(--habit-sidebar-active-text)", letterSpacing: "0.1em",
          }}>
            MENU
          </span>
          <motion.button
            onClick={() => { haptic(8); onClose?.(); }}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: "var(--habit-sidebar-hover)", color: "var(--habit-sidebar-text)" }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 600, damping: 28 }}
          >
            <X size={17} />
          </motion.button>
        </div>
      )}

      <div className="p-3 space-y-1 shrink-0" style={{ borderBottom: "1px solid var(--habit-sidebar-border)" }}>
        {APPS.map((app) => {
          const Icon = app.icon;
          const isActive = activeApp === app.id;
          return (
            <motion.button
              key={app.id}
              onClick={() => { haptic(12); onAppChange(app.id); onClose?.(); }}
              className="w-full flex items-center gap-2.5 px-3 rounded-xl"
              style={{
                height: 44,
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-sidebar-text)",
                boxShadow: isActive ? "0 2px 14px var(--habit-purple-glow)" : "none",
              }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && (
                <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.04em" }}>
                  {app.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

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



      <nav className="px-2 py-2 flex-1 min-h-0 overflow-y-auto max-md:pb-[100px]" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {SECTION_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {!collapsed && group.label && (
              <div className="px-3 mb-1.5 mt-1">
                <span style={{
                  fontFamily: "'Nunito'", fontSize: 9, fontWeight: 800,
                  color: "var(--habit-sidebar-dim)", letterSpacing: "0.2em", textTransform: "uppercase",
                }}>
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
                  ? activeSection === section.id || section.subItems.some(
                      sub => activeSection === sub.id || activeSubItem === sub.id
                    )
                  : activeSection === section.id;

                return (
                  <div key={section.id}>
                    <div
                      className="flex items-center rounded-xl overflow-hidden"
                      style={{
                        background: isActive ? "var(--habit-purple)" : "transparent",
                        boxShadow: isActive ? "0 2px 14px var(--habit-purple-glow)" : "none",
                        transition: "background 0.15s ease, box-shadow 0.15s ease",
                      }}
                    >
                      <motion.button
                        onClick={() => handleSectionNavigate(section)}
                        onMouseEnter={() => prefetchTab(section.id)}
                        onTouchStart={() => prefetchTab(section.id)}
                        className="flex items-center gap-2.5 flex-1 px-3 min-w-0"
                        style={{
                          height: 46,
                          color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-sidebar-text)",
                        }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        {collapsed ? (
                          <PixelIcon name={section.icon} size={20} active={isActive} />
                        ) : (
                          <>
                            <PixelIcon name={section.icon} size={18} active={isActive} className="shrink-0" />
                            <span
                              className="flex-1 text-left truncate"
                              style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13 }}
                            >
                              {section.label}
                            </span>
                          </>
                        )}
                      </motion.button>

                      {!collapsed && hasSubItems && (
                        <motion.button
                          onClick={(e) => handleToggleExpand(section, e)}
                          className="flex items-center justify-center shrink-0"
                          style={{
                            width: 42,
                            height: 46,
                            color: isActive ? "rgba(255,255,255,0.8)" : "var(--habit-sidebar-dim)",
                            borderLeft: isActive
                              ? "1px solid rgba(255,255,255,0.15)"
                              : "1px solid var(--habit-sidebar-border)",
                          }}
                          whileTap={{ scale: 0.80 }}
                          transition={{ type: "spring", stiffness: 600, damping: 26 }}
                          aria-label={isExpanded ? "Collapse submenu" : "Expand submenu"}
                        >
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          >
                            <ChevronDown size={15} />
                          </motion.div>
                        </motion.button>
                      )}
                    </div>


                    <AnimatePresence initial={false}>
                      {!collapsed && isExpanded && hasSubItems && (
                        <motion.div
                          key="subItems"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            type: "spring", stiffness: 360, damping: 34,
                            opacity: { duration: 0.16 },
                          }}
                          className="overflow-hidden"
                        >
                          <div
                            className="mt-0.5 mb-1 rounded-xl overflow-hidden"
                            style={{
                              background: "var(--habit-sidebar-sub-bg)",
                              borderLeft: "2px solid var(--habit-purple)",
                              marginLeft: 14,
                              marginRight: 2,
                            }}
                          >
                            {section.subItems.map((sub) => {
                              const subActive =
                                (section.id === "tools" && activeSection === sub.id) ||
                                (section.id !== "tools" && activeSubItem === sub.id);
                              return (
                                <motion.button
                                  key={sub.id}
                                  onClick={() => handleSubItemClick(section.id, sub.id)}
                                  onMouseEnter={() => prefetchTab(section.id)}
                                  className="w-full flex items-center gap-2.5 text-left"
                                  style={{
                                    height: 40,
                                    padding: "0 12px 0 14px",
                                    fontFamily: "'Nunito'",
                                    fontSize: 12,
                                    fontWeight: subActive ? 800 : 600,
                                    color: subActive ? "var(--habit-purple)" : "var(--habit-sidebar-sub-text)",
                                    background: subActive ? "var(--habit-purple-light)" : "transparent",
                                    borderRadius: 8,
                                    margin: "2px 4px",
                                    width: "calc(100% - 8px)",
                                    transition: "background 0.12s, color 0.12s",
                                  }}
                                  whileTap={{ scale: 0.96 }}
                                  transition={{ type: "spring", stiffness: 600, damping: 28 }}
                                >
                                  <span
                                    className="shrink-0 rounded-full"
                                    style={{
                                      width: 6,
                                      height: 6,
                                      background: subActive ? "var(--habit-purple)" : "transparent",
                                      border: subActive ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                                      transition: "background 0.12s, border 0.12s",
                                    }}
                                  />
                                  {sub.label}
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
  setMobileOpen: propSetMobileOpen,
}) {
  const [expandedSection, setExpandedSection] = useState("tasks");
  const [localMobileOpen, setLocalMobileOpen] = useState(false);

  const mobileOpen = propMobileOpen !== undefined ? propMobileOpen : localMobileOpen;
  const setMobileOpen = propSetMobileOpen !== undefined ? propSetMobileOpen : setLocalMobileOpen;

  return (
    <>
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
          isMobile={false}
        />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40"
              style={{
                background: "rgba(0,0,0,0.62)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              onClick={() => { haptic(8); setMobileOpen(false); }}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.9 }}
              className="md:hidden fixed left-0 top-0 z-50 flex flex-col"
              style={{
                width: "min(300px, 84vw)",
                height: "100dvh",
                background: "var(--habit-sidebar)",
                boxShadow: "8px 0 40px rgba(0,0,0,0.5)",
              }}
            >
              <NavContent
                activeApp={activeApp} onAppChange={onAppChange}
                activeSection={activeSection} activeSubItem={activeSubItem}
                onNavigate={onNavigate}
                collapsed={false} setCollapsed={null}
                expandedSection={expandedSection} setExpandedSection={setExpandedSection}
                onClose={() => setMobileOpen(false)}
                isMobile={true}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
