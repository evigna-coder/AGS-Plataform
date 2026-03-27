import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Lead, LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado, Posta, AdjuntoLead } from '@ags/shared';
import { LEAD_MAX_ADJUNTOS } from '@ags/shared';
import { db, storage, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

function migrateLeadEstado(raw: string): LeadEstado {
  const migration: Record<string, LeadEstado> = {
    contactado: 'pendiente_info',
    en_revision: 'pendiente_info',
    derivado: 'pendiente_info',
    presupuestado: 'en_presupuesto',
    convertido: 'finalizado',
    perdido: 'no_concretado',
  };
  return migration[raw] || (raw as LeadEstado) || 'nuevo';
}

function migrateMotivoLlamado(raw: string | null | undefined): MotivoLlamado {
  if (!raw) return 'soporte';
  if (raw === 'otros') return 'soporte';
  return raw as MotivoLlamado;
}

function migrateLeadArea(raw: string | null | undefined): LeadArea | null {
  if (!raw) return null;
  const migration: Record<string, LeadArea> = {
    presupuesto: 'presupuesto_ventas',
    contrato: 'presupuesto_ventas',
    venta_insumos: 'presupuesto_ventas',
  };
  return migration[raw] || (raw as LeadArea);
}

function parseLeadDoc(d: { id: string; data: () => any }): Lead {
  const data = d.data();
  return {
    id: d.id,
    clienteId: data.clienteId ?? null,
    contactoId: data.contactoId ?? null,
    razonSocial: data.razonSocial ?? '',
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
    prioridad: data.prioridad ?? null,
    proximoContacto: data.proximoContacto ?? null,
    valorEstimado: data.valorEstimado ?? null,
  };
}

export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'leads'), payload);
    logAudit({ action: 'create', collection: 'leads', documentId: docRef.id, after: payload as any });
    return docRef.id;
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

  async getById(id: string): Promise<Lead | null> {
    const snap = await getDoc(doc(db, 'leads', id));
    if (!snap.exists()) return null;
    return parseLeadDoc(snap);
  },

  async update(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>) {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: payload as any });
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string, nuevoAsignadoNombre?: string | null, area?: LeadArea | null, accionRequerida?: string | null, extras?: { prioridad?: LeadPrioridad | null; proximoContacto?: string | null }) {
    const update: Record<string, any> = {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      asignadoA: nuevoAsignadoA || null,
      asignadoNombre: nuevoAsignadoNombre || null,
      derivadoPor: posta.deUsuarioId,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (area !== undefined) update.areaActual = area || null;
    if (accionRequerida !== undefined) update.accionPendiente = accionRequerida || null;
    if (extras?.prioridad !== undefined) update.prioridad = extras.prioridad;
    if (extras?.proximoContacto !== undefined) update.proximoContacto = extras.proximoContacto || null;
    await updateDoc(doc(db, 'leads', id), update);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'derivar', posta } as any });
  },

  async completarAccion(id: string, posta: Posta) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      accionPendiente: null,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'completarAccion', posta } as any });
  },

  async finalizar(id: string, posta: Posta) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      estado: posta.estadoNuevo,
      finalizadoAt: Timestamp.now(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'finalizar' } as any });
  },

  async agregarComentario(id: string, posta: Posta) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'comentario', posta } as any });
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
    logAudit({ action: 'delete', collection: 'leads', documentId: id });
    await deleteDoc(doc(db, 'leads', id));
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
    await updateDoc(doc(db, 'leads', leadId), {
      adjuntos: updated.map(a => deepCleanForFirestore(a)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'removeAdjunto', adjuntoId: adjunto.id } as any });
  },
};
