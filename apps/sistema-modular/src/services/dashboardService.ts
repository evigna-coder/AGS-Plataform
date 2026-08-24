import { presupuestoAceptadoVigente, calcularEstadoCertificado } from '@ags/shared';
import type { Presupuesto, WorkOrder, Ticket, Contrato, OTEstadoAdmin, TicketEstado, TicketArea, TicketPrioridad,
  InstrumentoPatron, Patron, EstadoCertificado } from '@ags/shared';
import { presupuestosService } from './presupuestosService';
import { ordenesTrabajoService } from './otService';
import { leadsService } from './leadsService';
import { contratosService } from './contratosService';
import { instrumentosService } from './catalogService';
import { patronesService } from './patronesService';

export interface PipelineKPIs {
  abiertos: { count: number; montoUSD: number; montoARS: number };
  aceptadosMes: { count: number; montoUSD: number; montoARS: number };
  conversion90d: { aceptados: number; enviados: number; ratio: number };
  contratosPorVencer: { count: number; ventana60d: Contrato[] };
}

export interface OperacionKPIs {
  otsPorEstado: Record<OTEstadoAdmin, number>;
  otsCerradasMes: number;
  leadTimeDiasPromedio: number | null;
  otsSinIngeniero: number;
}

export interface TicketsKPIs {
  porArea: Record<TicketArea | 'sin_area', number>;
  porPrioridad: Record<TicketPrioridad | 'sin_prioridad', number>;
  abiertos: number;
  sinAsignar: number;
  altaPrioridadVencida48h: number;
}

/**
 * Vencimientos de certificados de instrumentos y lotes de patrones (2026-08-22).
 *
 * Responde a una observación de la auditoría: el estado del certificado ya se
 * calculaba y se veía en cada listado, pero NADA avisaba — había que entrar al
 * módulo y mirar. Esto lo trae al dashboard.
 */
export interface CalibracionKPIs {
  instrumentos: { vencidos: number; porVencer: number; sinCertificado: number; enCalibracion: number };
  patrones: { vencidos: number; porVencer: number; sinVencimiento: number };
  /** Los más urgentes primero (vencidos, después por vencer). Para el detalle de la card. */
  proximos: { id: string; tipo: 'instrumento' | 'patron'; nombre: string; detalle: string;
    vencimiento: string | null; estado: EstadoCertificado }[];
}

export interface EquiposKPIs {
  bajoContratoTotal: number;
  contratosActivos: number;
  contratosVencidos: number;
}

export interface DashboardData {
  pipeline: PipelineKPIs;
  operacion: OperacionKPIs;
  tickets: TicketsKPIs;
  equipos: EquiposKPIs;
  calibracion: CalibracionKPIs;
  loadedAt: string;
}

/**
 * Ventana de preaviso, en días. Es el default de `calcularEstadoCertificado`, y
 * a propósito: el número de la card tiene que coincidir con los badges
 * "Por vencer" que se ven en los listados de instrumentos y patrones. Si se
 * cambia acá sin cambiar allá, el dashboard dice una cosa y el módulo otra.
 */
const DIAS_PREAVISO_CERTIFICADO = 30;

const ESTADOS_OT_ABIERTOS: OTEstadoAdmin[] = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO', 'CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO'];

const TICKET_ESTADOS_CERRADOS: TicketEstado[] = ['finalizado', 'no_concretado'];

function startOfMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function daysAgo(n: number): number {
  return Date.now() - n * 86400000;
}

function daysFromNow(n: number): number {
  return Date.now() + n * 86400000;
}

function safeTs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

