import type { Articulo, PresupuestoItem } from '@ags/shared';
import { cambiarEnvase } from '../../utils/envasePresupuesto';

interface Props {
  item: PresupuestoItem;
  /** Artículo de stock de la línea (con sus presentaciones), si lo tiene. */
  articulo: Pick<Articulo, 'codigo' | 'descripcion' | 'presentaciones'> | null;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
}

/**
 * Celda de código de una línea del presupuesto (2026-10-01). Si el artículo
 * tiene presentaciones, se elige el envase como en OC y remitos: se ve el
 * código del envase, y cantidad y precio se convierten para comprometer las
 * mismas unidades base. Sin presentaciones, el código queda editable a mano.
 */
export function PresupuestoEnvaseCell({ item, articulo, onUpdateItem }: Props) {
  const envases = (articulo?.presentaciones ?? []).filter(p => p.activo !== false && p.factor > 1 && p.codigoParte);
  if (!articulo || envases.length === 0) {
    return (
      <input value={item.codigoProducto || ''} onChange={e => onUpdateItem(item.id, 'codigoProducto', e.target.value || null)}
        className="w-full outline-none bg-transparent text-xs text-slate-500" placeholder="Part #" />
    );
  }
  const elegir = (codigoParte: string) => {
    const p = envases.find(x => x.codigoParte === codigoParte) ?? null;
    const patch = cambiarEnvase(item, p, articulo);
    onUpdateItem(item.id, 'presentacion', patch.presentacion);
    onUpdateItem(item.id, 'descripcion', patch.descripcion);
    onUpdateItem(item.id, 'precioUnitario', patch.precioUnitario);
    onUpdateItem(item.id, 'cantidad', patch.cantidad);
  };
  return (
    <div title={item.presentacion ? `Envase ×${item.presentacion.factor} de ${item.codigoProducto}` : 'Unidad base'}>
      <select value={item.presentacion?.codigoParte ?? ''} onChange={e => elegir(e.target.value)}
        className="w-full outline-none bg-transparent text-xs font-mono text-slate-700 cursor-pointer">
        <option value="">{item.codigoProducto || articulo.codigo}</option>
        {envases.map(p => <option key={p.codigoParte} value={p.codigoParte}>{p.codigoParte} (×{p.factor})</option>)}
      </select>
      {item.presentacion && (
        <span className="block text-[9px] text-slate-400 font-mono">×{item.presentacion.factor} de {item.codigoProducto}</span>
      )}
    </div>
  );
}
