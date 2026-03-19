import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { Loaner, PrestamoLoaner, ExtraccionLoaner, VentaLoaner } from '@ags/shared';
import { db, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace } from './firebase';

// --- Loaners (Equipos en préstamo) ---

export const loanersService = {
  async getNextLoanerCodigo(): Promise<string> {
    const q = query(collection(db, 'loaners'), orderBy('codigo', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const codigo = d.data().codigo;
      const match = codigo?.match(/LNR-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return `LNR-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    estado?: string;
    activoOnly?: boolean;
  }): Promise<Loaner[]> {
    let q = query(collection(db, 'loaners'));
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Loaner[];
    if (filters?.activoOnly) {
      items = items.filter(l => l.activo);
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getById(id: string): Promise<Loaner | null> {
    const snap = await getDoc(doc(db, 'loaners', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Loaner;
  },

  async create(data: Omit<Loaner, 'id' | 'codigo' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const codigo = await this.getNextLoanerCodigo();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      codigo,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'loaners', id), payload);
    logAudit({ action: 'create', collection: 'loaners', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Loaner, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'loaners', id), payload);
    logAudit({ action: 'update', collection: 'loaners', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'loaners', documentId: id });
    await deleteDoc(doc(db, 'loaners', id));
  },

  async getDisponibles(): Promise<Loaner[]> {
    return this.getAll({ estado: 'en_base', activoOnly: true });
  },

  async registrarPrestamo(id: string, prestamo: Omit<PrestamoLoaner, 'id'>): Promise<void> {
    const loaner = await this.getById(id);
    if (!loaner) throw new Error('Loaner no encontrado');
    const newPrestamo: PrestamoLoaner = { ...prestamo, id: crypto.randomUUID() };
    await this.update(id, {
      estado: 'en_cliente',
      prestamos: [...loaner.prestamos, newPrestamo],
    });
  },

  async registrarDevolucion(loanerId: string, prestamoId: string, data: {
    fechaRetornoReal: string;
    condicionRetorno: string;
    remitoRetornoId?: string;
    remitoRetornoNumero?: string;
  }): Promise<void> {
    const loaner = await this.getById(loanerId);
    if (!loaner) throw new Error('Loaner no encontrado');
    const prestamos = loaner.prestamos.map(p =>
      p.id === prestamoId
        ? { ...p, ...data, estado: 'devuelto' as const }
        : p
    );
    await this.update(loanerId, { estado: 'en_base', prestamos, condicion: data.condicionRetorno });
  },

  async registrarExtraccion(id: string, extraccion: Omit<ExtraccionLoaner, 'id'>): Promise<void> {
    const loaner = await this.getById(id);
    if (!loaner) throw new Error('Loaner no encontrado');
    const newExtraccion: ExtraccionLoaner = { ...extraccion, id: crypto.randomUUID() };
    await this.update(id, {
      extracciones: [...loaner.extracciones, newExtraccion],
    });
  },

  async registrarVenta(id: string, venta: VentaLoaner): Promise<void> {
    await this.update(id, { estado: 'vendido', venta, activo: false });
  },
};
