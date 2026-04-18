import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Lead, LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado, Posta, AdjuntoLead, PresupuestoEstado, OTEstadoAdmin, ContactoTicket } from '@ags/shared';
import { LEAD_MAX_ADJUNTOS, getContactoPrincipal } from '@ags/shared';
import { db, storage, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit, getCurrentUserTrace, onSnapshot } from './firebase';

/** Si el payload crea/transiciona a motivoLlamado=ventas_insumos, devuelve los campos de stamp. */
function ventasInsumosStamp(incomingMotivo: MotivoLlamado | undefined, currentMotivo?: MotivoLlamado, hasStamp?: boolean): { ventasInsumosCreadoPor: string; ventasInsumosCreadoEn: string } | null {
  if (incomingMotivo !== 'ventas_insumos') return null;
  if (hasStamp && currentMotivo === 'ventas_insumos') return null;
  const user = getCurrentUserTrace();
  if (!user) return null;
  return { ventasInsumosCreadoPor: user.uid, ventasInsumosCreadoEn: new Date().toISOString() };
}

// ── Mapeo de estados: presupuesto → lead ──────────────────────────────
const PRESUPUESTO_TO_LEAD_ESTADO: Partial<Record<PresupuestoEstado, LeadEstado>> = {
  enviado: 'presupuesto_enviado',
  aceptado: 'en_coordinacion',
  finalizado: 'finalizado',
};

const PRESUPUESTO_ESTADO_LABELS: Partial<Record<PresupuestoEstado, string>> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  anulado: 'Anulado',
  finalizado: 'Finalizado',
};

// ── Mapeo de estados: OT estadoAdmin → lead ───────────────────────────
const OT_TO_LEAD_ESTADO: Partial<Record<OTEstadoAdmin, LeadEstado>> = {
  CREADA: 'ot_creada',
  ASIGNADA: 'ot_creada',
  COORDINADA: 'ot_coordinada',
  EN_CURSO: 'ot_coordinada',
  CIERRE_TECNICO: 'ot_realizada',
  CIERRE_ADMINISTRATIVO: 'pendiente_facturacion',
  FINALIZADO: 'finalizado',
};

function migrateLeadEstado(raw: string): LeadEstado {
  const migration: Record<string, LeadEstado> = {
    contactado: 'en_seguimiento',
    en_revision: 'en_seguimiento',
    derivado: 'en_seguimiento',
    presupuestado: 'presupuesto_pendiente',
    pendiente_info: 'en_seguimiento',
    en_presupuesto: 'presupuesto_pendiente',
    en_proceso: 'en_seguimiento',
    convertido: 'finalizado',
    perdido: 'no_concretado',
  };
  return migration[raw] || (raw as LeadEstado) || 'nuevo';
}

function migrateMotivoLlamado(raw: string | null | undefined): MotivoLlamado {
  if (!raw) return 'soporte';
  const migration: Record<string, MotivoLlamado> = {
    ventas: 'ventas_insumos',
    insumos: 'ventas_insumos',
    capacitacion: 'otros',
  };
  return migration[raw] || (raw as MotivoLlamado);
}

