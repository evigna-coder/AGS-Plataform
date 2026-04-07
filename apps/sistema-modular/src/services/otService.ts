import { collection, getDocs, doc, getDoc, query, where, Timestamp, addDoc, runTransaction } from 'firebase/firestore';
import type { WorkOrder, CierreAdministrativo, OTEstadoAdmin } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, getCreateTrace, getUpdateTrace, getCurrentUserTrace, deepCleanForFirestore, inTransition, onSnapshot } from './firebase';
import { leadsService } from './leadsService';
import { presupuestosService } from './presupuestosService';
import { agendaService } from './agendaService';

// Servicio para Órdenes de Trabajo (OTs) - usa la colección 'reportes' existente
export const ordenesTrabajoService = {
  // Generar siguiente número de OT con transacción atómica (counter doc pattern)
  async getNextOtNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de OT (transacción)...');
    const counterRef = doc(db, '_counters', 'otNumber');

    const nextOt = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear colección para inicializar el counter
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        let maxNumber = 29999;
        querySnapshot.docs.forEach(d => {
          const id = d.id;
          if (!id.includes('.')) {
            const m = id.match(/^(\d{5})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxNumber) maxNumber = n;
            }
          }
        });
        current = maxNumber;
      }

      const next = current + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return String(next).padStart(5, '0');
    });

    console.log(`✅ Siguiente OT: ${nextOt}`);
    return nextOt;
  },

  // Generar siguiente número de item con transacción atómica
  async getNextItemNumber(otPadre: string): Promise<string> {
    console.log(`🔢 Generando siguiente item para OT ${otPadre} (transacción)...`);
    const counterRef = doc(db, '_counters', `otItem_${otPadre}`);

    const nextItemNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let currentMax: number;
      if (counterSnap.exists()) {
        currentMax = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear items existentes para inicializar
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        const prefix = otPadre + '.';
        let maxItem = 0;
        querySnapshot.docs.forEach(d => {
          if (d.id.startsWith(prefix)) {
            const m = d.id.match(/\.(\d{2})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxItem) maxItem = n;
            }
          }
        });
        currentMax = maxItem;
      }

      const next = currentMax + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return `${otPadre}.${String(next).padStart(2, '0')}`;
    });

    console.log(`✅ Siguiente item: ${nextItemNumber}`);
    return nextItemNumber;
  },

  /** Obtener solo OTs activas/pendientes (para agenda sidebar). Mucho más rápido que getAll(). */
  async getPending(): Promise<WorkOrder[]> {
    const PENDING_ESTADOS = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO'];
    const [byEstado, byBorrador] = await Promise.all([
      getDocs(query(collection(db, 'reportes'), where('estadoAdmin', 'in', PENDING_ESTADOS))),
      getDocs(query(collection(db, 'reportes'), where('status', '==', 'BORRADOR'))),
    ]);
    const seen = new Set<string>();
    const results: WorkOrder[] = [];
    for (const snap of [byEstado, byBorrador]) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          results.push({ otNumber: d.id, ...d.data(), updatedAt: d.data().updatedAt || new Date().toISOString() } as WorkOrder);
        }
      }
    }
    return results;
  },

  // Obtener todas las OTs (con filtros opcionales)
  async getAll(filters?: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] }) {
    console.log('📥 Cargando órdenes de trabajo desde Firestore...');
    let q = query(collection(db, 'reportes'));

    // Aplicar filtros si existen
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.sistemaId) {
      q = query(q, where('sistemaId', '==', filters.sistemaId));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const querySnapshot = await getDocs(q);
    const ordenes = querySnapshot.docs.map(doc => ({
      otNumber: doc.id,
      ...doc.data(),
      updatedAt: doc.data().updatedAt || new Date().toISOString(),
    })) as WorkOrder[];

    // Ordenar por número de OT (descendente - más recientes primero)
    ordenes.sort((a, b) => {
      const numA = parseInt(a.otNumber.split('.')[0]);
      const numB = parseInt(b.otNumber.split('.')[0]);
      if (numA !== numB) return numB - numA;
      // Si mismo número base, ordenar por item
      const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
      const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
      return itemB - itemA;
    });

    console.log(`✅ ${ordenes.length} órdenes de trabajo cargadas`);
    return ordenes;
  },

  /** Real-time subscription for OTs. Returns unsubscribe function. */
  subscribe(
    filters: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] } | undefined,
    callback: (ots: WorkOrder[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'reportes'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.sistemaId) q = query(q, where('sistemaId', '==', filters.sistemaId));
    if (filters?.status) q = query(q, where('status', '==', filters.status));

    return onSnapshot(q, snap => {
      const ordenes = snap.docs.map(d => ({
        otNumber: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];
      ordenes.sort((a, b) => {
        const numA = parseInt(a.otNumber.split('.')[0]);
        const numB = parseInt(b.otNumber.split('.')[0]);
        if (numA !== numB) return numB - numA;
        const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
        const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
        return itemB - itemA;
      });
      inTransition(callback)(ordenes);
    }, err => {
      console.error('OT subscription error:', err);
      onError?.(err);
    });
  },

  // Obtener items de una OT padre
  async getItemsByOtPadre(otPadre: string): Promise<WorkOrder[]> {
    const q = query(collection(db, 'reportes'));
    const querySnapshot = await getDocs(q);
    const prefix = otPadre + '.';

    const items = querySnapshot.docs
      .filter(doc => doc.id.startsWith(prefix))
      .map(doc => ({
        otNumber: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];

    // Ordenar por número de item
    items.sort((a, b) => {
      const itemA = parseInt(a.otNumber.split('.')[1]);
      const itemB = parseInt(b.otNumber.split('.')[1]);
      return itemA - itemB;
    });

    return items;
  },

  // Obtener OT por número
  async getByOtNumber(otNumber: string) {
    const otDocRef = doc(db, 'reportes', otNumber);
    const docSnap = await getDoc(otDocRef);
    if (docSnap.exists()) {
      return {
        otNumber: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder;
    }
    return null;
  },

  /** Real-time subscription to a single OT by otNumber. Returns unsubscribe function. */
  subscribeByOtNumber(
    otNumber: string,
    callback: (ot: WorkOrder | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'reportes', otNumber), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        otNumber: snap.id,
        ...snap.data(),
        updatedAt: snap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder);
    }, err => {
      console.error('OT single subscription error:', err);
      onError?.(err);
    });
  },

  // Crear nueva OT (usa setDoc para controlar el ID)
  async create(otData: Omit<WorkOrder, 'otNumber'> & { otNumber: string }) {
    console.log('📝 Creando orden de trabajo:', otData.otNumber);

    const otDocRef = doc(db, 'reportes', otData.otNumber);
    const cleanedData = deepCleanForFirestore({
      ...otData,
      ...getCreateTrace(),
      status: otData.status || 'BORRADOR',
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.set(otDocRef, cleanedData);
    batchAudit(batch, { action: 'create', collection: 'ordenes_trabajo', documentId: otData.otNumber, after: cleanedData as any });
    await batch.commit();
    console.log('✅ Orden de trabajo creada exitosamente');

    // Auto-create agenda entry if engineer + date assigned
    if (otData.ingenieroAsignadoId && otData.fechaServicioAprox && !otData.otNumber.includes('.')) {
      try {
        await agendaService.autoCreateFromOT(otData as any);
      } catch (err) {
        console.error('[otService] Error auto-creating agenda entry:', err);
      }
    }

    return otData.otNumber;
  },

  // Actualizar OT
  async update(otNumber: string, data: Partial<WorkOrder>) {
    const cleanedData = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.update(docRef('reportes', otNumber), cleanedData);
    batchAudit(batch, { action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleanedData as any });
    await batch.commit();

    // ── Auto-sync lead when OT estadoAdmin changes ──
    if (data.estadoAdmin) {
      try {
        const ot = await this.getByOtNumber(otNumber);
        if (ot?.leadId) {
          await leadsService.syncFromOT(ot.leadId, otNumber, data.estadoAdmin as OTEstadoAdmin);
        }
        // Sync presupuesto estado
        if (ot && data.estadoAdmin === 'FINALIZADO') {
          await this._syncPresupuestoOnFinalize(ot).catch(err =>
            console.error('[otService] Error syncing presupuesto:', err)
          );
        }
      } catch (err) {
        console.error('[otService] Error syncing lead from OT:', err);
      }
    }

    // ── Auto-sync agenda when engineer or date changes ──
    if (data.ingenieroAsignadoId !== undefined || data.fechaServicioAprox !== undefined) {
      try {
        await agendaService.syncFromOT(otNumber, {
          ingenieroId: data.ingenieroAsignadoId as string | null | undefined,
          ingenieroNombre: data.ingenieroAsignadoNombre as string | null | undefined,
          fechaServicioAprox: data.fechaServicioAprox as string | undefined,
        });
        // If engineer+date now present but no entry existed, auto-create
        if (data.ingenieroAsignadoId && data.fechaServicioAprox) {
          const ot = await this.getByOtNumber(otNumber);
          if (ot) await agendaService.autoCreateFromOT(ot as any);
        }
      } catch (err) {
        console.error('[otService] Error syncing agenda:', err);
      }
    }
  },

  /** Check if all OTs for a presupuesto are finalized, and update presupuesto accordingly */
  async _syncPresupuestoOnFinalize(ot: WorkOrder): Promise<void> {
    const budgetNumbers = ot.budgets || [];
    if (budgetNumbers.length === 0) return;
    // For each linked presupuesto, check if all OTs are finalized
    const allPresupuestos = await presupuestosService.getAll();
    for (const budgetNum of budgetNumbers) {
      const pres = allPresupuestos.find(p => p.numero === budgetNum);
      if (!pres || pres.estado === 'finalizado' || pres.estado === 'anulado') continue;
      // Find all OTs that reference this presupuesto
      const allOTs = await this.getAll();
      const otsForPres = allOTs.filter(o =>
        !o.otNumber.includes('.') && (o.budgets || []).includes(budgetNum)
      );
      const allFinalized = otsForPres.every(o => o.estadoAdmin === 'FINALIZADO');
      if (allFinalized) {
        await presupuestosService.update(pres.id, { estado: 'finalizado' } as any);
      }
    }
  },

  async delete(otNumber: string) {
    const batch = createBatch();
    batch.delete(docRef('reportes', otNumber));
    batchAudit(batch, { action: 'delete', collection: 'ordenes_trabajo', documentId: otNumber });
    await batch.commit();
  },

  /** Encola un mail de aviso a administración para facturación */
  async enviarAvisoCierreAdmin(otNumber: string, data: {
    razonSocial: string;
    tipoServicio: string;
    horasLab: string;
    horasViaje: string;
    cierreAdmin: CierreAdministrativo;
    partesCount: number;
    ingenieroNombre: string | null;
  }): Promise<void> {
    const user = getCurrentUserTrace();
    const hsLab = data.cierreAdmin.horasLabAjustadas || data.horasLab || '0';
    const hsViaje = data.cierreAdmin.horasViajeAjustadas || data.horasViaje || '0';

    await addDoc(collection(db, 'mailQueue'), {
      type: 'cierre_admin_ot',
      status: 'pending',
      createdAt: Timestamp.now(),
      createdBy: user?.uid ?? null,
      createdByName: user?.name ?? null,
      data: {
        otNumber,
        razonSocial: data.razonSocial,
        tipoServicio: data.tipoServicio,
        horasLaboratorio: hsLab,
        horasViaje: hsViaje,
        horasTotal: (Number(hsLab) + Number(hsViaje)).toFixed(1),
        partesUsadas: data.partesCount,
        stockDeducido: data.cierreAdmin.stockDeducido,
        notas: data.cierreAdmin.notasCierre || null,
        ingeniero: data.ingenieroNombre,
      },
    });
  },
};
