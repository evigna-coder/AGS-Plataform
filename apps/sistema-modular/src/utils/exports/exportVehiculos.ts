import type { Vehiculo } from '@ags/shared';
import { formatFechaAR } from '../formatFecha';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Vehículos (Excel + PDF vía ExportarButton).
 * La página renderiza cards, pero cada card es un vehículo — el export es una
 * fila por vehículo con sus vencimientos resumidos en una columna.
 */

export const VEHICULOS_EXPORT_COLUMNS: ExportColumn<Vehiculo>[] = [
  { header: 'Patente',      width: 11, get: v => v.patente },
  { header: 'Marca',        width: 14, get: v => v.marca || '' },
  { header: 'Modelo',       width: 16, get: v => v.modelo || '' },
  { header: 'Año',          width: 7,  get: v => v.anio ?? null, align: 'right' },
  { header: 'Asignado a',   width: 20, get: v => v.asignadoA || '' },
  { header: 'Km actual',    width: 11, get: v => v.kmActual ?? null, align: 'right' },
  { header: 'Vencimientos', width: 38, get: v =>
      v.vencimientos.map(vc => `${vc.tipo}: ${vc.fecha ? formatFechaAR(vc.fecha) : '—'}`).join('; ') },
];