function migrateLeadArea(raw: string | null | undefined): LeadArea | null {
  if (!raw) return null;
  const migration: Record<string, LeadArea> = {
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
  return migration[raw] || (raw as LeadArea);
}

/**
 * Hidrata `contactos[]` desde los campos planos (`contacto/email/telefono`) cuando
 * el ticket es previo al refactor o se creó con los campos planos solamente.
 * La hidratación es en memoria — no se persiste hasta que el usuario edite contactos.
 */
function hydrateContactos(data: any): ContactoTicket[] {
  const existing: ContactoTicket[] = Array.isArray(data.contactos) ? data.contactos : [];
  if (existing.length > 0) return existing;
  const nombre = (data.contacto ?? '').trim();
  const email = (data.email ?? '').trim();
  const telefono = (data.telefono ?? '').trim();
  if (!nombre && !email && !telefono) return [];
  return [{
    id: 'legacy-principal',
    nombre: nombre || '(Sin nombre)',
    email: email || undefined,
    telefono: telefono || undefined,
    esPrincipal: true,
  }];
}

function parseLeadDoc(d: { id: string; data: () => any }): Lead {
  const data = d.data();
  return {
    id: d.id,
    clienteId: data.clienteId ?? null,
    contactoId: data.contactoId ?? null,
    razonSocial: data.razonSocial ?? '',
    contactos: hydrateContactos(data),
    contacto: data.contacto ?? '',
    email: data.email ?? '',
    telefono: data.telefono ?? '',
    motivoLlamado: migrateMotivoLlamado(data.motivoLlamado),
    motivoContacto: data.motivoContacto ?? '',
    descripcion: data.descripcion ?? null,
    sistemaId: data.sistemaId ?? null,
    moduloId: data.moduloId ?? null,
    estado: migrateLeadEstado(data.estado ?? 'nuevo'),
    postas: data.postas ?? [],
    asignadoA: data.asignadoA ?? null,
    asignadoNombre: data.asignadoNombre ?? null,
    derivadoPor: data.derivadoPor ?? null,
    areaActual: migrateLeadArea(data.areaActual),
    accionPendiente: data.accionPendiente ?? null,
    adjuntos: data.adjuntos ?? [],
    presupuestosIds: data.presupuestosIds ?? [],
    otIds: data.otIds ?? [],
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
    createdBy: data.createdBy ?? null,
    finalizadoAt: data.finalizadoAt?.toDate?.()?.toISOString() ?? null,
    prioridad: data.prioridad === 'media' ? 'normal' : (data.prioridad ?? null),
    proximoContacto: data.proximoContacto ?? null,
    valorEstimado: data.valorEstimado ?? null,
  };
}

/**
 * Si el payload incluye `contactos`, refleja el contacto principal en los campos planos
 * (`contacto/email/telefono`) para preservar listas, búsquedas y compat con tickets viejos.
 */
function syncFlatFromContactos<T extends Record<string, any>>(data: T): T {
  if (!('contactos' in data) || !Array.isArray(data.contactos)) return data;
  const principal = getContactoPrincipal(data.contactos as ContactoTicket[]);
  return {
    ...data,
    contacto: principal?.nombre ?? '',
    email: principal?.email ?? '',
    telefono: principal?.telefono ?? '',
  };
}

export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) {
    const stamp = ventasInsumosStamp(data.motivoLlamado);
    const payload = deepCleanForFirestore(syncFlatFromContactos({
      ...data,
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...(stamp || {}),
    }));
    const leadRef = newDocRef('leads');
    const batch = createBatch();
    batch.set(leadRef, payload);
    batchAudit(batch, { action: 'create', collection: 'leads', documentId: leadRef.id, after: payload as any });
    await batch.commit();
    return leadRef.id;
  },

  async getAll(filters?: { estado?: LeadEstado; asignadoA?: string; motivoLlamado?: MotivoLlamado; areaActual?: LeadArea }) {
    const constraints: any[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    if (filters?.motivoLlamado) constraints.push(where('motivoLlamado', '==', filters.motivoLlamado));
    if (filters?.areaActual) constraints.push(where('areaActual', '==', filters.areaActual));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => parseLeadDoc(d));
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    filters: { estado?: LeadEstado; asignadoA?: string; motivoLlamado?: MotivoLlamado; areaActual?: LeadArea } | undefined,
    callback: (leads: Lead[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    if (filters?.motivoLlamado) constraints.push(where('motivoLlamado', '==', filters.motivoLlamado));
    if (filters?.areaActual) constraints.push(where('areaActual', '==', filters.areaActual));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => parseLeadDoc(d)));
    }, err => {
      console.error('Leads subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Lead | null> {
    const snap = await getDoc(doc(db, 'leads', id));
    if (!snap.exists()) return null;
    return parseLeadDoc(snap);
  },

  /**
   * Tickets con motivoLlamado='ventas_insumos' que entran en el reporte:
   * creados en el rango, o modificados en el rango, o que siguen abiertos fuera.
   * El filtro OR se resuelve en cliente — Firestore no compone OR entre campos distintos.
   */
  async queryForVentasInsumosReport(rango: { desde: string; hasta: string }): Promise<Lead[]> {
    // Sin orderBy para evitar requerir un composite index (motivoLlamado + createdAt).
    // El subset es acotado; se ordena client-side abajo.
    const q = query(
      collection(db, 'leads'),
      where('motivoLlamado', '==', 'ventas_insumos'),
    );
    const snap = await getDocs(q);
    const all = snap.docs.map(d => parseLeadDoc(d));
    const filtered = all.filter(lead => {
      const createdIn = lead.createdAt >= rango.desde && lead.createdAt <= rango.hasta;
      const updatedIn = lead.updatedAt >= rango.desde && lead.updatedAt <= rango.hasta;
      const stillOpen = lead.estado !== 'finalizado' && lead.estado !== 'no_concretado';
      return createdIn || updatedIn || stillOpen;
    });
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  /** Real-time subscription to a single lead. Returns unsubscribe function. */
  subscribeById(id: string, callback: (lead: Lead | null) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(doc(db, 'leads', id), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback(parseLeadDoc(snap));
    }, err => { console.error('Lead subscription error:', err); onError?.(err); });
  },

  async update(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>) {
    // Si el update toca motivoLlamado=ventas_insumos, leemos el estado actual para decidir si stampear.
    let stamp: ReturnType<typeof ventasInsumosStamp> = null;
    if (data.motivoLlamado === 'ventas_insumos') {
      const current = await getDoc(doc(db, 'leads', id));
      const currentData = current.data();
      stamp = ventasInsumosStamp(
        data.motivoLlamado,
        currentData?.motivoLlamado as MotivoLlamado | undefined,
        !!currentData?.ventasInsumosCreadoPor,
      );
    }
    const payload = deepCleanForFirestore(syncFlatFromContactos({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
      ...(stamp || {}),
    }));
    const batch = createBatch();
    batch.update(docRef('leads', id), payload);
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: payload as any });
    await batch.commit();
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string, nuevoAsignadoNombre?: string | null, area?: LeadArea | null, accionRequerida?: string | null, extras?: { prioridad?: LeadPrioridad | null; proximoContacto?: string | null; motivoLlamado?: MotivoLlamado; motivoOtros?: string | null }) {
    const data: Record<string, any> = {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      asignadoA: nuevoAsignadoA || null,
      asignadoNombre: nuevoAsignadoNombre || null,
      derivadoPor: posta.deUsuarioId,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (area !== undefined) data.areaActual = area || null;
    if (accionRequerida !== undefined) data.accionPendiente = accionRequerida || null;
    if (posta.comentario) data.descripcion = posta.comentario;
    if (extras?.prioridad !== undefined) data.prioridad = extras.prioridad;
    if (extras?.proximoContacto !== undefined) data.proximoContacto = extras.proximoContacto || null;
    if (extras?.motivoLlamado !== undefined) {
      data.motivoLlamado = extras.motivoLlamado;
      data.motivoOtros = extras.motivoLlamado === 'otros' ? (extras.motivoOtros?.trim() || null) : null;
    }
    const batch = createBatch();
    batch.update(docRef('leads', id), data);
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'derivar', posta } as any });
    await batch.commit();
  },

  async completarAccion(id: string, posta: Posta) {
    const batch = createBatch();
    batch.update(docRef('leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      accionPendiente: null,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'completarAccion', posta } as any });
    await batch.commit();
  },

  async finalizar(id: string, posta: Posta) {
    const batch = createBatch();
    batch.update(docRef('leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      estado: posta.estadoNuevo,
      finalizadoAt: Timestamp.now(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'finalizar' } as any });
    await batch.commit();
  },

  async agregarComentario(id: string, posta: Posta) {
    const batch = createBatch();
    batch.update(docRef('leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'comentario', posta } as any });
    await batch.commit();
  },

  async linkPresupuesto(id: string, presupuestoId: string) {
    await updateDoc(doc(db, 'leads', id), {
      presupuestosIds: arrayUnion(presupuestoId),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async linkOT(id: string, otId: string) {
    await updateDoc(doc(db, 'leads', id), {
      otIds: arrayUnion(otId),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async delete(id: string) {
    const batch = createBatch();
    batch.delete(docRef('leads', id));
    batchAudit(batch, { action: 'delete', collection: 'leads', documentId: id });
    await batch.commit();
  },

  async uploadAdjuntos(leadId: string, files: File[], existingCount: number): Promise<AdjuntoLead[]> {
    const available = LEAD_MAX_ADJUNTOS - existingCount;
    const toUpload = files.slice(0, available);
    const uploaded: AdjuntoLead[] = [];

    for (const file of toUpload) {
      const storageRef = ref(storage, `leads/${leadId}/adjuntos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const isImage = file.type.startsWith('image/');
      uploaded.push({
        id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: file.name,
        url,
        tipo: isImage ? 'imagen' : 'archivo',
        size: file.size,
        fechaCarga: new Date().toISOString(),
      });
    }

    if (uploaded.length > 0) {
      await updateDoc(doc(db, 'leads', leadId), {
        adjuntos: arrayUnion(...uploaded.map(a => deepCleanForFirestore(a))),
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
    }

    return uploaded;
  },

  /**
   * Sincroniza el estado del lead cuando cambia el estado de un presupuesto vinculado.
   * Se llama automáticamente desde presupuestosService.update().
   */
  async syncFromPresupuesto(leadId: string, presupuestoNumero: string, newEstado: PresupuestoEstado) {
    const lead = await this.getById(leadId);
    if (!lead || lead.estado === 'finalizado' || lead.estado === 'no_concretado') return;

    const user = getCurrentUserTrace();
    const nuevoEstadoLead = PRESUPUESTO_TO_LEAD_ESTADO[newEstado];
    const estadoLabel = PRESUPUESTO_ESTADO_LABELS[newEstado] || newEstado;

    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: user?.uid ?? 'system',
      deUsuarioNombre: user?.name ?? 'Sistema',
      aUsuarioId: lead.asignadoA || '',
      aUsuarioNombre: lead.asignadoNombre || '',
      comentario: `Presupuesto ${presupuestoNumero} → ${estadoLabel}`,
      estadoAnterior: lead.estado,
      estadoNuevo: nuevoEstadoLead || lead.estado,
    };

    const updates: Record<string, any> = {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (nuevoEstadoLead && nuevoEstadoLead !== lead.estado) {
      updates.estado = nuevoEstadoLead;
    }
    // Presupuesto aceptado → mover lead a coordinación
    if (newEstado === 'aceptado') {
      updates.areaActual = 'agenda_coordinacion';
      updates.accionPendiente = `Coordinar OT — Presupuesto ${presupuestoNumero} aceptado`;
    }

    const batch = createBatch();
    batch.update(docRef('leads', leadId), updates);
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'syncFromPresupuesto', presupuestoNumero, newEstado } as any });
    await batch.commit();
  },

  /**
   * Sincroniza el estado del lead cuando cambia el estadoAdmin de una OT vinculada.
   * Se llama automáticamente desde otService.update().
   */
  async syncFromOT(leadId: string, otNumber: string, newEstadoAdmin: OTEstadoAdmin) {
    const lead = await this.getById(leadId);
    if (!lead || lead.estado === 'finalizado' || lead.estado === 'no_concretado') return;

    const nuevoEstadoLead = OT_TO_LEAD_ESTADO[newEstadoAdmin];
    if (!nuevoEstadoLead || nuevoEstadoLead === lead.estado) return;

    const user = getCurrentUserTrace();
    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: user?.uid ?? 'system',
      deUsuarioNombre: user?.name ?? 'Sistema',
      aUsuarioId: lead.asignadoA || '',
      aUsuarioNombre: lead.asignadoNombre || '',
      comentario: `OT-${otNumber} → ${newEstadoAdmin}`,
      estadoAnterior: lead.estado,
      estadoNuevo: nuevoEstadoLead,
    };

    const updates: Record<string, any> = {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      estado: nuevoEstadoLead,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (newEstadoAdmin === 'FINALIZADO') {
      updates.finalizadoAt = Timestamp.now();
    }

    const batch = createBatch();
    batch.update(docRef('leads', leadId), updates);
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'syncFromOT', otNumber, newEstadoAdmin } as any });
    await batch.commit();
  },

  async removeAdjunto(leadId: string, adjunto: AdjuntoLead, allAdjuntos: AdjuntoLead[]) {
    // Delete from Storage
    try {
      const storageRef = ref(storage, adjunto.url);
      await deleteObject(storageRef);
    } catch {
      // File may already be deleted — continue
    }
    // Remove from Firestore array
    const updated = allAdjuntos.filter(a => a.id !== adjunto.id);
    const batch = createBatch();
    batch.update(docRef('leads', leadId), {
      adjuntos: updated.map(a => deepCleanForFirestore(a)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'removeAdjunto', adjuntoId: adjunto.id } as any });
    await batch.commit();
  },
};
