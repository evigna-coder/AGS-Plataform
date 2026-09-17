import type { ComponenteRequerimiento, PresupuestoItem } from '@ags/shared';

/**
 * Sub-ítems de un ítem de presupuesto como componentes del requerimiento
 * (2026-09-16). Los presupuestos de venta de equipos cargan un artículo
 * principal (el que genera el requerimiento y la OC) con un desglose de
 * sub-ítems; ese desglose acompaña al requerimiento y a la línea de la OC
 * para que el proveedor lo vea. null si el ítem no tiene sub-ítems.
 */
export function componentesDeItem(item: Pick<PresupuestoItem, 'subItems'> | null | undefined): ComponenteRequerimiento[] | null {
  const subs = (item?.subItems ?? []).filter(s => (s.descripcion || '').trim() || (s.codigo || '').trim());
  if (subs.length === 0) return null;
  return subs.map(s => ({
    codigo: (s.codigo || '').trim() || null,
    descripcion: (s.descripcion || '').trim(),
    cantidad: s.cantidad > 0 ? s.cantidad : 1,
  }));
}
