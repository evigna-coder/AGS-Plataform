import { useRef } from 'react';
import { useIndicadorDeslizante } from '@ags/shared';
import { useTabs, NUEVA_PESTANA_PATH } from '../../contexts/TabsContext';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, switchTab, closeTab, openTab } = useTabs();
  // Subrayado que viaja de una pestaña a otra (2026-09-29).
  const barRef = useRef<HTMLDivElement>(null);
  const { pos: sub } = useIndicadorDeslizante(barRef, '[data-tab-active="true"]', [activeTabId, tabs.length]);

  return (
    <div ref={barRef} className="relative shrink-0 bg-white border-b border-slate-200 flex items-center gap-0 px-2 overflow-x-auto z-20">
      <span aria-hidden className="pointer-events-none absolute bottom-0 h-0.5 bg-teal-500 motion-safe:transition-[left,width,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ left: sub.left, width: sub.width, opacity: sub.visible ? 1 : 0 }} />
      {tabs.map((tab, idx) => {
        const isActiveTab = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            data-tab-active={isActiveTab ? 'true' : undefined}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 border-transparent transition-colors duration-200 shrink-0 motion-safe:animate-fade-in ${
              isActiveTab
                ? 'text-teal-700 bg-teal-50/50 font-medium'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
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
                className={`ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-[opacity,background-color,color] duration-150 ${isActiveTab ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
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
      {/* Pestaña nueva (2026-08-12), como en un navegador: abre una tab vacía
          con los módulos accesibles. Atajo Ctrl+T. */}
      <button
        onClick={() => openTab(NUEVA_PESTANA_PATH)}
        title="Nueva pestaña (Ctrl+T)"
        className="shrink-0 ml-1 px-2 py-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition-[color,background-color,transform] duration-200 motion-safe:hover:rotate-90"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};
