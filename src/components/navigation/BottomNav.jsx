import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Swords, User, BarChart2, Settings } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Home",      icon: LayoutDashboard },
  { id: "tasks",     label: "Tasks",     icon: Swords },
  { id: "character", label: "Hero",      icon: User },
  { id: "stats",     label: "Stats",     icon: BarChart2 },
  { id: "settings",  label: "Settings",  icon: Settings },
];

const CHARACTER_SUBITEMS = [
  { id: "overview",     label: "Overview" },
  { id: "skills",       label: "Skills" },
  { id: "skill_tree",   label: "Skill Tree" },
  { id: "allies",       label: "Allies" },
  { id: "achievements", label: "Achievements" },
  { id: "mutators",     label: "Mutators" },
  { id: "shop",         label: "Shop" },
];

export default function BottomNav({ activeSection, activeSubItem, onNavigate }) {
  const handleTap = (item) => {
    if (window.navigator?.vibrate) window.navigator.vibrate(12);
    if (item.id === "character") onNavigate(item.id, activeSubItem || "overview");
    else if (item.id === "settings") onNavigate(item.id, "appearance");
    else onNavigate(item.id, null);
  };

  return (
    <>
      {/* Sub-tabs for Character */}
      <AnimatePresence>
        {activeSection === "character" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="md:hidden fixed left-0 right-0 z-40 flex overflow-x-auto items-center"
            style={{
              bottom: "calc(60px + env(safe-area-inset-bottom))",
              background: "var(--habit-bottom-sub-bg)",
              borderTop: "1px solid var(--habit-bottom-border)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: "8px 12px",
              gap: "8px",
              scrollbarWidth: "none",
              msOverflowStyle: "none"
            }}
          >
            {CHARACTER_SUBITEMS.map((sub) => {
              const isActive = activeSubItem === sub.id || (!activeSubItem && sub.id === "overview");
              return (
                <button
                  key={sub.id}
                  onClick={() => onNavigate("character", sub.id)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all duration-150"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    background: isActive ? "var(--habit-purple)" : "var(--habit-bottom-item-bg)",
                    color: isActive ? "var(--habit-bottom-active-text)" : "var(--habit-bottom-text)",
                    border: `1px solid ${isActive ? "transparent" : "var(--habit-bottom-border)"}`,
                    boxShadow: isActive ? "0 2px 8px var(--habit-purple-glow)" : "none",
                  }}
                >
                  {sub.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around"
      style={{
        background: "var(--habit-bottom-bg)",
        borderTop: "1px solid var(--habit-bottom-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        paddingTop: "8px",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <motion.button
            key={item.id}
            onClick={() => handleTap(item)}
            className="flex flex-col items-center gap-1 flex-1 pb-1 pt-2 relative"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            {/* Active pill background */}
            {isActive && (
              <motion.div
                layoutId="bottom-nav-pill"
                className="absolute inset-x-2 top-1 bottom-1 rounded-2xl"
                style={{ background: "var(--habit-purple-light)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon
              className="w-5 h-5 relative z-10"
              style={{ color: isActive ? "var(--habit-purple)" : "var(--habit-bottom-inactive-text)" }}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
            <span
              className="text-[10px] font-medium relative z-10"
              style={{ color: isActive ? "var(--habit-purple)" : "var(--habit-bottom-inactive-text-dim)" }}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </nav>
    </>
  );
}