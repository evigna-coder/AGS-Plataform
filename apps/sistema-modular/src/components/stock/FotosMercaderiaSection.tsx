import { useEffect, useState } from 'react';
import type { FotoMercaderia } from '@ags/shared';
import { pushEscape } from '../../utils/escapeStack';

const IMG_ERROR = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>';

interface Props {
  fotos?: FotoMercaderia[];
  /** ISO del cierre de la tanda. Ausente = sigue abierta. */
  cerradaAt?: string | null;
  cerradaPor?: string | null;
  /** "Recepción" o "Entrega" — qué documenta esta tanda. */
  titulo: string;
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Galería de la tanda de fotos de un documento (2026-09-03).
 *
 * Las fotos se sacan desde el celular en el portal y se ven acá. La tanda queda
 * abierta hasta que alguien la cierra: "abierta" significa que todavía pueden
 * sumarse fotos, no que falte algo. Se puede cerrar incompleta.
 *
 * Es de solo lectura: la captura vive en el portal, que es donde está el
 * teléfono y la mercadería.
 */
export function FotosMercaderiaSection({ fotos = [], cerradaAt, cerradaPor, titulo }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    return pushEscape(() => setExpanded(null));
  }, [expanded]);

  const ordenadas = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-700">
          {titulo}
          {ordenadas.length > 0 && (
            <span className="text-slate-400 font-normal"> ({ordenadas.length})</span>
          )}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          cerradaAt ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'
        }`}
          title={cerradaAt
            ? `Cerrada el ${fechaCorta(cerradaAt)}${cerradaPor ? ` por ${cerradaPor}` : ''}`
            : 'Todavía se le pueden sumar fotos desde el celular'}>
          {cerradaAt ? 'Tanda cerrada' : 'Tanda abierta'}
        </span>
      </div>

      {ordenadas.length === 0 ? (
        <p className="text-xs text-slate-400">
          Sin fotos. Se sacan desde el celular, en Mercadería del portal.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {ordenadas.map(f => (
            <figure key={f.id}>
              <img
                src={f.url}
                alt={f.nombre ?? 'Foto'}
                title={[f.nombre, `${fechaCorta(f.fecha)}${f.subidoPor ? ` — ${f.subidoPor}` : ''}`]
                  .filter(Boolean).join('\n')}
                className="w-full aspect-square object-cover rounded-md border border-slate-200 cursor-pointer"
                onClick={() => setExpanded(f.url)}
                onError={e => { (e.target as HTMLImageElement).src = IMG_ERROR; }}
              />
              <figcaption className="text-[9px] text-slate-400 mt-0.5 truncate">
                {fechaCorta(f.fecha)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {expanded && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-8"
          onClick={() => setExpanded(null)}
        >
          <button
            onClick={e => { e.stopPropagation(); setExpanded(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-xl"
            aria-label="Cerrar"
            title="Cerrar (ESC)"
          >×</button>
          <img src={expanded} alt="Foto" className="max-w-full max-h-full rounded-lg"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
