import { SearchableSelect } from '../ui/SearchableSelect';
import type { ArticuloStockOption } from '../../services/misOTService';

export interface ParteRow {
  /** id del ítem del presupuesto cuando se edita uno existente (conserva el precio que ventas cargó). */
  itemId: string | null;
  /** id del artículo si vino del stock; null = número de parte tipeado a mano. */
  articuloId: string | null;
  numeroParte: string;
  descripcion: string;
  cantidad: string;
}

export const ROW_VACIA: ParteRow = { itemId: null, articuloId: null, numeroParte: '', descripcion: '', cantidad: '1' };

interface Props {
  partes: ParteRow[];
  onChange: (partes: ParteRow[]) => void;
  articulos: ArticuloStockOption[];
}

const inputCls = 'border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white text-slate-900 '
  + 'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500';

/**
 * Filas de partes de un presupuesto pedido desde el portal (extraído de
 * SolicitarPresupuestoModal el 2026-09-10 para reusarlo en la edición).
 * Cada fila: buscador del stock (o N° de parte libre) + cantidad.
 */
export function PartesSolicitadasEditor({ partes, onChange, articulos }: Props) {
  const setParte = (idx: number, patch: Partial<ParteRow>) =>
    onChange(partes.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  // El buscador devuelve el id del artículo elegido, o el texto tipeado (creatable).
  const handleParteChange = (idx: number, value: string) => {
    const art = articulos.find(a => a.id === value);
    if (art) setParte(idx, { articuloId: art.id, numeroParte: art.codigo, descripcion: art.descripcion });
    else setParte(idx, { articuloId: null, numeroParte: value.trim(), descripcion: '' });
  };

  const articuloOptions = articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }));

  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Partes solicitadas</p>
      {partes.map((p, idx) => {
        // Fila con texto libre: opción sintética para que el select la muestre.
        const rowOptions = !p.articuloId && p.numeroParte
          ? [...articuloOptions, { value: p.numeroParte, label: `${p.numeroParte} (no está en stock)` }]
          : articuloOptions;
        return (
          <div key={p.itemId ?? idx} className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SearchableSelect
                value={p.articuloId ?? p.numeroParte}
                onChange={v => handleParteChange(idx, v)}
                options={rowOptions}
                placeholder="Buscar por código o descripción…"
                emptyMessage="Sin resultados en stock"
                creatable
                createLabel="Usar N° de parte"
                inline
              />
            </div>
            <input
              className={`${inputCls} w-16 text-center`}
              type="number"
              // Fracciones de kit: 0,5 es una cantidad válida (2026-08-13).
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="Cant."
              title="Se puede pedir una fracción, ej. 0,5 de un kit"
              value={p.cantidad}
              onChange={e => setParte(idx, { cantidad: e.target.value })}
            />
            {partes.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(partes.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-600 px-1 text-lg leading-none"
                aria-label="Quitar parte"
              >×</button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...partes, { ...ROW_VACIA }])}
        className="text-teal-700 hover:text-teal-800 text-xs font-medium"
      >+ Agregar otra parte</button>
      <p className="text-[11px] text-slate-400">
        Elegí del stock (queda código + descripción) o tipeá el N° de parte si no está.
        Van al presupuesto como items sin precio; ventas los completa.
      </p>
    </div>
  );
}
