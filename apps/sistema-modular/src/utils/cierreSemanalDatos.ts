import type { CierreSemanalDatos, CierreSemanalFilaFacturacion, CierreSemanalFilaOT, CierreSemanalFilaPresupuesto, CierreSemanalResumen, Presupuesto, WorkOrder } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, MONEDA_SIMBOLO, OT_ESTADO_LABELS, SOLICITUD_FACTURACION_ESTADO_LABELS } from '@ags/shared';
import type { AgendaControlRow, FacturacionControlRow, OTArrastreRow, PresupuestoControlRow } from '../hooks/useControlSemanal';

export const ESTADO_CONTROL_LABEL: Record<string, string> = {
  cerrada: 'Cierre admin',
  sin_cierre_admin: 'Sin cierre admin',
  sin_realizar: 'Sin realizar',
  ot_no_encontrada: 'OT no encontrada',
};

/** Mismo texto que la columna "Qué falta" de la pantalla (PresupuestosControlTabla). */
export function queFaltaTexto(row: PresupuestoControlRow): string[] {
  if (row.facturadoEstaSemana) return ['Facturado esta semana'];
  if (row.avisoEnviado) return ['Aviso enviado'];
  const items: string[] = [];
  if (row.avisoParcialPct != null) items.push(`Aviso PARCIAL: ${row.avisoParcialPct}% pasado a facturar, falta el ${Math.max(0, 100 - row.avisoParcialPct)}%`);
  if (row.pagoAnticipado) items.push('Pago anticipado: se factura antes del servicio');
  if (row.sinAceptar) items.push('OT realizada con presupuesto sin aceptar: completar precios y aceptarlo');
  if (row.sinOtAgendada) {
    items.push(row.otsSinAgendar.length > 0
      ? `OT creada sin agendar: ${row.otsSinAgendar.map(n => `OT-${n}`).join(', ')}`
      : 'Sin OT creada: crear la OT o entregar las partes');
  }
  if (row.entregasPendientes.length > 0) items.push(`Entrega de partes pendiente: ${row.entregasPendientes.map(n => `OT-${n}`).join(', ')}`);
  if (row.agendadaOtraSemana) items.push(`Agendada para el ${row.agendadaOtraSemana.split('-').reverse().join('/')}`);
  if (row.otsEnSemana.length > 0) items.push(`Agendada esta semana: ${row.otsEnSemana.map(n => `OT-${n}`).join(', ')}`);
  if (row.otsPendientes.length > 0) {
    items.push(`Pendiente cierre: ${row.otsPendientes.map(o => `${o.otNumber} (${o.estadoAdmin ? OT_ESTADO_LABELS[o.estadoAdmin] : 'Sin estado'})`).join(', ')}`);
  }
  if (row.sinOC) items.push('Pendiente OC del cliente');
  if (row.listoParaAviso) items.push('Listo: falta generar el aviso');
  return items;
}

