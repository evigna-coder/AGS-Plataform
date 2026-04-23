import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import type { QFDocumento } from '@ags/shared';

interface Props {
  qf: QFDocumento;
  onClose: () => void;
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function HistorialDrawer({ qf, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const historialDesc = [...qf.historial].sort((a, b) => b.version.localeCompare(a.version));

  return createPortal(
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative ml-auto h-full w-full sm:max-w-md bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Historial</p>
            <p className="text-sm font-semibold text-slate-900">{qf.numeroCompleto}</p>
            <p className="text-xs text-slate-500 truncate">{qf.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {historialDesc.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin entradas de historial.</p>
          ) : (
            historialDesc.map((h, i) => {
              const esActual = h.version === qf.versionActual;
              return (
                <div
                  key={`${h.version}-${i}`}
                  className={`rounded-xl border p-3 ${
                    esActual ? 'bg-teal-50/60 border-teal-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-900">
                        v{h.version}
                      </span>
                      {esActual && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-600 text-white">
                          Vigente
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">{formatFecha(h.fecha)}</span>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{h.cambios}</p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {h.usuarioNombre || h.usuarioEmail}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
