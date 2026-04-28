import { useUploadQueue } from '../../hooks/useUploadQueue';

/**
 * Banner global con el estado de la cola de subida de fotos.
 * Aparece solo cuando hay fotos pendientes O cuando estamos offline.
 *
 * Si hay fotos con intentos > 0 (atrapadas en backoff), muestra un botón
 * "Reintentar" que fuerza el drain inmediato — útil cuando se acaba de arreglar
 * el problema de fondo (rules de Storage, red, etc.) y el usuario no quiere
 * esperar los 60s del backoff.
 */
export function UploadQueueIndicator() {
  const { pending, online, draining, retryAll } = useUploadQueue();
  if (pending.length === 0 && online) return null;

  const conIntentos = pending.filter(p => p.intentos > 0).length;
  const queued = pending.length;

  let label = '';
  let cls = '';
  if (!online) {
    label = `Sin conexión — ${queued} foto${queued === 1 ? '' : 's'} esperando`;
    cls = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (draining) {
    label = `Sincronizando ${queued} foto${queued === 1 ? '' : 's'}…`;
    cls = 'bg-teal-50 text-teal-800 border-teal-200';
  } else if (conIntentos > 0) {
    label = `${conIntentos} foto${conIntentos === 1 ? '' : 's'} con error — esperando reintento`;
    cls = 'bg-red-50 text-red-700 border-red-200';
  } else {
    label = `${queued} foto${queued === 1 ? '' : 's'} en cola`;
    cls = 'bg-slate-50 text-slate-700 border-slate-200';
  }

  const showRetry = online && conIntentos > 0;

  return (
    <div className={`fixed bottom-[72px] left-3 right-3 z-30 border rounded-xl px-3 py-2 text-xs font-medium shadow-sm flex items-center gap-2 md:bottom-4 md:left-auto md:right-4 md:max-w-xs ${cls}`}>
      <span className="flex-1 truncate">{label}</span>
      {showRetry && (
        <button
          onClick={() => void retryAll()}
          className="shrink-0 px-2 py-1 rounded-md bg-white/80 hover:bg-white border border-current text-[11px] font-semibold"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
