import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, setDoc, addDoc, runTransaction } from 'firebase/firestore';
import type { WorkOrder, CierreAdministrativo } from '@ags/shared';
import { db, logAudit, getCreateTrace, getUpdateTrace, getCurrentUserTrace, deepCleanForFirestore } from './firebase';

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
    const docRef = doc(db, 'reportes', otNumber);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        otNumber: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder;
    }
    return null;
  },

  // Crear nueva OT (usa setDoc para controlar el ID)
  async create(otData: Omit<WorkOrder, 'otNumber'> & { otNumber: string }) {
    console.log('📝 Creando orden de trabajo:', otData.otNumber);

    const docRef = doc(db, 'reportes', otData.otNumber);
    const cleanedData = deepCleanForFirestore({
      ...otData,
      ...getCreateTrace(),
      status: otData.status || 'BORRADOR',
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    await setDoc(docRef, cleanedData);
    logAudit({ action: 'create', collection: 'ordenes_trabajo', documentId: otData.otNumber, after: cleanedData as any });
    console.log('✅ Orden de trabajo creada exitosamente');
    return otData.otNumber;
  },

  // Actualizar OT
  async update(otNumber: string, data: Partial<WorkOrder>) {
    const docRef = doc(db, 'reportes', otNumber);
    const cleanedData = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
    logAudit({ action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleanedData as any });
  },

  async delete(otNumber: string) {
    logAudit({ action: 'delete', collection: 'ordenes_trabajo', documentId: otNumber });
    await deleteDoc(doc(db, 'reportes', otNumber));
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
