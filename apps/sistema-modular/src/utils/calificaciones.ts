import type { CalificacionProveedor } from '@ags/shared';

/**
 * Helpers de display para Calificación de Proveedores (2026-08-28).
 *
 * Los embarques generan una calificación POR ACTOR (vendedor / agente de carga /
 * despachante) con `origenLabel` tipo "Importación IMP-0002 — vendedor". El
 * negocio no maneja el número de importación: lo que identifica el evento es la
 * ORDEN DE COMPRA — estos helpers muestran la OC y derivan el rol del label,
 * cubriendo también los docs viejos (el `ordenCompraNro` está denormalizado
 * desde el disparador).
 */

/** Rol del actor ("vendedor" / "agente de carga" / "despachante") parseado del origenLabel. */
export function rolCalificacion(c: Pick<CalificacionProveedor, 'origenLabel'>): string | null {
  const l = c.origenLabel ?? '';
  const i = l.lastIndexOf('—');
  return i >= 0 ? (l.slice(i + 1).trim() || null) : null;
}

/** Detalle humano del evento — para embarques usa la OC en lugar del número de importación. */
export function detalleCalificacion(c: CalificacionProveedor): string {
  if ((c.origen ?? 'manual') === 'importacion_embarque' && c.ordenCompraNro) {
    const rol = rolCalificacion(c);
    return `OC ${c.ordenCompraNro}${rol ? ` — ${rol}` : ''}`;
  }
  return c.origenLabel
    || [c.ordenCompraNro && `OC ${c.ordenCompraNro}`, c.remitoNro && `Rto ${c.remitoNro}`].filter(Boolean).join(' · ');
}

/** Label del EVENTO sin el rol — encabezado del grupo en el listado. */
export function eventoCalificacion(c: CalificacionProveedor): string {
  if ((c.origen ?? 'manual') === 'importacion_embarque') {
    if (c.ordenCompraNro) return `OC ${c.ordenCompraNro}`;
    const l = c.origenLabel ?? '';
    const i = l.lastIndexOf('—');
    return i >= 0 ? l.slice(0, i).trim() : l;
  }
  return detalleCalificacion(c);
}
