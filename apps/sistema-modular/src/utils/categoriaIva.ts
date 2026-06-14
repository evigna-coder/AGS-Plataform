import type { CategoriaPresupuesto } from '@ags/shared';

/**
 * Categoría tributaria por defecto para items nuevos de presupuesto: IVA 21% estándar.
 *
 * Busca primero por porcentaje (IVA 21% sin reducción) — robusto ante renombres del
 * catálogo. Fallback al nombre "IVA 21%" (convención preexistente en AddItemModal).
 * Devuelve `undefined` si el catálogo no tiene una categoría 21% activa (el item queda
 * "Sin categoría", como antes — sin romper nada).
 */
export function findCategoriaIvaDefaultId(cats: CategoriaPresupuesto[]): string | undefined {
  const activas = cats.filter(c => c.activo);
  const porPorcentaje = activas.find(c => c.incluyeIva && c.porcentajeIva === 21 && !c.ivaReduccion);
  if (porPorcentaje) return porPorcentaje.id;
  const porNombre = activas.find(c => c.nombre.trim().toLowerCase() === 'iva 21%');
  return porNombre?.id;
}
