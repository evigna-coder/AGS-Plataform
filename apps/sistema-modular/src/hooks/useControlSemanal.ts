import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgendaEntry, Cliente, CondicionPago, Establecimiento, OTEstadoAdmin, Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import { esOTCerradaTecnicamente, establecimientoPerteneceACliente, tipoOTEfectivo } from '@ags/shared';
import { tieneOCDelCliente } from '../utils/analitica/presupuestosMetrics';
import { OT_ESTADO_ORDER } from '../utils/agendaOTSync';
import {
  agendaService, clientesService, condicionesPagoService, establecimientosService, facturacionService,
  ordenesTrabajoService, presupuestosService,
} from '../services/firebaseService';

// ── Tipos locales del control (no van a @ags/shared: solo los consume esta página) ──

export type AgendaControlEstado = 'cerrada' | 'sin_cierre_admin' | 'sin_realizar' | 'ot_no_encontrada';

export interface AgendaControlRow {
  /** Entrada representativa (la más temprana de la OT en la semana). */
  entry: AgendaEntry;
  /** TODAS las entradas de esa OT en la semana — una por ingeniero/bloque. */
  entries: AgendaEntry[];
  /** Ingenieros que la tuvieron, sin repetir. */
  ingenieros: string[];
  ot: WorkOrder | null;
  /** Establecimiento a mostrar entre paréntesis. null si el cliente tiene uno solo. */
  establecimientoNombre: string | null;
  estado: AgendaControlEstado;
  /** Diagnósticos de por qué quedó sin cerrar (pueden ser varios). */
  motivos: string[];
}

export interface PresupuestoControlRow {
  presupuesto: Presupuesto;
  clienteNombre: string;
  /** Establecimiento a mostrar entre paréntesis. null si el cliente tiene uno solo. */
  establecimientoNombre: string | null;
  /** Existe una solicitud de facturación activa (no anulada). */
  avisoEnviado: boolean;
  /** Aviso PARCIAL: % ya pasado a facturar. null = o no hay aviso, o está completo. */
  avisoParcialPct: number | null;
  /** OTs del presupuesto que todavía no llegaron a cierre administrativo. */
  otsPendientes: { otNumber: string; estadoAdmin: OTEstadoAdmin | '' }[];
  /** El cliente todavía no mandó la orden de compra. */
  sinOC: boolean;
  /** Todo cerrado y pendiente_facturacion: solo falta generar el aviso. */
  listoParaAviso: boolean;
  /** Condición de pago anticipada: figura en el control aunque ninguna OT haya cerrado. */
  pagoAnticipado: boolean;
  /**
   * Aceptado y SIN NINGUNA OT AGENDADA (2026-08-15).
   *
   * Antes era `nums.size === 0` — "sin ninguna OT creada"—, y ese no es el
   * pedido: un presupuesto con la OT ya creada pero nunca coordinada no entraba
   * por acá (tiene OT) ni por `otsEnSemana` (no está en la agenda de la semana),
   * así que se caía del control salvo que además tuviera trabajo hecho. Justo
   * el caso que un control semanal tiene que cazar.
   */
  sinOtAgendada: boolean;
  /**
   * OTs del ppto que EXISTEN pero nunca se coordinaron (2026-08-15). Distingue
   * los dos casos que caen bajo `sinOtAgendada`, porque la acción es distinta:
   * vacío = no hay ninguna OT, hay que crearla; con números = la OT está creada
   * y lo que falta es meterla en la agenda.
   */
  otsSinAgendar: string[];
  /** Fecha (yyyy-mm-dd) de la visita si esta agendada para OTRA semana
   *  (2026-08-15). Sirve para decir "agendada 28/08" en vez de tratarla como
   *  pendiente de coordinar. */
  agendadaOtraSemana: string | null;
  /** OTs del ppto agendadas en la semana visible (2026-08-04): ancla el ppto al control de esa semana. */
  otsEnSemana: string[];
  /** OTs de ENTREGA DE PARTES del ppto sin entregar (2026-08-04): como nunca se
   *  agendan ni cierran solas, anclan el ppto al control hasta que se entreguen. */
  entregasPendientes: string[];
  /** Ppto SIN aceptar (borrador/enviado) con OT ya realizada (2026-08-05, caso
   *  portal: la creación desde el portal implica aceptación del cliente — hay
   *  que ponerle precios/aceptarlo y pasarlo a facturar). */
  sinAceptar: boolean;
  /**
   * Entra al control SOLO por trabajo ya realizado y sin facturar (2026-08-15).
   *
   * No es de esta semana: arrastra desde que cerró la OT y va a seguir
   * apareciendo todas las semanas hasta que se facture. Se separa en su propio
   * bloque para que no se mezcle con el trabajo de la semana — mezclados, la
   * sección "tenía muchos" y no se distinguía qué pasaba ahora.
   */
  arrastre: boolean;
  /**
   * Facturado con la factura caída en la semana visible (2026-08-27). El ppto
   * facturado sale del universo de pendientes; vuelve SOLO en esa semana, con
   * tilde verde — "lo que tenía que hacerse se hizo" cierra la foto semanal.
   */
  facturadoEstaSemana: boolean;
}

