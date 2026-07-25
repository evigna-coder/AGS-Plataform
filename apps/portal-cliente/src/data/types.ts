import type { BadgeTone } from '@/components/ui/Badge';

/**
 * View-models del portal cliente. Son proyecciones pensadas para la UI;
 * cuando conectemos Firestore, los servicios devolverán estas mismas formas
 * (a partir de `Sistema`, `FichaPropiedad`, `WorkOrder`, `AgendaEntry` de @ags/shared).
 */

export interface ClientePortal {
  /** CUIT normalizado (id del Cliente en Firestore). */
  id: string;
  razonSocial: string;
  iniciales: string;
  establecimientosCount: number;
}

export interface FleetSummary {
  total: number;
  operativos: number;
  enBench: number;
  informesNuevos: number;
  proximosServicios: number;
}

export interface ActivityItem {
  id: string;
  tone: BadgeTone;
  title: string;
  meta: string;
}

export interface BienvenidaData {
  cliente: ClientePortal;
  fleet: FleetSummary;
  actividad: ActivityItem[];
  /** ISO de la última actualización de los datos. */
  actualizadoAt: string;
}

// ─── Equipos (Sistema) ──────────────────────────────────────────────

export type EquipoEstadoKey =
  | 'operativo'
  | 'en_diagnostico'
  | 'en_reparacion'
  | 'esperando_repuesto'
  | 'listo_entrega';

export const ESTADO_BADGE: Record<EquipoEstadoKey, { label: string; tone: BadgeTone }> = {
  operativo: { label: 'En planta · operativo', tone: 'success' },
  en_diagnostico: { label: 'En diagnóstico', tone: 'info' },
  en_reparacion: { label: 'En reparación', tone: 'warn' },
  esperando_repuesto: { label: 'Esperando repuesto', tone: 'danger' },
  listo_entrega: { label: 'Listo para entrega', tone: 'success' },
};

const EN_BENCH: EquipoEstadoKey[] = [
  'en_diagnostico',
  'en_reparacion',
  'esperando_repuesto',
  'listo_entrega',
];

export function estaEnBench(estado: EquipoEstadoKey): boolean {
  return EN_BENCH.includes(estado);
}

export interface EquipoResumen {
  /** agsVisibleId, ej. AGS-EQ-1043. */
  id: string;
  nombre: string;
  categoria: string;
  marca: string;
  establecimiento: string;
  sector: string;
  estado: EquipoEstadoKey;
  contrato: boolean;
  otsCount: number;
  /** Nombre de ícono lucide (por categoría). */
  icon: string;
}

export interface OtHistorialItem {
  id: string;
  tipo: string;
  fecha: string;
  pdf: boolean;
}

export type FichaPasoStatus = 'done' | 'current' | 'pending';

export interface FichaPaso {
  label: string;
  fecha?: string;
  status: FichaPasoStatus;
}

export interface SeguimientoEvento {
  tone: BadgeTone;
  title: string;
  fecha: string;
  nota: string;
}

export interface FichaBench {
  numero: string;
  ingreso: string;
  etaEntrega?: string;
  loaner?: string;
  repuestoPendiente?: string;
  sintomas?: string;
  pasoActual: string;
  totalPasos: number;
  pasos: FichaPaso[];
  seguimiento: SeguimientoEvento[];
}

export interface EquipoDetalle extends EquipoResumen {
  serie: string;
  software?: string;
  ultimoServicio?: string;
  proximoServicio?: string;
  otsPorAnio: { anio: string; cantidad: number }[];
  ultimasOts: OtHistorialItem[];
  /** Presente solo si el equipo está en el bench de AGS. */
  ficha?: FichaBench;
}
