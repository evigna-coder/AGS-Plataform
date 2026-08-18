import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { runTransaction } from './firebase';
import type { Contrato, EstadoContrato, WorkOrder } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, onSnapshot } from './firebase';

function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

function parseContrato(d: any, id: string): Contrato {
  return {
    id,
    ...d,
    createdAt: toISO(d.createdAt, '') as string,
    updatedAt: toISO(d.updatedAt, '') as string,
  };
}

export const contratosService = {
  async getNextContratoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'contratoNumber');
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let current = snap.exists() ? (snap.data().value as number) : 0;
      const nextVal = current + 1;
      transaction.set(counterRef, { value: nextVal });
      return nextVal;
    });
    return `CON-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: { clienteId?: string; estado?: EstadoContrato }) {
    let q = query(collection(db, 'contratos'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));

    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseContrato(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { clienteId?: string; estado?: EstadoContrato } | undefined,
    callback: (items: Contrato[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'contratos'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));

    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseContrato(d.data(), d.id));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    }, err => {
      console.error('Contratos subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<Contrato | null> {
    const snap = await getDoc(doc(db, 'contratos', id));
    if (!snap.exists()) return null;
    return parseContrato(snap.data(), snap.id);
  },

  async getActiveForCliente(clienteId: string): Promise<Contrato[]> {
    const q = query(collection(db, 'contratos'), where('clienteId', '==', clienteId), where('estado', '==', 'activo'));
    const snap = await getDocs(q);
    const today = new Date().toISOString().split('T')[0];
    return snap.docs
      .map(d => parseContrato(d.data(), d.id))
      .filter(c => c.fechaFin >= today);
  },

  async create(data: Omit<Contrato, 'id' | 'createdAt' | 'updatedAt' | 'numero'>): Promise<{ id: string; numero: string }> {
    const numero = await this.getNextContratoNumber();
    const ref = newDocRef('contratos');
    const batch = createBatch();
    const cleaned = cleanFirestoreData({
      ...data,
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...getCreateTrace(),
    });
    batch.set(ref, cleaned);
    await batch.commit();
    // F2 (2026-07-30): marcar los equipos cubiertos como "en contrato" con
    // backlink. Best-effort: un sistemaId inválido no debe voltear el alta.
    try {
      await this._syncEquipos(ref.id, data.sistemaIds ?? [], true);
    } catch (err) {
      console.error('[contratosService.create] sync de equipos falló (no bloquea):', err);
    }
    return { id: ref.id, numero };
  },

  async update(id: string, data: Partial<Contrato>): Promise<void> {
    // Edición de sistemaIds (2026-07-31): leer los ANTERIORES antes de escribir,
    // para poder desmarcar los equipos removidos (el sync por estado usa la
    // lista ya persistida y nunca hacía diff — los quitados quedaban marcados).
    const prevSistemaIds: string[] | null = data.sistemaIds !== undefined
      ? ((await this.getById(id))?.sistemaIds ?? [])
      : null;

    const ref = docRef('contratos', id);
    const batch = createBatch();
    const { id: _, createdAt: __, ...rest } = data;
    const cleaned = cleanFirestoreData({
      ...rest,
      updatedAt: Timestamp.now(),
      ...getUpdateTrace(),
    });
    batch.update(ref, cleaned);
    await batch.commit();

    // Diff de equipos al editar sistemaIds: marcar agregados, desmarcar quitados
    // (salvo que otro contrato vigente los cubra — lo resuelve _syncEquipos).
    if (prevSistemaIds !== null && data.sistemaIds !== undefined) {
      try {
        const nuevos = new Set(data.sistemaIds);
        const viejos = new Set(prevSistemaIds);
        const agregados = [...nuevos].filter(s => !viejos.has(s));
        const quitados = [...viejos].filter(s => !nuevos.has(s));
        if (agregados.length > 0) await this._syncEquipos(id, agregados, true);
        if (quitados.length > 0) await this._syncEquipos(id, quitados, false);
      } catch (err) {
        console.error('[contratosService.update] sync diff de equipos falló (no bloquea):', err);
      }
    }

    // F2: al cambiar el estado del contrato, sincronizar el flag de sus equipos
    // (activo → marcar; suspendido/cancelado/vencido → desmarcar salvo que otro
    // contrato vigente los cubra). Best-effort.
    if (data.estado) {
      try {
        const c = await this.getById(id);
        if (c) await this._syncEquipos(id, c.sistemaIds ?? [], data.estado === 'activo');
      } catch (err) {
        console.error('[contratosService.update] sync de equipos falló (no bloquea):', err);
      }
    }
  },

  /**
   * Sincroniza `enContrato` + `contratoId` de los sistemas cubiertos por un
   * contrato. Al DESMARCAR, si otro contrato vigente del cliente cubre el mismo
   * equipo (un cliente puede tener varios contratos, equipos distintos), el flag
   * queda encendido apuntando a ese otro contrato en vez de apagarse.
   */
  async _syncEquipos(contratoId: string, sistemaIds: string[], activar: boolean): Promise<void> {
    if (sistemaIds.length === 0) return;
    const batch = createBatch();
    if (activar) {
      for (const sid of sistemaIds) {
        batch.update(docRef('sistemas', sid), {
          enContrato: true,
          contratoId,
          updatedAt: Timestamp.now(),
        });
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      const activos = (await this.getAll({ estado: 'activo' }))
        .filter(c => c.id !== contratoId && c.fechaFin >= today);
      for (const sid of sistemaIds) {
        const otro = activos.find(c => (c.sistemaIds ?? []).includes(sid));
        batch.update(docRef('sistemas', sid), otro
          ? { enContrato: true, contratoId: otro.id, updatedAt: Timestamp.now() }
          : { enContrato: false, contratoId: null, updatedAt: Timestamp.now() });
      }
    }
    await batch.commit();
  },

  /**
   * Incrementa visitasUsadas atómicamente. Valida estado/fechaFin/maxVisitas
   * DENTRO de la tx — antes solo el caller validaba antes de llamar, lo cual
   * permitía cargar visitas a contratos vencidos por timing entre validateOTCreation
   * y la transaction (especialmente alrededor de medianoche o si el contrato se
   * anuló entre el validate y el create).
   */
  async incrementVisitas(id: string): Promise<number> {
    const contratoRef = doc(db, 'contratos', id);
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(contratoRef);
      if (!snap.exists()) throw new Error('Contrato no encontrado');
      const data = snap.data();

      if (data.estado !== 'activo') {
        throw new Error(`Contrato ${id} no activo (estado=${data.estado})`);
      }
      const today = new Date().toISOString().split('T')[0];
      if (data.fechaFin && today > data.fechaFin) {
        throw new Error(`Contrato ${id} vencido (fechaFin=${data.fechaFin})`);
      }
      if (data.tipoLimite === 'visitas' && data.maxVisitas != null) {
        if ((data.visitasUsadas || 0) >= data.maxVisitas) {
          throw new Error(`Contrato ${id} sin visitas disponibles (${data.visitasUsadas}/${data.maxVisitas})`);
        }
      }

      const current = data.visitasUsadas || 0;
      const next = current + 1;
      transaction.update(contratoRef, {
        visitasUsadas: next,
        updatedAt: Timestamp.now(),
        ...getUpdateTrace(),
      });
      return next;
    });
  },

  /**
   * Devuelve una visita al contrato (2026-08-17).
   *
   * `incrementVisitas` no tenía inversa: cancelar la OT liberaba la agenda pero
   * la visita quedaba consumida. Dos coordinaciones canceladas y reprogramadas
   * hacían que un contrato de 12 informara 14. El desvío se acumulaba en
   * silencio y lo iba a notar el cliente antes que nosotros.
   *
   * A diferencia del incremento, acá NO se exige contrato activo ni vigente: se
   * está devolviendo algo, y un contrato que venció entre la creación y la
   * cancelación tiene todo el derecho a recuperar su visita. Nunca baja de 0.
   */
  async decrementVisitas(id: string): Promise<number> {
    const contratoRef = doc(db, 'contratos', id);
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(contratoRef);
      if (!snap.exists()) throw new Error('Contrato no encontrado');
      const current = snap.data().visitasUsadas || 0;
      if (current <= 0) return 0;
      const next = current - 1;
      transaction.update(contratoRef, {
        visitasUsadas: next,
        updatedAt: Timestamp.now(),
        ...getUpdateTrace(),
      });
      return next;
    });
  },

  /**
   * OTs imputadas a este contrato. Una lectura acotada — son decenas, no miles.
   */
  async otsDelContrato(contratoId: string): Promise<WorkOrder[]> {
    const { ordenesTrabajoService } = await import('./otService');
    const todas = await ordenesTrabajoService.getAll();
    return todas.filter(o => o.contratoId === contratoId);
  },

  /**
   * ¿Se puede crear esta OT bajo este contrato? (2026-08-17)
   *
   * Reemplaza a `validateOTCreation` —que además no la llamaba nadie— con el
   * cupo por EQUIPO y por AÑO DE CONTRATO. La cuenta sale de las OTs, no del
   * contador `visitasUsadas`: ese subía al crear y no bajaba al cancelar, así
   * que hace rato dejó de ser confiable.
   */
  async validarCupoOT(
    contratoId: string,
    destino: { sistemaId?: string | null; tipoServicio?: string | null; fecha?: string },
  ): Promise<{ allowed: boolean; reason?: string; restantesTrasCrear?: number | null }> {
    const contrato = await this.getById(contratoId);
    if (!contrato) return { allowed: false, reason: 'Contrato no encontrado' };
    const [{ puedeCrearOTBajoContrato }, ots] = await Promise.all([
      import('../utils/contratoCupo'),
      this.otsDelContrato(contratoId),
    ]);
    return puedeCrearOTBajoContrato(contrato, ots, destino);
  },

  /** Consumo del año de contrato vigente, una fila por equipo × servicio. */
  async consumoDelAnioVigente(contratoId: string, fecha?: string) {
    const contrato = await this.getById(contratoId);
    if (!contrato) return [];
    const [{ consumoDelAnio }, ots] = await Promise.all([
      import('../utils/contratoCupo'),
      this.otsDelContrato(contratoId),
    ]);
    return consumoDelAnio(contrato, ots, fecha);
  },

  /** @deprecated Sin callers. Usar `validarCupoOT`, que mira el cupo por equipo. */
  async validateOTCreation(contratoId: string, tipoServicioNombre?: string): Promise<{ allowed: boolean; reason?: string }> {
    const contrato = await this.getById(contratoId);
    if (!contrato) return { allowed: false, reason: 'Contrato no encontrado' };
    if (contrato.estado !== 'activo') return { allowed: false, reason: 'Contrato no activo' };

    const today = new Date().toISOString().split('T')[0];
    if (today > contrato.fechaFin) return { allowed: false, reason: 'Contrato vencido' };

    if (contrato.tipoLimite === 'visitas' && contrato.maxVisitas !== null) {
      if (contrato.visitasUsadas >= contrato.maxVisitas) {
        return { allowed: false, reason: `Visitas agotadas (${contrato.visitasUsadas}/${contrato.maxVisitas})` };
      }
    }

    if (tipoServicioNombre && contrato.serviciosIncluidos.length > 0) {
      const included = contrato.serviciosIncluidos.some(s =>
        s.tipoServicioNombre.toLowerCase() === tipoServicioNombre.toLowerCase()
      );
      if (!included) {
        return { allowed: false, reason: `Servicio "${tipoServicioNombre}" no incluido en el contrato` };
      }
    }

    return { allowed: true };
  },
};
