import { useEffect, useRef } from 'react';
import { tableLabel, type CoverageRow } from '../../utils/tableCatalogCoverage';

interface Props {
  row: CoverageRow;
  total: number;
  /** Valor pendiente de aplicar: undefined = sin cambio. */
  pending: boolean | undefined;
  onToggle: () => void;
}

/**
 * Fila del panel de cobertura: casilla de tres estados (todas / algunas / ninguna),
 * contador "n de N" y, si es parcial, en qué tablas falta (o en cuáles está).
 */
export function CoverageRowItem({ row, total, pending, onToggle }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const effective: 'full' | 'partial' | 'none' =
    pending === undefined ? row.status : pending ? 'full' : 'none';
  useEffect(() => { if (ref.current) ref.current.indeterminate = effective === 'partial'; }, [effective]);

  const changed = pending !== undefined;
  const n = row.coveredBy.length;
  // Mostrar la lista más corta: "falta en" si faltan pocas, "solo en" si están en pocas.
  const showMissing = row.missingIn.length <= row.coveredBy.length;
  const detail = showMissing ? row.missingIn : row.coveredBy;

  return (
    <div className={`px-3 py-1.5 rounded-md transition-colors ${
      changed ? 'bg-teal-50 ring-1 ring-teal-200' : row.status === 'partial' ? 'bg-amber-50/70' : 'hover:bg-slate-50'
    }`}>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          checked={effective === 'full'}
          onChange={onToggle}
          className="w-4 h-4 accent-teal-600 shrink-0"
        />
        <span className={`text-xs flex-1 ${effective === 'none' ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
          {row.value}
          {!row.inCatalog && (
            <span className="ml-1.5 text-[10px] font-mono uppercase tracking-wide text-rose-600" title="Este valor está en las tablas pero no en el catálogo: en campo no va a coincidir con ningún equipo o servicio.">
              fuera del catálogo
            </span>
          )}
        </span>
        <span className={`text-[10px] font-mono tabular-nums ${
          row.status === 'full' ? 'text-emerald-600' : row.status === 'partial' ? 'text-amber-700 font-semibold' : 'text-slate-300'
        }`}>
          {changed ? (pending ? `→ ${total}/${total}` : `→ 0/${total}`) : `${n}/${total}`}
        </span>
      </label>
      {row.status === 'partial' && !changed && (
        <p className="ml-[26px] mt-0.5 text-[11px] text-amber-800 leading-snug">
          {showMissing ? 'Falta en: ' : 'Solo en: '}
          {detail.slice(0, 4).map(tableLabel).join(' · ')}
          {detail.length > 4 && ` y ${detail.length - 4} más`}
        </p>
      )}
    </div>
  );
}
