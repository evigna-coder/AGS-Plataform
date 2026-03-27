import { useTabs } from '../../contexts/TabsContext';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, switchTab, closeTab } = useTabs();

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 flex items-center gap-0 px-2 overflow-x-auto z-20">
      {tabs.map((tab, idx) => {
        const isActiveTab = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition-colors shrink-0 ${
              isActiveTab
                ? 'border-teal-500 text-teal-700 bg-teal-50/50 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => switchTab(tab.id)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.sublabel && (
              <span className="text-[10px] text-slate-400 whitespace-nowrap">/ {tab.sublabel}</span>
            )}
            {idx < 9 && tabs.length > 1 && (
              <span className="text-[9px] text-slate-300 font-mono ml-0.5">{idx + 1}</span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                title="Cerrar pestana"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