function aggregatePipeline(presupuestos: Presupuesto[], contratos: Contrato[]): PipelineKPIs {
  const monthStart = startOfMonth();
  const ninetyAgo = daysAgo(90);
  const sixtyForward = daysFromNow(60);

  const abiertos = { count: 0, montoUSD: 0, montoARS: 0 };
  const aceptadosMes = { count: 0, montoUSD: 0, montoARS: 0 };
  let aceptados90 = 0;
  let enviados90 = 0;

  for (const p of presupuestos) {
    const total = Number(p.total ?? 0);
    const fechaEnvio = safeTs(p.fechaEnvio);
    const updatedAt = safeTs(p.updatedAt);

    if (p.estado === 'borrador' || p.estado === 'enviado') {
      abiertos.count += 1;
      if (p.moneda === 'USD' || p.moneda === 'MIXTA') abiertos.montoUSD += total;
      else if (p.moneda === 'ARS') abiertos.montoARS += total;
    }

    if (presupuestoAceptadoVigente(p.estado) && updatedAt >= monthStart) {
      aceptadosMes.count += 1;
      if (p.moneda === 'USD' || p.moneda === 'MIXTA') aceptadosMes.montoUSD += total;
      else if (p.moneda === 'ARS') aceptadosMes.montoARS += total;
    }

    if (fechaEnvio >= ninetyAgo) enviados90 += 1;
    if (presupuestoAceptadoVigente(p.estado) && updatedAt >= ninetyAgo) aceptados90 += 1;
  }

  const ventana60d = contratos.filter(c => {
    if (c.estado !== 'activo') return false;
    const fin = safeTs(c.fechaFin);
    return fin > 0 && fin <= sixtyForward && fin >= Date.now();
  });

  return {
    abiertos,
    aceptadosMes,
    conversion90d: {
      aceptados: aceptados90,
      enviados: enviados90,
      ratio: enviados90 > 0 ? aceptados90 / enviados90 : 0,
    },
    contratosPorVencer: { count: ventana60d.length, ventana60d },
  };
}

function aggregateOperacion(ots: WorkOrder[]): OperacionKPIs {
  const monthStart = startOfMonth();
  const ninetyAgo = daysAgo(90);

  const porEstado: Record<OTEstadoAdmin, number> = {
    CREADA: 0, ASIGNADA: 0, COORDINADA: 0, EN_CURSO: 0,
    CIERRE_TECNICO: 0, CIERRE_ADMINISTRATIVO: 0, FINALIZADO: 0, CANCELADA: 0,
  };
  let cerradasMes = 0;
  let sinIngeniero = 0;
  let leadTimeSum = 0;
  let leadTimeCount = 0;

  for (const ot of ots) {
    const estado: OTEstadoAdmin = ot.estadoAdmin ?? 'CREADA';
    porEstado[estado] = (porEstado[estado] ?? 0) + 1;

    const fechaCierre = safeTs(ot.fechaCierre);
    if (estado === 'FINALIZADO' && fechaCierre >= monthStart) {
      cerradasMes += 1;
    }

    if (ESTADOS_OT_ABIERTOS.includes(estado) && !ot.ingenieroAsignadoId) {
      sinIngeniero += 1;
    }

    if (estado === 'FINALIZADO' && fechaCierre >= ninetyAgo) {
      const created = safeTs(ot.createdAt);
      if (created > 0 && fechaCierre > created) {
        leadTimeSum += (fechaCierre - created) / 86400000;
        leadTimeCount += 1;
      }
    }
  }

  return {
    otsPorEstado: porEstado,
    otsCerradasMes: cerradasMes,
    leadTimeDiasPromedio: leadTimeCount > 0 ? leadTimeSum / leadTimeCount : null,
    otsSinIngeniero: sinIngeniero,
  };
}

function aggregateTickets(tickets: Ticket[]): TicketsKPIs {
  const porArea: Record<TicketArea | 'sin_area', number> = {
    admin_soporte: 0, ing_soporte: 0, administracion: 0, ventas: 0, compras: 0, materiales: 0, sistema: 0, sin_area: 0,
  };
  const porPrioridad: Record<TicketPrioridad | 'sin_prioridad', number> = {
    urgente: 0, alta: 0, normal: 0, baja: 0, muy_baja: 0, sin_prioridad: 0,
  };
  let abiertos = 0;
  let sinAsignar = 0;
  let altaPrioridadVencida48h = 0;
  const cutoff48h = daysAgo(2);

  for (const t of tickets) {
    if (TICKET_ESTADOS_CERRADOS.includes(t.estado)) continue;
    abiertos += 1;

    const area = t.areaActual ?? 'sin_area';
    porArea[area] = (porArea[area] ?? 0) + 1;

    const prioridad = t.prioridad ?? 'sin_prioridad';
    porPrioridad[prioridad] = (porPrioridad[prioridad] ?? 0) + 1;

    if (!t.asignadoA) sinAsignar += 1;

    if ((t.prioridad === 'urgente' || t.prioridad === 'alta') && safeTs(t.createdAt) < cutoff48h) {
      altaPrioridadVencida48h += 1;
    }
  }

  return { porArea, porPrioridad, abiertos, sinAsignar, altaPrioridadVencida48h };
}

