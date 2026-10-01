import { useEffect, useMemo, useState } from 'react';
import type { Articulo } from '@ags/shared';
import { useTabs } from '../../contexts/TabsContext';
import { articulosService } from '../../services/stockService';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Drawer } from '../ui/Drawer';
import { LoadingState } from '../ui/LoadingState';
import { useDondeViene } from '../../hooks/useDondeViene';
import { formatFechaAR } from '../../utils/formatFecha';
import type { FuenteDondeViene, LineaDondeViene } from '../../utils/dondeViene';

const FUENTE: Record<FuenteDondeViene, { titulo: string; chip: string }> = {
  importacion:   { titulo: 'En importación', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  oc:            { titulo: 'En orden de compra, sin embarcar', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  requerimiento: { titulo: 'Requerido, sin comprar', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  unidad:        { titulo: 'En stock (por tanda)', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
};
const ORDEN: FuenteDondeViene[] = ['importacion', 'oc', 'requerimiento', 'unidad'];

/**
 * "¿Dónde viene?" (2026-09-30): buscador de artículo en Importaciones que abre
 * un panel con cada importación, OC, requerimiento y tanda de stock donde está,
 * SIN sumar, y para quién es. Antes había que abrir importación por importación.
 */
export function DondeVieneBuscador() {
  const { navigateInActiveTab } = useTabs();
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  const [articuloId, setArticuloId] = useState<string | null>(null);
  const { lineas, loading, error } = useDondeViene(articuloId);

  useEffect(() => {
    articulosService.getAll().then(setCatalogo).catch(err => console.error('[DondeVieneBuscador] catálogo:', err));
  }, []);
  const opciones = useMemo(() => catalogo.map(a => ({ value: a.id, label: `${a.codigo} · ${a.descripcion}` })), [catalogo]);
  const articulo = useMemo(() => catalogo.find(a => a.id === articuloId) ?? null, [catalogo, articuloId]);

  const porFuente = useMemo(() => {
    const m = new Map<FuenteDondeViene, LineaDondeViene[]>();
    for (const l of lineas) m.set(l.fuente, [...(m.get(l.fuente) ?? []), l]);
    return m;
  }, [lineas]);

  return (
    <>
      <div className="w-80">
        <SearchableSelect value="" onChange={v => { if (v) setArticuloId(v); }} size="sm" options={opciones}
          placeholder="¿Dónde viene…? Buscá un artículo" emptyMessage="Sin artículos" />
      </div>
      <Drawer open={!!articuloId} onClose={() => setArticuloId(null)} width="max-w-2xl"
        title={articulo ? `${articulo.codigo}` : '¿Dónde viene?'} subtitle={articulo?.descripcion}>
        {loading ? (
          <LoadingState message="Buscando en importaciones, OCs, requerimientos y stock…" rows={5} />
        ) : error ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        ) : lineas.length === 0 ? (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            No está en camino ni hay unidades en stock de este artículo.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] text-slate-500">
              Cada fila es un documento; las cantidades no se suman.
            </p>
            {ORDEN.filter(f => porFuente.has(f)).map(f => (
              <section key={f}>
                <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">{FUENTE[f].titulo}</p>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {porFuente.get(f)!.map(l => (
                    <li key={`${l.fuente}-${l.id}-${l.referencia}`} className="px-3 py-2 bg-white hover:bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        {l.ruta ? (
                          <button onClick={() => navigateInActiveTab(l.ruta!)} className="text-xs font-semibold text-teal-700 hover:underline font-mono">{l.referencia}</button>
                        ) : <span className="text-xs font-semibold text-slate-700 font-mono">{l.referencia}</span>}
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${FUENTE[l.fuente].chip}`}>{l.estadoLabel}</span>
                        {l.fecha && <span className="text-[11px] text-slate-500">llega {formatFechaAR(l.fecha)}</span>}
                        <span className="ml-auto text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          <span className="text-[9px] font-mono font-normal uppercase tracking-wide text-slate-400 mr-1">Cant.</span>
                          {l.cantidad}{l.presentacion ? <span className="text-[10px] font-normal text-slate-400 ml-1">× {l.presentacion}</span> : <span className="text-[10px] font-normal text-slate-400 ml-1">u.</span>}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                        <span className="text-slate-700">{l.para.length > 0 ? l.para.join(' · ') : <span className="text-slate-400">sin destino asignado</span>}</span>
                        {l.nota && <span className="text-slate-400">{l.nota}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
