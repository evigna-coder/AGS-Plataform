import { useEffect, useRef } from 'react';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { useTabs } from '../../contexts/TabsContext';
import { EditPresupuestoModal } from '../presupuestos/EditPresupuestoModal';

export const FloatingPresupuesto: React.FC = () => {
  const fp = useFloatingPresupuesto();
  const { activeTabId } = useTabs();

  // Cambiar de pestaña minimiza el editor visible (UAT 2026-07-31: "la barra
  // siempre debe estar disponible para trabajar con una nueva pestaña") — el
  // presupuesto queda como pill y la pestaña nueva se ve completa.
  const prevTabId = useRef(activeTabId);
  useEffect(() => {
    if (prevTabId.current !== activeTabId) {
      prevTabId.current = activeTabId;
      fp.minimizeAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  if (fp.entries.length === 0) return null;

  const abiertos = fp.entries.filter(e => !e.minimized);
  const minimizados = fp.entries.filter(e => e.minimized);

  return (
    <>
      {/* Editor flotante (a lo sumo uno visible) — persiste entre pestañas */}
      {abiertos.map(e => (
        <EditPresupuestoModal
          // Remount por presupuesto: estado fresco al cambiar de presupuesto.
          key={e.presupuestoId}
          presupuestoId={e.presupuestoId}
          open={true}
          onClose={() => fp.close(e.presupuestoId)}
          onUpdated={e.onUpdated || undefined}
          onMinimize={() => fp.minimize(e.presupuestoId)}
          onLabel={label => fp.setLabel(e.presupuestoId, label)}
        />
      ))}

      {/* Pills de presupuestos minimizados — uno por presupuesto, con su número */}
      {minimizados.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 flex-wrap justify-center max-w-[80vw]">
          {minimizados.map(e => (
            <button
              key={e.presupuestoId}
              onClick={() => fp.restore(e.presupuestoId)}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span className="text-xs font-medium">{e.label ?? 'Presupuesto'}</span>
              <svg className="w-3 h-3 ml-1 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
