import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { pushEscape } from '../../utils/escapeStack';
import type { FotoUnidad, MomentoFotoUnidad, UnidadStock } from '@ags/shared';

const MOMENTO_LABELS: Record<MomentoFotoUnidad, string> = {
  recepcion: 'Recepcion',
  entrega: 'Entrega',
};

const MOMENTO_BADGE: Record<MomentoFotoUnidad, string> = {
  recepcion: 'bg-teal-600/90',
  entrega: 'bg-blue-600/90',
};

const IMG_ERROR = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>';

interface Props {
  /** Unidades cuyas fotos se muestran. Varias cuando la fila del desglose
   *  unifica tandas identicas: cada foto se rotula con su unidad. */
  units: UnidadStock[];
  onClose: () => void;
}

interface FotoConUnidad {
  foto: FotoUnidad;
  unidad: UnidadStock;
}

function etiqueta(u: UnidadStock): string {
  if (u.nroSerie) return `S/N ${u.nroSerie}`;
  if (u.nroLote) return `Lote ${u.nroLote}`;
  return 'sin serie';
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Galeria de fotos de la mercaderia (2026-09-02). Se sacan desde el celular en
 * el portal; aca se ven. Separadas por momento: como llego contra como salio.
 *
 * Es el otro extremo de "mostrame la foto de la columna que le vendimos a
 * Synthon": del remito se llega a la unidad, y de la unidad a esta galeria.
 */
export function FotosUnidadModal({ units, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    return pushEscape(() => setExpanded(null));
  }, [expanded]);

  const porMomento = useMemo(() => {
    const todas: FotoConUnidad[] = units.flatMap(u =>
      (u.fotos ?? []).map(foto => ({ foto, unidad: u })),
    );
    const orden = (a: FotoConUnidad, b: FotoConUnidad) => a.foto.fecha.localeCompare(b.foto.fecha);
    return (['recepcion', 'entrega'] as MomentoFotoUnidad[])
      .map(m => ({ momento: m, fotos: todas.filter(f => f.foto.momento === m).sort(orden) }))
      .filter(g => g.fotos.length > 0);
  }, [units]);

  const primera = units[0];
  const total = porMomento.reduce((n, g) => n + g.fotos.length, 0);
  const variasUnidades = units.length > 1;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        maxWidth="2xl"
        title={`Fotos · ${primera?.articuloCodigo ?? ''}`}
        subtitle={primera
          ? `${primera.articuloDescripcion}${variasUnidades ? ` — ${units.length} tandas` : ` · ${etiqueta(primera)}`}`
          : undefined}
      >
        {total === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Esta unidad no tiene fotos. Se sacan desde el celular, en Mercaderia del portal.
          </p>
        ) : (
          <div className="space-y-4">
            {porMomento.map(g => (
              <section key={g.momento}>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-1 mb-2">
                  {MOMENTO_LABELS[g.momento]} · {g.fotos.length} foto{g.fotos.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {g.fotos.map(({ foto, unidad }) => (
                    <figure key={foto.id} className="relative">
                      <img
                        src={foto.url}
                        alt={foto.nombre ?? 'Foto'}
                        title={[
                          foto.nombre,
                          `${fechaCorta(foto.fecha)}${foto.subidoPor ? ` — ${foto.subidoPor}` : ''}`,
                          variasUnidades ? etiqueta(unidad) : null,
                        ].filter(Boolean).join('\n')}
                        className="w-full aspect-square object-cover rounded-md border border-slate-200 cursor-pointer"
                        onClick={() => setExpanded(foto.url)}
                        onError={e => { (e.target as HTMLImageElement).src = IMG_ERROR; }}
                      />
                      <span className={`absolute top-0.5 left-0.5 px-1 rounded text-white text-[8px] font-medium uppercase ${MOMENTO_BADGE[foto.momento]}`}>
                        {MOMENTO_LABELS[foto.momento]}
                      </span>
                      <figcaption className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {fechaCorta(foto.fecha)}
                        {variasUnidades ? ` · ${etiqueta(unidad)}` : ''}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Modal>

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
          <img
            src={expanded}
            alt="Foto"
            className="max-w-full max-h-full rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
