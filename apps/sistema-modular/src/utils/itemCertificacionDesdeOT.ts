import type { Establecimiento, ItemCertificacion, MovimientoStock, WorkOrder } from '@ags/shared';
import { partesDeConsumos } from './partesDeConsumosOT';

/**
 * Línea de certificación armada desde la OT (2026-09-23). Es lo que ve el
 * cliente en el resumen: establecimiento, equipo, servicio, fecha y partes.
 * Una sola implementación para el pedido por lote y para el registro directo
 * del papel: el directo guardaba solo el número de OT y el PDF salía con
 * guiones en todas las columnas (caso YPF 30061/30062/30331).
 */
export function itemCertificacionDesdeOT(
  ot: Pick<WorkOrder, 'otNumber' | 'establecimientoId' | 'sistema' | 'moduloSerie' | 'codigoInternoCliente' | 'tipoServicio' | 'fechaInicio' | 'fechaServicioAprox'>,
  establecimientos: Array<Pick<Establecimiento, 'id' | 'nombre'>>,
  consumos: MovimientoStock[],
  estado: ItemCertificacion['estado'] = 'pendiente',
): ItemCertificacion {
  return {
    otNumber: ot.otNumber,
    estado,
    establecimientoNombre: establecimientos.find(e => e.id === ot.establecimientoId)?.nombre ?? '',
    equipo: [ot.sistema, ot.moduloSerie ? `S/N ${ot.moduloSerie}` : null].filter(Boolean).join(' · '),
    equipoId: ot.codigoInternoCliente || '',
    descripcionServicio: ot.tipoServicio || '',
    fechaServicio: (ot.fechaInicio || ot.fechaServicioAprox || '').slice(0, 10) || null,
    partes: partesDeConsumos(consumos),
  };
}
