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
 * Clasifica el semáforo de entrega según días restantes.
 * Override: opts.entregado=true → 'entregado' (ganador absoluto).
 */
export function computeSemaforo(
  diasRestantes: number | null,
  opts?: { entregado?: boolean },
): Semaforo {
  if (opts?.entregado) return 'entregado';
  if (diasRestantes === null) return 'sin_eta';
  if (diasRestantes > 5) return 'verde';
  if (diasRestantes >= 0) return 'amarillo';
  return 'rojo';
}

/**
 * Calcula la fecha ETA como UTC midnight de fechaAceptacion + etaDiasEstimados días.
 * Suma días en UTC para evitar drift por DST/timezone (Pitfall 5 del RESEARCH).
 */
export function computeEtaFecha(
  fechaAceptacionIso: string | null,
  etaDiasEstimados: number | null,
): string | null {
  if (!fechaAceptacionIso || etaDiasEstimados == null) return null;
  const base = new Date(fechaAceptacionIso);
  if (isNaN(base.getTime())) return null;
  const eta = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + etaDiasEstimados,
  ));
  return eta.toISOString();
}

/** Diferencia en días completos (UTC) entre una fecha ISO y "now". */
function diasEntre(etaIso: string, now: Date): number {
  const eta = new Date(etaIso);
  const etaUtc = Date.UTC(eta.getUTCFullYear(), eta.getUTCMonth(), eta.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((etaUtc - nowUtc) / 86400000);
}

/**
 * Produce una EntregaRow por item de cada presupuesto, realizando joins en memoria:
 *   presupuestoItem ↔ requerimiento via `req.presupuestoItemId` (O(1), Plan 16-02)
 *   requerimiento ↔ ocItem via `ocItem.requerimientoId`
 *   requerimiento ↔ itemImportacion via `itemImp.requerimientoId`
 * Legacy: reqs con presupuestoItemId=null no se unen (sin_eta + no req chain).
 */
export function buildEntregaRows(input: BuildEntregaRowsInput): EntregaRow[] {
  const now = input.now ?? new Date();

  // 1) Indexar requerimientos por presupuestoItemId.
  const reqByItemId = new Map<string, RequerimientoCompra>();
  for (const req of input.requerimientos) {
    if (req.presupuestoItemId) reqByItemId.set(req.presupuestoItemId, req);
  }

  // 2) Indexar ocItem.requerimientoId → { ocId, ocNumero }.
  const ocByReqId = new Map<string, { ocId: string; ocNumero: string }>();
  for (const oc of input.ordenesCompra) {
    for (const ocItem of oc.items) {
      if (ocItem.requerimientoId) {
        ocByReqId.set(ocItem.requerimientoId, { ocId: oc.id, ocNumero: oc.numero });
      }
    }
  }

  // 3) Indexar itemImportacion.requerimientoId → resumen importación.
  type ImpResumen = { impId: string; impNumero: string; impEstado: string; entregado: boolean };
  const impByReqId = new Map<string, ImpResumen>();
  for (const imp of input.importaciones) {
    for (const itemImp of (imp.items ?? [])) {
      if (!itemImp.requerimientoId) continue;
      const entregado =
        imp.estado === 'recibido' ||
        ((itemImp.cantidadRecibida ?? 0) >= itemImp.cantidadPedida);
      impByReqId.set(itemImp.requerimientoId, {
        impId: imp.id,
        impNumero: imp.numero,
        impEstado: imp.estado as string,
        entregado,
      });
    }
  }

  // 4) Construir filas — una por item de presupuesto.
  const rows: EntregaRow[] = [];
  for (const ppto of input.presupuestos) {
    const clienteNombre = input.clienteNombreById.get(ppto.clienteId) ?? '—';
    for (const item of (ppto.items ?? [])) {
      const req = item.id ? reqByItemId.get(item.id) ?? null : null;
      const oc = req ? ocByReqId.get(req.id) ?? null : null;
      const imp = req ? impByReqId.get(req.id) ?? null : null;

      const etaFecha = computeEtaFecha(
        ppto.fechaAceptacion ?? null,
        item.etaDiasEstimados ?? null,
      );
      const diasRestantes = etaFecha ? diasEntre(etaFecha, now) : null;
      const semaforo = computeSemaforo(diasRestantes, { entregado: imp?.entregado === true });

      rows.push({
        presupuestoId: ppto.id,
        presupuestoNumero: ppto.numero,
        itemId: item.id ?? `${ppto.id}::${rows.length}`,
        clienteId: ppto.clienteId,
        clienteNombre,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        moneda: (item.moneda ?? null) as EntregaRow['moneda'],
        disponibilidad: (item.disponibilidad ?? null) as EntregaRow['disponibilidad'],
        etaDiasEstimados: item.etaDiasEstimados ?? null,
        fechaAceptacion: ppto.fechaAceptacion ?? null,
        etaFecha,
        diasRestantes,
        semaforo,
        otNumeroVinculada: item.otNumeroVinculada ?? null,
        requerimientoId: req?.id ?? null,
        requerimientoNumero: req?.numero ?? null,
        ocNumero: oc?.ocNumero ?? null,
        importacionId: imp?.impId ?? null,
        importacionNumero: imp?.impNumero ?? null,
        importacionEstado: imp?.impEstado ?? null,
      });
    }
  }
  return rows;
}
