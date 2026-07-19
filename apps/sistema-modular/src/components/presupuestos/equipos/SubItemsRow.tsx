import { useState } from 'react';
import type { PresupuestoItem, PresupuestoSubItem } from '@ags/shared';
import { SubItemsEditor } from './SubItemsEditor';

interface Props {
  item: PresupuestoItem;
  /** Numeración 1-based del item en la lista (para mostrar N.1, N.2…) */
  itemNumero: number;
  /** colSpan de la fila — depende de la tabla que la contiene */
  colSpan: number;
  presupuestoId?: string | null;
  onChangeSubItems: (subs: PresupuestoSubItem[]) => void;
}

/**
 * Fila expandible de sub-ítems bajo cada item de un presupuesto tipo 'ventas'
 * (Equipos). Colapsada muestra un toggle con el conteo; expandida renderiza el
 * SubItemsEditor completo. Se inyecta en las tablas de items vía `renderSubRow`.
 */
export const SubItemsRow = ({ item, itemNumero, colSpan, presupuestoId, onChangeSubItems }: Props) => {
  const count = item.subItems?.length || 0;
  const [expanded, setExpanded] = useState(count > 0);

  return (
    <tr className="bg-teal-50/30">
      <td colSpan={colSpan} className="px-3 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-teal-700 hover:text-teal-900"
        >
          <span className="inline-block w-3 text-center">{expanded ? '▾' : '▸'}</span>
          Sub-ítems{count > 0 ? ` (${count})` : ''}
        </button>
        {expanded && (
          <div className="mt-1.5 pl-4 border-l-2 border-teal-100">
            <SubItemsEditor
              item={item}
              itemNumero={itemNumero}
              presupuestoId={presupuestoId}
              onChangeSubItems={onChangeSubItems}
            />
          </div>
        )}
      </td>
    </tr>
  );
};
