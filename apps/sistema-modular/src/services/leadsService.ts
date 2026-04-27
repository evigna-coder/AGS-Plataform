import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, Timestamp, arrayUnion, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Lead, LeadEstado, LeadArea, LeadPrioridad, MotivoLlamado, Posta, AdjuntoLead, PresupuestoEstado, OTEstadoAdmin, Ticket, Cliente } from '@ags/shared';
import {
  LEAD_MAX_ADJUNTOS, findClienteCandidatesByRazonSocial,
  PRESUPUESTO_TO_LEAD_ESTADO, PRESUPUESTO_ESTADO_LABELS, OT_TO_LEAD_ESTADO,
  parseLeadDoc, syncFlatFromContactos,
} from '@ags/shared';
import { db, storage, deepCleanForFirestore, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, batchAudit, getCurrentUserTrace, onSnapshot } from './firebase';

/** Si el payload crea/transiciona a motivoLlamado=ventas_insumos, devuelve los campos de stamp. */
function ventasInsumosStamp(incomingMotivo: MotivoLlamado | undefined, currentMotivo?: MotivoLlamado, hasStamp?: boolean): { ventasInsumosCreadoPor: string; ventasInsumosCreadoEn: string } | null {
  if (incomingMotivo !== 'ventas_insumos') return null;
  if (hasStamp && currentMotivo === 'ventas_insumos') return null;
  const user = getCurrentUserTrace();
  if (!user) return null;
  return { ventasInsumosCreadoPor: user.uid, ventasInsumosCreadoEn: new Date().toISOString() };
}

