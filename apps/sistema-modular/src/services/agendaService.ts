import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { AgendaEntry, AgendaNota } from '@ags/shared';
import { db, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

/** Resolve a sistema's agsVisibleId (cached per-process). */
const _agsIdCache = new Map<string, string | null>();
async function _resolveAgsId(sistemaId: string | undefined | null): Promise<string | null> {
  if (!sistemaId) return null;
  if (_agsIdCache.has(sistemaId)) return _agsIdCache.get(sistemaId)!;
  try {
    const snap = await getDoc(doc(db, 'sistemas', sistemaId));
    const agsId = snap.exists() ? (snap.data().agsVisibleId ?? null) : null;
    _agsIdCache.set(sistemaId, agsId);
    return agsId;
  } catch { return null; }
}

// ── Agenda Service ──

function parseAgendaEntry(d: import('firebase/firestore').DocumentSnapshot): AgendaEntry {
  const data = d.data()!;
  return {
    id: d.id,
    fechaInicio: data.fechaInicio,
    fechaFin: data.fechaFin,
    quarterStart: data.quarterStart,
    quarterEnd: data.quarterEnd,
    ingenieroId: data.ingenieroId,
    ingenieroNombre: data.ingenieroNombre,
    otNumber: data.otNumber,
    clienteNombre: data.clienteNombre,
    tipoServicio: data.tipoServicio,
    sistemaNombre: data.sistemaNombre ?? null,
    establecimientoNombre: data.establecimientoNombre ?? null,
    equipoModelo: data.equipoModelo ?? null,
    equipoAgsId: data.equipoAgsId ?? null,
    estadoAgenda: data.estadoAgenda,
    notas: data.notas ?? null,
    titulo: data.titulo ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    updatedBy: data.updatedBy ?? null,
    updatedByName: data.updatedByName ?? null,
  };
}

export const agendaService = {
  /** Real-time subscription for entries in a date range. Returns unsubscribe fn. */
  subscribeToRange(
    rangeStart: string,
    rangeEnd: string,
    callback: (entries: AgendaEntry[]) => void,
  ): () => void {
    // Query entries whose fechaInicio or fechaFin falls within range
    // We query from (rangeStart - 14 days buffer) to rangeEnd to catch multi-day entries
    const q = query(
      collection(db, 'agendaEntries'),
      where('fechaInicio', '<=', rangeEnd),
      orderBy('fechaInicio', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs
        .map(d => parseAgendaEntry(d))
        .filter(e => e.fechaFin >= rangeStart); // client-side filter for overlap
      callback(entries);
    });
  },

  async getByOtNumber(otNumber: string): Promise<AgendaEntry[]> {
    const q = query(collection(db, 'agendaEntries'), where('otNumber', '==', otNumber));
    const snap = await getDocs(q);
    return snap.docs.map(d => parseAgendaEntry(d));
  },

  async create(data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>): Promise<string> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = await addDoc(collection(db, 'agendaEntries'), payload);
    logAudit({ action: 'create', collection: 'agendaEntries', documentId: ref.id, after: payload });
    return ref.id;
  },

  async update(id: string, data: Partial<AgendaEntry>): Promise<void> {
    const docRef = doc(db, 'agendaEntries', id);
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    // Remove id from payload if present
    delete (payload as Record<string, unknown>).id;
    await updateDoc(docRef, payload);
    logAudit({
      action: 'update', collection: 'agendaEntries', documentId: id,
      after: payload,
    });
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, 'agendaEntries', id);
    await deleteDoc(docRef);
    logAudit({ action: 'delete', collection: 'agendaEntries', documentId: id });
  },

  /** Auto-create agenda entry from OT when engineer + date are assigned */
  async autoCreateFromOT(ot: {
    otNumber: string;
    ingenieroAsignadoId?: string | null;
    ingenieroAsignadoNombre?: string | null;
    fechaServicioAprox?: string;
    razonSocial: string;
    tipoServicio: string;
    sistema?: string;
    moduloModelo?: string;
    sistemaId?: string | null;
  }): Promise<string | null> {
    if (!ot.ingenieroAsignadoId || !ot.fechaServicioAprox) return null;

    // Check if entry already exists for this OT
    const existing = await this.getByOtNumber(ot.otNumber);
    const active = existing.filter(e => e.estadoAgenda !== 'cancelado');
    if (active.length > 0) return active[0].id;

    const equipoAgsId = await _resolveAgsId(ot.sistemaId);

    return this.create({
      fechaInicio: ot.fechaServicioAprox,
      fechaFin: ot.fechaServicioAprox,
      quarterStart: 1,
      quarterEnd: 1,
      ingenieroId: ot.ingenieroAsignadoId,
      ingenieroNombre: ot.ingenieroAsignadoNombre || '',
      otNumber: ot.otNumber,
      clienteNombre: ot.razonSocial,
      tipoServicio: ot.tipoServicio,
      sistemaNombre: ot.sistema || null,
      establecimientoNombre: null,
      equipoModelo: ot.moduloModelo || null,
      equipoAgsId,
      estadoAgenda: 'tentativo',
      notas: null,
      titulo: null,
    });
  },

  /** Sync existing agenda entry when OT engineer or date changes */
  async syncFromOT(otNumber: string, changes: {
    ingenieroId?: string | null;
    ingenieroNombre?: string | null;
    fechaServicioAprox?: string;
  }): Promise<void> {
    const existing = await this.getByOtNumber(otNumber);
    const active = existing.filter(e => e.estadoAgenda !== 'cancelado');
    if (active.length === 0) return;

    const entry = active[0];
    const updates: Partial<AgendaEntry> = {};

    if (changes.ingenieroId !== undefined) {
      if (changes.ingenieroId === null) {
        // Engineer removed → delete agenda entry
        await this.delete(entry.id);
        return;
      }
      updates.ingenieroId = changes.ingenieroId;
      if (changes.ingenieroNombre !== undefined) updates.ingenieroNombre = changes.ingenieroNombre || '';
    }

    if (changes.fechaServicioAprox) {
      updates.fechaInicio = changes.fechaServicioAprox;
      updates.fechaFin = changes.fechaServicioAprox;
    }

    if (Object.keys(updates).length > 0) {
      await this.update(entry.id, updates);
    }
  },
};

