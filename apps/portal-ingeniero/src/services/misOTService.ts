import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  runTransaction,
  setDoc,
  addDoc,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import type {
  WorkOrder,
  Pendiente,
  Presupuesto,
  OrdenCompraCliente,
  UnidadStock,
  InstrumentoPatron,
  Asignacion,
  Sistema,
  OTEstadoAdmin,
} from '@ags/shared';
import { deepCleanForFirestore } from '@ags/shared';
import { db, leadsService } from './firebaseService';
import { getCreateTrace } from './currentUser';

/** Estados administrativos terminales — una OT en estos estados no aparece en "Mis OT". */
const ESTADOS_ADMIN_TERMINALES: OTEstadoAdmin[] = ['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO'];
const ESTADOS_ADMIN_ACTIVOS: OTEstadoAdmin[] = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO'];

export type MisOTDoc = WorkOrder & { id: string };

/** Parte declarada por el ingeniero al solicitar un presupuesto desde una OT. */
export interface ParteSolicitada {
  numeroParte: string;
  cantidad: number;
  /** Descripción del artículo cuando se eligió del stock (texto libre: null). */
  descripcion?: string | null;
  /** FK → articulos cuando la parte se seleccionó del catálogo de stock. */
  stockArticuloId?: string | null;
}

/** Opción del buscador de artículos de stock en "Solicitar presupuesto". */
export interface ArticuloStockOption {
  id: string;
  codigo: string;
  descripcion: string;
}