/** Sección 3 (2026-08-05): cruce "pasado a facturar vs facturado" — lo confirma
 *  ADMINISTRACIÓN. Una fila por solicitud de facturación activa. */
export interface FacturacionControlRow {
  solicitud: SolicitudFacturacion;
  /** true = facturada o cobrada (el aviso se cumplió). */
  facturada: boolean;
  /** Facturada dentro de la semana visible (para el check de la semana). */
  facturadaEstaSemana: boolean;
}

// Sección 1: la OT se considera "cerrada" desde el cierre técnico en adelante.
/**
 * TRABAJO hecho: cierre técnico en adelante. Es el criterio de la sección de
 * presupuestos —un ppto cuya OT quedó en cierre técnico tiene que figurar
 * igual, justamente porque el cierre admin puede estar olvidado (UAT
 * 2026-07-20)—. NO sirve para decir si una visita está cerrada: para eso está
 * `OT_CERRADA_ADMIN`, que es lo único que cuenta como cerrada de verdad.
 */
const OT_TRABAJO_REALIZADO = new Set<OTEstadoAdmin>(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
// Sección 2: para facturación cuenta el cierre ADMINISTRATIVO (mismo criterio que CierreFacturacionWizard).
const OT_CERRADA_ADMIN = new Set<OTEstadoAdmin>(['CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
// Universo de presupuestos con trabajo en curso o realizado.
// pendiente_oc (2026-08-04): aceptado de palabra, el cliente debe la OC — el
// caso típico es el repuesto ya usado (trabajo hecho, falta OC para facturar):
// TIENE que figurar en el control con su chip "Sin OC".
const ESTADOS_CON_TRABAJO = new Set<Presupuesto['estado']>(['pendiente_oc', 'aceptado', 'en_ejecucion', 'pendiente_facturacion']);
// Pago anticipado: desde 2026-08-27 los anticipados NO figuran en la sección de
// presupuestos (evaluación del user) — se facturan por su propio circuito, antes
// del servicio, así que el control por cierre de OT no les aplica.
// Detección por texto del catálogo de condiciones de pago ("anticipado"/"adelanto") —
// cuando exista el flag formal "requiere pago anticipado" (item 11 UAT Fanely),
// cambiar solo esta función.
const esCondicionAnticipada = (c: CondicionPago) => /anticip|adelant/i.test(`${c.nombre} ${c.descripcion ?? ''}`);

/** OT de ENTREGA DE PARTES (2026-08-04): mismo criterio que la cola de agenda
 *  (AgendaPendingSidebar) — tipoOT nuevo + fallback por nombre del tipo de
 *  servicio para OTs previas al campo. */
const esEntregaOT = (ot: WorkOrder) =>
  ot.tipoOT === 'entrega' || /entrega de insumos|entrega de partes/i.test(ot.tipoServicio ?? '');

/** Sección 1b ampliada (2026-08-27): también las OTs de ALQUILER — como las
 *  entregas, no se agendan y quedaban invisibles para el control. */
const esEntregaOAlquilerOT = (ot: WorkOrder) =>
  esEntregaOT(ot) || tipoOTEfectivo(ot) === 'alquiler';

function classifyEntry(entry: AgendaEntry, ot: WorkOrder | null): { estado: AgendaControlEstado; motivos: string[] } {
  if (!ot) return { estado: 'ot_no_encontrada', motivos: ['La OT referenciada no existe en la colección'] };
  if (ot.estadoAdmin && OT_CERRADA_ADMIN.has(ot.estadoAdmin)) return { estado: 'cerrada', motivos: [] };
  // Trabajo hecho, papeles no: el técnico cerró (CIERRE_TECNICO, o marcó el
  // reporte FINALIZADO) pero falta el cierre administrativo — que es el que
  // deduce stock, dispara el aviso a facturación y habilita el cobro.
  if (ot.estadoAdmin === 'CIERRE_TECNICO' || ot.status === 'FINALIZADO') {
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
export function otsDelPresupuesto(pres: Presupuesto, allOTs: WorkOrder[]): Set<string> {
  const nums = new Set<string>([
    ...(pres.otsVinculadasNumbers ?? []),
    ...(pres.otVinculadaNumber ? [pres.otVinculadaNumber] : []),
  ]);
  for (const ot of allOTs) {
    if ((ot.budgets || []).includes(pres.numero)) nums.add(ot.otNumber);
  }

  // El vínculo lo manda la OT (2026-08-20). `otsVinculadasNumbers` vive en el
  // presupuesto y se estampa al crear la OT, pero sacar el presupuesto de la OT
  // NO lo limpia: el ppto seguía figurando en el control de esa semana aunque ya
  // no tuviera nada que ver con la orden (caso Eriochem, ppto 005047 corregido a
  // otra semana).
  //
  // Solo se descarta cuando la OT EXISTE y su `budgets` contradice el vínculo.
  // Si la OT no está en la lista no se toca: no hay con qué verificar, y perder
  // un vínculo real es peor que arrastrar uno viejo.
  const otPorNumero = new Map(allOTs.map(o => [o.otNumber, o]));
  for (const num of [...nums]) {
    const ot = otPorNumero.get(num);
    if (!ot) continue;
    if (!(ot.budgets || []).includes(pres.numero)) nums.delete(num);
  }
  const padresConHijas = new Set(
    allOTs.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]));
  for (const num of [...nums]) {
    if (!num.includes('.') && padresConHijas.has(num)) {
      nums.delete(num);
      // Heredar el vínculo a las hijas (2026-08-06): si el ppto se vinculó al
      // PADRE (ej. editándolo después de crear la OT), las hijas no tienen el
      // budget propio — borrar el padre sin heredar perdía la relación y el
      // ppto figuraba "sin OT" (caso 29960/29960.01, P1-005046-01).
      for (const o of allOTs) {
        if (o.otNumber.startsWith(`${num}.`)) nums.add(o.otNumber);
      }
    }
  }
  return nums;
}

export function useControlSemanal(weekStart: string, weekEnd: string) {
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudFacturacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  /** otNumber → fecha de su entrada de agenda más temprana (todas las semanas). */
  const [fechaAgendaPorOt, setFechaAgendaPorOt] = useState<Map<string, string>>(new Map());
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Agenda COMPLETA por OT (2026-08-15): saber si una OT está agendada NO se
  // puede resolver con `entries`, que solo trae la semana visible, ni con el
  // estadoAdmin de la OT — hay OTs coordinadas en agenda cuyo estado nunca
  // avanzó a COORDINADA. Es el mismo bug que ya cazaron en la cola de agenda
  // (UAT 2026-07-30) y para el que existe esta suscripción global.
  useEffect(() => agendaService.subscribeFechaPorOt(setFechaAgendaPorOt), []);

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
      establecimientosService.getAll(),
    ])
      .then(([allOts, allPres, allSol, allCli, allCond, allEst]) => {
        if (cancelled) return;
        setOts(allOts);
        setPresupuestos(allPres);
        setSolicitudes(allSol);
        setClientes(allCli);
        setCondiciones(allCond);
        setEstablecimientos(allEst);
      })
      .catch((err) => {
        console.error('[useControlSemanal] load:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando datos');
      })
      .finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const refetch = useCallback(() => setReloadKey(k => k + 1), []);

  /**
   * Sufijo " (Establecimiento)" para el nombre del cliente (2026-08-20).
   *
   * Solo cuando el cliente tiene MÁS DE UNO: con uno solo el dato no distingue
   * nada y alarga la celda. Un mismo cliente con tres plantas, en cambio, es
   * imposible de leer sin esto — "YPF" no dice a cuál hay que ir.
   */
  const clientesMultiEstab = useMemo(() => {
    // El vínculo puede venir por `clienteId` o por CUIT (migración a medio
    // camino), así que se cuenta con el helper compartido y no por un campo.
    const porCliente = new Map<string, number>();
    for (const e of establecimientos) {
      const dueño = [e.clienteId, e.clienteCuit].find((k): k is string =>
        !!k && establecimientoPerteneceACliente(e, k));
      if (!dueño) continue;
      porCliente.set(dueño, (porCliente.get(dueño) ?? 0) + 1);
    }
    return new Set([...porCliente].filter(([, n]) => n > 1).map(([id]) => id));
  }, [establecimientos]);

  const establecimientoNombreById = useMemo(
    () => new Map(establecimientos.map(e => [e.id, e.nombre])), [establecimientos]);

  /** Nombre del establecimiento SOLO si el cliente tiene varios. `null` si no aplica. */
  const sufijoEstablecimiento = useCallback((
    clienteId?: string | null,
    establecimientoId?: string | null,
    establecimientoNombre?: string | null,
  ): string | null => {
    if (!clienteId || !clientesMultiEstab.has(clienteId)) return null;
    const nombre = establecimientoNombre
      ?? (establecimientoId ? establecimientoNombreById.get(establecimientoId) : null);
    return nombre?.trim() || null;
  }, [clientesMultiEstab, establecimientoNombreById]);

  const otByNumber = useMemo(() => new Map(ots.map(o => [o.otNumber, o])), [ots]);
  /** numero de ppto → id, para linkear los budgets de las entregas pendientes. */
  const presupuestoIdByNumero = useMemo(
    () => new Map(presupuestos.map(p => [p.numero, p.id])), [presupuestos]);
  /** numero de ppto → doc completo — la sección de entregas muestra su valor (2026-08-27). */
  const presupuestoPorNumero = useMemo(
    () => new Map(presupuestos.map(p => [p.numero, p])), [presupuestos]);
  const clienteNombreById = useMemo(
    () => new Map(clientes.map(c => [c.id, c.razonSocial])), [clientes]);

  // ── Sección 1: agenda de la semana vs cierre de OTs ──
  /**
   * Una fila por OT, no por entrada (2026-08-19).
   *
   * Se armaba con `entries.map`, así que una OT asignada a DOS ingenieros —o
   * partida en dos bloques— salía repetida y el control la contaba dos veces.
   * La OT es una sola: los ingenieros se juntan en la misma fila.
   *
   * Las entradas marcadas `excluidoDelControl` no entran: son las que alguien
   * sacó a mano porque la visita se recoordinó y el control de ESTA semana no
   * las tiene que mirar.
   */
  const agendaRows = useMemo<AgendaControlRow[]>(() => {
    const porOt = new Map<string, AgendaEntry[]>();
    for (const e of entries) {
      if (!e.otNumber || e.excluidoDelControl) continue;
      const prev = porOt.get(e.otNumber);
      if (prev) prev.push(e); else porOt.set(e.otNumber, [e]);
    }
    const rows: AgendaControlRow[] = [];
    for (const [otNumber, grupo] of porOt) {
      const ordenadas = [...grupo].sort((a, b) => (a.fechaInicio || '').localeCompare(b.fechaInicio || ''));
      const entry = ordenadas[0];
      const ot = otByNumber.get(otNumber) ?? null;
      const ingenieros = [...new Set(ordenadas.map(e => e.ingenieroNombre).filter(Boolean))];
      rows.push({
        entry, entries: ordenadas, ingenieros, ot,
        // La entrada de agenda trae el nombre denormalizado; si falta, se resuelve
        // por el id de la OT.
        establecimientoNombre: sufijoEstablecimiento(
          ot?.clienteId, ot?.establecimientoId, entry.establecimientoNombre),
        ...classifyEntry(entry, ot),
      });
    }
    return rows.sort((a, b) => (a.entry.fechaInicio || '').localeCompare(b.entry.fechaInicio || ''));
  }, [entries, otByNumber, sufijoEstablecimiento]);

  /** Saca (o repone) una OT del control de esta semana — todas sus entradas. */
  const excluirDelControl = useCallback(async (otNumber: string, excluir: boolean) => {
    const afectadas = entries.filter(e => e.otNumber === otNumber);
    await Promise.all(afectadas.map(e => agendaService.update(e.id, { excluidoDelControl: excluir })));
  }, [entries]);

  /** Las que se sacaron a mano, para poder reponerlas. */
  const agendaExcluidas = useMemo(
    () => entries.filter(e => e.otNumber && e.excluidoDelControl),
    [entries]);

  const tareasSinOT = useMemo(() => entries.filter(e => !e.otNumber), [entries]);

  // ── Sección 1b: entregas de partes pendientes (2026-08-04) ──
  // Las entregas NUNCA van a agenda, así que la sección 1 no las ve. Figuran
  // SIEMPRE (sin límite de semana) hasta el cierre técnico = entregadas.
  // Las OTs padre con hijas son contenedores no-accionables: solo las hijas.
  const entregasPendientes = useMemo<WorkOrder[]>(() => {
    const padresConHijas = new Set(
      ots.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]));
    return ots
      .filter(o => esEntregaOAlquilerOT(o) && !esOTCerradaTecnicamente(o))
      .filter(o => o.otNumber.includes('.') || !padresConHijas.has(o.otNumber))
      // Sacadas a mano de ESTA semana (2026-08-19): la entrega no se concretó,
      // se trasladó, y la foto de la semana que pasó tiene que quedar limpia.
      // Sigue figurando en las demás semanas hasta que se entregue.
      .filter(o => !(o.controlSemanalExcluidoSemanas ?? []).includes(weekStart))
      .sort((a, b) => a.otNumber.localeCompare(b.otNumber));
  }, [ots, weekStart]);

  /** Entregas sacadas de la semana visible, para poder reponerlas. */
  const entregasExcluidas = useMemo(
    () => ots.filter(o => esEntregaOAlquilerOT(o) && !esOTCerradaTecnicamente(o)
      && (o.controlSemanalExcluidoSemanas ?? []).includes(weekStart)),
    [ots, weekStart]);

  /** Saca (o repone) una entrega del control de la semana visible. */
  const excluirEntregaDelControl = useCallback(async (otNumber: string, excluir: boolean) => {
    const ot = ots.find(o => o.otNumber === otNumber);
    if (!ot) return;
    const actuales = ot.controlSemanalExcluidoSemanas ?? [];
    const next = excluir
      ? (actuales.includes(weekStart) ? actuales : [...actuales, weekStart])
      : actuales.filter(w => w !== weekStart);
    await ordenesTrabajoService.update(otNumber, { controlSemanalExcluidoSemanas: next });
    // Reflejar el cambio en memoria (2026-08-20): `ots` sale de un getAll() de
    // una sola pasada, no de una suscripción como la agenda — sin esto el botón
    // escribía en Firestore y la fila no se movía, así que parecía roto. Un
    // refetch tampoco alcanzaba: el servicio pasa por serviceCache (TTL 2 min).
    setOts(prev => prev.map(o =>
      o.otNumber === otNumber ? { ...o, controlSemanalExcluidoSemanas: next } : o));
  }, [ots, weekStart]);

  const agendaKpis = useMemo(() => ({
    agendadas: agendaRows.length,
    cerradas: agendaRows.filter(r => r.estado === 'cerrada').length,
    sinCierreAdmin: agendaRows.filter(r => r.estado === 'sin_cierre_admin').length,
    sinRealizar: agendaRows.filter(r => r.estado === 'sin_realizar').length,
  }), [agendaRows]);

  // ── Sección 2: presupuestos con trabajo realizado O pago anticipado, trabados a hoy (sin límite de semana) ──
  const presupuestoRows = useMemo<PresupuestoControlRow[]>(() => {
    /**
     * Cobertura avisada por presupuesto (2026-08-20).
     *
     * `avisoEnviado` marcaba el ppto con CUALQUIER solicitud no anulada, y la
     * pantalla esconde los avisados salvo que se tilde "mostrar enviados". Un
     * aviso PARCIAL —50% ahora, 50% contra entrega— lo hacía desaparecer del
     * control con la mitad sin pasar a facturar (caso P3-005043-01).
     *
     * La solicitud guarda `porcentajeCoberturaPorMoneda` al crearse. Se suman
     * las de un mismo presupuesto y solo se considera avisado cuando toda
     * moneda llegó al 100%. Las solicitudes viejas no traen el campo: esas
     * cuentan como cobertura total, para no revivir en el control todo lo que
     * ya se avisó antes de que existiera el dato.
     */
    const coberturaPorPpto = new Map<string, { total: boolean; pct: number }>();
    for (const sol of solicitudes) {
      if (sol.estado === 'anulada') continue;
      const prev = coberturaPorPpto.get(sol.presupuestoId) ?? { total: false, pct: 0 };
      const cobertura = sol.porcentajeCoberturaPorMoneda;
      if (!cobertura || Object.keys(cobertura).length === 0) {
        coberturaPorPpto.set(sol.presupuestoId, { total: true, pct: 100 });
        continue;
      }
      // Varias monedas: manda la MENOS cubierta — si una quedó a medias, falta.
      const pct = Math.min(...Object.values(cobertura).map(v => v ?? 0));
      coberturaPorPpto.set(sol.presupuestoId, {
        total: prev.total,
        pct: prev.pct + (Number.isFinite(pct) ? pct : 0),
      });
    }
    /** Avisado por COMPLETO. Tolerancia de medio punto por redondeos. */
    const avisadoCompleto = (pptoId: string) => {
      const c = coberturaPorPpto.get(pptoId);
      return !!c && (c.total || c.pct >= 99.5);
    };
    const pptosConAviso = new Set(
      solicitudes.filter(s => s.estado !== 'anulada').map(s => s.presupuestoId));
    const condicionesAnticipadas = new Set(
      condiciones.filter(esCondicionAnticipada).map(c => c.id));

    // OTs agendadas en la semana visible: anclan sus pptos al control (2026-08-04).
    const otsAgendadasSemana = new Set(entries.map(e => e.otNumber).filter(Boolean));

    const rows: PresupuestoControlRow[] = [];
    for (const p of presupuestos) {
      // Los CONTRATOS (P5) no van al control semanal (2026-08-04): tienen su
      // propio circuito de cuotas/facturación — acá solo ruido.
      if (p.tipo === 'contrato') continue;
      // Sacado a mano de ESTA semana (2026-08-19): lo pendiente se resolvió
      // después, así que la foto de la semana que pasó queda limpia. Sigue
      // figurando en las demás mientras arrastre algo.
      if ((p.controlSemanalExcluidoSemanas ?? []).includes(weekStart)) continue;
      const pagoAnticipado = !!p.condicionPagoId && condicionesAnticipadas.has(p.condicionPagoId);
      const enUniversoTrabajo = ESTADOS_CON_TRABAJO.has(p.estado);
      // ── Redefinición 2026-08-27 (evaluación del user) ──
      // A la sección de presupuestos entran SOLO los que tienen OT para la
      // semana visible o una ANTERIOR y siguen sin facturar. Quedan afuera:
      //  - pptos con OT agendada a futuro o sin OT creada (no son trabajo de
      //    esta semana — vuelven cuando les llegue la semana),
      //  - pago anticipado (se factura por su propio circuito, no por cierre),
      //  - pptos de entregas/alquileres (viven en la sección 1b, con su valor).
      if (!enUniversoTrabajo) continue;
      if (pagoAnticipado) continue;
      const nums = otsDelPresupuesto(p, ots);
      if (nums.size === 0) continue;
      const otsExistentes = [...nums].filter(n => otByNumber.has(n));
      const esPptoDeEntregas = otsExistentes.length > 0
        && otsExistentes.every(n => esEntregaOAlquilerOT(otByNumber.get(n)!));
      if (esPptoDeEntregas) continue;
      // OT "para esta semana o una anterior": por fecha de agenda (≤ fin de la
      // semana visible) o, para OTs que nunca pasaron por agenda, por trabajo
      // ya realizado (cierre técnico en adelante).
      const tieneOtSemanaOAnterior = [...nums].some(n => {
        const f = fechaAgendaPorOt.get(n);
        if (f && f <= weekEnd) return true;
        const e = otByNumber.get(n)?.estadoAdmin;
        return !!e && OT_TRABAJO_REALIZADO.has(e);
      });
      if (!tieneOtSemanaOAnterior) continue;
      // Campos de diagnóstico para los chips de la fila (la INCLUSIÓN ya se
      // decidió arriba — estos solo describen).
      const tieneAlgunaAgendada = [...nums].some(n => {
        if (fechaAgendaPorOt.has(n)) return true;
        const e = otByNumber.get(n)?.estadoAdmin;
        return !!e && OT_ESTADO_ORDER[e] >= OT_ESTADO_ORDER.COORDINADA;
      });
      const sinOtAgendada = enUniversoTrabajo && !tieneAlgunaAgendada;
      const otsSinAgendar = sinOtAgendada ? [...nums].filter(n => otByNumber.has(n)).sort() : [];
      const agendadaOtraSemana = [...nums]
        .map(n => fechaAgendaPorOt.get(n))
        .filter((f): f is string => !!f && (f < weekStart || f > weekEnd))
        .sort()[0] ?? null;
      const otsEnSemana = [...nums].filter(n => otsAgendadasSemana.has(n)).sort();
      const entregasPpto = [...nums]
        .filter(n => {
          const ot = otByNumber.get(n);
          return !!ot && esEntregaOT(ot) && !esOTCerradaTecnicamente(ot);
        })
        .sort();
      const sinAceptar = false;
      // "De la semana" = tiene OT agendada en la semana visible. Lo demás es
      // ARRASTRE: OT de una semana anterior que sigue sin facturarse (2026-08-27).
      const deLaSemana = otsEnSemana.length > 0;
      const arrastre = !deLaSemana;

      // Avisado = la cobertura llegó al total. Un parcial sigue en el control
      // con lo que falta (ver coberturaPorPpto).
      const avisoEnviado = pptosConAviso.has(p.id) && avisadoCompleto(p.id);
      const avisoParcialPct = pptosConAviso.has(p.id) && !avisoEnviado
        ? Math.round(coberturaPorPpto.get(p.id)?.pct ?? 0)
        : null;
      const otsPendientes = [...nums]
        .filter(n => otByNumber.has(n))
        .filter(n => {
          const estado = otByNumber.get(n)!.estadoAdmin;
          return !estado || !OT_CERRADA_ADMIN.has(estado);
        })
        .sort()
        .map(n => ({ otNumber: n, estadoAdmin: otByNumber.get(n)!.estadoAdmin ?? ('' as const) }));
      // tieneOCDelCliente (2026-08-06): la OC puede haber entrado por el camino
      // liviano (AdjuntarOCModal: número + PDF adjunto), que NO estampa
      // ordenesCompraIds — mirando solo ese array, un ppto con la OC cargada
      // seguía figurando "Pendiente OC del cliente" (caso P3-005034-01).
      const sinOC = !tieneOCDelCliente(p);
      const listoParaAviso = !avisoEnviado && otsPendientes.length === 0 && p.estado === 'pendiente_facturacion';

      rows.push({
        presupuesto: p,
        clienteNombre: clienteNombreById.get(p.clienteId) ?? '—',
        establecimientoNombre: sufijoEstablecimiento(p.clienteId, p.establecimientoId),
        avisoEnviado, avisoParcialPct, otsPendientes, sinOC, listoParaAviso, pagoAnticipado,
        sinOtAgendada, otsSinAgendar, agendadaOtraSemana, otsEnSemana, entregasPendientes: entregasPpto, sinAceptar,
        arrastre, facturadoEstaSemana: false,
      });
    }

    // ── Facturados de la semana (2026-08-27): "lo que tenía que hacerse se hizo".
    // El ppto facturado sale del universo de pendientes; acá vuelve SOLO en la
    // semana en que cayó su factura, con tilde verde, para cerrar la foto.
    const enSemanaVisible = (iso?: string | null) => {
      const d = (iso ?? '').slice(0, 10);
      return !!d && d >= weekStart && d <= weekEnd;
    };
    const idsFacturadosSemana = new Set(
      solicitudes
        .filter(s => (s.estado === 'facturada' || s.estado === 'cobrada') && enSemanaVisible(s.fechaFactura ?? s.updatedAt))
        .map(s => s.presupuestoId));
    const yaListados = new Set(rows.map(r => r.presupuesto.id));
    for (const p of presupuestos) {
      if (!idsFacturadosSemana.has(p.id) || yaListados.has(p.id)) continue;
      if (p.tipo === 'contrato') continue;
      if ((p.controlSemanalExcluidoSemanas ?? []).includes(weekStart)) continue;
      rows.push({
        presupuesto: p,
        clienteNombre: clienteNombreById.get(p.clienteId) ?? '—',
        establecimientoNombre: sufijoEstablecimiento(p.clienteId, p.establecimientoId),
        avisoEnviado: true, avisoParcialPct: null, otsPendientes: [], sinOC: false,
        listoParaAviso: false, pagoAnticipado: false, sinOtAgendada: false, otsSinAgendar: [],
        agendadaOtraSemana: null, otsEnSemana: [], entregasPendientes: [], sinAceptar: false,
        arrastre: false, facturadoEstaSemana: true,
      });
    }
    // Listos primero, después trabados, enviados al final; dentro de cada grupo por número.
    const rank = (r: PresupuestoControlRow) => r.avisoEnviado ? 2 : r.listoParaAviso ? 0 : 1;
    return rows.sort((a, b) => rank(a) - rank(b) || a.presupuesto.numero.localeCompare(b.presupuesto.numero));
  }, [presupuestos, solicitudes, ots, otByNumber, clienteNombreById, condiciones, entries,
      fechaAgendaPorOt, weekStart, weekEnd, sufijoEstablecimiento]);

  // ── Sección 3: cruce con facturación (2026-08-05) ──
  // "Todo lo que se pasó para facturar, ¿se facturó?" — universo: solicitudes
  // NO anuladas. Las SIN facturar (pendiente/enviada) figuran SIEMPRE (backlog
  // de administración); las facturadas/cobradas solo si la factura cayó en la
  // semana visible (confirmación del cruce de esa semana).
  const facturacionRows = useMemo<FacturacionControlRow[]>(() => {
    const enSemana = (iso?: string | null) => {
      const d = (iso ?? '').slice(0, 10);
      return !!d && d >= weekStart && d <= weekEnd;
    };
    // El backlog arrastra hacia ADELANTE, no hacia atrás (2026-08-09): una
    // solicitud no puede figurar en una semana anterior a su creación. Sin esto,
    // lo que se pasaba a facturar hoy aparecía también en el control de la
    // semana pasada — y ahí ni siquiera tenía OT ni presupuesto que lo respaldara.
    const yaExistia = (s: SolicitudFacturacion) => (s.createdAt ?? '').slice(0, 10) <= weekEnd;
    return solicitudes
      .filter(s => s.estado !== 'anulada' && yaExistia(s))
      .map(s => {
        const facturada = s.estado === 'facturada' || s.estado === 'cobrada';
        return {
          solicitud: s,
          facturada,
          facturadaEstaSemana: facturada && enSemana(s.fechaFactura ?? s.updatedAt),
        };
      })
      .filter(r => !r.facturada || r.facturadaEstaSemana)
      .sort((a, b) => (a.facturada ? 1 : 0) - (b.facturada ? 1 : 0)
        || (a.solicitud.createdAt || '').localeCompare(b.solicitud.createdAt || ''));
  }, [solicitudes, weekStart, weekEnd]);

  const facturacionKpis = useMemo(() => ({
    sinFacturar: facturacionRows.filter(r => !r.facturada).length,
    facturadasSemana: facturacionRows.filter(r => r.facturadaEstaSemana).length,
    montoSinFacturar: facturacionRows
      .filter(r => !r.facturada)
      .reduce((acc, r) => {
        const m = r.solicitud.moneda || 'USD';
        acc[m] = (acc[m] || 0) + (r.solicitud.montoTotal || 0);
        return acc;
      }, {} as Record<string, number>),
  }), [facturacionRows]);

  /** Presupuestos sacados de la semana visible, para poder reponerlos. */
  const presupuestosExcluidos = useMemo(
    () => presupuestos.filter(p => (p.controlSemanalExcluidoSemanas ?? []).includes(weekStart)),
    [presupuestos, weekStart]);

  /** Saca (o repone) un presupuesto del control de la semana visible. */
  const excluirPresupuestoDelControl = useCallback(async (presupuestoId: string, excluir: boolean) => {
    const p = presupuestos.find(x => x.id === presupuestoId);
    if (!p) return;
    const actuales = p.controlSemanalExcluidoSemanas ?? [];
    const next = excluir
      ? (actuales.includes(weekStart) ? actuales : [...actuales, weekStart])
      : actuales.filter(w => w !== weekStart);
    await presupuestosService.update(presupuestoId, { controlSemanalExcluidoSemanas: next } as never);
    // Ídem entregas: `presupuestos` es una carga puntual, hay que reflejarlo acá.
    setPresupuestos(prev => prev.map(p =>
      p.id === presupuestoId ? { ...p, controlSemanalExcluidoSemanas: next } : p));
  }, [presupuestos, weekStart]);

  const presupuestoKpis = useMemo(() => ({
    conTrabajo: presupuestoRows.filter(r => !r.arrastre).length,
    listosSinAviso: presupuestoRows.filter(r => r.listoParaAviso).length,
    esperandoOTs: presupuestoRows.filter(r => !r.avisoEnviado && r.otsPendientes.length > 0).length,
    sinOC: presupuestoRows.filter(r => !r.avisoEnviado && r.sinOC).length,
    anticipadas: presupuestoRows.filter(r => r.pagoAnticipado && !r.avisoEnviado).length,
    sinOtAgendada: presupuestoRows.filter(r => !r.avisoEnviado && r.sinOtAgendada).length,
    sinAceptar: presupuestoRows.filter(r => !r.avisoEnviado && r.sinAceptar).length,
    // KPI "En control" cuenta SOLO lo de la semana: el arrastre tiene su propio
    // bloque y su propio contador (2026-08-15).
    arrastre: presupuestoRows.filter(r => r.arrastre).length,
  }), [presupuestoRows]);

  /**
   * Establecimiento por OT para las secciones que renderizan WorkOrder crudo
   * (entregas). Solo trae nombre cuando el cliente tiene más de uno.
   */
  const establecimientoPorOT = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const ot of ots) {
      m.set(ot.otNumber, sufijoEstablecimiento(ot.clienteId, ot.establecimientoId));
    }
    return m;
  }, [ots, sufijoEstablecimiento]);

  return {
    loading: agendaLoading || dataLoading,
    error,
    refetch,
    agendaRows,
    agendaExcluidas,
    excluirDelControl,
    tareasSinOT,
    agendaKpis,
    entregasPendientes,
    establecimientoPorOT,
    entregasExcluidas,
    excluirEntregaDelControl,
    presupuestoIdByNumero,
    presupuestoPorNumero,
    presupuestoRows,
    presupuestosExcluidos,
    excluirPresupuestoDelControl,
    presupuestoKpis,
    facturacionRows,
    facturacionKpis,
  };
}
