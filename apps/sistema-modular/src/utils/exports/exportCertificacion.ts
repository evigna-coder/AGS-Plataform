import type { ItemCertificacion } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Columnas del resumen de certificación que se le manda al cliente
 * (2026-08-17).
 *
 * Las mismas cuatro que pidió el usuario, en el orden en que se leen: dónde se
 * hizo, qué OT lo respalda, sobre qué equipo y qué se hizo. Sirven para el PDF
 * y para el Excel, que es el que se copia y se pega en el cuerpo de un mail.
 *
 * A propósito NO incluyen estado, motivo ni nada interno: este documento sale
 * de la empresa y lo firma el cliente.
 */
export const CERTIFICACION_EXPORT_COLUMNS: ExportColumn<ItemCertificacion>[] = [
  { header: 'Establecimiento', get: i => i.establecimientoNombre || '—', width: 26 },
  { header: 'N° de OT', get: i => i.otNumber, width: 14 },
  { header: 'Equipo', get: i => i.equipo || '—', width: 30 },
  { header: 'Servicio realizado', get: i => i.descripcionServicio || '—', width: 44 },
  { header: 'Fecha', get: i => (i.fechaServicio || '').slice(0, 10) || '—', width: 12 },
];
