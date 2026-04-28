/**
 * Helpers puros (sin Firestore SDK) para parsear y migrar Lead/Ticket docs.
 * Antes vivían duplicados en sistema-modular/leadsService, portal-ingeniero/firebaseService
 * y reportes-ot/firebaseService — con drift confirmado entre versiones.
 *
 * Los servicios concretos (CRUD) siguen viviendo en cada app porque dependen
 * de la instancia Firestore local. Lo que se extrae acá es la lógica de
 * transformación: state mappings, migrations de campos legacy, y el parser
 * de DocumentSnapshot → Lead.
 */
import type {
  Lead, TicketEstado, TicketArea, MotivoLlamado, ContactoTicket,
  PresupuestoEstado, OTEstadoAdmin,
} from '../types';
import { getContactoPrincipal } from '../types';

// ── Mapeos de estados ─────────────────────────────────────────────────────────

/**
 * Mapeo: estado de presupuesto → estado del ticket vinculado.
 *
 * Cubre transiciones que disparan sync automático del ticket al cambiar el ppto.
 * - `en_ejecucion` significa "OT(s) ya creadas y trabajando" → ticket pasa a ot_creada.
 * - `anulado` cierra el ticket como `no_concretado` (la oportunidad se cayó).
 */
export const PRESUPUESTO_TO_LEAD_ESTADO: Partial<Record<PresupuestoEstado, TicketEstado>> = {
  enviado: 'presupuesto_enviado',
  aceptado: 'en_coordinacion',
  en_ejecucion: 'ot_creada',
  anulado: 'no_concretado',
  finalizado: 'finalizado',
};

/** Labels human-readable para los estados de presupuesto (usados en postas). */
export const PRESUPUESTO_ESTADO_LABELS: Partial<Record<PresupuestoEstado, string>> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  anulado: 'Anulado',
  finalizado: 'Finalizado',
};

/**
 * Mapeo: estadoAdmin de OT → estado del ticket vinculado.
 * Antes estaba duplicado en sistema-modular/leadsService y reportes-ot/firebaseService;
 * el comentario de reportes-ot reconocía la duplicación intencional ("escribimos
 * directo a Firestore"). Acá queda single source of truth.
 */
export const OT_TO_LEAD_ESTADO: Partial<Record<OTEstadoAdmin, TicketEstado>> = {
  CREADA: 'ot_creada',
  ASIGNADA: 'ot_creada',
  COORDINADA: 'ot_coordinada',
  EN_CURSO: 'ot_coordinada',
  CIERRE_TECNICO: 'ot_realizada',
  CIERRE_ADMINISTRATIVO: 'pendiente_aviso_facturacion',
  FINALIZADO: 'finalizado',
};

// ── Migraciones de campos legacy ──────────────────────────────────────────────

/**
 * Migra valores de estado legacy al esquema actual de TicketEstado.
 *
 * Los estados intermedios introducidos en Phase 8/10 (esperando_oc, oc_recibida,
 * pendiente_aviso_facturacion, pendiente_facturacion, ot_creada, ot_coordinada,
 * ot_realizada) son nuevos y solo se setean explícitamente — los tickets legacy
 * no tienen forma de inferirlos, por eso no aparecen en este mapping.
 *
 * Un ticket viejo con estado='presupuestado' se asume que el ppto ya fue
 * enviado al cliente (no que está pendiente de generar) — por eso se mapea a
 * 'presupuesto_enviado' y no a 'presupuesto_pendiente'.
 *
 * Si necesitás un análisis más fino (¿está aceptado? ¿anulado?), correr
 * /admin/backfill-ticket-estados (no implementado aún — TODO Phase 13).
 */
export function migrateLeadEstado(raw: string): TicketEstado {
  const migration: Record<string, TicketEstado> = {
    contactado: 'en_seguimiento',
    en_revision: 'en_seguimiento',
    derivado: 'en_seguimiento',
    presupuestado: 'presupuesto_enviado',
    pendiente_info: 'en_seguimiento',
    en_presupuesto: 'presupuesto_pendiente',
    en_proceso: 'en_seguimiento',
    convertido: 'finalizado',
    perdido: 'no_concretado',
  };
  if (migration[raw]) {
    // Log para que admin pueda detectar tickets que requieren backfill manual.
    if (typeof console !== 'undefined') {
      console.debug(`[migrateLeadEstado] legacy '${raw}' → '${migration[raw]}' — considerar backfill`);
    }
    return migration[raw];
  }
  return (raw as TicketEstado) || 'nuevo';
}

/** Migra valores de motivoLlamado legacy. */
export function migrateMotivoLlamado(raw: string | null | undefined): MotivoLlamado {
  if (!raw) return 'soporte';
  const migration: Record<string, MotivoLlamado> = {
    ventas: 'ventas_insumos',
    insumos: 'ventas_insumos',
    capacitacion: 'otros',
  };
  return migration[raw] || (raw as MotivoLlamado);
}

/** Migra valores de areaActual legacy al esquema actual de TicketArea. */
export function migrateLeadArea(raw: string | null | undefined): TicketArea | null {
  if (!raw) return null;
  const migration: Record<string, TicketArea> = {
    presupuesto: 'ventas',
    contrato: 'ventas',
    venta_insumos: 'ventas',
    presupuesto_ventas: 'ventas',
    soporte: 'admin_soporte',
    agenda_coordinacion: 'admin_soporte',
    materiales_comex: 'admin_soporte',
    ingeniero_soporte: 'ing_soporte',
    facturacion: 'administracion',
    pago_proveedores: 'administracion',
  };
  return migration[raw] || (raw as TicketArea);
}

