import type { Part, StockSelection, UnidadStock, CondicionUnidad } from '@ags/shared';
import { useCierreStockUnits, type StockPosicion } from '../../hooks/useCierreStockUnits';

interface Props {
  articulos: Part[];
  selections: StockSelection[];
  onChange: (selections: StockSelection[]) => void;
  disabled?: boolean;
}

const CONDICION_LABEL: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacond.',
  vendible: 'Vendible', scrap: 'Scrap',
};

/** Etiqueta de una unidad para el dropdown: serie/lote + ubicación + condición. */
function unidadLabel(u: UnidadStock): string {
  const ident = u.nroSerie
    ? `S/N ${u.nroSerie}`
    : u.nroLote
      ? `Lote ${u.nroLote}${(u.cantidad ?? 1) > 1 ? ` (×${u.cantidad})` : ''}`
      : 'Sin ident.';
  return `${ident} · ${u.ubicacion.referenciaNombre} · ${CONDICION_LABEL[u.condicion] ?? u.condicion}`;
}

export const CierreStockSelector: React.FC<Props> = ({ articulos, selections, onChange, disabled }) => {
  const { get, loading } = useCierreStockUnits(articulos);

  const getSelection = (partId: string) => selections.find(s => s.partId === partId);

  const updateSelection = (part: Part, patch: Partial<StockSelection>) => {
    const base: StockSelection = {
      partId: part.id, partCodigo: part.codigo, partDescripcion: part.descripcion, cantidad: part.cantidad,
      origenTipo: 'posicion', origenId: '', origenNombre: '',
    };
    onChange([...selections.filter(s => s.partId !== part.id), { ...base, ...patch }]);
  };

  const removeSelection = (partId: string) => onChange(selections.filter(s => s.partId !== partId));

  /** Selección por unidad puntual (artículos con serie/lote). La unidad define el origen. */
  const selectUnidad = (part: Part, unidad: UnidadStock | null) => {
    if (!unidad) { removeSelection(part.id); return; }
    updateSelection(part, {
      articuloId: unidad.articuloId,
      origenTipo: unidad.ubicacion.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
      origenId: unidad.ubicacion.referenciaId,
      origenNombre: unidad.ubicacion.referenciaNombre,
      unidadStockId: unidad.id,
      nroSerie: unidad.nroSerie ?? null,
      nroLote: unidad.nroLote ?? null,
    });
  };

  /** Selección por posición de descarga (artículos sin trazabilidad). */
  const selectPosicion = (part: Part, pos: StockPosicion | null) => {
    if (!pos) { removeSelection(part.id); return; }
    updateSelection(part, {
      articuloId: get(part.id).articulo?.id ?? null,
      origenTipo: pos.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
      origenId: pos.referenciaId,
      origenNombre: pos.referenciaNombre,
      unidadStockId: null,
    });
  };

  if (articulos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        Origen de materiales{loading && <span className="ml-2 normal-case font-normal text-slate-400">cargando stock…</span>}
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/60">
            <tr>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left">Material</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center w-12">Cant.</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left w-56">Origen / Unidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {articulos.map(part => {
              const sel = getSelection(part.id);
              const stock = get(part.id);
              return (
                <tr key={part.id} className="bg-white/40 align-top">
                  <td className="px-2 py-1.5">
                    <p className="text-xs text-slate-700">{part.descripcion}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{part.codigo || '—'}</p>
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-slate-600">{part.cantidad}</td>
                  <td className="px-2 py-1.5">
                    {disabled ? (
                      <span className="text-[11px] text-slate-600">
                        {sel?.nroSerie ? `S/N ${sel.nroSerie}` : sel?.nroLote ? `Lote ${sel.nroLote}` : sel?.origenNombre || '—'}
                      </span>
                    ) : stock.requiereTrazabilidad ? (
                      stock.unidades.length === 0 ? (
                        <span className="text-[11px] text-amber-600">Sin stock disponible</span>
                      ) : (
                        <select
                          value={sel?.unidadStockId ?? ''}
                          onChange={e => selectUnidad(part, stock.unidades.find(u => u.id === e.target.value) ?? null)}
                          className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                        >
                          <option value="">Elegir {stock.articulo?.requiereNumeroSerie ? 'serie' : 'lote'}…</option>
                          {stock.unidades.map(u => (
                            <option key={u.id} value={u.id}>{unidadLabel(u)}</option>
                          ))}
                        </select>
                      )
                    ) : stock.posiciones.length === 0 ? (
                      <span className="text-[11px] text-amber-600">Sin stock disponible</span>
                    ) : (
                      <select
                        value={sel && !sel.unidadStockId ? sel.origenId : ''}
                        onChange={e => selectPosicion(part, stock.posiciones.find(p => p.referenciaId === e.target.value) ?? null)}
                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="">Elegir posición…</option>
                        {stock.posiciones.map(p => (
                          <option key={p.key} value={p.referenciaId}>{p.referenciaNombre} (×{p.cantidad})</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
