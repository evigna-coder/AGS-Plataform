import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type {
  CalificacionProveedor, CriterioEvaluacion, EstadoCalificacion, Importacion,
  Lead, OrdenCompra, OrigenCalificacion, TicketArea, TicketEstado,
} from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';
import { getCurrentUser } from './currentUser';

const COLLECTION = 'calificaciones_proveedor';

/** Hidrata un doc: legacy sin estadoCiclo = calificada manual (ya tiene puntaje). */
function parseCalificacion(id: string, data: Record<string, any>): CalificacionProveedor {
  return {
    id,
    ...data,
    estadoCiclo: data.estadoCiclo ?? 'calificada',
    origen: data.origen ?? 'manual',
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  } as CalificacionProveedor;
}

export function calcEstadoCalificacion(puntaje: number): EstadoCalificacion {
  return puntaje >= 80 ? 'aprobado' : puntaje >= 60 ? 'condicional' : 'no_aprobado';
}

/**
 * Promedio ponderado por antigüedad (decisión 2026-08-12: lo reciente pesa más).
 * Peso lineal sobre la edad de la calificación: hoy = 1.0, 24 meses = 0.2, y de
 * ahí en adelante piso 0.2 (lo viejo nunca deja de contar, pero pesa poco).
 * Solo considera calificaciones completadas (estadoCiclo 'calificada').
 */
export function promedioPonderado(items: CalificacionProveedor[]): { promedio: number; count: number; estado: EstadoCalificacion } {
  const calificadas = items.filter(c =>
    (c.estadoCiclo ?? 'calificada') === 'calificada' && typeof c.puntajeTotal === 'number');
  if (calificadas.length === 0) return { promedio: 0, count: 0, estado: 'sin_datos' };
  const now = Date.now();
  let sumPeso = 0;
  let sumPuntaje = 0;
  for (const c of calificadas) {
    const fecha = new Date(c.fechaRecepcion || c.createdAt).getTime();
    const edadDias = isNaN(fecha) ? 0 : Math.max(0, (now - fecha) / 86400000);
    const peso = Math.max(0.2, 1 - (edadDias / 730) * 0.8); // 730 días = 24 meses
    sumPeso += peso;
    sumPuntaje += peso * (c.puntajeTotal as number);
  }
  const promedio = Math.round(sumPuntaje / sumPeso);
  return { promedio, count: calificadas.length, estado: calcEstadoCalificacion(promedio) };
}

/** Días de atraso de `real` (default hoy) vs. `prometida`; negativo = antes. */
function diasAtrasoVs(prometida: string | null | undefined, real?: string | null): number | null {
  if (!prometida) return null;
  const p = new Date(prometida).getTime();
  const r = new Date(real || new Date().toISOString()).getTime();
  if (isNaN(p) || isNaN(r)) return null;
  return Math.round((r - p) / 86400000);
}

export interface PendienteCalificacionInput {
  proveedorId: string;
  proveedorNombre: string;
  origen: Exclude<OrigenCalificacion, 'manual'>;
  /** Clave de dedupe — si ya existe un doc con esta clave, no se crea nada. */
  origenKey: string;
  origenId: string;
  origenLabel: string;
  fechaEvento: string; // ISO
  fechaPrometida?: string | null;
  diasAtraso?: number | null;
  completitudPct?: number | null;
  diasEnProveedor?: number | null;
  ordenCompraId?: string | null;
  ordenCompraNro?: string | null;
  importacionId?: string | null;
  remitoId?: string | null;
  remitoNro?: string | null;
  fichaId?: string | null;
  itemFichaId?: string | null;
  instrumentoId?: string | null;
  loanerId?: string | null;
}

