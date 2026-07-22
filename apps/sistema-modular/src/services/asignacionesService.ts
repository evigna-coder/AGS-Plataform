import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { runTransaction } from './firebase';
import type { Asignacion, ItemAsignacion } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot } from './firebase';
import {
  consumirUnidadAsignada,
  devolverUnidadAsignada,
  getOrCreateDevolucionesPosition,
  registrarMovimientoAsignacion,
} from './asignacionesStockHelpers';

export const asignacionesService = {
  // Atómico vía counter doc — antes era scan-and-max no transaccional.
  async getNextNumero(): Promise<string> {
    const counterRef = doc(db, '_counters', 'asignacionNumero');
    const next = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const snap = await getDocs(collection(db, 'asignaciones'));
        let maxNum = 0;
        snap.docs.forEach(d => {
          const match = d.data().numero?.match(/ASG-(\d+)/);
          if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
        });
        current = maxNum;
      }
      const nextVal = current + 1;
      tx.set(counterRef, { value: nextVal, updatedAt: Timestamp.now() });
      return nextVal;
    });
    return `ASG-${String(next).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    ingenieroId?: string;
    estado?: string;
    clienteId?: string;
  }): Promise<Asignacion[]> {
    let q = query(collection(db, 'asignaciones'));
    if (filters?.ingenieroId) q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Asignacion[];
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getByIngeniero(ingenieroId: string): Promise<Asignacion[]> {
    return this.getAll({ ingenieroId, estado: 'activa' });
  },

  async getById(id: string): Promise<Asignacion | null> {
    const snap = await getDoc(doc(db, 'asignaciones', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Asignacion;
  },

  async create(data: Omit<Asignacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const numero = data.numero || await this.getNextNumero();
    const { numero: _num, ...rest } = data;
    const payload = deepCleanForFirestore({
      ...rest,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = docRef('asignaciones', id);
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'asignaciones', documentId: id, after: payload });
    await batch.commit();
    return id;
  },

  async update(id: string, data: Partial<Omit<Asignacion, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    const batch = createBatch();
    batch.update(docRef('asignaciones', id), payload);
    batchAudit(batch, { action: 'update', collection: 'asignaciones', documentId: id, after: payload });
    await batch.commit();
  },

  async devolverItems(
    asignacionId: string,
    devoluciones: { itemId: string; cantidad: number }[],
    opts?: {
      /**
       * B3: la transferencia entre ingenieros marca la devolución en el comprobante
       * pero setea ella misma el estado final de las entidades y su propio
       * MovimientoStock 'transferencia'. Con este flag se saltean el revert de
       * entidades y los efectos de stock (la unidad nunca pasa por 'disponible').
       */
      skipEntityEffects?: boolean;
    },
  ): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const reciénDevueltos: { item: ItemAsignacion; cantDev: number }[] = [];
    const devueltosParciales: { item: ItemAsignacion; cantDev: number }[] = [];
    const updatedItems = asg.items.map(item => {
      const dev = devoluciones.find(d => d.itemId === item.id);
      if (!dev) return item;
      const cantDev = Math.min(dev.cantidad, item.cantidad - item.cantidadDevuelta - item.cantidadConsumida);
      const newDevuelta = item.cantidadDevuelta + cantDev;
      const remaining = item.cantidad - newDevuelta - item.cantidadConsumida;
      const updated = {
        ...item,
        cantidadDevuelta: newDevuelta,
        estado: remaining <= 0 ? 'devuelto' as const : item.estado,
        fechaDevolucion: remaining <= 0 ? new Date().toISOString() : item.fechaDevolucion,
      };
      if (item.estado !== 'devuelto' && updated.estado === 'devuelto') reciénDevueltos.push({ item: updated, cantDev });
      else if (cantDev > 0) devueltosParciales.push({ item: updated, cantDev });
      return updated;
    });

    const allDone = updatedItems.every(i => i.permanente || i.estado === 'devuelto' || i.estado === 'consumido');
    await this.update(asignacionId, {
      items: updatedItems,
      estado: allDone ? 'completada' : 'activa',
    });

    if (opts?.skipEntityEffects) return;

    // B2: destino de las unidades devueltas — la posición ORIGINAL de la que
    // salieron (item.origenUbicacion, capturada al asignar; UAT 2026-07-20: "lo
    // que vuelve, vuelve a su posición"). Items legacy sin origen guardado caen
    // a la posición DEVOLUCIONES (pendiente de re-estanteo); si tampoco esa se
    // puede resolver (offline, permisos), placeholder — mejor un movimiento con
    // destino genérico que ningún movimiento.
    const tieneOrigen = (item: ItemAsignacion) =>
      item.origenUbicacion?.tipo === 'posicion' && !!item.origenUbicacion.referenciaId;
    const conStock = [...reciénDevueltos, ...devueltosParciales].filter(({ item }) => item.unidadId || item.articuloId);
    let posDevoluciones: { id: string; nombre: string } = { id: '', nombre: 'Stock' };
    if (conStock.some(({ item }) => !tieneOrigen(item))) {
      try {
        const pos = await getOrCreateDevolucionesPosition();
        posDevoluciones = { id: pos.id, nombre: pos.nombre };
      } catch (err) {
        console.error('[devolverItems] no se pudo resolver la posición DEVOLUCIONES, fallback a placeholder:', err);
      }
    }
    const destinoDe = (item: ItemAsignacion): { id: string; nombre: string } =>
      tieneOrigen(item)
        ? { id: item.origenUbicacion!.referenciaId, nombre: item.origenUbicacion!.referenciaNombre }
        : posDevoluciones;

    // Revertir el estado de la ENTIDAD al devolver — la asignación rápida setea
    // asignadoAId/ubicación al asignar, así que la devolución debe limpiarlos acá
    // (en el servicio, para que TODOS los callers lo hereden — el detalle del
    // comprobante solo marcaba el item y el instrumento quedaba "en poder" del
    // ingeniero en el portal; UAT 2026-07-19, caso TER-04). Best-effort: un fallo
    // acá no revierte la devolución del comprobante. Import dinámico para evitar
    // ciclos con firebaseService.
    if (reciénDevueltos.length > 0) {
      try {
        const { minikitsService, instrumentosService, dispositivosService, vehiculosService } =
          await import('./firebaseService');
        for (const { item, cantDev } of reciénDevueltos) {
          try {
            // B2: la unidad vuelve 'disponible' a una posición real + MovimientoStock
            // 'devolucion' (ingeniero → posición) en una sola transacción.
            if (item.unidadId) {
              await devolverUnidadAsignada({
                unidadId: item.unidadId,
                cantidad: cantDev,
                ingenieroId: asg.ingenieroId,
                ingenieroNombre: asg.ingenieroNombre,
                posicion: destinoDe(item),
                motivo: `Devolución de asignación ${asg.numero}`,
              });
            } else if (item.articuloId) {
              // Item por cantidad sin unidad puntual: solo el asiento del reingreso.
              await registrarMovimientoAsignacion({
                tipo: 'devolucion',
                articuloId: item.articuloId,
                articuloCodigo: item.articuloCodigo,
                articuloDescripcion: item.articuloDescripcion,
                cantidad: cantDev,
                ingenieroId: asg.ingenieroId,
                ingenieroNombre: asg.ingenieroNombre,
                destinoPosicion: destinoDe(item),
                motivo: `Devolución de asignación ${asg.numero}`,
              });
            }
            if (item.minikitId) await minikitsService.update(item.minikitId, { estado: 'en_revision', asignadoA: null });
            if (item.instrumentoId) await instrumentosService.update(item.instrumentoId, { asignadoAId: null, asignadoANombre: null });
            if (item.dispositivoId) await dispositivosService.update(item.dispositivoId, { asignadoAId: null, asignadoANombre: null });
            if (item.vehiculoId) await vehiculosService.update(item.vehiculoId, { asignadoA: '' });
          } catch (err) {
            console.error(`[devolverItems] revert de entidad falló para item ${item.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[devolverItems] no se pudieron cargar los servicios para revertir entidades:', err);
      }
    }

    // Devoluciones PARCIALES de items de stock: el doc de unidad (si existe) sigue
    // 'asignado' con el remanente en poder del ingeniero, pero el reingreso físico
    // parcial se asienta igual en el kardex.
    for (const { item, cantDev } of devueltosParciales) {
      if (!item.unidadId && !item.articuloId) continue;
      try {
        await registrarMovimientoAsignacion({
          tipo: 'devolucion',
          unidadId: item.unidadId,
          articuloId: item.articuloId,
          articuloCodigo: item.articuloCodigo,
          articuloDescripcion: item.articuloDescripcion,
          cantidad: cantDev,
          ingenieroId: asg.ingenieroId,
          ingenieroNombre: asg.ingenieroNombre,
          destinoPosicion: destinoDe(item),
          motivo: `Devolución parcial de asignación ${asg.numero}`,
        });
      } catch (err) {
        console.error(`[devolverItems] movimiento de devolución parcial falló para item ${item.id}:`, err);
      }
    }
  },

  async consumirItems(asignacionId: string, consumos: { itemId: string; cantidad: number; otNumber?: string }[]): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const nowIso = new Date().toISOString();
    const consumidos: { item: ItemAsignacion; cantCon: number }[] = [];
    const updatedItems = asg.items.map(item => {
      const con = consumos.find(c => c.itemId === item.id);
      if (!con) return item;
      const cantCon = Math.min(con.cantidad, item.cantidad - item.cantidadDevuelta - item.cantidadConsumida);
      const newConsumida = item.cantidadConsumida + cantCon;
      const remaining = item.cantidad - item.cantidadDevuelta - newConsumida;
      const updated = {
        ...item,
        cantidadConsumida: newConsumida,
        otNumber: con.otNumber || item.otNumber,
        estado: remaining <= 0 ? 'consumido' as const : item.estado,
        // B1: fecha real del consumo (antes la vista de Consumos aproximaba con la
        // fecha de asignación). Última fecha si hay consumos parciales sucesivos.
        fechaConsumo: cantCon > 0 ? nowIso : (item.fechaConsumo ?? null),
      };
      if (cantCon > 0) consumidos.push({ item: updated, cantCon });
      return updated;
    });

    const allDone = updatedItems.every(i => i.permanente || i.estado === 'devuelto' || i.estado === 'consumido');
    await this.update(asignacionId, {
      items: updatedItems,
      estado: allDone ? 'completada' : 'activa',
    });

    // B1: efectos de stock del consumo en campo — descontar existencias y dejar el
    // MovimientoStock 'consumo' (ingeniero → consumo_ot). Best-effort post-update,
    // mismo criterio que el revert de entidades en devolverItems: un fallo acá no
    // revierte el consumo del comprobante, se loguea para reconciliar a mano.
    for (const { item, cantCon } of consumidos) {
      try {
        if (item.unidadId) {
          // Unidad puntual: transición real (doc entero → 'consumido'; lote → decrementa
          // cantidad) + movimiento, atómico en una transacción.
          await consumirUnidadAsignada({
            unidadId: item.unidadId,
            cantidad: cantCon,
            otNumber: item.otNumber ?? null,
            ingenieroId: asg.ingenieroId,
            ingenieroNombre: asg.ingenieroNombre,
            motivo: `Consumo en campo — asignación ${asg.numero}`,
          });
        } else if (item.articuloId) {
          // Item por cantidad sin unidad puntual: se asienta igual el consumo en el kardex.
          await registrarMovimientoAsignacion({
            tipo: 'consumo',
            articuloId: item.articuloId,
            articuloCodigo: item.articuloCodigo,
            articuloDescripcion: item.articuloDescripcion,
            cantidad: cantCon,
            ingenieroId: asg.ingenieroId,
            ingenieroNombre: asg.ingenieroNombre,
            otNumber: item.otNumber ?? null,
            motivo: `Consumo en campo — asignación ${asg.numero}`,
          });
        }
      } catch (err) {
        console.error(`[consumirItems] efecto de stock falló para item ${item.id}:`, err);
      }
    }
  },

  async reasignarCliente(asignacionId: string, itemIds: string[], nuevoClienteId: string, nuevoClienteNombre: string): Promise<void> {
    const asg = await this.getById(asignacionId);
    if (!asg) throw new Error('Asignación no encontrada');

    const updatedItems = asg.items.map(item =>
      itemIds.includes(item.id) ? { ...item, clienteId: nuevoClienteId, clienteNombre: nuevoClienteNombre } : item
    );
    await this.update(asignacionId, { items: updatedItems });
  },

  async delete(id: string): Promise<void> {
    const batch = createBatch();
    batch.delete(docRef('asignaciones', id));
    batchAudit(batch, { action: 'delete', collection: 'asignaciones', documentId: id });
    await batch.commit();
  },

  /** Real-time subscription. Returns unsubscribe function. */
  subscribe(
    filters: { ingenieroId?: string; estado?: string; clienteId?: string } | undefined,
    callback: (asignaciones: Asignacion[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const constraints: any[] = [];
    if (filters?.ingenieroId) constraints.push(where('ingenieroId', '==', filters.ingenieroId));
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.clienteId) constraints.push(where('clienteId', '==', filters.clienteId));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'asignaciones'), ...constraints);
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })) as Asignacion[];
      callback(items);
    }, err => {
      console.error('Asignaciones subscription error:', err);
      onError?.(err);
    });
  },
};
