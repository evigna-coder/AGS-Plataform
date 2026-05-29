/**
 * Phase 16 — Pure-function resolver para el visor de entregas.
 *
 * 3 funciones puras testeables sin Firestore:
 *   - computeSemaforo(diasRestantes, opts) — clasifica el semáforo
 *   - computeEtaFecha(fechaAceptacionIso, etaDiasEstimados) — calcula la fecha ETA
 *   - buildEntregaRows(input) — joins en memoria de la cadena ppto→req→oc→imp
 *
 * Plan 16-01 (Wave 0): STUBS — funciones tiran NotImplemented.
 * Plan 16-03 (Wave 1): impls. Tests turn GREEN.
 */
import type {
  Presupuesto,
  RequerimientoCompra,
  Importacion,
  Disponibilidad,
} from '@ags/shared';

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'entregado' | 'sin_eta';

export const SEMAFORO_COLORS: Record<Semaforo, string> = {
  verde:     'text-emerald-600',
  amarillo:  'text-amber-500',
  rojo:      'text-red-600',
  entregado: 'text-slate-400',
  sin_eta:   'text-slate-300',
};

export const SEMAFORO_LABELS: Record<Semaforo, string> = {
  verde:     'En plazo',
  amarillo:  'Próximo',
  rojo:      'Vencido',
  entregado: 'Entregado',
  sin_eta:   'Sin ETA',
};

export interface EntregaRow {
  presupuestoId: string;
  presupuestoNumero: string;
  itemId: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  moneda: 'USD' | 'ARS' | 'EUR' | null;
  disponibilidad: Disponibilidad | null;
  etaDiasEstimados: number | null;
  fechaAceptacion: string | null;
  etaFecha: string | null;
  diasRestantes: number | null;
  semaforo: Semaforo;
  otNumeroVinculada: string | null;
  requerimientoId: string | null;
  requerimientoNumero: string | null;
  ocNumero: string | null;
  importacionId: string | null;
  importacionNumero: string | null;
  importacionEstado: string | null;
}

export interface BuildEntregaRowsInput {
  presupuestos: Array<Pick<Presupuesto, 'id' | 'numero' | 'clienteId' | 'estado' | 'items' | 'fechaAceptacion'>>;
  requerimientos: RequerimientoCompra[];
  ordenesCompra: Array<{ id: string; numero: string; items: Array<{ id: string; requerimientoId?: string | null }> }>;
  importaciones: Array<Pick<Importacion, 'id' | 'numero' | 'estado' | 'items'>>;
  clienteNombreById: Map<string, string>;
  /** Inyectable para tests; default = new Date() */
  now?: Date;
}

/**
 * STUB — Plan 16-03 implementará.
 *
 * Returns:
 *   - 'sin_eta' si diasRestantes === null
 *   - 'entregado' si opts.entregado === true
 *   - 'verde' si diasRestantes > 5
 *   - 'amarillo' si 0 <= diasRestantes <= 5
 *   - 'rojo' si diasRestantes < 0
 */
export function computeSemaforo(
  _diasRestantes: number | null,
  _opts?: { entregado?: boolean },
): Semaforo {
  throw new Error('NotImplemented — Plan 16-03');
}

/**
 * STUB — Plan 16-03 implementará.
 *
 * Returns ISO date (YYYY-MM-DD) of fechaAceptacion + etaDiasEstimados, or null si falta dato.
 */
export function computeEtaFecha(
  _fechaAceptacionIso: string | null,
  _etaDiasEstimados: number | null,
): string | null {
  throw new Error('NotImplemented — Plan 16-03');
}

/**
 * STUB — Plan 16-03 implementará.
 *
 * Toma presupuestos + requerimientos + OCs + importaciones + clienteNombreById y
 * produce una lista plana de EntregaRow (una por item de cada presupuesto activo).
 *
 * Joins:
 *   - presupuestoItem ↔ requerimiento via `req.presupuestoItemId === item.id`
 *     (fallback: req.presupuestoId + articuloId match si presupuestoItemId no existe — legacy)
 *   - requerimiento ↔ ocItem via `ocItem.requerimientoId === req.id`
 *   - requerimiento ↔ itemImportacion via `itemImp.requerimientoId === req.id`
 */
export function buildEntregaRows(_input: BuildEntregaRowsInput): EntregaRow[] {
  throw new Error('NotImplemented — Plan 16-03');
}
