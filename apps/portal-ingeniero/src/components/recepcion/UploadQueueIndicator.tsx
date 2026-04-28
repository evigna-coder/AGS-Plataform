import { useUploadQueue } from '../../hooks/useUploadQueue';

/**
 * Banner global con el estado de la cola de subida de fotos.
 * Aparece solo cuando hay fotos pendientes O cuando estamos offline.
 */
export function UploadQueueIndicator() {
  const { pending, online, draining } = useUploadQueue();
  if (pending.length === 0 && online) return null;

  const errores = pending.filter(p => p.status === 'error' || p.intentos > 0).length;
  const queued = pending.length;

  let label = '';
  let cls = '';
  if (!online) {
    label = `Sin conexión — ${queued} foto${queued === 1 ? '' : 's'} esperando`;
    cls = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (draining) {
    label = `Sincronizando ${queued} foto${queued === 1 ? '' : 's'}…`;
    cls = 'bg-teal-50 text-teal-800 border-teal-200';
  } else if (errores > 0) {
    label = `${errores} foto${errores === 1 ? '' : 's'} con error — reintentando`;
    cls = 'bg-red-50 text-red-700 border-red-200';
  } else {
    label = `${queued} foto${queued === 1 ? '' : 's'} en cola`;
    cls = 'bg-slate-50 text-slate-700 border-slate-200';
  }

  return (
    // En mobile el portal tiene una bottom-nav (~60px); levantamos el banner
    // para que no la solape. En desktop no hay bottom-nav, queda abajo a la derecha.
    <div className={`fixed bottom-[72px] left-3 right-3 z-30 border rounded-xl px-3 py-2 text-xs font-medium shadow-sm md:bottom-4 md:left-auto md:right-4 md:max-w-xs ${cls}`}>
      {label}
    </div>
  );
}