const fmtMonto = (moneda: string | null | undefined, monto: number | null | undefined) =>
  `${MONEDA_SIMBOLO[(moneda || 'USD') as keyof typeof MONEDA_SIMBOLO] || moneda || '$'} ${(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Fecha a 'YYYY-MM-DD' tolerando string ISO, Date o Timestamp de Firestore (las OTs viejas traen Timestamp). */
const diaDe = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v instanceof Date ? v : (v as { toDate?: () => Date }).toDate?.();
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
};

const nombreCliente = (ot: WorkOrder | null | undefined, establecimiento?: string | null) =>
  `${ot?.razonSocial ?? ''}${establecimiento ? ` (${establecimiento})` : ''}`;

export interface EntradasCierreSemanal {
  agendaRows: AgendaControlRow[];
  otsArrastre: OTArrastreRow[];
  entregasPendientes: WorkOrder[];
  establecimientoPorOT: Map<string, string | null>;
  presupuestoPorNumero: Map<string, Presupuesto>;
  presupuestoRows: PresupuestoControlRow[];
  facturacionRows: FacturacionControlRow[];
  agendaKpis: { agendadas: number; cerradas: number; sinCierreAdmin: number; sinRealizar: number };
  presupuestoKpis: { conTrabajo: number; listosSinAviso: number; sinOC: number; arrastre: number };
  facturacionKpis: { sinFacturar: number; facturadasSemana: number; montoSinFacturar: Record<string, number> };
}

/**
 * La FOTO del control semanal (2026-09-09): lo que se ve en pantalla, pasado
 * a filas planas y serializables. Se guarda en el doc del cierre para poder
 * releerla aunque las OTs y presupuestos hayan cambiado después.
 */
export function armarCierreSemanal(e: EntradasCierreSemanal): { datos: CierreSemanalDatos; resumen: CierreSemanalResumen } {
  const filaOT = (r: AgendaControlRow | OTArrastreRow): CierreSemanalFilaOT => {
    const esAgenda = 'entry' in r;
    const otNumber = esAgenda ? r.entry.otNumber : r.ot.otNumber;
    return {
      otNumber,
      cliente: esAgenda ? `${r.entry.clienteNombre}${r.establecimientoNombre ? ` (${r.establecimientoNombre})` : ''}` : nombreCliente(r.ot, r.establecimientoNombre),
      ingeniero: esAgenda ? r.ingenieros.join(', ') : (r.ot.ingenieroAsignadoNombre ?? ''),
      fecha: esAgenda ? r.entry.fechaInicio : (r.fechaAgenda ?? ''),
      servicio: (esAgenda ? r.entry.tipoServicio : r.ot.tipoServicio) ?? '',
      estado: ESTADO_CONTROL_LABEL[r.estado] ?? r.estado,
      diasTrabado: r.diasTrabado,
      motivos: r.motivos,
    };
  };
  const ots = e.agendaRows.map(filaOT);
  const otsArrastre = e.otsArrastre.map(filaOT);
  const entregas = e.entregasPendientes.map(ot => ({
    otNumber: ot.otNumber,
    cliente: nombreCliente(ot, e.establecimientoPorOT.get(ot.otNumber)),
    servicio: ot.tipoServicio ?? '',
    presupuestos: ot.budgets ?? [],
    valor: (ot.budgets ?? []).map(n => { const p = e.presupuestoPorNumero.get(n); return p ? fmtMonto(p.moneda, p.total) : ''; }).filter(Boolean).join(' · '),
    estado: ot.estadoAdmin ? OT_ESTADO_LABELS[ot.estadoAdmin] ?? ot.estadoAdmin : '',
    creada: diaDe(ot.createdAt),
  }));
  const presupuestos: CierreSemanalFilaPresupuesto[] = e.presupuestoRows.map(r => ({
    numero: r.presupuesto.numero,
    cliente: `${r.clienteNombre}${r.establecimientoNombre ? ` (${r.establecimientoNombre})` : ''}`,
    total: fmtMonto(r.presupuesto.moneda, r.presupuesto.total),
    estado: ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado] ?? r.presupuesto.estado,
    diasTrabado: r.diasTrabado,
    queFalta: queFaltaTexto(r),
    comentario: r.presupuesto.comentarioControlSemanal ?? null,
    arrastre: r.arrastre,
  }));
  const facturacion: CierreSemanalFilaFacturacion[] = e.facturacionRows.map(r => ({
    pasadoEl: diaDe(r.solicitud.createdAt),
    diasTrabado: r.diasTrabado,
    presupuesto: r.solicitud.presupuestoNumero ?? '',
    cliente: r.solicitud.clienteNombre ?? '',
    monto: fmtMonto(r.solicitud.moneda, r.solicitud.montoTotal),
    ots: r.solicitud.otNumbers ?? [],
    estado: SOLICITUD_FACTURACION_ESTADO_LABELS[r.solicitud.estado] ?? r.solicitud.estado,
    nroFactura: r.solicitud.numeroFactura ?? null,
    comentario: r.solicitud.comentarioControl ?? null,
  }));
  const resumen: CierreSemanalResumen = {
    agendadas: e.agendaKpis.agendadas,
    cerradas: e.agendaKpis.cerradas,
    sinCierreAdmin: e.agendaKpis.sinCierreAdmin,
    sinRealizar: e.agendaKpis.sinRealizar,
    otsArrastre: otsArrastre.length,
    entregasPendientes: entregas.length,
    presupuestosEnControl: e.presupuestoKpis.conTrabajo,
    listosSinAviso: e.presupuestoKpis.listosSinAviso,
    sinOC: e.presupuestoKpis.sinOC,
    presupuestosArrastre: e.presupuestoKpis.arrastre,
    sinFacturar: e.facturacionKpis.sinFacturar,
    facturadasSemana: e.facturacionKpis.facturadasSemana,
    montoSinFacturar: e.facturacionKpis.montoSinFacturar,
  };
  return { datos: { ots, otsArrastre, entregas, presupuestos, facturacion }, resumen };
}
