import type { Part, StockSelection, UnidadStock, CondicionUnidad } from '@ags/shared';
import { useCierreStockUnits, type StockPosicion, type PartStockInfo, type PatronLoteOrigen, type RemitoItemOrigen } from '../../hooks/useCierreStockUnits';
import { SearchableSelect } from '../ui/SearchableSelect';

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

/** Etiqueta de un lote de patrón: lote + saldo + vencimiento. */
function loteLabel(l: PatronLoteOrigen): string {
  const saldo = l.cantidad != null ? ` (×${l.cantidad})` : '';
  const vto = l.fechaVencimiento ? ` · vto ${l.fechaVencimiento.slice(0, 10)}` : '';
  return `Lote ${l.lote}${saldo}${vto}`;
}

/** Opciones de origen unificadas (patrón + remito en campo + stock) para el select de una parte. */
type OrigenOption =
  | { kind: 'patron'; value: string; label: string; lote: PatronLoteOrigen }
  | { kind: 'remito'; value: string; label: string; remito: RemitoItemOrigen }
  | { kind: 'unidad'; value: string; label: string; unidad: UnidadStock }
  | { kind: 'posicion'; value: string; label: string; pos: StockPosicion };

function buildOptions(stock: PartStockInfo): OrigenOption[] {
  const opts: OrigenOption[] = [];
  for (const l of stock.patronLotes) {
    opts.push({ kind: 'patron', value: `patron:${l.lote}`, label: loteLabel(l), lote: l });
  }
  // Remitos en campo (2026-08-04): el material ya salió con un remito de salida —
  // descargarlo desde acá consume desde el remito y lo cierra si queda resuelto.
  for (const r of stock.remitoOrigenes) {
    opts.push({
      kind: 'remito',
      value: `remito:${r.remitoId}:${r.itemId}`,
      label: `Remito ${r.remitoNumero} — ${r.ingenieroNombre} (×${r.cantidad})${r.serie ? ` · S/N ${r.serie}` : ''}`,
      remito: r,
    });
  }
  if (stock.requiereTrazabilidad) {
    for (const u of stock.unidades) opts.push({ kind: 'unidad', value: `unidad:${u.id}`, label: unidadLabel(u), unidad: u });
  } else {
    for (const p of stock.posiciones) {
      opts.push({ kind: 'posicion', value: `posicion:${p.referenciaId}`, label: `${p.referenciaNombre} (×${p.cantidad})`, pos: p });
    }
  }
  return opts;
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
  const selectUnidad = (part: Part, unidad: UnidadStock) => {
    updateSelection(part, {
      articuloId: unidad.articuloId,
      origenTipo: unidad.ubicacion.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
      origenId: unidad.ubicacion.referenciaId,
      origenNombre: unidad.ubicacion.referenciaNombre,
      unidadStockId: unidad.id,
      nroSerie: unidad.nroSerie ?? null,
      nroLote: unidad.nroLote ?? null,
      patronId: null,
      patronLote: null,
    });
  };

  /** Selección por posición de descarga (artículos sin trazabilidad). */
  const selectPosicion = (part: Part, pos: StockPosicion) => {
    updateSelection(part, {
      articuloId: get(part.id).articulo?.id ?? null,
      origenTipo: pos.tipo === 'ingeniero' ? 'ingeniero' : 'posicion',
      origenId: pos.referenciaId,
      origenNombre: pos.referenciaNombre,
      unidadStockId: null,
      patronId: null,
      patronLote: null,
    });
  };

  /** Selección desde un remito en campo: al cerrar se consume desde el remito. */
  const selectRemito = (part: Part, r: RemitoItemOrigen) => {
    updateSelection(part, {
      articuloId: get(part.id).articulo?.id ?? null,
      origenTipo: 'remito',
      origenId: r.remitoId,
      origenNombre: `Remito ${r.remitoNumero} — ${r.ingenieroNombre}`,
      remitoId: r.remitoId,
      remitoNumero: r.remitoNumero,
      remitoItemId: r.itemId,
      unidadStockId: null,
      nroSerie: r.serie,
      nroLote: null,
      patronId: null,
      patronLote: null,
    });
  };

  /** Selección por lote de patrón (activo). Descuenta la cantidad del lote al cerrar. */
  const selectPatronLote = (part: Part, lote: PatronLoteOrigen) => {
    updateSelection(part, {
      articuloId: null,
      unidadStockId: null,
      origenTipo: 'patron',
      origenId: lote.patronId,
      origenNombre: `Patrón ${lote.patronCodigo} · Lote ${lote.lote}`,
      patronId: lote.patronId,
      patronLote: lote.lote,
      nroSerie: null,
      nroLote: lote.lote,
    });
  };

  /** Value del select que refleja la selección actual. */
  const currentValue = (sel: StockSelection | undefined): string => {
    if (!sel) return '';
    if (sel.origenTipo === 'patron' && sel.patronLote) return `patron:${sel.patronLote}`;
    if (sel.origenTipo === 'remito' && sel.remitoId && sel.remitoItemId) return `remito:${sel.remitoId}:${sel.remitoItemId}`;
    if (sel.unidadStockId) return `unidad:${sel.unidadStockId}`;
    if (sel.origenId) return `posicion:${sel.origenId}`;
    return '';
  };

  const onSelectOrigen = (part: Part, stock: PartStockInfo, value: string) => {
    if (!value) { removeSelection(part.id); return; }
    const opt = buildOptions(stock).find(o => o.value === value);
    if (!opt) return;
    if (opt.kind === 'patron') selectPatronLote(part, opt.lote);
    else if (opt.kind === 'remito') selectRemito(part, opt.remito);
    else if (opt.kind === 'unidad') selectUnidad(part, opt.unidad);
    else selectPosicion(part, opt.pos);
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
              const options = buildOptions(stock);
              const stockGroup = options.filter(o => o.kind === 'unidad' || o.kind === 'posicion');
              const patronGroup = options.filter(o => o.kind === 'patron');
              const remitoGroup = options.filter(o => o.kind === 'remito');
              // Opciones aplanadas para el SearchableSelect (no soporta optgroups): el grupo
              // Patrón/Remito/Stock queda en subLabel. "Quitar origen" (value '') solo si ya
              // hay selección — replica el <option value=""> del select nativo sin mostrarlo
              // cuando el campo está vacío (ahí manda el placeholder).
              const searchOptions = [
                ...(sel ? [{ value: '', label: '— Quitar origen —' }] : []),
                ...patronGroup.map(o => ({ value: o.value, label: o.label, subLabel: 'Patrón (activo)' })),
                ...remitoGroup.map(o => ({ value: o.value, label: o.label, subLabel: 'En campo (remito)' })),
                ...stockGroup.map(o => ({ value: o.value, label: o.label, subLabel: 'Stock' })),
              ];
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
                        {sel?.origenTipo === 'patron' || sel?.origenTipo === 'remito'
                          ? sel.origenNombre || '—'
                          : sel?.nroSerie ? `S/N ${sel.nroSerie}` : sel?.nroLote ? `Lote ${sel.nroLote}` : sel?.origenNombre || '—'}
                      </span>
                    ) : options.length === 0 ? (
                      <span className="text-[11px] text-amber-600">Sin stock disponible</span>
                    ) : (
                      <SearchableSelect
                        value={currentValue(sel)}
                        onChange={v => onSelectOrigen(part, stock, v)}
                        options={searchOptions}
                        placeholder="Buscar origen…"
                        size="sm"
                      />
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