function parseReporte(id: string, data: Record<string, unknown>): MisOTDoc {
  return {
    ...data,
    id,
    otNumber: (data.otNumber as string) ?? id,
    status: (data.status as WorkOrder['status']) ?? 'BORRADOR',
    createdAt: (data.createdAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data.createdAt as string) ?? '',
    updatedAt: (data.updatedAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.() ?? (data.updatedAt as string) ?? '',
  } as unknown as MisOTDoc;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const misOTService = {
  /**
   * OTs asignadas al ingeniero (colección `reportes`, doc id = número de OT),
   * en estados NO terminales (status BORRADOR y estadoAdmin previo a cierre).
   * `ids` = [uid del usuario, id del doc en `ingenieros`] — reportes guarda el uid,
   * pero se toleran ambos por robustez histórica.
   */
  subscribeMisOTs(
    ids: string[],
    callback: (ots: MisOTDoc[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) { callback([]); return () => {}; }
    const q = unique.length === 1
      ? query(collection(db, 'reportes'), where('ingenieroAsignadoId', '==', unique[0]))
      : query(collection(db, 'reportes'), where('ingenieroAsignadoId', 'in', unique));
    return onSnapshot(q, snap => {
      const ots = snap.docs
        .map(d => parseReporte(d.id, d.data() as Record<string, unknown>))
        .filter(ot => ot.status !== 'FINALIZADO'
          && (!ot.estadoAdmin || !ESTADOS_ADMIN_TERMINALES.includes(ot.estadoAdmin)));
      ots.sort((a, b) => (a.fechaServicioAprox || '9999').localeCompare(b.fechaServicioAprox || '9999'));
      callback(ots);
    }, err => {
      console.error('[misOTService] reportes subscription error:', err);
      onError?.(err);
    });
  },

  /**
   * Vista admin de "Mis OT": TODAS las OTs activas, de todos los ingenieros.
   * Filtra por estadoAdmin no-terminal en la query (acota el volumen — no baja
   * el histórico completo de `reportes`). OTs legacy sin estadoAdmin quedan
   * afuera de esta vista; siguen visibles para su ingeniero asignado.
   */
  subscribeTodasLasOTs(
    callback: (ots: MisOTDoc[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, 'reportes'), where('estadoAdmin', 'in', ESTADOS_ADMIN_ACTIVOS));
    return onSnapshot(q, snap => {
      const ots = snap.docs
        .map(d => parseReporte(d.id, d.data() as Record<string, unknown>))
        .filter(ot => ot.status !== 'FINALIZADO');
      ots.sort((a, b) => (a.fechaServicioAprox || '9999').localeCompare(b.fechaServicioAprox || '9999'));
      callback(ots);
    }, err => {
      console.error('[misOTService] reportes (todas) subscription error:', err);
      onError?.(err);
    });
  },

  /** Tareas pendientes abiertas de un equipo (colección `pendientes`, equipoId = sistemaId). */
  async getPendientesDeEquipo(sistemaId: string): Promise<Pendiente[]> {
    const q = query(
      collection(db, 'pendientes'),
      where('equipoId', '==', sistemaId),
      where('estado', '==', 'pendiente'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Pendiente));
  },

  /** Conteo de tareas pendientes por equipo, para el ⚠ de la lista. */
  async getPendientesCounts(sistemaIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const unique = Array.from(new Set(sistemaIds.filter(Boolean)));
    for (const ids of chunk(unique, 10)) {
      const q = query(
        collection(db, 'pendientes'),
        where('equipoId', 'in', ids),
        where('estado', '==', 'pendiente'),
      );
      const snap = await getDocs(q).catch(() => null);
      snap?.docs.forEach(d => {
        const eq = d.data().equipoId as string;
        counts.set(eq, (counts.get(eq) ?? 0) + 1);
      });
    }
    return counts;
  },

  /** Presupuesto por número visible (budgets[] de la OT guarda números, no ids). */
  async getPresupuestoByNumero(numero: string): Promise<Presupuesto | null> {
    const snap = await getDocs(query(collection(db, 'presupuestos'), where('numero', '==', numero)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as unknown as Presupuesto;
  },

  async getOrdenCompraCliente(id: string): Promise<OrdenCompraCliente | null> {
    const snap = await getDoc(doc(db, 'ordenesCompraCliente', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as unknown as OrdenCompraCliente;
  },

  /** Unidades de stock reservadas para un presupuesto (materiales del servicio). */
  async getUnidadesReservadas(presupuestoId: string): Promise<UnidadStock[]> {
    const q = query(
      collection(db, 'unidades'),
      where('reservadoParaPresupuestoId', '==', presupuestoId),
      where('activo', '==', true),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UnidadStock));
  },

  /** Unidades de stock físicamente en poder del ingeniero. */
  async getUnidadesDeIngeniero(ingenieroIds: string[]): Promise<UnidadStock[]> {
    const unique = Array.from(new Set(ingenieroIds.filter(Boolean)));
    if (unique.length === 0) return [];
    const q = query(
      collection(db, 'unidades'),
      where('ubicacion.tipo', '==', 'ingeniero'),
      where('ubicacion.referenciaId', 'in', unique),
      where('activo', '==', true),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UnidadStock));
  },

  /** Instrumentos asignados al ingeniero (asignadoAId), con certificadoUrl. */
  async getInstrumentosDeIngeniero(ingenieroIds: string[]): Promise<InstrumentoPatron[]> {
    const unique = Array.from(new Set(ingenieroIds.filter(Boolean)));
    if (unique.length === 0) return [];
    const q = query(collection(db, 'instrumentos'), where('asignadoAId', 'in', unique));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as unknown as InstrumentoPatron))
      .filter(i => i.activo !== false);
  },

  /** Asignaciones activas del ingeniero (minikits, patrones, dispositivos, artículos). */
  async getAsignacionesActivas(ingenieroIds: string[]): Promise<Asignacion[]> {
    const unique = Array.from(new Set(ingenieroIds.filter(Boolean)));
    if (unique.length === 0) return [];
    const q = query(
      collection(db, 'asignaciones'),
      where('ingenieroId', 'in', unique),
      where('estado', '==', 'activa'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Asignacion));
  },

  /** Certificado de un patrón: campo top-level o el del primer lote que tenga uno. */
  async getPatronCertificadoUrl(patronId: string): Promise<string | null> {
    const snap = await getDoc(doc(db, 'patrones', patronId));
    if (!snap.exists()) return null;
    const data = snap.data() as { certificadoUrl?: string | null; lotes?: { certificadoUrl?: string | null }[] };
    if (data.certificadoUrl) return data.certificadoUrl;
    return data.lotes?.find(l => l.certificadoUrl)?.certificadoUrl ?? null;
  },

  /**
   * Datos del establecimiento para la banda del detalle (la OT solo guarda el id):
   * nombre + geolocalización validada con Google (lat/lng/placeId) para el link a Maps.
   */
  async getEstablecimientoInfo(establecimientoId: string): Promise<{
    nombre: string | null;
    lat: number | null;
    lng: number | null;
    placeId: string | null;
  } | null> {
    const snap = await getDoc(doc(db, 'establecimientos', establecimientoId));
    if (!snap.exists()) return null;
    const d = snap.data() as { nombre?: string; lat?: number | null; lng?: number | null; placeId?: string | null };
    return {
      nombre: d.nombre ?? null,
      lat: typeof d.lat === 'number' ? d.lat : null,
      lng: typeof d.lng === 'number' ? d.lng : null,
      placeId: d.placeId ?? null,
    };
  },

  /** Catálogo de artículos activos (colección `articulos`) para el buscador de partes. */
  async getArticulosStock(): Promise<ArticuloStockOption[]> {
    const snap = await getDocs(query(collection(db, 'articulos'), where('activo', '==', true)));
    const items = snap.docs.map(d => {
      const data = d.data() as { codigo?: string; descripcion?: string };
      return { id: d.id, codigo: data.codigo ?? '', descripcion: data.descripcion ?? '' };
    });
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  /**
   * Número de presupuesto atómico. MISMO mecanismo y MISMO doc counter que
   * sistema-modular (presupuestosService.getNextPresupuestoNumber): transacción
   * sobre `_counters/presupuestoNumber` con bootstrap scan-and-max la primera vez.
   * No cambiar el esquema acá sin cambiarlo allá — duplicaría numeración.
   */
  async getNextPresupuestoNumber(): Promise<string> {
    const counterRef = doc(db, '_counters', 'presupuestoNumber');
    const nextBase = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        const querySnapshot = await getDocs(collection(db, 'presupuestos'));
        let maxBase = 0;
        querySnapshot.docs.forEach(d => {
          const match = (d.data().numero as string | undefined)?.match(/PRE-(\d+)/);
          const base = match ? parseInt(match[1], 10) : 0;
          if (base > maxBase) maxBase = base;
        });
        current = maxBase;
      }
      const next = current + 1;
      tx.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return next;
    });
    return `PRE-${String(nextBase).padStart(4, '0')}.01`;
  },

  /**
   * Flujo "Solicitar presupuesto" desde una OT:
   *  a) toma número atómico (counter compartido con sistema-modular),
   *  b) crea el presupuesto en borrador (tipo 'partes', origen OT) con las partes
   *     declaradas como items sin precio — ventas los completa,
   *  c) agrega el número a budgets[] de la OT (colección `reportes`, canónica),
   *  d) crea ticket al área ADMINISTRACIÓN DE SOPORTE — no existe un sector
   *     "compras" en la empresa: Miguel Barrios (admin de soporte) es el
   *     encargado de compras y quien envía los presupuestos de partes; ventas
   *     se ocupa solo de equipos. leadsService.create auto-asigna al responsable
   *     configurado en adminConfig/flujos → responsablePorArea.admin_soporte.
   */
  async solicitarPresupuesto(
    ot: MisOTDoc,
    sistema: Sistema | null,
    partes: ParteSolicitada[] = [],
  ): Promise<{ presupuestoId: string; numero: string }> {
    const numero = await this.getNextPresupuestoNumber();

    const items = partes.map(p => ({
      id: crypto.randomUUID(),
      codigoProducto: p.numeroParte,
      descripcion: p.descripcion || p.numeroParte,
      cantidad: p.cantidad,
      unidad: 'unidad',
      precioUnitario: 0,
      subtotal: 0,
      stockArticuloId: p.stockArticuloId ?? null,
      sistemaId: ot.sistemaId ?? null,
      sistemaNombre: sistema?.nombre || ot.sistema || null,
    }));

    // El IST siempre solicita partes — el presupuesto nace tipo 'partes'.
    const payload = deepCleanForFirestore({
      numero,
      tipo: 'partes',
      moneda: 'USD',
      clienteId: ot.clienteId ?? null,
      establecimientoId: ot.establecimientoId ?? sistema?.establecimientoId ?? null,
      sistemaId: ot.sistemaId ?? null,
      contactoId: null,
      origenTipo: 'ot',
      origenId: ot.otNumber,
      origenRef: `OT-${ot.otNumber}`,
      estado: 'borrador',
      items,
      subtotal: 0,
      total: 0,
      ordenesCompraIds: [],
      adjuntos: [],
      validezDias: 15,
      responsableId: null,
      responsableNombre: null,
      otVinculadaNumber: ot.otNumber,
      otsVinculadasNumbers: [ot.otNumber],
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const presRef = await addDoc(collection(db, 'presupuestos'), payload);

    // budgets[] vive en reportes/{otNumber} (colección canónica de OTs).
    await setDoc(doc(db, 'reportes', ot.otNumber), {
      budgets: arrayUnion(numero),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    const equipoLabel = [sistema?.nombre || ot.sistema, sistema?.agsVisibleId].filter(Boolean).join(' · ');
    const partesTexto = partes.length > 0
      ? `Partes solicitadas:\n${partes.map(p =>
          `  · ${p.numeroParte}${p.descripcion ? ` (${p.descripcion})` : ''} × ${p.cantidad}`).join('\n')}\n`
      : '';
    await leadsService.create({
      clienteId: ot.clienteId ?? null,
      contactoId: null,
      razonSocial: ot.razonSocial || '',
      contacto: ot.contacto || '',
      email: ot.emailPrincipal || '',
      telefono: '',
      motivoLlamado: 'soporte',
      motivoOtros: null,
      motivoContacto: `Solicitud de presupuesto desde OT ${ot.otNumber}`,
      sistemaId: ot.sistemaId ?? null,
      estado: 'presupuesto_pendiente',
      postas: [],
      asignadoA: null,
      derivadoPor: null,
      areaActual: 'admin_soporte',
      prioridad: 'urgente',
      accionPendiente: 'Completar y enviar presupuesto',
      descripcion: `Presupuesto ${numero} creado en borrador desde el portal de ingenieros.\n`
        + `OT: ${ot.otNumber} (${ot.tipoServicio || 'servicio'})\n`
        + `Cliente: ${ot.razonSocial || '—'}\n`
        + `Equipo: ${equipoLabel || '—'}\n`
        + partesTexto
        + `Completar precios y enviar al cliente.`,
      presupuestosIds: [presRef.id],
      otIds: [ot.otNumber],
      source: 'portal',
    } as unknown as Parameters<typeof leadsService.create>[0]);

    return { presupuestoId: presRef.id, numero };
  },
};
