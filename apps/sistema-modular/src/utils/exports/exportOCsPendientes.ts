import type { Presupuesto, Cliente, UsuarioAGS } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import type { SinOCInfo } from '../presupuestosSinOC';

/**
 * Export de OCs Pendientes (modo `ocPendiente` de PresupuestosList),
 * Excel + PDF vía ExportarButton.
 */
export interface OCPendienteExportRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  /** Primer OC del array (o 'N/A' si no hay cargada pero el filter la marco como pendiente). */
  ocNumero: string;
  /** ISO del primer OC recibido (o null si no hay). */
  ocFecha: string | null;
  /** Count de adjuntos (OC PDF + otros). */
  adjuntosCount: number;
  /** Dias desde createdAt del primer OC (o desde estado='aceptado' si no hay OC aun). */
  diasDesdeCarga: number;
  coordinadorNombre: string;
  /** Seguimiento de la OC (2026-09-18): desde cuándo está aprobado y desde cuándo se hizo el trabajo. */
  fechaAceptacion: string | null;
  diasSinOC: number | null;
  otsCerradas: string;
  fechaPrimerCierre: string | null;
  diasDesdeCierre: number | null;
}

export function buildOCPendienteRows(
  rows: Presupuesto[], clientes: Cliente[], usuarios: UsuarioAGS[], sinOC?: Map<string, SinOCInfo>,
): OCPendienteExportRow[] {
  return rows.map(p => ({
    fechaAceptacion: sinOC?.get(p.id)?.fechaAceptacion ?? p.fechaAceptacion ?? null,
    diasSinOC: sinOC?.get(p.id)?.diasSinOC ?? null,
    otsCerradas: (sinOC?.get(p.id)?.otsCerradas ?? []).join(', '),
    fechaPrimerCierre: sinOC?.get(p.id)?.fechaPrimerCierre ?? null,
    diasDesdeCierre: sinOC?.get(p.id)?.diasDesdeCierre ?? null,
    presupuesto: p,
    clienteNombre: clientes.find(c => c.id === p.clienteId)?.razonSocial || '—',
    ocNumero: 'N/A',
    ocFecha: null,
    adjuntosCount: (p.adjuntos || []).length,
    diasDesdeCarga: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86_400_000),
    coordinadorNombre: usuarios.find(u => u.id === p.responsableId)?.displayName || p.responsableNombre || '—',
  }));
}

// 8 columnas per CONTEXT FMT-05 — mismas que el export previo a la unificación.
export const OCS_PENDIENTES_EXPORT_COLUMNS: ExportColumn<OCPendienteExportRow>[] = [
  { header: 'Numero OC',            width: 14, get: r => r.ocNumero },
  { header: 'Cliente',              width: 28, get: r => r.clienteNombre },
  { header: 'Presupuesto(s)',       width: 16, get: r => r.presupuesto.numero },
  { header: 'Fecha OC',             width: 10, get: r => fmtDateShort(r.ocFecha) },
  { header: 'Estado ppto',          width: 14, get: r => ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado] || r.presupuesto.estado },
  { header: 'Adjuntos',             width: 8,  get: r => r.adjuntosCount, align: 'center' },
  { header: 'Dias desde carga',     width: 14, get: r => r.diasDesdeCarga, align: 'right' },
  { header: 'Aprobado',             width: 10, get: r => fmtDateShort(r.fechaAceptacion) },
  { header: 'Dias sin OC',          width: 11, get: r => r.diasSinOC ?? '', align: 'right' },
  { header: 'OT cerradas',          width: 16, get: r => r.otsCerradas },
  { header: 'Primer cierre tecnico', width: 12, get: r => fmtDateShort(r.fechaPrimerCierre) },
  { header: 'Dias desde cierre',    width: 12, get: r => r.diasDesdeCierre ?? '', align: 'right' },
  { header: 'Coordinador asignado', width: 20, get: r => r.coordinadorNombre },
];
