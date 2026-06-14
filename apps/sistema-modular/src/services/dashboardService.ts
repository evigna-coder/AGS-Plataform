import type { Presupuesto, WorkOrder, Ticket, Contrato, OTEstadoAdmin, TicketEstado, TicketArea, TicketPrioridad } from '@ags/shared';
import { presupuestosService } from './presupuestosService';
import { ordenesTrabajoService } from './otService';
import { leadsService } from './leadsService';
import { contratosService } from './contratosService';

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
  loadedAt: string;
}

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

    if (p.estado === 'aceptado' && updatedAt >= monthStart) {
      aceptadosMes.count += 1;
      if (p.moneda === 'USD' || p.moneda === 'MIXTA') aceptadosMes.montoUSD += total;
      else if (p.moneda === 'ARS') aceptadosMes.montoARS += total;
    }

    if (fechaEnvio >= ninetyAgo) enviados90 += 1;
    if (p.estado === 'aceptado' && updatedAt >= ninetyAgo) aceptados90 += 1;
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
    CIERRE_TECNICO: 0, CIERRE_ADMINISTRATIVO: 0, FINALIZADO: 0,
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

export const dashboardService = {
  async load(): Promise<DashboardData> {
    const [presupuestos, ots, tickets, contratos] = await Promise.all([
      presupuestosService.getAll().catch(() => [] as Presupuesto[]),
      ordenesTrabajoService.getAll().catch(() => [] as WorkOrder[]),
      leadsService.getAll().catch(() => [] as Ticket[]),
      contratosService.getAll().catch(() => [] as Contrato[]),
    ]);

    return {
      pipeline: aggregatePipeline(presupuestos, contratos),
      operacion: aggregateOperacion(ots),
      tickets: aggregateTickets(tickets),
      equipos: aggregateEquipos(contratos),
      loadedAt: new Date().toISOString(),
    };
  },
};