export const calificacionesService = {
  async getAll(filters?: {
    proveedorId?: string;
    estado?: string;
  }): Promise<CalificacionProveedor[]> {
    let q = query(collection(db, COLLECTION), orderBy('fechaRecepcion', 'desc'));
    if (filters?.proveedorId) {
      q = query(collection(db, COLLECTION), where('proveedorId', '==', filters.proveedorId), orderBy('fechaRecepcion', 'desc'));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => parseCalificacion(d.id, d.data()));
    if (filters?.estado) {
      items = items.filter(c => c.estado === filters.estado);
    }
    return items;
  },

  subscribe(
    filters: { proveedorId?: string } | undefined,
    callback: (items: CalificacionProveedor[]) => void,
    onError?: (error: Error) => void,
  ) {
    let q = query(collection(db, COLLECTION), orderBy('fechaRecepcion', 'desc'));
    if (filters?.proveedorId) {
      q = query(collection(db, COLLECTION), where('proveedorId', '==', filters.proveedorId), orderBy('fechaRecepcion', 'desc'));
    }
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => parseCalificacion(d.id, d.data())));
    }, onError);
  },

  async getById(id: string): Promise<CalificacionProveedor | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return parseCalificacion(snap.id, snap.data());
  },

  async create(data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const user = getCurrentUser();
    const payload = deepCleanForFirestore({
      origen: 'manual' as const,
      estadoCiclo: 'calificada' as const,
      responsableId: user?.id ?? null,
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.set(docRef(COLLECTION, id), payload);
    batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<CalificacionProveedor, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef(COLLECTION, id), payload);
    batchAudit(batch, { action: 'update', collection: COLLECTION, documentId: id, after: payload });
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef(COLLECTION, id));
    batchAudit(batch, { action: 'delete', collection: COLLECTION, documentId: id });
    await batch.commit();
  },

  /** Completa una pendiente con el puntaje. */
  async calificar(id: string, data: {
    criterios: CriterioEvaluacion[];
    puntajeTotal: number;
    observaciones?: string | null;
    responsable: string;
  }): Promise<void> {
    const user = getCurrentUser();
    await this.update(id, {
      estadoCiclo: 'calificada',
      criterios: data.criterios,
      puntajeTotal: data.puntajeTotal,
      estado: calcEstadoCalificacion(data.puntajeTotal),
      observaciones: data.observaciones ?? null,
      responsable: data.responsable,
      responsableId: user?.id ?? null,
    });
  },

  /** Descarta una pendiente con motivo (cualquiera puede; decisión 2026-08-12). */
  async omitir(id: string, motivo: string): Promise<void> {
    const user = getCurrentUser();
    await this.update(id, {
      estadoCiclo: 'omitida',
      omitidaMotivo: motivo,
      responsable: user?.displayName ?? null,
      responsableId: user?.id ?? null,
    });
  },

  /**
   * Disparador central (2026-08-12): crea una calificación PENDIENTE si no hay
   * ya un doc con el mismo `origenKey` (idempotente) y le cuelga un ticket
   * autoasignado al usuario actual para que no se pierda. Best-effort SIEMPRE:
   * un fallo acá jamás debe romper el flujo que lo dispara — no lanza.
   */
  async crearPendienteSiNoExiste(input: PendienteCalificacionInput): Promise<string | null> {
    try {
      if (!input.proveedorId) return null;
      const dup = await getDocs(query(collection(db, COLLECTION), where('origenKey', '==', input.origenKey)));
      if (!dup.empty) return null;

      const id = crypto.randomUUID();
      const user = getCurrentUser();
      const payload = deepCleanForFirestore({
        proveedorId: input.proveedorId,
        proveedorNombre: input.proveedorNombre,
        origen: input.origen,
        origenKey: input.origenKey,
        origenId: input.origenId,
        origenLabel: input.origenLabel,
        estadoCiclo: 'pendiente' as const,
        // Puntaje ausente hasta calificar; fechaRecepcion = fecha del evento
        // (YYYY-MM-DD) para que el orderBy del listado la ubique bien.
        fechaRecepcion: input.fechaEvento.split('T')[0],
        fechaEvento: input.fechaEvento,
        fechaPrometida: input.fechaPrometida ?? null,
        diasAtraso: input.diasAtraso ?? null,
        completitudPct: input.completitudPct ?? null,
        diasEnProveedor: input.diasEnProveedor ?? null,
        ordenCompraId: input.ordenCompraId ?? null,
        ordenCompraNro: input.ordenCompraNro ?? null,
        importacionId: input.importacionId ?? null,
        remitoId: input.remitoId ?? null,
        remitoNro: input.remitoNro ?? null,
        fichaId: input.fichaId ?? null,
        itemFichaId: input.itemFichaId ?? null,
        instrumentoId: input.instrumentoId ?? null,
        loanerId: input.loanerId ?? null,
        responsableId: user?.id ?? null,
        responsable: user?.displayName ?? null,
        ...getCreateTrace(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const batch = createBatch();
      batch.set(docRef(COLLECTION, id), payload);
      batchAudit(batch, { action: 'create', collection: COLLECTION, documentId: id, after: payload });
      await batch.commit();

      // Ticket autoasignado a quien registró la recepción/retorno (decisión
      // 2026-08-12: el que registra califica; sin SLA — queda hasta resolverse).
      try {
        const { leadsService } = await import('./leadsService');
        const ticket: Omit<Lead, 'id' | 'updatedAt'> = {
          clienteId: null,
          contactoId: null,
          razonSocial: 'AGS Analítica — Interno',
          contacto: '',
          email: '',
          telefono: '',
          motivoLlamado: 'otros',
          motivoOtros: 'Calificación de proveedor',
          motivoContacto: `Calificar proveedor ${input.proveedorNombre} — ${input.origenLabel}`,
          sistemaId: null,
          estado: 'nuevo' as TicketEstado,
          postas: [],
          asignadoA: user?.id ?? null,
          asignadoNombre: user?.displayName ?? null,
          derivadoPor: null,
          areaActual: 'admin_soporte' as TicketArea,
          esAutogenerado: true,
          descripcion: `Quedó pendiente calificar al proveedor ${input.proveedorNombre} por: ${input.origenLabel}. `
            + 'Resolver desde el módulo Calificación de Proveedores (menú Stock → Calif. Proveedores, pestaña Pendientes).',
          accionPendiente: 'Calificar proveedor',
          prioridad: 'normal',
          otIds: [],
          presupuestosIds: [],
          source: 'manual',
          createdAt: new Date().toISOString(),
        };
        await leadsService.create(ticket);
      } catch (ticketErr) {
        console.error('[calificaciones] pendiente creada pero el ticket falló:', ticketErr);
      }
      return id;
    } catch (err) {
      console.error('[calificaciones] crearPendienteSiNoExiste falló (flujo origen sigue):', err);
      return null;
    }
  },

  /**
   * Disparador para OC NACIONAL recibida (una calificación por OC completa).
   * Las OCs de importación se califican por embarque — acá se saltean.
   */
  async crearPendienteDesdeOC(oc: Pick<OrdenCompra, 'id' | 'numero' | 'tipo' | 'proveedorId' | 'proveedorNombre' | 'items' | 'fechaEntregaEstimada'> & { fechaRecepcion?: string | null }): Promise<void> {
    if (oc.tipo === 'importacion') return;
    const pedida = (oc.items ?? []).reduce((s, it) => s + (it.cantidad ?? 0), 0);
    const recibida = (oc.items ?? []).reduce((s, it) => s + Math.min(it.cantidadRecibida ?? 0, it.cantidad ?? 0), 0);
    const fechaEvento = oc.fechaRecepcion || new Date().toISOString();
    await this.crearPendienteSiNoExiste({
      proveedorId: oc.proveedorId,
      proveedorNombre: oc.proveedorNombre,
      origen: 'oc_recepcion',
      origenKey: `oc_recepcion:${oc.id}`,
      origenId: oc.id,
      origenLabel: `OC ${oc.numero} recibida`,
      fechaEvento,
      fechaPrometida: oc.fechaEntregaEstimada ?? null,
      diasAtraso: diasAtrasoVs(oc.fechaEntregaEstimada, fechaEvento),
      completitudPct: pedida > 0 ? Math.round((recibida / pedida) * 100) : null,
      ordenCompraId: oc.id,
      ordenCompraNro: oc.numero,
    });
  },

  /**
   * Disparador por EMBARQUE recibido: una calificación POR ACTOR — vendedor
   * (proveedor de la OC) + agente de carga + despachante si están cargados.
   * `agenteCarga`/`despachante` en `Importacion` son NOMBRES (los selectores
   * guardan el nombre del proveedor, no el id): se resuelven contra el catálogo
   * por nombre exacto case-insensitive; si no matchean, se saltean con warn.
   */
  async crearPendientesDesdeImportacion(imp: Importacion): Promise<void> {
    try {
      const pedida = (imp.items ?? []).reduce((s, it) => s + (it.cantidadPedida ?? 0), 0);
      const recibida = (imp.items ?? []).reduce((s, it) => s + Math.min(it.cantidadRecibida ?? 0, it.cantidadPedida ?? 0), 0);
      const fechaEvento = new Date().toISOString();
      const base = {
        fechaEvento,
        fechaPrometida: imp.fechaEstimadaArribo ?? null,
        diasAtraso: diasAtrasoVs(imp.fechaEstimadaArribo, imp.fechaArriboReal ?? fechaEvento),
        completitudPct: pedida > 0 ? Math.round((recibida / pedida) * 100) : null,
        importacionId: imp.id,
        ordenCompraId: imp.ordenCompraId ?? null,
        ordenCompraNro: imp.ordenCompraNumero ?? null,
      };

      // Vendedor (proveedor de la OC) — siempre.
      await this.crearPendienteSiNoExiste({
        ...base,
        proveedorId: imp.proveedorId,
        proveedorNombre: imp.proveedorNombre,
        origen: 'importacion_embarque',
        origenKey: `importacion_embarque:${imp.id}:${imp.proveedorId}`,
        origenId: imp.id,
        origenLabel: `Importación ${imp.numero} — vendedor`,
      });

      // Agente de carga y despachante — por nombre contra el catálogo.
      const actores: Array<{ rol: string; nombre: string | null | undefined }> = [
        { rol: 'agente de carga', nombre: imp.agenteCarga },
        { rol: 'despachante', nombre: imp.despachante },
      ];
      const conNombre = actores.filter(a => a.nombre && a.nombre.trim());
      if (conNombre.length === 0) return;
      const { proveedoresService } = await import('./firebaseService');
      const proveedores = await proveedoresService.getAll();
      for (const actor of conNombre) {
        const nombre = actor.nombre!.trim();
        const prov = proveedores.find(p => p.nombre.trim().toLowerCase() === nombre.toLowerCase());
        if (!prov) {
          console.warn(`[calificaciones] ${actor.rol} "${nombre}" (imp ${imp.numero}) sin match en el catálogo de proveedores — se saltea`);
          continue;
        }
        await this.crearPendienteSiNoExiste({
          ...base,
          proveedorId: prov.id,
          proveedorNombre: prov.nombre,
          origen: 'importacion_embarque',
          origenKey: `importacion_embarque:${imp.id}:${prov.id}`,
          origenId: imp.id,
          origenLabel: `Importación ${imp.numero} — ${actor.rol}`,
        });
      }
    } catch (err) {
      console.error('[calificaciones] crearPendientesDesdeImportacion falló (ingreso sigue):', err);
    }
  },

  /** Promedio histórico ponderado por antigüedad de un proveedor. */
  async getPromedioProveedor(proveedorId: string): Promise<{ promedio: number; count: number; estado: string }> {
    const items = await this.getAll({ proveedorId });
    return promedioPonderado(items);
  },
};