export const leadsService = {
  /**
   * Extrae la parte numérica de un numero de ticket: "TKT-00042" → 42.
   * Devuelve 0 si el formato no matchea (tickets legacy sin numero).
   */
  _extractTicketNumber(numero: string | undefined | null): number {
    if (!numero) return 0;
    const match = numero.match(/TKT-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  },

  /**
   * Genera el siguiente numero correlativo de ticket: TKT-00001, TKT-00002, ...
   * Atómico vía counter doc `_counters/tickets` (mismo doc que usa reportes-ot
   * en createTicketFromAcciones — Firestore garantiza atomicidad cross-app).
   * Antes era scan-and-max no transaccional — dos creates concurrentes podían
   * obtener el mismo número.
   */
  async getNextTicketNumero(): Promise<string> {
    const counterRef = doc(db, '_counters', 'tickets');
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const snap = await getDocs(collection(db, 'leads'));
        let max = 0;
        snap.docs.forEach(d => {
          const n = this._extractTicketNumber(d.data().numero);
          if (n > max) max = n;
        });
        current = max;
      }
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `TKT-${String(next).padStart(5, '0')}`;
  },

  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }) {
    const stamp = ventasInsumosStamp(data.motivoLlamado);
    const numero = data.numero || await this.getNextTicketNumero();
    // Si se recibe createdAt como ISO string, respetarlo (override manual desde UI).
    // Si no, usar el momento actual.
    const createdTs = data.createdAt
      ? Timestamp.fromDate(new Date(data.createdAt))
      : Timestamp.now();
    const { createdAt: _omit, ...rest } = data;
    const payload = deepCleanForFirestore(syncFlatFromContactos({
      ...rest,
      numero,
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: createdTs,
      updatedAt: Timestamp.now(),
      ...(stamp || {}),
    }));
    const leadRef = newDocRef('leads');
    const batch = createBatch();
    batch.set(leadRef, payload);
    batchAudit(batch, { action: 'create', collection: 'leads', documentId: leadRef.id, after: payload });
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
    // Normalizar boundaries: rango.desde/hasta vienen del <input type="date"> como
    // 'YYYY-MM-DD' (10 chars), pero lead.createdAt es ISO con hora ('YYYY-MM-DDThh:mm:...').
    // Sin esto, lead.createdAt <= '2026-04-25' deja afuera todo el día 25 porque
    // '2026-04-25T15:...' > '2026-04-25' lexicográficamente. El contable contaba de menos.
    const desdeStart = rango.desde + 'T00:00:00.000Z';
    const hastaEnd = rango.hasta + 'T23:59:59.999Z';

    // Sin orderBy para evitar requerir un composite index (motivoLlamado + createdAt).
    // El subset es acotado; se ordena client-side abajo.
    const q = query(
      collection(db, 'leads'),
      where('motivoLlamado', '==', 'ventas_insumos'),
    );
    const snap = await getDocs(q);
    const all = snap.docs.map(d => parseLeadDoc(d));
    const filtered = all.filter(lead => {
      const createdIn = lead.createdAt >= desdeStart && lead.createdAt <= hastaEnd;
      const updatedIn = lead.updatedAt >= desdeStart && lead.updatedAt <= hastaEnd;
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: payload });
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'derivar', posta } });
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'completarAccion', posta } });
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'finalizar' } });
    await batch.commit();
  },

  async agregarComentario(id: string, posta: Posta) {
    const batch = createBatch();
    batch.update(docRef('leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: id, after: { accion: 'comentario', posta } });
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'syncFromPresupuesto', presupuestoNumero, newEstado } });
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

    // FLOW-05: al pasar a CIERRE_TECNICO, derivar el ticket al responsable
    // de Materiales para que ejecute el cierre administrativo. El look-up es
    // best-effort — si no hay config o el usuario está inactivo, el ticket
    // queda con su asignado actual (coordinador).
    let nextAsignadoA: string | null = null;
    let nextAsignadoNombre: string | null = null;
    let nextAreaActual: LeadArea | null = null;
    let nextAccionPendiente: string | null = null;
    if (newEstadoAdmin === 'CIERRE_TECNICO') {
      try {
        const { adminConfigService } = await import('./adminConfigService');
        const { usuariosService } = await import('./personalService');
        const cfg = await adminConfigService.getWithDefaults();
        if (cfg.usuarioMaterialesId) {
          const materiales = await usuariosService.getById(cfg.usuarioMaterialesId);
          if (materiales && materiales.status === 'activo') {
            nextAsignadoA = materiales.id;
            nextAsignadoNombre = materiales.displayName ?? null;
            nextAreaActual = 'administracion' as LeadArea;
            nextAccionPendiente = `OT-${otNumber} cerrada técnicamente — ejecutar cierre administrativo (descarga artículos + facturación)`;
          }
        }
      } catch (err) {
        console.warn('[syncFromOT] derivación a Materiales falló, ticket queda con asignado actual:', err);
      }
    }

    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: user?.uid ?? 'system',
      deUsuarioNombre: user?.name ?? 'Sistema',
      aUsuarioId: nextAsignadoA ?? lead.asignadoA ?? '',
      aUsuarioNombre: nextAsignadoNombre ?? lead.asignadoNombre ?? '',
      comentario: nextAsignadoA
        ? `OT-${otNumber} → ${newEstadoAdmin} · derivado a ${nextAsignadoNombre || 'Materiales'}`
        : `OT-${otNumber} → ${newEstadoAdmin}`,
      estadoAnterior: lead.estado,
      estadoNuevo: nuevoEstadoLead,
    };

    const updates: Record<string, any> = {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      estado: nuevoEstadoLead,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (nextAsignadoA) {
      updates.asignadoA = nextAsignadoA;
      updates.asignadoNombre = nextAsignadoNombre;
      updates.areaActual = nextAreaActual;
      updates.accionPendiente = nextAccionPendiente;
    }
    if (newEstadoAdmin === 'FINALIZADO') {
      updates.finalizadoAt = Timestamp.now();
    }

    const batch = createBatch();
    batch.update(docRef('leads', leadId), updates);
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'syncFromOT', otNumber, newEstadoAdmin } });
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
    batchAudit(batch, { action: 'update', collection: 'leads', documentId: leadId, after: { accion: 'removeAdjunto', adjuntoId: adjunto.id } });
    await batch.commit();
  },

  /**
   * Resuelve manualmente el clienteId de un ticket pendiente (flujo UI /admin/revision-clienteid).
   * Setea clienteId + trazabilidad (clienteIdMigradoAt/Por) y limpia pendienteClienteId + candidatosPropuestos.
   *
   * FLOW-06 extension (plan 08-03): tras el update exitoso del ticket, dispara
   * `presupuestosService.retryPendingActionsForCliente(clienteId)` para procesar todas las
   * pendingActions no resueltas de presupuestos de ese cliente (típicamente
   * `crear_ticket_seguimiento` encoladas cuando el presupuesto se envió con clienteId
   * resuelto pero el usuarioSeguimiento no estaba activo, o similar).
   *
   * El retry falla soft: si `retryPendingActionsForCliente` lanza, se loguea y el resumen
   * devuelve defaults ceros — NO rompe el resolve del ticket.
   *
   * Import dinámico de `presupuestosService` para romper el cycle
   * `leadsService ↔ presupuestosService`.
   */
  async resolverClienteIdPendiente(
    ticketId: string,
    clienteId: string,
  ): Promise<{ retryResumen: { retried: number; successful: number; failed: number } }> {
    const trace = getCurrentUserTrace();
    const payload = deepCleanForFirestore({
      clienteId,
      clienteIdMigradoAt: Timestamp.now(),
      clienteIdMigradoPor: trace?.uid ?? null,
      pendienteClienteId: false,
      candidatosPropuestos: [],
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const ref = doc(db, 'leads', ticketId);
    await updateDoc(ref, payload);

    // FLOW-06: disparar retry retroactivo (lazy import rompe el cycle con presupuestosService)
    let retryResumen = { retried: 0, successful: 0, failed: 0 };
    try {
      const { presupuestosService } = await import('./presupuestosService');
      retryResumen = await presupuestosService.retryPendingActionsForCliente(clienteId);
    } catch (err) {
      console.error('[resolverClienteIdPendiente] retryPendingActionsForCliente failed:', err);
    }
    return { retryResumen };
  },

  /**
   * Marca un ticket como "no se puede resolver, ignorar" desde la UI admin.
   * No asigna clienteId; solo saca al ticket de la lista de pendientes.
   */
  async descartarRevisionClienteId(ticketId: string): Promise<void> {
    const payload = deepCleanForFirestore({
      revisionDescartada: true,
      pendienteClienteId: false,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const ref = doc(db, 'leads', ticketId);
    await updateDoc(ref, payload);
  },

  /**
   * Lista tickets con pendienteClienteId == true, excluyendo los marcados como descartados.
   * Firestore no soporta `!=` compound eficiente con otro where; filtramos client-side.
   * NOTA: este query usa un único `where` de igualdad sobre un field indexado automáticamente
   * — NO requiere composite index. Si en el futuro se agrega un segundo `where` o un
   * `orderBy` combinado con otro filter, Firestore pedirá crear un composite index via
   * el error message del primer run.
   */
  async listarPendientesClienteId(): Promise<Ticket[]> {
    const q = query(collection(db, 'leads'), where('pendienteClienteId', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => parseLeadDoc(d))
      .filter(t => t.revisionDescartada !== true);
  },

  /**
   * Asigna numero TKT-00001..N a todos los tickets que no lo tengan, ordenados por createdAt ASC.
   * Respeta los numeros ya existentes: arranca desde max(existentes)+1 y solo escribe en los que
   * faltan. Idempotente: re-ejecutarla no reasigna numeros ya asignados.
   */
  async backfillTicketNumeros(): Promise<{ total: number; yaNumerados: number; asignados: number }> {
    const snap = await getDocs(collection(db, 'leads'));
    const total = snap.docs.length;

    let maxExistente = 0;
    const sinNumero: { id: string; createdAt: any }[] = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const n = this._extractTicketNumber(data.numero);
      if (n > 0) {
        if (n > maxExistente) maxExistente = n;
      } else {
        sinNumero.push({ id: d.id, createdAt: data.createdAt });
      }
    });

    sinNumero.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });

    let next = maxExistente + 1;
    for (const t of sinNumero) {
      await updateDoc(doc(db, 'leads', t.id), {
        numero: `TKT-${String(next).padStart(5, '0')}`,
      });
      next++;
    }

    return { total, yaNumerados: total - sinNumero.length, asignados: sinNumero.length };
  },

  /**
   * Backfill de clienteId para tickets con `clienteId == null`.
   * Busca candidatos por razón social normalizada (ignora acentos, puntuación, sufijos societarios).
   *   - 1 candidato → asigna clienteId + clienteIdMigradoAt/Por='script-ui' + pendienteClienteId=false
   *   - 2+ candidatos → pendienteClienteId=true + candidatosPropuestos (para /admin/revision-clienteid)
   *   - 0 candidatos → pendienteClienteId=true + candidatosPropuestos=[] (queda en la lista para resolución manual)
   *
   * Idempotente: no toca tickets que ya tengan clienteId o estén marcados revisionDescartada.
   */
  async backfillClienteIds(
    clientes: Cliente[],
  ): Promise<{ total: number; matched: number; ambiguous: number; unmatched: number; skipped: number }> {
    const snap = await getDocs(query(collection(db, 'leads'), where('clienteId', '==', null)));
    const trace = getCurrentUserTrace();
    let matched = 0, ambiguous = 0, unmatched = 0, skipped = 0;
    const total = snap.docs.length;

    for (const d of snap.docs) {
      const data = d.data();
      if (data.revisionDescartada === true) { skipped++; continue; }

      const razon = typeof data.razonSocial === 'string' ? data.razonSocial : '';
      const candidatos = razon ? findClienteCandidatesByRazonSocial(razon, clientes) : [];
      const ref = doc(db, 'leads', d.id);

      if (candidatos.length === 1) {
        await updateDoc(ref, deepCleanForFirestore({
          clienteId: candidatos[0].id,
          clienteIdMigradoAt: Timestamp.now(),
          clienteIdMigradoPor: trace?.uid ?? 'script-ui',
          pendienteClienteId: false,
          candidatosPropuestos: [],
          updatedAt: Timestamp.now(),
        }));
        matched++;
      } else if (candidatos.length > 1) {
        await updateDoc(ref, deepCleanForFirestore({
          pendienteClienteId: true,
          candidatosPropuestos: candidatos.map(c => ({
            clienteId: c.id,
            razonSocial: c.razonSocial,
            score: 'razonSocial' as const,
          })),
          updatedAt: Timestamp.now(),
        }));
        ambiguous++;
      } else {
        await updateDoc(ref, deepCleanForFirestore({
          pendienteClienteId: true,
          candidatosPropuestos: [],
          updatedAt: Timestamp.now(),
        }));
        unmatched++;
      }
    }

    return { total, matched, ambiguous, unmatched, skipped };
  },
};
