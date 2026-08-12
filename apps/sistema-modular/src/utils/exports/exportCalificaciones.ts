import type { CalificacionProveedor } from '@ags/shared';
import { ORIGEN_CALIFICACION_LABELS } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Calificación de Proveedores (Excel + PDF vía ExportarButton).
 * Las pestañas del listado (Pendientes/Calificadas/Omitidas/Todas) muestran
 * columnas distintas; el export usa un set COMÚN que cubre todas: la columna
 * "Ciclo" identifica la etapa y Puntaje/Estado quedan vacíos en pendientes.
 * `fechaRecepcion` es YYYY-MM-DD y se exporta tal cual (igual que la tabla) —
 * pasarla por `new Date()` correría el día en UTC-3.
 */

const CICLO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', calificada: 'Calificada', omitida: 'Omitida',
};

const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Aprobado', condicional: 'Condicional', no_aprobado: 'No aprobado', sin_datos: 'Sin datos',
};

/** Mismo criterio que la columna "Detalle" de CalificacionesTable. */
const detalle = (c: CalificacionProveedor): string =>
  c.origenLabel
  || [c.ordenCompraNro && `OC ${c.ordenCompraNro}`, c.remitoNro && `Rto ${c.remitoNro}`].filter(Boolean).join(' · ');

export const CALIFICACIONES_EXPORT_COLUMNS: ExportColumn<CalificacionProveedor>[] = [
  { header: 'Fecha',       width: 11, get: c => c.fechaRecepcion },
  { header: 'Proveedor',   width: 26, get: c => c.proveedorNombre },
  { header: 'Origen',      width: 16, get: c => ORIGEN_CALIFICACION_LABELS[c.origen ?? 'manual'] },
  { header: 'Detalle',     width: 28, get: c => detalle(c) },
  { header: 'Ciclo',       width: 11, get: c => CICLO_LABELS[c.estadoCiclo ?? 'calificada'] },
  { header: 'Puntaje',     width: 9,  get: c => (typeof c.puntajeTotal === 'number' ? c.puntajeTotal : ''), align: 'center' },
  { header: 'Estado',      width: 13, get: c => (c.estado ? (ESTADO_LABELS[c.estado] ?? c.estado) : '') },
  { header: 'Responsable', width: 18, get: c => c.responsable || '' },
];
