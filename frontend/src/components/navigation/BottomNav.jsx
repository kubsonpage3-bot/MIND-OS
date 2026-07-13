import { motion } from "framer-motion";
import { LayoutDashboard, Swords, User, BarChart2, Settings } from "lucide-react";
import { hapticLight } from "@/hooks/useHaptic";
import { useTranslation } from "react-i18next";

function haptic() {
  hapticLight();
}

export const MOBILE_SECTIONS = [
  { id: "dashboard", navTarget: "dashboard", label: "Home",     icon: LayoutDashboard, color: "#a855f7", glow: "rgba(168,85,247,0.4)"  },
  { id: "tasks",     navTarget: "tasks",     label: "Tasks",    icon: Swords,          color: "#ef4444", glow: "rgba(239,68,68,0.4)"    },
  { id: "character", navTarget: "character", label: "Hero",     icon: User,            color: "#3b82f6", glow: "rgba(59,130,246,0.4)"   },
  { id: "tools",     navTarget: "history",   label: "Stats",    icon: BarChart2,       color: "#22c55e", glow: "rgba(34,197,94,0.4)"    },
  { id: "settings",  navTarget: "settings",  label: "Settings", icon: Settings,        color: "#f59e0b", glow: "rgba(245,158,11,0.4)"   },
];

export default function BottomNav({ activeSection, activeSubItem, onNavigate }) {
  const { t } = useTranslation();

  const handleTap = (item) => {
    haptic(12);
    if (item.id === "character") onNavigate(item.navTarget, activeSubItem || "overview");
    else if (item.id === "settings") onNavigate(item.navTarget, "appearance");
    else onNavigate(item.navTarget, null);
  };

  const activeIndex = MOBILE_SECTIONS.findIndex((item) =>
    item.id === "tools"
      ? ["history", "pomodoro", "calendar", "stats"].includes(activeSection)
      : activeSection === item.id
  );
  const activeItem = MOBILE_SECTIONS[activeIndex] ?? MOBILE_SECTIONS[0];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50"
      style={{
        background: "var(--habit-bottom-bg)",
        borderTop: "1px solid var(--habit-bottom-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        paddingTop: "8px",
        paddingLeft: "12px",
        paddingRight: "12px",
        touchAction: "manipulation",
        overscrollBehavior: "none",
      }}
    >
      {/* Segmented pill container — same style as PomodoroPanel tabs */}
      <div
        className="relative flex w-full rounded-2xl p-0.5"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-[14px] pointer-events-none"
            style={{
              width: `calc(${100 / MOBILE_SECTIONS.length}% - 4px)`,
              left: `calc(${activeIndex * (100 / MOBILE_SECTIONS.length)}% + 2px)`,
              background: activeItem.color,
              boxShadow: `0 0 16px ${activeItem.glow}, 0 0 6px ${activeItem.glow}`,
            }}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}

        {MOBILE_SECTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === "tools"
            ? ["history", "pomodoro", "calendar", "stats"].includes(activeSection)
            : activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => handleTap(item)}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200"
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Icon
                className="w-4 h-4 transition-all duration-200"
                style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-wider leading-none transition-all duration-200"
                style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
              >
                {t(`nav.${item.id}`)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}