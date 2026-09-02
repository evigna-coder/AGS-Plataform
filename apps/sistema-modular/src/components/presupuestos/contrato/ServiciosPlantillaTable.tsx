import type { PresupuestoItem } from '@ags/shared';

interface Props {
  servicios: PresupuestoItem[];
  /** Cuántos equipos van a recibir esta misma lista. */
  cantidadEquipos: number;
  onUpdate: (itemId: string, field: 'precioUnitario' | 'cantidad', value: number) => void;
  onRemove: (itemId: string) => void;
}

/**
 * Servicios cargados para la tanda: se tipean UNA vez y se replican a cada
 * equipo seleccionado (2026-09-02). El subtotal mostrado ya contempla la
 * replicación, para que no sorprenda el total del contrato al confirmar.
 */
export function ServiciosPlantillaTable({ servicios, cantidadEquipos, onUpdate, onRemove }: Props) {
  if (servicios.length === 0) return null;

  const porEquipo = servicios.reduce((s, i) => s + (i.subtotal || 0), 0);
  const total = porEquipo * Math.max(cantidadEquipos, 1);
  const replica = cantidadEquipos > 1;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-teal-50/60 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700">
          Servicios · {servicios.length}{replica ? ` × ${cantidadEquipos} equipos` : ''}
        </span>
        <span className="text-[10px] font-mono text-teal-700 font-semibold">
          {replica && (
            <span className="font-normal text-teal-600 mr-2">
              {porEquipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })} c/equipo
            </span>
          )}
          Subtotal {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {servicios.map((item, i) => (
            <tr key={item.id} className="border-t border-slate-100 first:border-0">
              <td className="px-2 py-1 text-slate-400 font-mono text-[10px] w-10">{i + 1}</td>
              <td className="px-2 py-1 text-slate-500 font-mono text-[10px] w-32 truncate">{item.codigoProducto}</td>
              <td className="px-2 py-1 text-slate-700">{item.descripcion}</td>
              <td className="px-2 py-1 w-16">
                <input type="number" min="0" value={item.cantidad}
                  onChange={e => onUpdate(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                  className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
              </td>
              <td className="px-2 py-1 w-24">
                <input type="number" min="0" step="any" value={item.precioUnitario || ''}
                  onChange={e => onUpdate(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-20 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
              </td>
              <td className="px-2 py-1 w-8 text-center">
                <button onClick={() => onRemove(item.id)}
                  className="text-red-400 hover:text-red-600 text-sm leading-none" title="Quitar">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
