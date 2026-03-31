import { collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import type { AgendaEntry, AgendaNota } from '@ags/shared';
import { db, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

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
    logAudit({ action: 'create', collection: 'agendaEntries', documentId: ref.id, after: payload as Record<string, unknown> });
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
      after: payload as Record<string, unknown>,
    });
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, 'agendaEntries', id);
    await deleteDoc(docRef);
    logAudit({ action: 'delete', collection: 'agendaEntries', documentId: id });
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
    await setDoc(doc(db, 'feriados', fecha), { fecha, createdAt: Timestamp.now() });
  },

  async remove(fecha: string): Promise<void> {
    await deleteDoc(doc(db, 'feriados', fecha));
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
    // Check if a note already exists for this engineer + date
    const q = query(
      collection(db, 'agendaNotas'),
      where('fecha', '==', data.fecha),
      where('ingenieroId', '==', data.ingenieroId),
    );
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      // Update existing
      const existingId = snap.docs[0].id;
      await updateDoc(doc(db, 'agendaNotas', existingId), {
        texto: data.texto,
        ...getUpdateTrace(),
        updatedAt: Timestamp.now(),
      });
      return existingId;
    }
    // Create new
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = await addDoc(collection(db, 'agendaNotas'), payload);
    return ref.id;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'agendaNotas', id));
  },
};