function aggregateEquipos(contratos: Contrato[]): EquiposKPIs {
  let activos = 0;
  let vencidos = 0;
  let sistemasCubiertos = 0;

  for (const c of contratos) {
    if (c.estado === 'activo') {
      activos += 1;
      sistemasCubiertos += (c.sistemaIds?.length ?? 0);
    }
    if (c.estado === 'vencido') vencidos += 1;
  }

  return { bajoContratoTotal: sistemasCubiertos, contratosActivos: activos, contratosVencidos: vencidos };
}

/** Orden de urgencia para el detalle de la card. */
const PESO_ESTADO: Record<EstadoCertificado, number> = {
  vencido: 0, sin_certificado: 1, por_vencer: 2, vigente: 3,
};

function aggregateCalibracion(instrumentos: InstrumentoPatron[], patrones: Patron[]): CalibracionKPIs {
  const inst = { vencidos: 0, porVencer: 0, sinCertificado: 0, enCalibracion: 0 };
  const pat = { vencidos: 0, porVencer: 0, sinVencimiento: 0 };
  const proximos: CalibracionKPIs['proximos'] = [];

  for (const i of instrumentos) {
    // Ya está afuera calibrándose: no es una acción pendiente, es una en curso.
    // Mismo criterio que `necesitaCalibrar` en InstrumentosList.
    if (i.estadoCalibracion === 'en_calibracion') { inst.enCalibracion += 1; continue; }
    const estado = calcularEstadoCertificado(i.certificadoVencimiento, DIAS_PREAVISO_CERTIFICADO);
    if (estado === 'vigente') continue;
    if (estado === 'vencido') inst.vencidos += 1;
    else if (estado === 'por_vencer') inst.porVencer += 1;
    else inst.sinCertificado += 1;
    proximos.push({
      id: i.id, tipo: 'instrumento', nombre: i.nombre,
      detalle: [i.marca, i.modelo, i.serie].filter(Boolean).join(' · '),
      vencimiento: i.certificadoVencimiento ?? null, estado,
    });
  }

  for (const p of patrones) {
    for (const lote of p.lotes ?? []) {
      // Un patrón sin fecha de vencimiento no es un hallazgo: hay lotes que no
      // vencen. Se cuenta aparte para no inflar el número de la card.
      if (!lote.fechaVencimiento) { pat.sinVencimiento += 1; continue; }
      const estado = calcularEstadoCertificado(lote.fechaVencimiento, DIAS_PREAVISO_CERTIFICADO);
      if (estado === 'vigente') continue;
      if (estado === 'vencido') pat.vencidos += 1; else pat.porVencer += 1;
      proximos.push({
        id: p.id, tipo: 'patron', nombre: p.descripcion || p.codigoArticulo,
        detalle: `Lote ${lote.lote}${p.marca ? ` · ${p.marca}` : ''}`,
        vencimiento: lote.fechaVencimiento, estado,
      });
    }
  }

  proximos.sort((a, b) => {
    const d = PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado];
    if (d !== 0) return d;
    return safeTs(a.vencimiento) - safeTs(b.vencimiento);
  });

  return { instrumentos: inst, patrones: pat, proximos };
}

export const dashboardService = {
  async load(): Promise<DashboardData> {
    const [presupuestos, ots, tickets, contratos, instrumentos, patrones] = await Promise.all([
      presupuestosService.getAll().catch(() => [] as Presupuesto[]),
      ordenesTrabajoService.getAll().catch(() => [] as WorkOrder[]),
      leadsService.getAll().catch(() => [] as Ticket[]),
      contratosService.getAll().catch(() => [] as Contrato[]),
      instrumentosService.getAll({ tipo: 'instrumento', activoOnly: true }).catch(() => [] as InstrumentoPatron[]),
      patronesService.getAll({ activoOnly: true }).catch(() => [] as Patron[]),
    ]);

    return {
      pipeline: aggregatePipeline(presupuestos, contratos),
      operacion: aggregateOperacion(ots),
      tickets: aggregateTickets(tickets),
      equipos: aggregateEquipos(contratos),
      calibracion: aggregateCalibracion(instrumentos, patrones),
      loadedAt: new Date().toISOString(),
    };
  },
};
