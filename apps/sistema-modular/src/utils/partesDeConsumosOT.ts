import type { MovimientoStock, ParteCertificada } from '@ags/shared';

/**
 * Partes a declarar en la certificación a partir de los consumos de stock de
 * una OT (2026-09-07): un renglón por artículo, cantidades sumadas. Las
 * devoluciones (cantidad negativa o tipo 'devolucion') descuentan.
 */
export function partesDeConsumos(movs: MovimientoStock[]): ParteCertificada[] {
  const porCodigo = new Map<string, ParteCertificada>();
  for (const m of movs) {
    if (m.tipo !== 'consumo' && m.tipo !== 'devolucion') continue;
    const codigo = (m.articuloCodigo || '').trim();
    const key = codigo || m.articuloId || m.articuloDescripcion;
    if (!key) continue;
    const signo = m.tipo === 'devolucion' ? -1 : 1;
    const prev = porCodigo.get(key);
    if (prev) prev.cantidad += signo * Math.abs(m.cantidad);
    else porCodigo.set(key, { codigo, descripcion: m.articuloDescripcion || '', cantidad: signo * Math.abs(m.cantidad) });
  }
  return [...porCodigo.values()].filter(p => p.cantidad > 0);
}
