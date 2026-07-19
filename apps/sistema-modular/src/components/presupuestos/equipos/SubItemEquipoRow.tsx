import type { PresupuestoSubItem } from '@ags/shared';
import { ArticuloInlineAutocomplete, type ArticuloMini } from '../contrato/ArticuloInlineAutocomplete';

interface Props {
  sub: PresupuestoSubItem;
  numero: string; // "1.3"
  articulosCatalog: ArticuloMini[];
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<PresupuestoSubItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onOpenDetalle: () => void;
  onRemove: () => void;
}

const inputCls = 'w-full border border-slate-200 rounded px-1.5 py-1 text-[11px] bg-white outline-none focus:ring-1 focus:ring-teal-400';

/**
 * Fila editable de un sub-ítem (Equipos): código (autocomplete de stock opcional,
 * texto libre), cantidad, descripción corta y precio opcional (vacío = sin precio).
 */
export const SubItemEquipoRow = ({
  sub, numero, articulosCatalog, isFirst, isLast,
  onUpdate, onMove, onOpenDetalle, onRemove,
}: Props) => {
  const tieneDetalle = !!(sub.detalleLargo || (sub.fotos && sub.fotos.length > 0));

  return (
    <div className="grid grid-cols-[36px_150px_52px_1fr_92px_150px] gap-1.5 items-center">
      <span className="text-[10px] font-mono text-slate-400 text-center">{numero}</span>

      <ArticuloInlineAutocomplete
        value={sub.codigo}
        onChange={val => onUpdate({ codigo: val })}
        onSelect={(art) => onUpdate({
          codigo: art.codigo,
          descripcion: sub.descripcion || art.descripcion,
          stockArticuloId: art.id,
        })}
        catalog={articulosCatalog}
        placeholder="Código..."
        className={`${inputCls} font-mono`}
      />

      <input type="number" min="0" step="1" value={sub.cantidad}
        onChange={e => onUpdate({ cantidad: Number(e.target.value) || 0 })}
        className={`${inputCls} text-center`} />

      <input value={sub.descripcion}
        onChange={e => onUpdate({ descripcion: e.target.value })}
        placeholder="Descripción corta..."
        className={inputCls} />

      <input type="number" min="0" step="0.01"
        value={sub.precioUnitario ?? ''}
        placeholder="—"
        title="Precio unitario opcional — vacío = sin precio (va incluido en el item)"
        onChange={e => onUpdate({ precioUnitario: e.target.value === '' ? null : Number(e.target.value) })}
        className={`${inputCls} text-right font-mono`} />

      <div className="flex items-center gap-1 justify-end">
        <button type="button" onClick={() => onMove(-1)} disabled={isFirst}
          title="Subir" className="text-[11px] px-1 text-slate-400 hover:text-slate-600 disabled:opacity-25">↑</button>
        <button type="button" onClick={() => onMove(1)} disabled={isLast}
          title="Bajar" className="text-[11px] px-1 text-slate-400 hover:text-slate-600 disabled:opacity-25">↓</button>
        <button type="button" onClick={onOpenDetalle}
          title="Detalle largo + fotos (Detalles de Configuración del PDF)"
          className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors ${
            tieneDetalle
              ? 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}>
          Detalle{tieneDetalle ? ' ✓' : ''}
        </button>
        <button type="button" onClick={onRemove} title="Quitar sub-ítem"
          className="text-red-400 hover:text-red-600 text-sm px-1 leading-none">&times;</button>
      </div>
    </div>
  );
};
