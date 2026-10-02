import type { Articulo, ItemOC, PresupuestoItem } from '@ags/shared';
import { cambiarEnvase } from '../../utils/envasePresupuesto';

interface Props {
  item: ItemOC;
  /** Artículo de la línea con sus presentaciones, si las tiene. */
  articulo: Pick<Articulo, 'descripcion' | 'presentaciones'> | null;
  onUpdate: (itemId: string, field: keyof ItemOC, value: unknown) => void;
}

/**
 * Código de una línea de OC con selector de envase (2026-10-02). Las líneas que
 * llegan desde requerimientos vienen en unidades base y no había cómo pasarlas
 * al envase con el que se compra: el PDF salía con el N° de parte del base.
 * Cambiar el envase convierte cantidad y precio (mismas unidades base, mismo
 * importe); el cruce con requerimientos ya cuenta en unidades base.
 */
export function OCEnvaseCell({ item, articulo, onUpdate }: Props) {
  const envases = (articulo?.presentaciones ?? []).filter(p => p.activo !== false && p.factor > 1 && p.codigoParte);
  if (!articulo || envases.length === 0) {
    return <>{item.presentacion?.codigoParte || item.articuloCodigo || '—'}</>;
  }
  const elegir = (codigoParte: string) => {
    const p = envases.find(x => x.codigoParte === codigoParte) ?? null;
    const patch = cambiarEnvase(
      { cantidad: item.cantidad, precioUnitario: item.precioUnitario ?? 0, descripcion: item.descripcion, presentacion: item.presentacion ?? null } as Pick<PresupuestoItem, 'cantidad' | 'precioUnitario' | 'descripcion'>,
      p, articulo,
    );
    onUpdate(item.id, 'presentacion', patch.presentacion);
    onUpdate(item.id, 'descripcion', patch.descripcion);
    onUpdate(item.id, 'cantidad', patch.cantidad);
    if (item.precioUnitario != null) onUpdate(item.id, 'precioUnitario', patch.precioUnitario);
  };
  return (
    <select value={item.presentacion?.codigoParte ?? ''} onChange={e => elegir(e.target.value)}
      title="Envase con el que se compra (el stock entra al artículo base)"
      className="w-full outline-none bg-transparent text-xs font-mono text-slate-600 cursor-pointer">
      <option value="">{item.articuloCodigo || 'Unidad base'}</option>
      {envases.map(p => <option key={p.codigoParte} value={p.codigoParte}>{p.codigoParte} (×{p.factor})</option>)}
    </select>
  );
}
