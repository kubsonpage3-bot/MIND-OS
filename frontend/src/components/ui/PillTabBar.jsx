import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

export default function PillTabBar({ tabs, activeTab, onChange, sticky = false }) {
  const { t } = useTranslation();

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  return (
    <div
      className={`
        md:hidden
        relative w-full
        ${sticky ? 'sticky top-0 z-30' : ''}
        backdrop-blur-md
        px-3 py-2
      `}
      style={{
        background: "var(--habit-panel)",
        borderBottom: "1px solid var(--habit-border)",
      }}
    >
      {/* Segmented container */}
      <div
        className="relative flex w-full rounded-xl p-0.5"
        style={{
          background: "var(--habit-bg)",
          border: "1px solid var(--habit-border)",
        }}
      >
        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-[10px] pointer-events-none"
            style={{
              width: `calc(${100 / tabs.length}% - 4px)`,
              left: `calc(${activeIndex * (100 / tabs.length)}% + 2px)`,
              background: "var(--habit-purple)",
              boxShadow: "0 0 12px var(--habit-purple-glow), 0 0 4px var(--habit-purple-glow)",
            }}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
        )}

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          const isLocked = tab.locked;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200"
              style={{ opacity: isLocked ? 0.6 : 1 }}
            >
              {Icon && (
                <Icon
                  className="w-3.5 h-3.5 transition-all duration-200"
                  style={{ color: isActive ? "#ffffff" : "var(--habit-dim)" }}
                />
              )}
              <span
                className="font-mono text-[9px] uppercase tracking-wider leading-none whitespace-nowrap transition-all duration-200 flex items-center gap-0.5"
                style={{ color: isActive ? "#ffffff" : "var(--habit-dim)" }}
              >
                {isLocked && "🔒"}
                {String(t(`sidebar.sections.${tab.id}`, tab.label || tab.id))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