// ── Hidratación de contactos ──────────────────────────────────────────────────

/**
 * Hidrata `contactos[]` desde los campos planos (`contacto/email/telefono`) cuando
 * el ticket es previo al refactor. La hidratación es en memoria — no se persiste
 * hasta que el usuario edite contactos.
 */
export function hydrateContactosTicket(data: Record<string, unknown>): ContactoTicket[] {
  const existing = Array.isArray(data.contactos) ? (data.contactos as ContactoTicket[]) : [];
  if (existing.length > 0) return existing;
  const nombre = ((data.contacto as string) ?? '').trim();
  const email = ((data.email as string) ?? '').trim();
  const telefono = ((data.telefono as string) ?? '').trim();
  if (!nombre && !email && !telefono) return [];
  return [{
    id: 'legacy-principal',
    nombre: nombre || '(Sin nombre)',
    email: email || undefined,
    telefono: telefono || undefined,
    esPrincipal: true,
  }];
}

/**
 * Si el payload incluye `contactos`, refleja el contacto principal en los campos planos
 * (`contacto/email/telefono`) para preservar listas, búsquedas y compat con tickets viejos.
 */
export function syncFlatFromContactos<T extends Record<string, any>>(data: T): T {
  if (!('contactos' in data) || !Array.isArray(data.contactos)) return data;
  const principal = getContactoPrincipal(data.contactos as ContactoTicket[]);
  return {
    ...data,
    contacto: principal?.nombre ?? '',
    email: principal?.email ?? '',
    telefono: principal?.telefono ?? '',
  };
}

// ── Parser DocumentSnapshot → Lead ────────────────────────────────────────────

/** Duck-typed Firestore Timestamp — solo necesitamos `.toDate()`. */
type TimestampLike = { toDate: () => Date };
function toISO(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  const ts = v as TimestampLike;
  return typeof ts.toDate === 'function' ? ts.toDate().toISOString() : null;
}

/**
 * Parser canónico de DocumentSnapshot → Lead. Acepta cualquier shape que provea
 * `id` y `data()` (DocumentSnapshot, QueryDocumentSnapshot).
 *
 * Hidrata todos los campos de migración (clienteId batch, contactos legacy, etc.)
 * con defaults conservadores.
 */
export function parseLeadDoc(d: { id: string; data: () => Record<string, unknown> }): Lead {
  const data = d.data();
  return {
    id: d.id,
    numero: typeof data.numero === 'string' && data.numero ? (data.numero as string) : undefined,
    clienteId: (data.clienteId as string) ?? null,
    contactoId: (data.contactoId as string) ?? null,
    razonSocial: (data.razonSocial as string) ?? '',
    contactos: hydrateContactosTicket(data),
    contacto: (data.contacto as string) ?? '',
    email: (data.email as string) ?? '',
    telefono: (data.telefono as string) ?? '',
    motivoLlamado: migrateMotivoLlamado(data.motivoLlamado as string),
    motivoContacto: (data.motivoContacto as string) ?? '',
    descripcion: (data.descripcion as string) ?? null,
    ultimaObservacion: (data.ultimaObservacion as string) ?? null,
    sistemaId: (data.sistemaId as string) ?? null,
    moduloId: (data.moduloId as string) ?? null,
    estado: migrateLeadEstado((data.estado as string) ?? 'nuevo'),
    postas: (data.postas as Lead['postas']) ?? [],
    asignadoA: (data.asignadoA as string) ?? null,
    asignadoNombre: (data.asignadoNombre as string) ?? null,
    derivadoPor: (data.derivadoPor as string) ?? null,
    areaActual: migrateLeadArea(data.areaActual as string),
    accionPendiente: (data.accionPendiente as string) ?? null,
    adjuntos: (data.adjuntos as Lead['adjuntos']) ?? [],
    presupuestosIds: (data.presupuestosIds as string[]) ?? [],
    otIds: (data.otIds as string[]) ?? [],
    // Fallback al timestamp actual en vez de '' — el parser miente menos.
    // Tickets legacy sin createdAt aparecen en el momento de hidratación, no en el epoch.
    createdAt: toISO(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toISO(data.updatedAt) ?? new Date().toISOString(),
    createdBy: (data.createdBy as string) ?? null,
    finalizadoAt: toISO(data.finalizadoAt),
    prioridad: data.prioridad === 'media' ? 'normal' : ((data.prioridad as Lead['prioridad']) ?? null),
    proximoContacto: (data.proximoContacto as string) ?? null,
    valorEstimado: (data.valorEstimado as number) ?? null,
    pendienteClienteId: data.pendienteClienteId === true,
    candidatosPropuestos: Array.isArray(data.candidatosPropuestos)
      ? (data.candidatosPropuestos as Lead['candidatosPropuestos'])
      : [],
    clienteIdMigradoAt: toISO(data.clienteIdMigradoAt),
    clienteIdMigradoPor: typeof data.clienteIdMigradoPor === 'string' ? data.clienteIdMigradoPor : null,
    revisionDescartada: data.revisionDescartada === true,
  };
}
