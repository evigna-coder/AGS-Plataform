import type { Articulo, ItemImportacion, ItemOC, PresentacionUsada } from '@ags/shared';
import { baseDePresentacion } from './articuloSearch';

/**
 * Normaliza un ítem de importación contra el catálogo antes de ingresarlo
 * (2026-09-16, caso OC con vials y caps): el ítem puede venir
 *  - con el N° de parte de una PRESENTACIÓN como código de artículo y sin
 *    vínculo al artículo base (5190-4049 en vez de 5182-0717 ×50), o
 *  - con el artículo base pero sin el envase con que se compró, que la OC sí
 *    tiene (5182-0714 comprado como 5183-2067).
 * Todo entra al stock en su unidad mínima: el ítem sale apuntando al artículo
 * BASE con la presentación completa. Lo que no se pueda resolver queda igual.
 */
export function resolverItemImportacion(
  it: ItemImportacion,
  catalogo: Articulo[],
  ocItem?: Pick<ItemOC, 'presentacion'> | null,
): ItemImportacion {
  let presentacion: PresentacionUsada | null = it.presentacion ?? ocItem?.presentacion ?? null;
  const codigo = (it.articuloCodigo ?? '').trim();
  const porId = it.articuloId ? catalogo.find(a => a.id === it.articuloId) ?? null : null;

  // El código del ítem es un envase de algún artículo → base + envase. Gana
  // sobre el vínculo por id: el catálogo todavía tiene el duplicado suelto
  // (5183-2068 como artículo propio Y como envase del 5182-0715) y la OC lo
  // suele apuntar; el stock tiene que entrar al base en unidad mínima.
  const viaEnvase = codigo ? baseDePresentacion(catalogo, codigo) : null;
  let base: Articulo | null = viaEnvase ? viaEnvase.base : porId;
  if (!base && codigo) base = catalogo.find(a => (a.codigo ?? '').trim().toLowerCase() === codigo.toLowerCase()) ?? null;
  if (!base) return it;

  if (!presentacion) {
    // Código del ítem = envase del artículo base (con o sin vínculo por id).
    const p = (base.presentaciones ?? []).find(x => x.activo !== false && x.factor > 0
      && x.codigoParte.trim().toLowerCase() === codigo.toLowerCase());
    if (p) presentacion = { codigoParte: p.codigoParte, factor: p.factor };
    else if (viaEnvase && viaEnvase.base.id === base.id) presentacion = { codigoParte: codigo, factor: viaEnvase.factor };
  }

  const cambia = base.id !== it.articuloId || base.codigo !== it.articuloCodigo
    || (presentacion?.codigoParte ?? null) !== (it.presentacion?.codigoParte ?? null);
  if (!cambia) return it;
  return { ...it, articuloId: base.id, articuloCodigo: base.codigo, presentacion };
}

export function resolverItemsImportacion(
  items: ItemImportacion[],
  catalogo: Articulo[],
  ocItems?: ItemOC[] | null,
): ItemImportacion[] {
  const ocById = new Map((ocItems ?? []).map(o => [o.id, o]));
  return items.map(it => resolverItemImportacion(it, catalogo, it.itemOCId ? ocById.get(it.itemOCId) ?? null : null));
}
