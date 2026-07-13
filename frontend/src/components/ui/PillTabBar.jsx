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
        bg-black/40 backdrop-blur-md border-b border-white/10
        px-3 py-2
      `}
    >
      {/* Frosted-glass segmented container — same style as PomodoroPanel */}
      <div
        className="relative flex w-full rounded-xl p-0.5"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-[10px] pointer-events-none"
            style={{
              width: `calc(${100 / tabs.length}% - 4px)`,
              left: `calc(${activeIndex * (100 / tabs.length)}% + 2px)`,
              background: "#a855f7",
              boxShadow: "0 0 12px rgba(168,85,247,0.4), 0 0 4px rgba(168,85,247,0.3)",
            }}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
        )}

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-200 active:scale-95"
            >
              {Icon && (
                <Icon
                  className="w-3.5 h-3.5 transition-all duration-200"
                  style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
                />
              )}
              <span
                className="font-mono text-[9px] uppercase tracking-wider leading-none whitespace-nowrap transition-all duration-200"
                style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
              >
                {tab.label ? (tab.label.includes('.') ? t(tab.label) : tab.label) : t(`sidebar.sections.${tab.id}`, tab.id)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