// ── Feriados Service ──

export const feriadosService = {
  subscribe(callback: (fechas: Set<string>) => void): () => void {
    return onSnapshot(collection(db, 'feriados'), (snap) => {
      const fechas = new Set<string>();
      snap.docs.forEach(d => fechas.add(d.id));
      callback(fechas);
    });
  },

  async add(fecha: string): Promise<void> {
    const payload = { fecha, createdAt: Timestamp.now() };
    await setDoc(doc(db, 'feriados', fecha), payload);
    logAudit({ action: 'create', collection: 'feriados', documentId: fecha, after: payload });
  },

  async remove(fecha: string): Promise<void> {
    await deleteDoc(doc(db, 'feriados', fecha));
    logAudit({ action: 'delete', collection: 'feriados', documentId: fecha });
  },
};

// ── Agenda Notas Service ──

export const agendaNotasService = {
  /** Real-time subscription for notes in a date range. */
  subscribeToRange(
    rangeStart: string,
    rangeEnd: string,
    callback: (notas: AgendaNota[]) => void,
  ): () => void {
    const q = query(
      collection(db, 'agendaNotas'),
      where('fecha', '>=', rangeStart),
      where('fecha', '<=', rangeEnd),
      orderBy('fecha', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const notas: AgendaNota[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          fecha: data.fecha,
          ingenieroId: data.ingenieroId,
          ingenieroNombre: data.ingenieroNombre,
          texto: data.texto,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
        };
      });
      callback(notas);
    });
  },

  async upsert(data: { fecha: string; ingenieroId: string; ingenieroNombre: string; texto: string }): Promise<string> {
    // Deterministic ID = ingenieroId_fecha → single setDoc (no read required)
    const docId = `${data.ingenieroId}_${data.fecha}`;
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'agendaNotas', docId), payload, { merge: true });
    logAudit({ action: 'update', collection: 'agendaNotas', documentId: docId, after: payload });
    return docId;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'agendaNotas', id));
    logAudit({ action: 'delete', collection: 'agendaNotas', documentId: id });
  },
};
