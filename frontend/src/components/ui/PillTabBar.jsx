export default function PillTabBar({ tabs, activeTab, onChange, wrap = false, sticky = false }) {
  return (
    <div 
      className={`
        md:hidden
        flex gap-2 px-4 py-3
        ${sticky ? 'sticky top-0 z-30' : ''}
        bg-black/40 backdrop-blur-md border-b border-white/10
        ${wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-hide'}
      `}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            font-pixel text-xl uppercase tracking-widest
            px-4 py-2 rounded-full whitespace-nowrap
            transition-all duration-150 active:scale-95
            ${activeTab === tab.id
              ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
              : 'bg-white/10 text-white/50 hover:bg-white/20'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
