import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgendaEntry, Cliente, CondicionPago, OTEstadoAdmin, Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import {
  agendaService, clientesService, condicionesPagoService, facturacionService, ordenesTrabajoService, presupuestosService,
} from '../services/firebaseService';

// ── Tipos locales del control (no van a @ags/shared: solo los consume esta página) ──

export type AgendaControlEstado = 'cerrada' | 'sin_cierre_admin' | 'sin_realizar' | 'ot_no_encontrada';

export interface AgendaControlRow {
  entry: AgendaEntry;
  ot: WorkOrder | null;
  estado: AgendaControlEstado;
  /** Diagnósticos de por qué quedó sin cerrar (pueden ser varios). */
  motivos: string[];
}

export interface PresupuestoControlRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  /** Existe una solicitud de facturación activa (no anulada). */
  avisoEnviado: boolean;
  /** OTs del presupuesto que todavía no llegaron a cierre administrativo. */
  otsPendientes: { otNumber: string; estadoAdmin: OTEstadoAdmin | '' }[];
  /** El cliente todavía no mandó la orden de compra. */
  sinOC: boolean;
  /** Todo cerrado y pendiente_facturacion: solo falta generar el aviso. */
  listoParaAviso: boolean;
  /** Condición de pago anticipada: figura en el control aunque ninguna OT haya cerrado. */
  pagoAnticipado: boolean;
}

