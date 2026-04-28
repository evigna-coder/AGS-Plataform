import { useState } from 'react';
import { useUploadQueue } from '../../hooks/useUploadQueue';

/**
 * Banner global con el estado de la cola de subida de fotos.
 * Aparece cuando hay pendientes O cuando estamos offline.
 *
 * Tappable: si hay errores, expande mostrando el detalle de cada foto fallida
 * con su `lastError`. Útil para diagnosticar sin F12 (permission denied,
 * network, quota, etc.).
 */
export function UploadQueueIndicator() {
  const { pending, online, draining, retryAll, discard } = useUploadQueue();
  const [expanded, setExpanded] = useState(false);

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
  const conError = pending.filter(p => p.lastError);

  return (
    <div className={`fixed bottom-[72px] left-3 right-3 z-30 border rounded-xl text-xs shadow-sm md:bottom-4 md:left-auto md:right-4 md:max-w-sm ${cls}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex-1 text-left font-medium truncate"
          title="Tocar para ver detalle"
        >
          {label}
          {conError.length > 0 && <span className="ml-1 underline">▾</span>}
        </button>
        {showRetry && (
          <button
            onClick={() => void retryAll()}
            className="shrink-0 px-2 py-1 rounded-md bg-white/80 hover:bg-white border border-current text-[11px] font-semibold"
          >
            Reintentar
          </button>
        )}
      </div>
      {expanded && conError.length > 0 && (
        <div className="border-t border-current/20 max-h-48 overflow-y-auto">
          {conError.map(p => (
            <div key={p.id} className="px-3 py-2 border-b border-current/10 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] truncate">{p.itemSubId || p.fichaNumero} · {p.filename}</span>
                <button
                  onClick={() => void discard(p.id)}
                  className="text-[10px] underline shrink-0"
                  title="Descartar de la cola (la foto se pierde)"
                >
                  Descartar
                </button>
              </div>
              <p className="text-[10px] mt-1 break-words opacity-90">
                {p.lastError ?? 'Sin detalle'}
              </p>
              <p className="text-[10px] opacity-60">Intento {p.intentos}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
