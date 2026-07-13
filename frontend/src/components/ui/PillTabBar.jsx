import { useTranslation } from "react-i18next";

export default function PillTabBar({ tabs, activeTab, onChange, sticky = false }) {
  const { t } = useTranslation();
  return (
    <div 
      className={`
        md:hidden
        relative w-full
        ${sticky ? 'sticky top-0 z-30' : ''}
        bg-black/40 backdrop-blur-md border-b border-white/10
      `}
    >
      <div 
        className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide items-center"
        style={{ WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              font-pixel text-sm uppercase tracking-widest
              px-3 py-1.5 rounded-full whitespace-nowrap
              transition-all duration-150 active:scale-95
              ${activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
              }
            `}
          >
            {t(`sidebar.sections.${tab.id}`, tab.label || tab.id)}
          </button>
        ))}
      </div>
    </div>
  );
}
