import type { Articulo } from '@ags/shared';
import { matchesSearch } from './searchTerms';

/**
 * Búsqueda de artículos que TAMBIÉN matchea los N° de parte de sus
 * presentaciones (2026-08-13, Fase 1 del plan presentaciones-de-compra).
 *
 * Un mismo producto se compra y se vende con distintos códigos según el envase
 * —"vial x100" es 5182-0714 y "vial x1000" es 5183-2067—, pero el stock vive en
 * UN solo artículo base. Sin esto, quien tipea el código del envase grande no
 * encuentra nada y termina dando de alta un artículo duplicado, que es
 * exactamente el lío que hay que deshacer.
 *
 * El listado de artículos ya lo hacía; los buscadores de presupuesto, OC y
 * planificación no.
 */
export function articuloMatchesSearch(
  query: string,
  articulo: Pick<Articulo, 'codigo' | 'descripcion'> & { presentaciones?: { codigoParte: string }[] | null },
): boolean {
  return matchesSearch(
    query,
    articulo.codigo,
    articulo.descripcion,
    ...(articulo.presentaciones ?? []).map(p => p.codigoParte),
  );
}

/**
 * Etiqueta del envase cuyo código matcheó la búsqueda, para que quede claro por
 * qué apareció ese artículo: "vía 5183-2067 ×10". null si matcheó por el código
 * base o por la descripción.
 */
export function presentacionQueMatchea(
  query: string,
  articulo: Pick<Articulo, 'codigo' | 'descripcion'> & { presentaciones?: { codigoParte: string; factor: number }[] | null },
): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if ((articulo.codigo ?? '').toLowerCase().includes(q)) return null;
  const p = (articulo.presentaciones ?? []).find(x => x.codigoParte.toLowerCase().includes(q));
  return p ? `${p.codigoParte} ×${p.factor}` : null;
}
