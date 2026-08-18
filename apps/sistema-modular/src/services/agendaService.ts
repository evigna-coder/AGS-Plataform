import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { addDoc, setDoc, updateDoc, deleteDoc } from './firebase';
import type { AgendaEntry, AgendaNota } from '@ags/shared';
import { db, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';

/** ID visible del equipo: código interno del CLIENTE, fallback agsVisibleId
 *  (pedido coordinación 2026-08-03). Cached per-process. */
const _agsIdCache = new Map<string, string | null>();
async function _resolveAgsId(sistemaId: string | undefined | null): Promise<string | null> {
  if (!sistemaId) return null;
  if (_agsIdCache.has(sistemaId)) return _agsIdCache.get(sistemaId)!;
  try {
    const snap = await getDoc(doc(db, 'sistemas', sistemaId));
    const agsId = snap.exists() ? (snap.data().codigoInternoCliente || snap.data().agsVisibleId || null) : null;
    _agsIdCache.set(sistemaId, agsId);
    return agsId;
  } catch { return null; }
}

/**
 * Resuelve un id de ingeniero (uid de usuario O doc id del catálogo) al DOC ID
 * del catálogo `ingenieros`, que es lo que dibuja las filas de la grilla.
 * (2026-07-31: al vincular usuarioId, las OTs pasaron a guardar el uid y las
 * entradas auto-creadas/sincronizadas con ese valor quedaban INVISIBLES.)
 * Best-effort: si no puede resolver, devuelve el id crudo.
 */
async function _resolverIngenieroCatalogo(id: string, nombre: string): Promise<{ id: string; nombre: string }> {
  try {
    const snap = await getDocs(collection(db, 'ingenieros'));
    for (const d of snap.docs) {
      if (d.id === id) return { id, nombre: nombre || (d.data().nombre ?? '') };
    }
    for (const d of snap.docs) {
      if (d.data().usuarioId === id) return { id: d.id, nombre: d.data().nombre ?? nombre };
    }
  } catch (err) {
    console.error('[agendaService] resolución de ingeniero falló (se usa el id crudo):', err);
  }
  return { id, nombre };
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
    pagoAdelantado: data.pagoAdelantado === true,
    // Estos dos FALTABAN acá (2026-08-09) y por eso "se destildaban solos": el
    // toggle guardaba bien en Firestore, pero este mapper es campo por campo y
    // los descartaba al reconstruir la entrada, así que el primer snapshot en
    // tiempo real pisaba el update optimista y la marca desaparecía. El dato
    // nunca se perdió — no se leía. Al agregar un flag nuevo a `AgendaEntry`,
    // agregarlo TAMBIÉN acá.
    requiereInduccion: data.requiereInduccion === true,
    ventaConcretada: data.ventaConcretada === true,
    perIncident: data.perIncident === true,
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
    // Query con lower bound (rangeStart - 30 días) para capturar entries multi-día
    // que arrancaron antes del rango y se extienden adentro. Antes solo había
    // upper bound (fechaInicio <= rangeEnd) → escaneaba TODA la historia y descartaba
    // client-side. Para una colección de varios años eso es ineficiente.
    // 30d cubre el peor caso realista de duración de entry (instalaciones largas).
    const startDate = new Date(rangeStart);
    startDate.setDate(startDate.getDate() - 30);
    const lowerBound = startDate.toISOString().split('T')[0];

    const q = query(
      collection(db, 'agendaEntries'),
      where('fechaInicio', '>=', lowerBound),
      where('fechaInicio', '<=', rangeEnd),
      orderBy('fechaInicio', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs
        .map(d => parseAgendaEntry(d))
        .filter(e => e.fechaFin >= rangeStart); // client-side filter para overlap exacto
      callback(entries);
    });
  },

  /**
   * Entradas cuyo `fechaInicio` cae dentro del año calendario `anio`.
   * Query de rango simple (sin filtrar estado en Firestore) para no necesitar un
   * índice compuesto: el filtro por `estadoAgenda` lo hace el caller en memoria.
   */
  async getByAnio(anio: number): Promise<AgendaEntry[]> {
    const q = query(
      collection(db, 'agendaEntries'),
      where('fechaInicio', '>=', `${anio}-01-01`),
      where('fechaInicio', '<=', `${anio}-12-31`),
      orderBy('fechaInicio', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => parseAgendaEntry(d));
  },

  async getByOtNumber(otNumber: string): Promise<AgendaEntry[]> {
    const q = query(collection(db, 'agendaEntries'), where('otNumber', '==', otNumber));
    const snap = await getDocs(q);
    return snap.docs.map(d => parseAgendaEntry(d));
  },

  /** TODAS las entradas (una lectura). Para el buscador con salto a celda
   *  (2026-08-03): la suscripción del hook trae solo el rango visible. */
  async listAll(): Promise<AgendaEntry[]> {
    const snap = await getDocs(query(collection(db, 'agendaEntries'), orderBy('fechaInicio', 'asc')));
    return snap.docs.map(d => parseAgendaEntry(d));
  },

  /**
   * Set de otNumbers con entrada de agenda VIGENTE (no cancelada), SIN filtro de
   * rango. La cola "a programar" no puede descontar usando las entries del rango
   * visible: una OT agendada meses adelante reaparecía como "sin asignar" al
   * salir de esa semana (bug UAT 2026-07-30).
   */
  subscribeOtNumbersAsignados(callback: (otNumbers: Set<string>) => void): () => void {
    return onSnapshot(collection(db, 'agendaEntries'), snap => {
      const s = new Set<string>();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.otNumber && data.estadoAgenda !== 'cancelado') s.add(data.otNumber);
      }
      callback(s);
    }, err => console.error('agenda otNumbers subscription error:', err));
  },

  /**
   * otNumber → fecha de inicio de su entrada más TEMPRANA no cancelada
   * (2026-08-15). Variante de `subscribeOtNumbersAsignados` que además dice
   * CUÁNDO: el control semanal necesita distinguir "no está agendada" de
   * "está agendada para dentro de tres semanas", que no es lo mismo y no se
   * trabaja igual. Global sin rango, a propósito.
   */
  subscribeFechaPorOt(callback: (fechas: Map<string, string>) => void): () => void {
    return onSnapshot(collection(db, 'agendaEntries'), snap => {
      const m = new Map<string, string>();
      for (const d of snap.docs) {
        const data = d.data();
        if (!data.otNumber || data.estadoAgenda === 'cancelado') continue;
        const prev = m.get(data.otNumber);
        if (!prev || String(data.fechaInicio) < prev) m.set(data.otNumber, String(data.fechaInicio));
      }
      callback(m);
    }, err => console.error('agenda fechaPorOt subscription error:', err));
  },

  async create(data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>): Promise<string> {
    // Cinturón (2026-08-04): una entrada de UN día con quarterEnd < quarterStart
    // es un rango invertido — no ocupa ninguna celda y queda INVISIBLE en la
    // grilla (aunque el buscador la encuentra). Normalizar acá corta el bug en
    // cualquier caller presente o futuro.
    if (data.fechaInicio === data.fechaFin && data.quarterEnd < data.quarterStart) {
      data = { ...data, quarterEnd: data.quarterStart };
    }
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

    const resuelto = await _resolverIngenieroCatalogo(ot.ingenieroAsignadoId, ot.ingenieroAsignadoNombre || '');
    const ingenieroId = resuelto.id;
    const ingenieroNombre = resuelto.nombre;

    return this.create({
      fechaInicio: ot.fechaServicioAprox,
      fechaFin: ot.fechaServicioAprox,
      quarterStart: 1,
      quarterEnd: 1,
      ingenieroId,
      ingenieroNombre,
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
      // Resolver UID → doc del catálogo (2026-07-31): la OT guarda el uid desde
      // la vinculación usuarioId; escribirlo crudo dejaba la entrada invisible.
      const resuelto = await _resolverIngenieroCatalogo(changes.ingenieroId, changes.ingenieroNombre || '');
      updates.ingenieroId = resuelto.id;
      updates.ingenieroNombre = resuelto.nombre;
    }

    if (changes.fechaServicioAprox) {
      updates.fechaInicio = changes.fechaServicioAprox;
      updates.fechaFin = changes.fechaServicioAprox;
    }

    if (Object.keys(updates).length > 0) {
      await this.update(entry.id, updates);
    }
  },

  /** Sincroniza el EQUIPO mostrado en las entradas activas de una OT
   *  (2026-08-03): la tarjeta guarda una foto del equipo tomada al agendar;
   *  si el equipo de la OT se corrige después, la tarjeta quedaba mostrando
   *  el equipo viejo. */
  async syncEquipoFromOT(otNumber: string, cambios: {
    sistemaId?: string | null;
    sistemaNombre?: string | null;
    equipoModelo?: string | null;
  }): Promise<void> {
    const existing = await this.getByOtNumber(otNumber);
    const active = existing.filter(e => e.estadoAgenda !== 'cancelado');
    if (active.length === 0) return;
    const equipoAgsId = await _resolveAgsId(cambios.sistemaId);
    for (const entry of active) {
      await this.update(entry.id, {
        sistemaNombre: cambios.sistemaNombre ?? null,
        equipoModelo: cambios.equipoModelo ?? null,
        equipoAgsId,
      });
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

  /** Lectura one-shot (el doc id ES la fecha 'YYYY-MM-DD'). Para batches que no
   *  pueden esperar a un subscribe (ej. generador de previsiones). */
  async getAllFechas(): Promise<Set<string>> {
    const snap = await getDocs(collection(db, 'feriados'));
    return new Set(snap.docs.map(d => d.id));
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

// ── Días AGS Service ──
// Día NO laborable de UN ingeniero (cumpleaños + 2 días que da la empresa por
// año — pedido 2026-08-02). Distinto de feriados (globales): esto bloquea la
// agenda SOLO para ese ingeniero y se pinta turquesa. Doc id = `${ingId}_${fecha}`.

export const diasAgsService = {
  /** Suscripción global. Devuelve claves `${ingenieroId}_${fecha}`. */
  subscribe(callback: (keys: Set<string>) => void): () => void {
    return onSnapshot(collection(db, 'agendaDiasAgs'), (snap) => {
      const keys = new Set<string>();
      snap.docs.forEach(d => keys.add(d.id));
      callback(keys);
    });
  },

  async toggle(ingenieroId: string, ingenieroNombre: string, fecha: string, marcadoActual: boolean): Promise<void> {
    const docId = `${ingenieroId}_${fecha}`;
    if (marcadoActual) {
      await deleteDoc(doc(db, 'agendaDiasAgs', docId));
      logAudit({ action: 'delete', collection: 'agendaDiasAgs', documentId: docId });
    } else {
      const payload = deepCleanForFirestore({
        ingenieroId, ingenieroNombre, fecha,
        ...getCreateTrace(),
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(db, 'agendaDiasAgs', docId), payload);
      logAudit({ action: 'create', collection: 'agendaDiasAgs', documentId: docId, after: payload });
    }
  },
};

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
          quarter: data.quarter ?? undefined,
          texto: data.texto,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
        };
      });
      callback(notas);
    });
  },

  async upsert(data: { fecha: string; ingenieroId: string; ingenieroNombre: string; quarter: 1 | 2 | 3 | 4; texto: string }): Promise<string> {
    // Deterministic ID = ingenieroId_fecha_qN → un comentario por CELDA (cuarto
    // de día), como en Excel. Single setDoc, sin read previo.
    const docId = `${data.ingenieroId}_${data.fecha}_q${data.quarter}`;
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
