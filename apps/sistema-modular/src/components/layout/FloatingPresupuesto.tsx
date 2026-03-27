import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { EditPresupuestoModal } from '../presupuestos/EditPresupuestoModal';

export const FloatingPresupuesto: React.FC = () => {
  const floatingPres = useFloatingPresupuesto();

  if (!floatingPres.presupuestoId) return null;

  return (
    <>
      {/* Floating presupuesto modal -- persists across route changes */}
      {!floatingPres.minimized && (
        <EditPresupuestoModal
          presupuestoId={floatingPres.presupuestoId}
          open={true}
          onClose={floatingPres.close}
          onUpdated={floatingPres.onUpdated || undefined}
          onMinimize={floatingPres.minimize}
        />
      )}

      {/* Minimized presupuesto pill */}
      {floatingPres.minimized && (
        <button
          onClick={floatingPres.restore}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-xs font-medium">Presupuesto abierto</span>
          <svg className="w-3 h-3 ml-1 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
    </>
  );
};
