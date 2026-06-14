import { useState } from 'react';
import type { PresupuestoItem, CategoriaPresupuesto } from '@ags/shared';
import { DISPONIBILIDAD_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { PresupuestoDisponibilidadFields } from './PresupuestoDisponibilidadFields';

interface PresupuestoItemRowProps {
  item: PresupuestoItem;
  categoriasPresupuesto: CategoriaPresupuesto[];
  fmtMoney: (n: number) => string;
  taxes: { totalImpuestos: number };
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
}

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

export const PresupuestoItemRow = ({
  item, categoriasPresupuesto, fmtMoney, taxes, onUpdateItem, onRemoveItem,
}: PresupuestoItemRowProps) => {
  // Start expanded if the item already has availability data or a factor set (Phase 16)
  const [showDisp, setShowDisp] = useState(
    item.disponibilidad != null || item.etaDiasEstimados != null || item.factor != null,
  );

  const dispLabel = item.disponibilidad ? DISPONIBILIDAD_LABELS[item.disponibilidad] : null;

  return (
    <>
      <tr>
        <td className="px-2 py-2">
          <input value={item.codigoProducto || ''} onChange={e => onUpdateItem(item.id, 'codigoProducto', e.target.value || null)}
            className="w-full outline-none bg-transparent text-xs text-slate-500" placeholder="Part #" />
        </td>
        <td className="px-3 py-2">
          <input value={item.descripcion} onChange={e => onUpdateItem(item.id, 'descripcion', e.target.value)}
            className="w-full outline-none bg-transparent text-xs" placeholder="Descripcion..." />
        </td>
        <td className="px-2 py-2">
          <input type="number" min="0" step="0.01" value={item.cantidad}
            onChange={e => onUpdateItem(item.id, 'cantidad', Number(e.target.value) || 0)}
            className="w-full outline-none text-center bg-transparent text-xs" />
        </td>
        <td className="px-2 py-2">
          <input value={item.unidad} onChange={e => onUpdateItem(item.id, 'unidad', e.target.value)}
            className="w-full outline-none bg-transparent text-xs" />
        </td>
        <td className="px-2 py-2">
          <input type="number" min="0" step="0.01" value={item.precioUnitario}
            onChange={e => onUpdateItem(item.id, 'precioUnitario', Number(e.target.value) || 0)}
            className="w-full outline-none text-right bg-transparent text-xs" />
        </td>
        <td className="px-2 py-2">
          <input type="number" min="0" max="100" step="0.5" value={item.descuento || 0}
            onChange={e => onUpdateItem(item.id, 'descuento', Number(e.target.value) || 0)}
            className="w-full outline-none text-center bg-transparent text-xs" />
        </td>
        <td className="px-2 py-2 text-center text-xs font-semibold text-slate-700">
          {fmtMoney(item.subtotal)}
        </td>
        <td className="px-2 py-2">
          <SearchableSelect value={item.categoriaPresupuestoId || ''}
            onChange={(v) => onUpdateItem(item.id, 'categoriaPresupuestoId', v || undefined)}
            options={categoriaOptions(categoriasPresupuesto)} placeholder="Categoria..." />
          {taxes.totalImpuestos > 0 && (
            <span className="text-[10px] text-slate-400 mt-0.5 block">Imp: {fmtMoney(taxes.totalImpuestos)}</span>
          )}
        </td>
        <td className="text-center px-1">
          <div className="flex flex-col items-center gap-0.5">
            <button onClick={() => onRemoveItem(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
            <button type="button" onClick={() => setShowDisp(v => !v)}
              title={showDisp ? 'Ocultar entrega' : (dispLabel ?? 'Editar entrega')}
              className="text-[10px] text-teal-600 hover:text-teal-800 leading-none">
              {showDisp ? '▲' : (dispLabel ? `⬛` : '▼')}
            </button>
          </div>
        </td>
      </tr>
      {/* Phase 16 — inline disponibilidad/eta disclosure row */}
      {showDisp && (
        <tr className="bg-slate-50/60">
          <td colSpan={9} className="px-3 py-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-mono text-slate-500 shrink-0">Entrega:</span>
              <div className="flex-1 min-w-[220px] max-w-md">
                <PresupuestoDisponibilidadFields
                  disponibilidad={item.disponibilidad ?? null}
                  etaDiasEstimados={item.etaDiasEstimados ?? null}
                  onChange={(next) => {
                    onUpdateItem(item.id, 'disponibilidad', next.disponibilidad);
                    onUpdateItem(item.id, 'etaDiasEstimados', next.etaDiasEstimados);
                  }}
                  variant="row"
                />
              </div>
              <label className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wide font-mono text-slate-500" title="Multiplicador sobre FOB — referencia interna, no se muestra en el PDF">Factor:</span>
                <input type="number" min="0" step="0.01" value={item.factor ?? ''} placeholder="1.45"
                  onChange={e => onUpdateItem(item.id, 'factor', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-20 border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-right" />
              </label>
              <button type="button" onClick={() => setShowDisp(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0">
                Ocultar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
