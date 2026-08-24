import { softwareDeDispositivo } from '@ags/shared';
import type { Dispositivo, TipoDispositivo } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';

/**
 * Export de Dispositivos (Excel + PDF vía ExportarButton).
 * TIPO_DISPOSITIVO_LABELS vive acá; DispositivosList lo importa para que la
 * tabla y el export usen los mismos labels.
 */

export const TIPO_DISPOSITIVO_LABELS: Record<TipoDispositivo, string> = {
  celular: 'Celular',
  computadora: 'Computadora',
  tablet: 'Tablet',
  otro: 'Otro',
};

export const DISPOSITIVOS_EXPORT_COLUMNS: ExportColumn<Dispositivo>[] = [
  { header: 'Tipo',        width: 13, get: d => TIPO_DISPOSITIVO_LABELS[d.tipo] || d.tipo },
  { header: 'Marca',       width: 15, get: d => d.marca },
  { header: 'Modelo',      width: 20, get: d => d.modelo },
  { header: 'Serie',       width: 20, get: d => d.serie || '' },
  { header: 'Asignado a',  width: 22, get: d => d.asignadoANombre || '' },
  { header: 'Descripción', width: 30, get: d => d.descripcion || '' },
  // El software es el dato por el que se consulta el módulo: tiene que poder
  // salir en el Excel, una línea por producto (2026-08-23).
  { header: 'Software', width: 50, get: d => softwareDeDispositivo(d)
      .map(sw => `${sw.entorno}${sw.entornoTipo === 'virtual' ? ' (VM)' : ''}: ${sw.nombre}${sw.version ? ` ${sw.version}` : ''}`)
      .join(' | ') },
  { header: 'GPIB', width: 10, get: d => (d.tieneGPIB ? (d.gpibDetalle || 'Sí') : '') },
];
