import type { Presupuesto, Cliente, UsuarioAGS } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Presupuestos (Excel + PDF vía ExportarButton).
 * Las filas se arman desde el array YA filtrado de PresupuestosList; los
 * nombres de cliente/responsable se resuelven acá para no duplicar lookups.
 */
export interface PresupuestoExportRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  responsableNombre: string;
}

export function buildPresupuestoRows(
  rows: Presupuesto[], clientes: Cliente[], usuarios: UsuarioAGS[],
): PresupuestoExportRow[] {
  return rows.map(p => ({
    presupuesto: p,
    clienteNombre: clientes.find(c => c.id === p.clienteId)?.razonSocial || '—',
    responsableNombre: usuarios.find(u => u.id === p.responsableId)?.displayName || p.responsableNombre || '—',
  }));
}

// 12 columnas per CONTEXT FMT-04 — mismas que el export previo a la unificación.
export const PRESUPUESTOS_EXPORT_COLUMNS: ExportColumn<PresupuestoExportRow>[] = [
  { header: 'Numero',         width: 15, get: r => r.presupuesto.numero },
  { header: 'Cliente',        width: 28, get: r => r.clienteNombre },
  { header: 'Tipo',           width: 10, get: r => TIPO_PRESUPUESTO_LABELS[r.presupuesto.tipo] || r.presupuesto.tipo },
  { header: 'Estado',         width: 14, get: r => ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado] || r.presupuesto.estado },
  { header: 'Total',          width: 12, get: r => r.presupuesto.total ?? 0, align: 'right' },
  { header: 'Moneda',         width: 8,  get: r => r.presupuesto.moneda },
  { header: 'Responsable',    width: 20, get: r => r.responsableNombre },
  { header: 'Creado',         width: 10, get: r => fmtDateShort(r.presupuesto.createdAt) },
  { header: 'Enviado',        width: 10, get: r => fmtDateShort(r.presupuesto.fechaEnvio ?? null) },
  { header: 'Validez (dias)', width: 10, get: r => r.presupuesto.validezDias ?? '' },
  { header: 'OCs vinculadas', width: 14, get: r => (r.presupuesto.ordenesCompraIds || []).length, align: 'center' },
  { header: 'Prox. contacto', width: 12, get: r => fmtDateShort((r.presupuesto as unknown as Record<string, string | null | undefined>)['proximoContacto']) },
];

/** Labels legibles de las cards KPI cuando actúan como filtro (drill-down). */
const KPI_LABELS: Record<string, string> = {
  enviados: 'Enviados',
  aceptados: 'Aceptados',
  fact_pendientes: 'Enviadas a facturación',
  pend_cobro: 'Pendientes de cobro',
  pendiente_aviso: 'OT cerrada — falta aviso',
};

/** Línea "Filtros: …" del export — refleja los filtros activos de PresupuestosList. */
export function buildPresupuestosFiltrosExport(
  f: {
    vista: string; cliente: string; estado: string; tipo: string; responsable: string;
    fechaDesde: string; fechaHasta: string; search: string;
    ocPendiente: boolean; ocTrabajoRealizado: boolean; kpi: string;
  },
  clientes: Cliente[], usuarios: UsuarioAGS[],
): string[] {
  return filtrosAplicadosDesc({
    Pestaña: f.vista === 'contratos' ? 'Contratos' : '',
    Cliente: clientes.find(c => c.id === f.cliente)?.razonSocial,
    Estado: f.estado === 'borrador_enviado'
      ? 'Borrador + Enviado + Pend. OC'
      : (ESTADO_PRESUPUESTO_LABELS[f.estado as keyof typeof ESTADO_PRESUPUESTO_LABELS] ?? f.estado),
    Tipo: f.tipo ? (TIPO_PRESUPUESTO_LABELS[f.tipo as keyof typeof TIPO_PRESUPUESTO_LABELS] ?? f.tipo) : '',
    Responsable: usuarios.find(u => u.id === f.responsable)?.displayName,
    Desde: f.fechaDesde,
    Hasta: f.fechaHasta,
    'Búsqueda': f.search ? `'${f.search}'` : '',
    Card: f.kpi ? (KPI_LABELS[f.kpi] ?? f.kpi) : '',
    'OCs pendientes': f.ocPendiente,
    'Solo trabajo realizado': f.ocTrabajoRealizado,
  });
}
