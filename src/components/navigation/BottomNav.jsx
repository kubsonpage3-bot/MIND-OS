import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Swords, User, BarChart2, Settings } from "lucide-react";
import PixelIcon from "./PixelIcon";
import { hapticLight } from "@/hooks/useHaptic";

function haptic() {
  hapticLight();
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: Swords },
  { id: "character", label: "Hero", icon: User },
  { id: "stats", label: "Stats", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const CHARACTER_SUBITEMS = [
  { id: "overview", label: "Overview", icon: "overview", color: "#3b82f6" },
  { id: "skills", label: "Skills", icon: "skills", color: "#ef4444" },
  { id: "skill_tree", label: "Skill Tree", icon: "skill_tree", color: "#a855f7" },
  { id: "allies", label: "Allies", icon: "allies", color: "#00cc88" },
  { id: "achievements", label: "Achievements", icon: "achievements", color: "#f0c040" },
  { id: "mutators", label: "Mutators", icon: "mutators", color: "#f97316" },
  { id: "shop", label: "Shop", icon: "shop", color: "#f59e0b" },
];
export default function BottomNav({ activeSection, activeSubItem, onNavigate }) {
  const handleTap = (item) => {
    haptic(12);
    if (item.id === "character") onNavigate(item.id, activeSubItem || "overview");
    else if (item.id === "settings") onNavigate(item.id, "appearance");
    else onNavigate(item.id, null);
  };

  const handleSubTap = (subId) => { haptic(8); onNavigate("character", subId); };

  const isSubActive = (sub) => activeSubItem === sub.id || (!activeSubItem && sub.id === "overview");

  return (
    <>
      {/* Character sub-tab strip */}
      <AnimatePresence>
        {activeSection === "character" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
            className="md:hidden fixed left-0 right-0 z-40 flex items-center"
            style={{
              bottom: "calc(58px + env(safe-area-inset-bottom))",
              background: "var(--habit-bottom-sub-bg)",
              borderTop: "1px solid var(--habit-bottom-border)",
              borderBottom: "1px solid var(--habit-bottom-border)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: "10px 0",
              touchAction: "pan-x",
              overscrollBehavior: "none",
            }}
          >
            {/* Fade left edge */}
            <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
              style={{ width: 20, background: "linear-gradient(to right, var(--habit-bottom-sub-bg), transparent)" }}
            />
            {/* Fade right edge */}
            <div className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
              style={{ width: 20, background: "linear-gradient(to left, var(--habit-bottom-sub-bg), transparent)" }}
            />
            {/* Segmented Control Track */}
            <div className="overflow-x-auto px-3 py-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
              <div className="flex items-center rounded-2xl relative overflow-hidden"
                style={{
                  background: "var(--habit-panel)",
                  border: "1px solid var(--habit-border)",
                  minWidth: "max-content",
                  height: 36
                }}
              >
                {CHARACTER_SUBITEMS.map((sub, idx) => {
                  const active = isSubActive(sub);
                  const isLast = idx === CHARACTER_SUBITEMS.length - 1;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleSubTap(sub.id)}
                      className="relative shrink-0 flex items-center justify-center gap-1.5 transition-colors z-10 h-full"
                      style={{
                        padding: "0 14px",
                        fontFamily: "'Nunito', sans-serif",
                        fontSize: 11,
                        fontWeight: active ? 800 : 600,
                        color: active ? sub.color : "var(--habit-dim)",
                        letterSpacing: "0.01em",
                        borderRight: !isLast ? "1px solid rgba(255,255,255,0.06)" : "none",
                      }}
                    >
                      {active && (
                        <motion.div
                          layoutId="subnav-pill"
                          className="absolute inset-0 -z-10"
                          style={{
                            background: `${sub.color}25`,
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <PixelIcon name={sub.icon} size={14} />
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50 flex items-end justify-around"
        style={{
          background: "var(--habit-bottom-bg)",
          borderTop: "1px solid var(--habit-bottom-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          paddingTop: "8px",
          touchAction: "none",
          overscrollBehavior: "none",
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
              <span className="text-[10px] font-medium relative z-10"
                style={{ color: isActive ? "var(--habit-purple)" : "var(--habit-bottom-inactive-text-dim)" }}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </>
  );
}