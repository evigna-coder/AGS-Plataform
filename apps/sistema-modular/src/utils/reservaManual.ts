import { cantidadEnUnidadBase } from '@ags/shared';
import type { PresentacionUsada } from '@ags/shared';

export interface ArticuloAReservar {
  articuloId: string;
  descripcion: string;
  /** Unidades BASE que pide el presupuesto para este artículo (todas sus líneas). */
  necesaria: number;
}

/**
 * Artículos de stock de un presupuesto para el botón "Reservar stock"
 * (2026-10-01): uno por artículo aunque aparezca en varias líneas, con lo que
 * piden en unidades base ("2 kits de 10" = 20).
 */
export function articulosAReservar(items: Array<{
  stockArticuloId?: string | null;
  descripcion: string;
  cantidad?: number | null;
  presentacion?: PresentacionUsada | null;
}>): ArticuloAReservar[] {
  const porArticulo = new Map<string, ArticuloAReservar>();
  for (const i of items) {
    if (!i.stockArticuloId) continue;
    const base = cantidadEnUnidadBase(i.cantidad || 0, i.presentacion ?? null);
    const prev = porArticulo.get(i.stockArticuloId);
    if (prev) prev.necesaria += base;
    else porArticulo.set(i.stockArticuloId, { articuloId: i.stockArticuloId, descripcion: i.descripcion, necesaria: base });
  }
  return [...porArticulo.values()];
}