// Sección 1: la OT se considera "cerrada" desde el cierre técnico en adelante.
const OT_CERRADA = new Set<OTEstadoAdmin>(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
// Sección 2: para facturación cuenta el cierre ADMINISTRATIVO (mismo criterio que CierreFacturacionWizard).
const OT_CERRADA_ADMIN = new Set<OTEstadoAdmin>(['CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
// Universo de presupuestos con trabajo en curso o realizado.
const ESTADOS_CON_TRABAJO = new Set<Presupuesto['estado']>(['aceptado', 'en_ejecucion', 'pendiente_facturacion']);
// Pago anticipado (UAT 2026-07-19): estos pptos figuran desde el ENVÍO — se facturan
// antes del servicio (ej. servicio que espera una importación), así que hay que
// trabajarlos aunque ninguna OT esté cerrada.
const ESTADOS_ANTICIPADA = new Set<Presupuesto['estado']>(['enviado', 'aceptado', 'en_ejecucion', 'pendiente_facturacion']);
// Detección por texto del catálogo de condiciones de pago ("anticipado"/"adelanto") —
// cuando exista el flag formal "requiere pago anticipado" (item 11 UAT Fanely),
// cambiar solo esta función.
const esCondicionAnticipada = (c: CondicionPago) => /anticip|adelant/i.test(`${c.nombre} ${c.descripcion ?? ''}`);

function classifyEntry(entry: AgendaEntry, ot: WorkOrder | null): { estado: AgendaControlEstado; motivos: string[] } {
  if (!ot) return { estado: 'ot_no_encontrada', motivos: ['La OT referenciada no existe en la colección'] };
  if (ot.estadoAdmin && OT_CERRADA.has(ot.estadoAdmin)) return { estado: 'cerrada', motivos: [] };
  if (ot.status === 'FINALIZADO') {
    return { estado: 'sin_cierre_admin', motivos: ['Finalizada por el técnico — falta cierre administrativo'] };
  }
  // status BORRADOR con estadoAdmin previo al cierre → sin realizar. Diagnóstico múltiple:
  const motivos: string[] = [];
  if (entry.estadoAgenda === 'cancelado') motivos.push('Visita cancelada — ¿recoordinar?');
  if (!ot.ingenieroAsignadoId) motivos.push('Sin IST asignado');
  if (ot.ingenieroAsignadoId && entry.estadoAgenda !== 'cancelado') {
    motivos.push(ot.fechaInicio ? 'Reporte iniciado, sin finalizar' : 'Reporte sin finalizar');
  }
  return { estado: 'sin_realizar', motivos };
}

/**
 * Universo de OTs de un ppto: vinculadas ∪ OTs cuyo budgets[] contiene el número
 * (mismo criterio que CierreFacturacionWizard). Excluye OTs padre con hijas:
 * son contenedores no-accionables que nunca reciben cierre administrativo.
 */
function otsDelPresupuesto(pres: Presupuesto, allOTs: WorkOrder[]): Set<string> {
  const nums = new Set<string>([
    ...(pres.otsVinculadasNumbers ?? []),
    ...(pres.otVinculadaNumber ? [pres.otVinculadaNumber] : []),
  ]);
  for (const ot of allOTs) {
    if ((ot.budgets || []).includes(pres.numero)) nums.add(ot.otNumber);
  }
  const padresConHijas = new Set(
    allOTs.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]));
  for (const num of [...nums]) {
    if (!num.includes('.') && padresConHijas.has(num)) nums.delete(num);
  }
  return nums;
}

export function useControlSemanal(weekStart: string, weekEnd: string) {
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Agenda de la semana: suscripción realtime por rango (mismo mecanismo que useAgenda).
  useEffect(() => {
    setAgendaLoading(true);
    const unsubscribe = agendaService.subscribeToRange(weekStart, weekEnd, (nuevas) => {
      setEntries(nuevas);
      setAgendaLoading(false);
    });
    return unsubscribe;
  }, [weekStart, weekEnd]);

  // Datos de cruce: OTs + presupuestos + solicitudes + clientes (una carga, refrescable).
  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    setError(null);
    Promise.all([
      ordenesTrabajoService.getAll(),
      presupuestosService.getAll(),
      facturacionService.getAll(),
      clientesService.getAll(),
      condicionesPagoService.getAll(),
    ])
      .then(([allOts, allPres, allSol, allCli, allCond]) => {
        if (cancelled) return;
        setOts(allOts);
        setPresupuestos(allPres);
        setSolicitudes(allSol);
        setClientes(allCli);
        setCondiciones(allCond);
      })
      .catch((err) => {
        console.error('[useControlSemanal] load:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando datos');
      })
      .finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const refetch = useCallback(() => setReloadKey(k => k + 1), []);

  const otByNumber = useMemo(() => new Map(ots.map(o => [o.otNumber, o])), [ots]);
  const clienteNombreById = useMemo(
    () => new Map(clientes.map(c => [c.id, c.razonSocial])), [clientes]);

  // ── Sección 1: agenda de la semana vs cierre de OTs ──
  const agendaRows = useMemo<AgendaControlRow[]>(() =>
    entries
      .filter(e => e.otNumber)
      .map(entry => {
        const ot = otByNumber.get(entry.otNumber) ?? null;
        return { entry, ot, ...classifyEntry(entry, ot) };
      }),
  [entries, otByNumber]);

  const tareasSinOT = useMemo(() => entries.filter(e => !e.otNumber), [entries]);

  const agendaKpis = useMemo(() => ({
    agendadas: agendaRows.length,
    cerradas: agendaRows.filter(r => r.estado === 'cerrada').length,
    sinCierreAdmin: agendaRows.filter(r => r.estado === 'sin_cierre_admin').length,
    sinRealizar: agendaRows.filter(r => r.estado === 'sin_realizar').length,
  }), [agendaRows]);

  // ── Sección 2: presupuestos con trabajo realizado O pago anticipado, trabados a hoy (sin límite de semana) ──
  const presupuestoRows = useMemo<PresupuestoControlRow[]>(() => {
    const pptosConAviso = new Set(
      solicitudes.filter(s => s.estado !== 'anulada').map(s => s.presupuestoId));
    const condicionesAnticipadas = new Set(
      condiciones.filter(esCondicionAnticipada).map(c => c.id));

    const rows: PresupuestoControlRow[] = [];
    for (const p of presupuestos) {
      const pagoAnticipado = !!p.condicionPagoId && condicionesAnticipadas.has(p.condicionPagoId);
      const enUniversoTrabajo = ESTADOS_CON_TRABAJO.has(p.estado);
      const enUniversoAnticipada = pagoAnticipado && ESTADOS_ANTICIPADA.has(p.estado);
      if (!enUniversoTrabajo && !enUniversoAnticipada) continue;
      const nums = otsDelPresupuesto(p, ots);
      // "Trabajo realizado" = cierre TÉCNICO en adelante (criterio unificado con el
      // chip Pend. OC). Antes se exigía cierre ADMINISTRATIVO y un ppto con la OT
      // solo en cierre técnico no figuraba: si el cierre admin se olvidaba, el
      // aviso a facturación no aparecía en ningún control (UAT 2026-07-20).
      const tieneTrabajoRealizado = (p.otsListasParaFacturar?.length ?? 0) > 0
        || [...nums].some(n => {
          const estado = otByNumber.get(n)?.estadoAdmin;
          return !!estado && OT_CERRADA.has(estado);
        });
      if (!tieneTrabajoRealizado && !enUniversoAnticipada) continue;

      const avisoEnviado = pptosConAviso.has(p.id);
      const otsPendientes = [...nums]
        .filter(n => otByNumber.has(n))
        .filter(n => {
          const estado = otByNumber.get(n)!.estadoAdmin;
          return !estado || !OT_CERRADA_ADMIN.has(estado);
        })
        .sort()
        .map(n => ({ otNumber: n, estadoAdmin: otByNumber.get(n)!.estadoAdmin ?? ('' as const) }));
      const sinOC = (p.ordenesCompraIds ?? []).length === 0;
      const listoParaAviso = !avisoEnviado && otsPendientes.length === 0 && p.estado === 'pendiente_facturacion';

      rows.push({
        presupuesto: p,
        clienteNombre: clienteNombreById.get(p.clienteId) ?? '—',
        avisoEnviado, otsPendientes, sinOC, listoParaAviso, pagoAnticipado,
      });
    }
    // Listos primero, después trabados, enviados al final; dentro de cada grupo por número.
    const rank = (r: PresupuestoControlRow) => r.avisoEnviado ? 2 : r.listoParaAviso ? 0 : 1;
    return rows.sort((a, b) => rank(a) - rank(b) || a.presupuesto.numero.localeCompare(b.presupuesto.numero));
  }, [presupuestos, solicitudes, ots, otByNumber, clienteNombreById, condiciones]);

  const presupuestoKpis = useMemo(() => ({
    conTrabajo: presupuestoRows.length,
    listosSinAviso: presupuestoRows.filter(r => r.listoParaAviso).length,
    esperandoOTs: presupuestoRows.filter(r => !r.avisoEnviado && r.otsPendientes.length > 0).length,
    sinOC: presupuestoRows.filter(r => !r.avisoEnviado && r.sinOC).length,
    anticipadas: presupuestoRows.filter(r => r.pagoAnticipado && !r.avisoEnviado).length,
  }), [presupuestoRows]);

  return {
    loading: agendaLoading || dataLoading,
    error,
    refetch,
    agendaRows,
    tareasSinOT,
    agendaKpis,
    presupuestoRows,
    presupuestoKpis,
  };
}
