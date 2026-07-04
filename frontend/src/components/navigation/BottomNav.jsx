import { motion } from "framer-motion";
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
  { id: "tools", label: "Stats", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: Settings },
];


export default function BottomNav({ activeSection, activeSubItem, onNavigate }) {
  const handleTap = (item) => {
    haptic(12);
    if (item.id === "character") onNavigate(item.id, activeSubItem || "overview");
    else if (item.id === "settings") onNavigate(item.id, "appearance");
    else if (item.id === "tools") onNavigate("history", null);
    else onNavigate(item.id, null);
  };

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50 flex items-end justify-around"
        style={{
          background: "var(--habit-bottom-bg)",
          borderTop: "1px solid var(--habit-bottom-border)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          paddingTop: "8px",
          touchAction: "manipulation",
          overscrollBehavior: "none",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === "tools" 
            ? ["history", "pomodoro", "calendar"].includes(activeSection)
            : activeSection === item.id;
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