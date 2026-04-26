import { collection, getDocs, doc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import type { SolicitudFacturacion, SolicitudFacturacionEstado } from '@ags/shared';
import { db, cleanFirestoreData, getCreateTrace, getUpdateTrace, createBatch, newDocRef, docRef, onSnapshot } from './firebase';

function toISO(val: any, fallback: string | null = null): string | null {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return fallback;
}

function parseSolicitud(d: any, id: string): SolicitudFacturacion {
  return {
    id,
    ...d,
    createdAt: toISO(d.createdAt, '') as string,
    updatedAt: toISO(d.updatedAt, '') as string,
    fechaFactura: toISO(d.fechaFactura),
    fechaCobro: toISO(d.fechaCobro),
    fechaVencimientoCae: toISO(d.fechaVencimientoCae),
  };
}

export const facturacionService = {
  async getAll(filters?: { estado?: SolicitudFacturacionEstado; clienteId?: string }) {
    let q = query(collection(db, 'solicitudesFacturacion'));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));

    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  subscribe(
    filters: { estado?: SolicitudFacturacionEstado; clienteId?: string } | undefined,
    callback: (items: SolicitudFacturacion[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'solicitudesFacturacion'));
    if (filters?.estado) q = query(q, where('estado', '==', filters.estado));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));

    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    }, err => {
      console.error('SolicitudesFacturacion subscription error:', err);
      onError?.(err);
    });
  },

  async getById(id: string): Promise<SolicitudFacturacion | null> {
    const snap = await getDoc(doc(db, 'solicitudesFacturacion', id));
    if (!snap.exists()) return null;
    return parseSolicitud(snap.data(), snap.id);
  },

  async getByPresupuesto(presupuestoId: string): Promise<SolicitudFacturacion[]> {
    const q = query(collection(db, 'solicitudesFacturacion'), where('presupuestoId', '==', presupuestoId));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => parseSolicitud(d.data(), d.id));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async create(data: Omit<SolicitudFacturacion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = newDocRef('solicitudesFacturacion');
    const batch = createBatch();
    const cleaned = cleanFirestoreData({
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...getCreateTrace(),
    });
    batch.set(ref, cleaned);
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<SolicitudFacturacion>): Promise<void> {
    const ref = docRef('solicitudesFacturacion', id);
    const batch = createBatch();
    const { id: _, createdAt: __, ...rest } = data;
    const cleaned = cleanFirestoreData({
      ...rest,
      updatedAt: Timestamp.now(),
      ...getUpdateTrace(),
    });
    batch.update(ref, cleaned);
    await batch.commit();

    // ── Phase 12 BILL-02 + Pitfall 5: recompute cuota estados when solicitud estado changes ──
    // Pitfall 5: anulada solicitud → cuota back to habilitada (regen case).
    // The recompute also covers cobrada/facturada mirrors.
    // Guard: only trigger when estado field is being updated.
    const triggersRecompute = 'estado' in (data as Record<string, unknown>);
    if (triggersRecompute) {
      // Read solicitud after write to get presupuestoId (may not be in `data`)
      const sol = await this.getById(id);
      if (sol?.presupuestoId) {
        const { presupuestosService } = await import('./presupuestosService');
        // Recompute BEFORE trySyncFinalizacion so finalizacion sees fresh cuota estados.
        try {
          await (presupuestosService as any)._recomputeAndPersistEsquema(sol.presupuestoId);
        } catch (err) {
          console.warn('[facturacionService.update.recompute]', err);
        }
        try {
          await presupuestosService.trySyncFinalizacion(sol.presupuestoId);
        } catch (err) {
          console.warn('[facturacionService.update.trySync]', err);
        }
      }
    }
  },

  async registrarFactura(id: string, datos: {
    numeroFactura: string;
    fechaFactura: string;
    tipoComprobante?: string;
    puntoVenta?: string;
    cae?: string;
    fechaVencimientoCae?: string;
  }): Promise<void> {
    await this.update(id, {
      ...datos,
      estado: 'facturada',
    });
  },

  async registrarCobro(id: string, fechaCobro: string): Promise<void> {
    await this.update(id, {
      estado: 'cobrada',
      fechaCobro,
    });
  },

  /**
   * Phase 10 — Marcar solicitud como enviada (mail al contable ya fue disparado).
   * Transiciona estado 'pendiente' → 'enviada' y registra timestamp de envío.
   */
  async marcarEnviada(id: string, actor?: { uid: string; name?: string }): Promise<void> {
    const ref = docRef('solicitudesFacturacion', id);
    const batch = createBatch();
    const cleaned = cleanFirestoreData({
      estado: 'enviada' as const,
      enviadaAt: new Date().toISOString(),   // Wave 10-01 field
      updatedAt: Timestamp.now(),
      updatedBy: actor?.uid ?? null,
      updatedByName: actor?.name ?? null,
    });
    batch.update(ref, cleaned);
    await batch.commit();
  },

  /**
   * Phase 10 — Marcar solicitud como facturada (alias semántico con más contexto que registrarFactura).
   * Acepta datos opcionales — si se pasan, registra la factura completa; si no, solo cambia estado.
   * Usable desde el row-action del dashboard sin requerir que el contable tenga los datos AFIP aún.
   */
  async marcarFacturada(
    id: string,
    actor?: { uid: string; name?: string },
    datos?: { numeroFactura?: string; fechaFactura?: string },
  ): Promise<void> {
    // update() call includes estado='facturada' → triggers recompute + trySyncFinalizacion internally
    // (Phase 12 BILL-02: hook added to facturacionService.update() in this plan).
    await this.update(id, {
      estado: 'facturada',
      numeroFactura: datos?.numeroFactura ?? null,
      fechaFactura: datos?.fechaFactura ?? null,
      facturadoPor: actor?.uid ?? null,
      facturadoPorNombre: actor?.name ?? null,
    } as any);
  },

  /**
   * Phase 10 — Agregar/reemplazar observaciones (nota del contable).
   * NO es append — reemplaza. Si el caller quiere append, concatena en el UI antes de llamar.
   * audit via getUpdateTrace ya incluido en update().
   */
  async agregarNota(id: string, nota: string, _actor?: { uid: string; name?: string }): Promise<void> {
    await this.update(id, {
      observaciones: nota,
    });
  },
};
