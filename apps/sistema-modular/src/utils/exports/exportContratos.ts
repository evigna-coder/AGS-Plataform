import type { Contrato, EstadoContrato } from '@ags/shared';
import { ESTADO_CONTRATO_LABELS, TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Contratos (Excel + PDF vía ExportarButton).
 * Opera directo sobre `Contrato` — cliente y presupuesto ya vienen denormalizados.
 */
export function buildContratosFiltrosExport(
  filters: { search: string; cliente: string; estado: string },
  clienteNombre: string | undefined,
): string[] {
  return filtrosAplicadosDesc({
    Cliente: clienteNombre,
    Estado: filters.estado ? (ESTADO_CONTRATO_LABELS[filters.estado as EstadoContrato] ?? filters.estado) : '',
    'Búsqueda': filters.search ? `'${filters.search}'` : '',
  });
}

export const CONTRATOS_EXPORT_COLUMNS: ExportColumn<Contrato>[] = [
  { header: 'Número',      width: 14, get: c => c.numero },
  { header: 'Cliente',     width: 30, get: c => c.clienteNombre },
  { header: 'Inicio',      width: 10, get: c => fmtDateShort(c.fechaInicio) },
  { header: 'Fin',         width: 10, get: c => fmtDateShort(c.fechaFin) },
  { header: 'Tipo límite', width: 14, get: c => TIPO_LIMITE_CONTRATO_LABELS[c.tipoLimite] || c.tipoLimite },
  { header: 'Visitas',     width: 10, get: c => c.tipoLimite === 'visitas' && c.maxVisitas !== null ? `${c.visitasUsadas}/${c.maxVisitas}` : '', align: 'center' },
  { header: 'Servicios',   width: 10, get: c => c.serviciosIncluidos.length, align: 'right' },
  { header: 'Estado',      width: 12, get: c => ESTADO_CONTRATO_LABELS[c.estado] || c.estado },
  { header: 'Presupuesto', width: 16, get: c => c.presupuestoNumero || '' },
];
