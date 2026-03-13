import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Cliente, ContactoCliente, ContactoEstablecimiento, CategoriaEquipo, CategoriaModulo, Sistema, ModuloSistema, Establecimiento, WorkOrder, TipoServicio, Presupuesto, PresupuestoEstado, OrdenCompra, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TableCatalogEntry, InstrumentoPatron, CategoriaInstrumento, Marca, Ingeniero, Proveedor, PosicionStock, Articulo, UnidadStock, Minikit, MovimientoStock, Remito, FichaPropiedad, HistorialFicha, DerivacionProveedor, Loaner, PrestamoLoaner, ExtraccionLoaner, VentaLoaner, PosicionArancelaria, RequerimientoCompra, Importacion, UsuarioAGS, UserRole, UserStatus, AgendaEntry, AgendaNota, PostaWorkflow, PostaHandoff, Lead, Posta, LeadEstado, MotivoLlamado } from '@ags/shared';
import type { AuditAction } from '@ags/shared';
import { getCreateTrace, getUpdateTrace, getCurrentUserTrace } from './currentUser';

// --- Utilidades para CUIT como id de cliente ---
/** Normaliza CUIT: quita guiones y espacios (solo dígitos). */
export function normalizeCuit(cuit: string): string {
  return (cuit || '').replace(/\D/g, '');
}

/** Genera id para cliente sin CUIT: LEGACY-{uuid}. */
export function generateLegacyClientId(): string {
  return 'LEGACY-' + crypto.randomUUID();
}

/** Limpia payload asegurando que no haya undefineds, los cuales fallan en Firestore */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;           // Firestore NO acepta undefined
    out[k] = v === '' ? null : v;            // opcional: strings vacías a null
  }
  return out;
}

// Configuración de Firebase (usar la misma que reportes-ot)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validar que las variables de entorno estén definidas
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ Variables de entorno de Firebase faltantes:', missingVars);
  console.warn('Copia el archivo .env.local desde apps/reportes-ot/ o crea uno nuevo');
} else {
  console.log('%c✅ Variables de entorno de Firebase cargadas correctamente', 'color: green; font-weight: bold');
  console.log('%c📋 Project ID: ' + firebaseConfig.projectId, 'color: blue; font-weight: bold');
}

export let app: ReturnType<typeof initializeApp>;
let db: ReturnType<typeof getFirestore>;
export let storage: ReturnType<typeof getStorage>;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('%c✅ Firebase inicializado correctamente', 'color: green; font-weight: bold');
  console.log('%c🔥 Sistema Modular conectado a Firestore', 'color: orange; font-weight: bold');
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
  // No lanzar error para permitir que la app funcione sin Firebase (modo desarrollo)
}

export { db };

// ========== AUDIT LOG (fire-and-forget) ==========
export function logAudit(params: {
  action: AuditAction;
  collection: string;
  documentId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): void {
  const user = getCurrentUserTrace();
  if (!user) return;
  addDoc(collection(db, 'audit_log'), {
    action: params.action,
    collection: params.collection,
    documentId: params.documentId,
    userId: user.uid,
    userName: user.name,
    timestamp: Timestamp.now(),
    changes: params.before || params.after
      ? { before: params.before ?? null, after: params.after ?? null }
      : null,
  }).catch(err => console.error('Audit log failed:', err));
}

// Servicio para Leads

function migrateLeadEstado(raw: string): LeadEstado {
  const migration: Record<string, LeadEstado> = {
    contactado: 'en_revision',
    presupuestado: 'en_proceso',
    convertido: 'finalizado',
  };
  return migration[raw] || (raw as LeadEstado) || 'nuevo';
}

function parseLeadDoc(d: { id: string; data: () => any }): Lead {
  const data = d.data();
  return {
    id: d.id,
    clienteId: data.clienteId ?? null,
    contactoId: data.contactoId ?? null,
    razonSocial: data.razonSocial ?? '',
    contacto: data.contacto ?? '',
    email: data.email ?? '',
    telefono: data.telefono ?? '',
    motivoLlamado: data.motivoLlamado ?? 'otros',
    motivoContacto: data.motivoContacto ?? '',
    descripcion: data.descripcion ?? null,
    sistemaId: data.sistemaId ?? null,
    estado: migrateLeadEstado(data.estado ?? 'nuevo'),
    postas: data.postas ?? [],
    asignadoA: data.asignadoA ?? null,
    derivadoPor: data.derivadoPor ?? null,
    presupuestosIds: data.presupuestosIds ?? [],
    otIds: data.otIds ?? [],
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
    createdBy: data.createdBy ?? null,
    finalizadoAt: data.finalizadoAt?.toDate?.()?.toISOString() ?? null,
  };
}

export const leadsService = {
  async create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      estado: data.estado || 'nuevo',
      postas: data.postas || [],
      presupuestosIds: data.presupuestosIds || [],
      otIds: data.otIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'leads'), payload);
    logAudit({ action: 'create', collection: 'leads', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  async getAll(filters?: { estado?: LeadEstado; asignadoA?: string; motivoLlamado?: MotivoLlamado }) {
    const constraints: any[] = [];
    if (filters?.estado) constraints.push(where('estado', '==', filters.estado));
    if (filters?.asignadoA) constraints.push(where('asignadoA', '==', filters.asignadoA));
    if (filters?.motivoLlamado) constraints.push(where('motivoLlamado', '==', filters.motivoLlamado));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(collection(db, 'leads'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => parseLeadDoc(d));
  },

  async getById(id: string): Promise<Lead | null> {
    const snap = await getDoc(doc(db, 'leads', id));
    if (!snap.exists()) return null;
    return parseLeadDoc(snap);
  },

  async update(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>) {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'leads', id), payload);
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: payload as any });
  },

  async derivar(id: string, posta: Posta, nuevoAsignadoA: string) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      asignadoA: nuevoAsignadoA,
      derivadoPor: posta.deUsuarioId,
      estado: posta.estadoNuevo,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'derivar', posta } as any });
  },

  async finalizar(id: string, posta: Posta) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      estado: posta.estadoNuevo,
      finalizadoAt: Timestamp.now(),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'finalizar' } as any });
  },

  async agregarComentario(id: string, posta: Posta) {
    await updateDoc(doc(db, 'leads', id), {
      postas: arrayUnion(deepCleanForFirestore(posta)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    logAudit({ action: 'update', collection: 'leads', documentId: id, after: { accion: 'comentario', posta } as any });
  },

  async linkPresupuesto(id: string, presupuestoId: string) {
    await updateDoc(doc(db, 'leads', id), {
      presupuestosIds: arrayUnion(presupuestoId),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async linkOT(id: string, otId: string) {
    await updateDoc(doc(db, 'leads', id), {
      otIds: arrayUnion(otId),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'leads', documentId: id });
    await deleteDoc(doc(db, 'leads', id));
  },
};

// ========== SERVICIOS FASE 1: CLIENTES Y EQUIPOS ==========

// Servicio para Clientes (id = CUIT normalizado o LEGACY-{uuid})
export const clientesService = {
  // Crear cliente. Si data.cuit existe se usa como id (normalizado); si no, id = LEGACY-{uuid}, cuit = null.
  async create(clienteData: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>) {
    console.log('📝 Creando cliente:', clienteData.razonSocial);
    const rawCuit = clienteData.cuit ?? '';
    const normalized = normalizeCuit(rawCuit);
    const id = normalized
      ? normalized
      : generateLegacyClientId();
    const payload: Record<string, unknown> = {
      ...clienteData,
      ...getCreateTrace(),
      cuit: normalized || null,
      activo: clienteData.activo !== undefined ? clienteData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    delete (payload as any).contactos;
    const docRef = doc(db, 'clientes', id);
    await setDoc(docRef, payload);
    logAudit({ action: 'create', collection: 'clientes', documentId: id, after: payload as any });
    console.log('✅ Cliente creado exitosamente con ID:', id);
    return id;
  },

  // Obtener todos los clientes (activos por defecto)
  async getAll(activosOnly: boolean = false) {
    console.log('📥 Cargando clientes desde Firestore...');
    let q;
    if (activosOnly) {
      // Filtrar por activo y ordenar en memoria (mientras se construye el índice)
      q = query(collection(db, 'clientes'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'clientes'));
    }
    const querySnapshot = await getDocs(q);
    const clientes = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const { contactos: _, ...rest } = data;
      return {
        id: docSnap.id,
        ...rest,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Cliente;
    });

    // Ordenar en memoria mientras se construye el índice
    clientes.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

    console.log(`✅ ${clientes.length} clientes cargados`);
    return clientes;
  },

  // Buscar clientes (por razón social o CUIT)
  async search(term: string) {
    console.log('🔍 Buscando clientes con término:', term);
    const allClientes = await this.getAll(false);
    const termLower = term.toLowerCase();
    return allClientes.filter(c =>
      c.razonSocial.toLowerCase().includes(termLower) ||
      (c.cuit && c.cuit.includes(term))
    );
  },

  // Obtener cliente por ID (CUIT normalizado o LEGACY-xxx). Sin contactos (están en establecimientos).
  async getById(id: string) {
    const docRef = doc(db, 'clientes', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const { contactos: __, ...rest } = data;
      return {
        id: docSnap.id,
        ...rest,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Cliente;
    }
    return null;
  },

  // Obtener cliente por CUIT (normaliza y llama getById)
  async getByCuit(cuit: string) {
    return this.getById(normalizeCuit(cuit));
  },

  // Actualizar cliente
  async update(id: string, data: Partial<Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'clientes', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'clientes', documentId: id, after: payload as any });
  },

  // Baja lógica (marcar como inactivo)
  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  // Activar cliente
  async activate(id: string) {
    await this.update(id, { activo: true });
  },
};

// Servicio para Contactos de Cliente (subcolección)
export const contactosService = {
  // Crear contacto
  async create(clienteId: string, contactoData: Omit<ContactoCliente, 'id'>) {
    console.log('📝 Creando contacto para cliente:', clienteId);
    const docRef = await addDoc(collection(db, 'clientes', clienteId, 'contactos'), {
      ...contactoData,
      esPrincipal: contactoData.esPrincipal || false,
    });
    console.log('✅ Contacto creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los contactos de un cliente
  async getByCliente(clienteId: string) {
    const querySnapshot = await getDocs(collection(db, 'clientes', clienteId, 'contactos'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ContactoCliente[];
  },

  // Actualizar contacto
  async update(clienteId: string, contactoId: string, data: Partial<Omit<ContactoCliente, 'id'>>) {
    const docRef = doc(db, 'clientes', clienteId, 'contactos', contactoId);
    await updateDoc(docRef, data);
  },

  // Eliminar contacto
  async delete(clienteId: string, contactoId: string) {
    await deleteDoc(doc(db, 'clientes', clienteId, 'contactos', contactoId));
  },
};

// Servicio para Contactos de Establecimiento (subcolección establecimientos/{id}/contactos)
export const contactosEstablecimientoService = {
  async create(establecimientoId: string, data: Omit<ContactoEstablecimiento, 'id' | 'establecimientoId'>) {
    const docRef = await addDoc(collection(db, 'establecimientos', establecimientoId, 'contactos'), cleanFirestoreData({
      ...data,
      establecimientoId,
      esPrincipal: data.esPrincipal ?? false,
    }));
    return docRef.id;
  },

  async getByEstablecimiento(establecimientoId: string): Promise<ContactoEstablecimiento[]> {
    const snapshot = await getDocs(collection(db, 'establecimientos', establecimientoId, 'contactos'));
    return snapshot.docs.map(d => ({
      id: d.id,
      establecimientoId,
      ...d.data(),
    })) as ContactoEstablecimiento[];
  },

  async update(establecimientoId: string, contactoId: string, data: Partial<Omit<ContactoEstablecimiento, 'id' | 'establecimientoId'>>) {
    const docRef = doc(db, 'establecimientos', establecimientoId, 'contactos', contactoId);
    await updateDoc(docRef, cleanFirestoreData(data));
  },

  async delete(establecimientoId: string, contactoId: string) {
    await deleteDoc(doc(db, 'establecimientos', establecimientoId, 'contactos', contactoId));
  },
};

// Servicio para Establecimientos (colección global; clienteCuit = id del cliente)
export const establecimientosService = {
  async create(clienteCuit: string, data: Omit<Establecimiento, 'id' | 'clienteCuit' | 'createdAt' | 'updatedAt'>) {
    console.log('📝 Creando establecimiento:', data.nombre, 'para cliente', clienteCuit);
    const payload = cleanFirestoreData({
      clienteCuit,
      ...data,
      ...getCreateTrace(),
      ubicaciones: data.ubicaciones || [],
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'establecimientos'), payload);
    logAudit({ action: 'create', collection: 'establecimientos', documentId: docRef.id, after: payload as any });
    console.log('✅ Establecimiento creado con ID:', docRef.id);
    return docRef.id;
  },

  async getById(id: string): Promise<Establecimiento | null> {
    const docRef = doc(db, 'establecimientos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento;
    }
    return null;
  },

  async getByCliente(clienteCuit: string): Promise<Establecimiento[]> {
    const q = query(
      collection(db, 'establecimientos'),
      where('clienteCuit', '==', clienteCuit)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento;
    });
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return list;
  },

  async getAll(): Promise<Establecimiento[]> {
    const snapshot = await getDocs(collection(db, 'establecimientos'));
    const list = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        ubicaciones: d.ubicaciones || [],
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      } as Establecimiento;
    });
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return list;
  },

  async update(id: string, data: Partial<Omit<Establecimiento, 'id' | 'clienteCuit' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'establecimientos', id);
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'establecimientos', documentId: id, after: payload as any });
  },

  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'establecimientos', documentId: id });
    await deleteDoc(doc(db, 'establecimientos', id));
  },

  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  async activate(id: string) {
    await this.update(id, { activo: true });
  },
};

// Servicio para Categorías Equipo
export const categoriasEquipoService = {
  // Crear categoría
  async create(categoriaData: Omit<CategoriaEquipo, 'id'>) {
    console.log('📝 Creando categoría:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const docRef = await addDoc(collection(db, 'categorias_equipo'), payload);
    logAudit({ action: 'create', collection: 'categorias_equipo', documentId: docRef.id, after: payload as any });
    console.log('✅ Categoría creada exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todas las categorías
  async getAll() {
    console.log('📥 Cargando categorías desde Firestore...');
    const q = query(collection(db, 'categorias_equipo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaEquipo[];

    // Normalizar modelos para categorías viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria mientras se construyen los índices
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`✅ ${categorias.length} categorías cargadas`);
    return categorias;
  },

  // Obtener categoría por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_equipo', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaEquipo;
    }
    return null;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaEquipo, 'id'>>) {
    const docRef = doc(db, 'categorias_equipo', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_equipo', documentId: id, after: payload as any });
  },

  // Eliminar categoría
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_equipo', documentId: id });
    await deleteDoc(doc(db, 'categorias_equipo', id));
  },
};

// Servicio para Categorías de Módulos
export const categoriasModuloService = {
  // Crear categoría de módulo
  async create(categoriaData: Omit<CategoriaModulo, 'id'>) {
    console.log('📝 Creando categoría de módulo:', categoriaData.nombre);
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      modelos: categoriaData.modelos || [],
    };
    const docRef = await addDoc(collection(db, 'categorias_modulo'), payload);
    logAudit({ action: 'create', collection: 'categorias_modulo', documentId: docRef.id, after: payload as any });
    console.log('✅ Categoría de módulo creada exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todas las categorías de módulos
  async getAll() {
    console.log('📥 Cargando categorías de módulos desde Firestore...');
    const q = query(collection(db, 'categorias_modulo'));
    const querySnapshot = await getDocs(q);
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CategoriaModulo[];

    // Normalizar modelos para categorías viejas
    for (const c of categorias) {
      if (!Array.isArray(c.modelos)) c.modelos = [];
    }

    // Ordenar en memoria
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    console.log(`✅ ${categorias.length} categorías de módulos cargadas`);
    return categorias;
  },

  // Obtener categoría de módulo por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_modulo', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CategoriaModulo;
    }
    return null;
  },

  // Actualizar categoría de módulo
  async update(id: string, data: Partial<Omit<CategoriaModulo, 'id'>>) {
    const docRef = doc(db, 'categorias_modulo', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      ...(data.modelos ? { modelos: data.modelos } : {}),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_modulo', documentId: id, after: payload as any });
  },

  // Eliminar categoría de módulo
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_modulo', documentId: id });
    await deleteDoc(doc(db, 'categorias_modulo', id));
  },
};

// Servicio para Sistemas (establecimientoId requerido; clienteId opcional durante migración)
export const sistemasService = {
  // Crear sistema. Requiere establecimientoId.
  async create(sistemaData: Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!sistemaData.establecimientoId) {
      throw new Error('sistemasService.create: establecimientoId es requerido');
    }
    console.log('📝 Creando sistema:', sistemaData.nombre);
    const payload = {
      ...sistemaData,
      ...getCreateTrace(),
      ubicaciones: sistemaData.ubicaciones || [],
      otIds: sistemaData.otIds || [],
      activo: sistemaData.activo !== undefined ? sistemaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'sistemas'), payload);
    logAudit({ action: 'create', collection: 'sistemas', documentId: docRef.id, after: payload as any });
    console.log('✅ Sistema creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los sistemas. Filtros: establecimientoId, clienteCuit (resuelve a establecimientos del cliente), activosOnly.
  async getAll(filters?: { establecimientoId?: string; clienteCuit?: string; clienteId?: string; activosOnly?: boolean }) {
    console.log('📥 Cargando sistemas desde Firestore...');
    let q;
    if (filters?.establecimientoId) {
      q = query(collection(db, 'sistemas'), where('establecimientoId', '==', filters.establecimientoId));
    } else if (filters?.clienteId) {
      // Migración: seguir soportando filtro por clienteId si existe en documentos
      q = query(collection(db, 'sistemas'), where('clienteId', '==', filters.clienteId));
    } else if (filters?.activosOnly) {
      q = query(collection(db, 'sistemas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'sistemas'));
    }
    const querySnapshot = await getDocs(q);
    let sistemas = querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate().toISOString(),
      updatedAt: d.data().updatedAt?.toDate().toISOString(),
    })) as Sistema[];
    // Si se filtró por clienteCuit, resolver establecimientos y filtrar en memoria
    if (filters?.clienteCuit && !filters?.establecimientoId) {
      const establecimientos = await establecimientosService.getByCliente(filters.clienteCuit);
      const ids = new Set(establecimientos.map(e => e.id));
      sistemas = sistemas.filter(s => s.establecimientoId && ids.has(s.establecimientoId));
    }
    if (filters?.activosOnly) {
      sistemas = sistemas.filter(s => s.activo === true);
    }
    sistemas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${sistemas.length} sistemas cargados`);
    return sistemas;
  },

  // Obtener sistema por ID
  async getById(id: string) {
    const docRef = doc(db, 'sistemas', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        ubicaciones: data.ubicaciones || [],
        otIds: data.otIds || [],
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Sistema;
    }
    return null;
  },

  // Actualizar sistema
  async update(id: string, data: Partial<Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'sistemas', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'sistemas', documentId: id, after: payload as any });
  },

  // Baja lógica
  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  // Genera el próximo ID visible legible (AGS-EQ-XXXX)
  async generateNextAgsVisibleId(): Promise<string> {
    const q = query(collection(db, 'sistemas'), where('agsVisibleId', '!=', null));
    const snap = await getDocs(q);
    let max = 0;
    snap.docs.forEach(d => {
      const vid: string = d.data().agsVisibleId || '';
      const match = vid.match(/^AGS-EQ-(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `AGS-EQ-${String(max + 1).padStart(4, '0')}`;
  },

  // Eliminar sistema (elimina también todos sus módulos)
  async delete(id: string) {
    console.log('🗑️ Eliminando sistema:', id);
    logAudit({ action: 'delete', collection: 'sistemas', documentId: id });

    // Primero eliminar todos los módulos del sistema
    try {
      const modulosSnapshot = await getDocs(collection(db, 'sistemas', id, 'modulos'));
      const deletePromises = modulosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(`✅ ${modulosSnapshot.docs.length} módulos eliminados`);
    } catch (error) {
      console.error('Error eliminando módulos:', error);
      // Continuar con la eliminación del sistema aunque falle la eliminación de módulos
    }

    // Luego eliminar el sistema
    await deleteDoc(doc(db, 'sistemas', id));
    console.log('✅ Sistema eliminado exitosamente');
  },
};

// Servicio para Módulos (subcolección de sistemas)
export const modulosService = {
  // Crear módulo
  async create(sistemaId: string, moduloData: Omit<ModuloSistema, 'id' | 'sistemaId'>) {
    console.log('📝 Creando módulo para sistema:', sistemaId);

    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const cleanedData = cleanData({
      ...moduloData,
      sistemaId,
      ubicaciones: moduloData.ubicaciones || [],
      otIds: moduloData.otIds || [],
    });

    const docRef = await addDoc(collection(db, 'sistemas', sistemaId, 'modulos'), cleanedData);
    console.log('✅ Módulo creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los módulos de un sistema
  async getBySistema(sistemaId: string) {
    const querySnapshot = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sistemaId,
    })) as ModuloSistema[];
  },

  // Obtener módulo por ID
  async getById(sistemaId: string, moduloId: string) {
    const docRef = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        sistemaId,
      } as ModuloSistema;
    }
    return null;
  },

  // Actualizar módulo
  async update(sistemaId: string, moduloId: string, data: Partial<Omit<ModuloSistema, 'id' | 'sistemaId'>>) {
    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    await updateDoc(docRef, cleanData(data));
  },

  // Eliminar módulo
  async delete(sistemaId: string, moduloId: string) {
    await deleteDoc(doc(db, 'sistemas', sistemaId, 'modulos', moduloId));
  },
};

// Servicio para Órdenes de Trabajo (OTs) - usa la colección 'reportes' existente
export const ordenesTrabajoService = {
  // Generar siguiente número de OT automáticamente (correlativo desde 30000)
  async getNextOtNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de OT...');
    const querySnapshot = await getDocs(collection(db, 'reportes'));

    let maxNumber = 29999; // Base: 30000 será el primero

    querySnapshot.docs.forEach(doc => {
      const otNumber = doc.id;
      // Extraer número base (antes del punto) - solo OTs principales, no items
      if (!otNumber.includes('.')) {
        const baseMatch = otNumber.match(/^(\d{5})$/);
        if (baseMatch) {
          const baseNum = parseInt(baseMatch[1]);
          if (baseNum > maxNumber) {
            maxNumber = baseNum;
          }
        }
      }
    });

    const nextNumber = maxNumber + 1;
    const nextOt = String(nextNumber).padStart(5, '0');
    console.log(`✅ Siguiente OT: ${nextOt}`);
    return nextOt;
  },

  // Generar siguiente número de item para una OT padre
  async getNextItemNumber(otPadre: string): Promise<string> {
    console.log(`🔢 Generando siguiente item para OT ${otPadre}...`);
    const q = query(collection(db, 'reportes'));
    const querySnapshot = await getDocs(q);

    let maxItem = 0;
    const prefix = otPadre + '.';

    querySnapshot.docs.forEach(doc => {
      const otNumber = doc.id;
      if (otNumber.startsWith(prefix)) {
        const itemMatch = otNumber.match(/\.(\d{2})$/);
        if (itemMatch) {
          const itemNum = parseInt(itemMatch[1]);
          if (itemNum > maxItem) {
            maxItem = itemNum;
          }
        }
      }
    });

    const nextItem = maxItem + 1;
    const nextItemNumber = `${otPadre}.${String(nextItem).padStart(2, '0')}`;
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

    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'reportes', otData.otNumber);
    const cleanedData = cleanData({
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
    // Helper para limpiar undefined (Firestore no acepta undefined)
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value === '' ? null : value;
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'reportes', otNumber);
    const cleanedData = cleanData({
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
};

// Servicio para Tipos de Servicio (lista simple)
export const tiposServicioService = {
  // Obtener todos los tipos de servicio
  async getAll() {
    console.log('📥 Cargando tipos de servicio...');
    const querySnapshot = await getDocs(collection(db, 'tipos_servicio'));
    const tipos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as TipoServicio[];

    tipos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${tipos.length} tipos de servicio cargados`);
    return tipos;
  },

  // Obtener tipo por ID
  async getById(id: string) {
    const docRef = doc(db, 'tipos_servicio', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as TipoServicio;
    }
    return null;
  },

  // Crear tipo de servicio
  async create(tipoData: Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...tipoData,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'tipos_servicio'), payload);
    logAudit({ action: 'create', collection: 'tipos_servicio', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar tipo de servicio
  async update(id: string, data: Partial<Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'tipos_servicio', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'tipos_servicio', documentId: id, after: payload as any });
  },

  // Eliminar tipo de servicio
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'tipos_servicio', documentId: id });
    await deleteDoc(doc(db, 'tipos_servicio', id));
  },
};

// Servicio para Presupuestos
export const presupuestosService = {
  // Generar siguiente número de presupuesto (PRE-0000)
  async getNextPresupuestoNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de presupuesto...');
    const q = query(collection(db, 'presupuestos'), orderBy('numero', 'desc'));
    const querySnapshot = await getDocs(q);

    let maxNum = 0;
    querySnapshot.docs.forEach(doc => {
      const numero = doc.data().numero;
      const match = numero.match(/PRE-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const nextNumber = `PRE-${String(nextNum).padStart(4, '0')}`;
    console.log(`✅ Siguiente presupuesto: ${nextNumber}`);
    return nextNumber;
  },

  // Obtener todos los presupuestos
  async getAll(filters?: { clienteId?: string; estado?: Presupuesto['estado'] }) {
    console.log('📥 Cargando presupuestos desde Firestore...');
    let q = query(collection(db, 'presupuestos'));

    // Aplicar filtros primero
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }

    // Ordenar solo si no hay filtros que requieran índice compuesto
    // Por ahora, ordenar en memoria para evitar problemas de índices
    const querySnapshot = await getDocs(q);
    const presupuestos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      validUntil: doc.data().validUntil?.toDate().toISOString(),
      fechaEnvio: doc.data().fechaEnvio?.toDate().toISOString(),
    })) as Presupuesto[];

    // Ordenar en memoria por fecha de creación (más recientes primero)
    presupuestos.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`✅ ${presupuestos.length} presupuestos cargados`);
    return presupuestos;
  },

  // Obtener presupuesto por ID
  async getById(id: string) {
    const docRef = doc(db, 'presupuestos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
        validUntil: docSnap.data().validUntil?.toDate().toISOString(),
        fechaEnvio: docSnap.data().fechaEnvio?.toDate().toISOString(),
      } as Presupuesto;
    }
    return null;
  },

  // Crear presupuesto
  async create(presupuestoData: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> & { numero?: string }) {
    console.log('📝 Creando presupuesto...');

    // Generar número si no se proporciona
    const numero = presupuestoData.numero || await this.getNextPresupuestoNumber();

    // Helper para limpiar undefined y convertir fechas
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === 'fechaEnvio' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else if (key === 'validUntil' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else {
            cleaned[key] = value === '' ? null : value;
          }
        }
      }
      return cleaned;
    };

    const payload = cleanData({
      ...presupuestoData,
      ...getCreateTrace(),
      numero,
      tipo: presupuestoData.tipo || 'servicio',
      moneda: presupuestoData.moneda || 'USD',
      items: presupuestoData.items || [],
      ordenesCompraIds: presupuestoData.ordenesCompraIds || [],
      adjuntos: presupuestoData.adjuntos || [],
      validezDias: presupuestoData.validezDias ?? 15,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'presupuestos'), payload);
    logAudit({ action: 'create', collection: 'presupuestos', documentId: docRef.id, after: payload as any });

    console.log('✅ Presupuesto creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Actualizar presupuesto
  async update(id: string, data: Partial<Presupuesto>) {
    // Helper para limpiar undefined
    const cleanData = (data: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === 'fechaEnvio' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else if (key === 'validUntil' && value) {
            cleaned[key] = Timestamp.fromDate(new Date(value as string));
          } else {
            cleaned[key] = value === '' ? null : value;
          }
        }
      }
      return cleaned;
    };

    const docRef = doc(db, 'presupuestos', id);
    const cleanedData = cleanData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
    logAudit({ action: 'update', collection: 'presupuestos', documentId: id, after: cleanedData as any });
  },

  // Eliminar presupuesto (baja lógica)
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'presupuestos', documentId: id });
    const docRef = doc(db, 'presupuestos', id);
    await updateDoc(docRef, {
      estado: 'borrador' as PresupuestoEstado,
      updatedAt: Timestamp.now(),
    });
  },
};

// Servicio para Ordenes de Compra
export const ordenesCompraService = {
  async getNextOCNumber(): Promise<string> {
    const q = query(collection(db, 'ordenes_compra'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/OC-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `OC-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; tipo?: string; proveedorId?: string }): Promise<OrdenCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.tipo) constraints.unshift(where('tipo', '==', filters.tipo));
    if (filters?.proveedorId) constraints.unshift(where('proveedorId', '==', filters.proveedorId));
    const q = query(collection(db, 'ordenes_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      fechaRecepcion: d.data().fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.data().fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.data().fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as OrdenCompra[];
  },

  async getById(id: string): Promise<OrdenCompra | null> {
    const snap = await getDoc(doc(db, 'ordenes_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      ...d,
      fechaRecepcion: d.fechaRecepcion?.toDate?.()?.toISOString() ?? null,
      fechaProforma: d.fechaProforma?.toDate?.()?.toISOString() ?? null,
      fechaEntregaEstimada: d.fechaEntregaEstimada?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as OrdenCompra;
  },

  async create(data: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & { numero?: string }): Promise<string> {
    const numero = data.numero || await this.getNextOCNumber();
    const id = crypto.randomUUID();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      items: data.items || [],
      presupuestoIds: data.presupuestoIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    await setDoc(doc(db, 'ordenes_compra', id), payload);
    logAudit({ action: 'create', collection: 'ordenes_compra', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<OrdenCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaRecepcion) payload.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    if (data.fechaProforma) payload.fechaProforma = Timestamp.fromDate(new Date(data.fechaProforma));
    if (data.fechaEntregaEstimada) payload.fechaEntregaEstimada = Timestamp.fromDate(new Date(data.fechaEntregaEstimada));
    await updateDoc(doc(db, 'ordenes_compra', id), payload);
    logAudit({ action: 'update', collection: 'ordenes_compra', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'ordenes_compra', documentId: id });
    await deleteDoc(doc(db, 'ordenes_compra', id));
  },
};

// Servicio para Categorías de Presupuesto
export const categoriasPresupuestoService = {
  // Obtener todas las categorías
  async getAll() {
    console.log('📥 Cargando categorías de presupuesto...');
    const querySnapshot = await getDocs(collection(db, 'categorias_presupuesto'));
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as CategoriaPresupuesto[];

    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${categorias.length} categorías de presupuesto cargadas`);
    return categorias;
  },

  // Obtener categoría por ID
  async getById(id: string) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as CategoriaPresupuesto;
    }
    return null;
  },

  // Crear categoría
  async create(categoriaData: Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = {
      ...categoriaData,
      ...getCreateTrace(),
      activo: categoriaData.activo !== undefined ? categoriaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'categorias_presupuesto'), payload);
    logAudit({ action: 'create', collection: 'categorias_presupuesto', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'categorias_presupuesto', documentId: id, after: payload as any });
  },

  // Eliminar categoría
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'categorias_presupuesto', documentId: id });
    await deleteDoc(doc(db, 'categorias_presupuesto', id));
  },
};

// Servicio para Condiciones de Pago
export const condicionesPagoService = {
  // Obtener todas las condiciones
  async getAll() {
    console.log('📥 Cargando condiciones de pago...');
    const querySnapshot = await getDocs(collection(db, 'condiciones_pago'));
    const condiciones = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CondicionPago[];

    condiciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
    console.log(`✅ ${condiciones.length} condiciones de pago cargadas`);
    return condiciones;
  },

  // Obtener condición por ID
  async getById(id: string) {
    const docRef = doc(db, 'condiciones_pago', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CondicionPago;
    }
    return null;
  },

  // Crear condición
  async create(condicionData: Omit<CondicionPago, 'id'>) {
    const payload = {
      ...condicionData,
      ...getCreateTrace(),
      activo: condicionData.activo !== undefined ? condicionData.activo : true,
    };
    const docRef = await addDoc(collection(db, 'condiciones_pago'), payload);
    logAudit({ action: 'create', collection: 'condiciones_pago', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  // Actualizar condición
  async update(id: string, data: Partial<Omit<CondicionPago, 'id'>>) {
    const docRef = doc(db, 'condiciones_pago', id);
    const payload = { ...data, ...getUpdateTrace() };
    await updateDoc(docRef, payload);
    logAudit({ action: 'update', collection: 'condiciones_pago', documentId: id, after: payload as any });
  },

  // Eliminar condición
  async delete(id: string) {
    logAudit({ action: 'delete', collection: 'condiciones_pago', documentId: id });
    await deleteDoc(doc(db, 'condiciones_pago', id));
  },
};

// --- Conceptos de Servicio (catálogo de precios) ---
export const conceptosServicioService = {
  async getAll(): Promise<ConceptoServicio[]> {
    const querySnapshot = await getDocs(collection(db, 'conceptos_servicio'));
    const items = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
      } as ConceptoServicio;
    });
    items.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    return items;
  },

  async getById(id: string): Promise<ConceptoServicio | null> {
    const docSnap = await getDoc(doc(db, 'conceptos_servicio', id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
    } as ConceptoServicio;
  },

  async create(data: Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cleaned = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      factorActualizacion: data.factorActualizacion || 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'conceptos_servicio'), cleaned);
    logAudit({ action: 'create', collection: 'conceptos_servicio', documentId: docRef.id, after: cleaned as any });
    return docRef.id;
  },

  async update(id: string, data: Partial<Omit<ConceptoServicio, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const cleaned = cleanFirestoreData({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    await updateDoc(doc(db, 'conceptos_servicio', id), cleaned);
    logAudit({ action: 'update', collection: 'conceptos_servicio', documentId: id, after: cleaned as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'conceptos_servicio', documentId: id });
    await deleteDoc(doc(db, 'conceptos_servicio', id));
  },
};

// --- Biblioteca de Tablas (/tableCatalog) ---
/**
 * Deep-clean para Firestore:
 * 1. Elimina valores undefined (JSON round-trip)
 * 2. Elimina keys vacíos "" de objetos — Firestore no acepta field names vacíos
 */
function deepCleanForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepCleanForFirestore);
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '') continue;              // skip empty-string keys
    if (value === undefined) continue;    // skip undefined values
    cleaned[key] = deepCleanForFirestore(value);
  }
  return cleaned;
}

function toTableCatalogEntry(id: string, data: any): TableCatalogEntry {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
  } as TableCatalogEntry;
}

export const tableCatalogService = {
  async getAll(filters?: { sysType?: string; status?: string; projectId?: string | null }): Promise<TableCatalogEntry[]> {
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    let entries = snap.docs.map(d => toTableCatalogEntry(d.id, d.data()));
    if (filters?.sysType) entries = entries.filter(e => e.sysType === filters.sysType);
    if (filters?.status) entries = entries.filter(e => e.status === filters.status);
    if (filters?.projectId !== undefined) {
      entries = filters.projectId === null
        ? entries.filter(e => !e.projectId)
        : entries.filter(e => e.projectId === filters.projectId);
    }
    return entries;
  },

  async getById(id: string): Promise<TableCatalogEntry | null> {
    const snap = await getDoc(doc(db, 'tableCatalog', id));
    if (!snap.exists()) return null;
    return toTableCatalogEntry(snap.id, snap.data());
  },

  async save(entry: TableCatalogEntry): Promise<string> {
    const { id, createdAt: _ca, updatedAt: _ua, ...rest } = entry;
    const payload = {
      ...deepCleanForFirestore(rest),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    if (id) {
      await setDoc(doc(db, 'tableCatalog', id), payload, { merge: true });
      logAudit({ action: 'update', collection: 'tableCatalog', documentId: id, after: payload as any });
      return id;
    }
    const newId = crypto.randomUUID();
    const createPayload = { ...payload, ...getCreateTrace(), createdAt: Timestamp.now() };
    await setDoc(doc(db, 'tableCatalog', newId), createPayload);
    logAudit({ action: 'create', collection: 'tableCatalog', documentId: newId, after: createPayload as any });
    return newId;
  },

  async publish(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'published', updatedAt: Timestamp.now() });
  },

  async archive(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'archived', updatedAt: Timestamp.now() });
  },

  async clone(id: string, overrides?: { name?: string; sysType?: string; projectId?: string | null }): Promise<string> {
    const original = await this.getById(id);
    if (!original) throw new Error('Tabla no encontrada');
    const newId = crypto.randomUUID();
    const { createdAt: _ca, updatedAt: _ua, ...rest } = original;
    await setDoc(doc(db, 'tableCatalog', newId), {
      ...deepCleanForFirestore(rest),
      id: newId,
      name: overrides?.name || `${original.name} (copia)`,
      ...(overrides?.sysType ? { sysType: overrides.sysType } : {}),
      ...(overrides?.projectId !== undefined ? { projectId: overrides.projectId } : {}),
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return newId;
  },

  async saveMany(entries: TableCatalogEntry[]): Promise<string[]> {
    return Promise.all(entries.map(e => this.save(e)));
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'tableCatalog', documentId: id });
    await deleteDoc(doc(db, 'tableCatalog', id));
  },

  async assignProject(tableIds: string[], projectId: string | null): Promise<void> {
    await Promise.all(tableIds.map(id =>
      updateDoc(doc(db, 'tableCatalog', id), { projectId: projectId ?? null, updatedAt: Timestamp.now() })
    ));
  },
};

// ========== PROYECTOS DE TABLAS ==========

function toTableProject(id: string, data: any): import('@ags/shared').TableProject {
  return {
    id,
    name: data.name ?? '',
    description: data.description ?? null,
    sysType: data.sysType ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    createdBy: data.createdBy ?? 'admin',
  };
}

export const tableProjectsService = {
  async getAll(): Promise<import('@ags/shared').TableProject[]> {
    const q = query(collection(db, 'tableProjects'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => toTableProject(d.id, d.data()));
  },

  async create(data: { name: string; description?: string | null; sysType?: string | null }): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'tableProjects', id), payload);
    logAudit({ action: 'create', collection: 'tableProjects', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<{ name: string; description: string | null; headerTitle: string | null; footerQF: string | null }>): Promise<void> {
    const payload = deepCleanForFirestore({ ...data, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    await updateDoc(doc(db, 'tableProjects', id), payload);
  },

  async delete(id: string): Promise<void> {
    // Desasignar tablas del proyecto antes de eliminarlo
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const tablesInProject = snap.docs.filter(d => d.data().projectId === id);
    await Promise.all(tablesInProject.map(d =>
      updateDoc(doc(db, 'tableCatalog', d.id), { projectId: null, updatedAt: Timestamp.now() })
    ));
    logAudit({ action: 'delete', collection: 'tableProjects', documentId: id });
    await deleteDoc(doc(db, 'tableProjects', id));
  },
};

// ========== INSTRUMENTOS Y CERTIFICADOS ==========

function toInstrumento(id: string, data: any): InstrumentoPatron {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
  } as InstrumentoPatron;
}

export const instrumentosService = {
  async getAll(filters?: {
    tipo?: 'instrumento' | 'patron';
    categoria?: CategoriaInstrumento;
    activoOnly?: boolean;
  }): Promise<InstrumentoPatron[]> {
    let q = query(collection(db, 'instrumentos'));
    if (filters?.activoOnly) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => toInstrumento(d.id, d.data()));
    if (filters?.categoria) {
      items = items.filter(i => i.categorias.includes(filters.categoria!));
    }
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<InstrumentoPatron | null> {
    const snap = await getDoc(doc(db, 'instrumentos', id));
    if (!snap.exists()) return null;
    return toInstrumento(snap.id, snap.data());
  },

  async create(data: Omit<InstrumentoPatron, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'instrumentos', id), payload);
    logAudit({ action: 'create', collection: 'instrumentos', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<InstrumentoPatron, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'instrumentos', id), payload);
    logAudit({ action: 'update', collection: 'instrumentos', documentId: id, after: payload as any });
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async activate(id: string): Promise<void> {
    await this.update(id, { activo: true });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'instrumentos', documentId: id });
    // Intentar borrar archivos de Storage antes de eliminar el documento
    const instrumento = await this.getById(id);
    if (instrumento?.certificadoStoragePath) {
      try { await deleteObject(storageRef(storage, instrumento.certificadoStoragePath)); } catch { /* ignore */ }
    }
    if (instrumento?.trazabilidadStoragePath) {
      try { await deleteObject(storageRef(storage, instrumento.trazabilidadStoragePath)); } catch { /* ignore */ }
    }
    await deleteDoc(doc(db, 'instrumentos', id));
  },

  async reemplazar(idViejo: string, idNuevo: string): Promise<void> {
    await this.update(idViejo, { reemplazadoPor: idNuevo, activo: false });
    await this.update(idNuevo, { reemplazaA: idViejo });
  },

  // ── Storage: certificados y trazabilidad ──

  async uploadCertificado(instrumentoId: string, file: File): Promise<{ url: string; path: string }> {
    const path = `certificados/${instrumentoId}/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);
    await this.update(instrumentoId, {
      certificadoUrl: url,
      certificadoNombre: file.name,
      certificadoStoragePath: path,
    });
    return { url, path };
  },

  async uploadTrazabilidad(instrumentoId: string, file: File): Promise<{ url: string; path: string }> {
    const path = `certificados/${instrumentoId}/trazabilidad/${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(fileRef);
    await this.update(instrumentoId, {
      trazabilidadUrl: url,
      trazabilidadNombre: file.name,
      trazabilidadStoragePath: path,
    });
    return { url, path };
  },

  async deleteStorageFile(storagePath: string): Promise<void> {
    await deleteObject(storageRef(storage, storagePath));
  },
};

// ========== MARCAS (catálogo compartido) ==========

export const marcasService = {
  async getAll(activoOnly: boolean = true): Promise<Marca[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'marcas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'marcas'));
    }
    const snap = await getDocs(q);
    const marcas = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Marca[];
    marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return marcas;
  },

  async create(nombre: string): Promise<string> {
    const payload = {
      nombre: nombre.trim(),
      ...getCreateTrace(),
      activo: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'marcas'), payload);
    logAudit({ action: 'create', collection: 'marcas', documentId: docRef.id, after: payload as any });
    return docRef.id;
  },

  async update(id: string, data: Partial<Omit<Marca, 'id' | 'createdAt'>>): Promise<void> {
    const payload = {
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'marcas', id), payload);
    logAudit({ action: 'update', collection: 'marcas', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'marcas', documentId: id });
    await deleteDoc(doc(db, 'marcas', id));
  },
};

// ========== INGENIEROS ==========

export const ingenierosService = {
  async getAll(activoOnly: boolean = true): Promise<Ingeniero[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'ingenieros'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'ingenieros'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Ingeniero[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<Ingeniero | null> {
    const snap = await getDoc(doc(db, 'ingenieros', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Ingeniero;
  },

  async create(data: Omit<Ingeniero, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'ingenieros', id), payload);
    logAudit({ action: 'create', collection: 'ingenieros', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Ingeniero, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'ingenieros', id), payload);
    logAudit({ action: 'update', collection: 'ingenieros', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'ingenieros', documentId: id });
    await deleteDoc(doc(db, 'ingenieros', id));
  },
};

// ========== PROVEEDORES ==========

export const proveedoresService = {
  async getAll(activoOnly: boolean = true): Promise<Proveedor[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'proveedores'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'proveedores'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Proveedor[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getById(id: string): Promise<Proveedor | null> {
    const snap = await getDoc(doc(db, 'proveedores', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Proveedor;
  },

  async create(data: Omit<Proveedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'proveedores', id), payload);
    logAudit({ action: 'create', collection: 'proveedores', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Proveedor, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'proveedores', id), payload);
    logAudit({ action: 'update', collection: 'proveedores', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'proveedores', documentId: id });
    await deleteDoc(doc(db, 'proveedores', id));
  },

  async getInternacionales(): Promise<Proveedor[]> {
    const q = query(collection(db, 'proveedores'), where('activo', '==', true), where('tipo', '==', 'internacional'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as Proveedor[];
  },
};

// ========== POSICIONES DE STOCK ==========

export const posicionesStockService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionStock[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posicionesStock'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posicionesStock'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as PosicionStock[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<PosicionStock | null> {
    const snap = await getDoc(doc(db, 'posicionesStock', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as PosicionStock;
  },

  async create(data: Omit<PosicionStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'posicionesStock', id), payload);
    logAudit({ action: 'create', collection: 'posiciones_stock', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'posicionesStock', id), payload);
    logAudit({ action: 'update', collection: 'posiciones_stock', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'posiciones_stock', documentId: id });
    await deleteDoc(doc(db, 'posicionesStock', id));
  },
};

// ========== ARTICULOS (catálogo de partes) ==========

export const articulosService = {
  async getAll(filters?: {
    categoriaEquipo?: string;
    marcaId?: string;
    tipo?: string;
    activoOnly?: boolean;
  }): Promise<Articulo[]> {
    let q = query(collection(db, 'articulos'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.categoriaEquipo) {
      q = query(q, where('categoriaEquipo', '==', filters.categoriaEquipo));
    }
    if (filters?.marcaId) {
      q = query(q, where('marcaId', '==', filters.marcaId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Articulo[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<Articulo | null> {
    const snap = await getDoc(doc(db, 'articulos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  async getByCodigo(codigo: string): Promise<Articulo | null> {
    const q = query(collection(db, 'articulos'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Articulo;
  },

  async create(data: Omit<Articulo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'articulos', id), payload);
    logAudit({ action: 'create', collection: 'articulos', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Articulo, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'articulos', id), payload);
    logAudit({ action: 'update', collection: 'articulos', documentId: id, after: payload as any });
  },

  async deactivate(id: string): Promise<void> {
    await this.update(id, { activo: false });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'articulos', documentId: id });
    await deleteDoc(doc(db, 'articulos', id));
  },
};

// ========== UNIDADES DE STOCK ==========

export const unidadesService = {
  async getAll(filters?: {
    articuloId?: string;
    estado?: string;
    condicion?: string;
    activoOnly?: boolean;
  }): Promise<UnidadStock[]> {
    let q = query(collection(db, 'unidades'));
    if (filters?.activoOnly !== false) {
      q = query(q, where('activo', '==', true));
    }
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.condicion) {
      q = query(q, where('condicion', '==', filters.condicion));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as UnidadStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getByArticulo(articuloId: string): Promise<UnidadStock[]> {
    return this.getAll({ articuloId, activoOnly: true });
  },

  async getById(id: string): Promise<UnidadStock | null> {
    const snap = await getDoc(doc(db, 'unidades', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as UnidadStock;
  },

  async create(data: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'unidades', id), payload);
    logAudit({ action: 'create', collection: 'unidades_stock', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<UnidadStock, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'unidades', id), payload);
    logAudit({ action: 'update', collection: 'unidades_stock', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'unidades_stock', documentId: id });
    await deleteDoc(doc(db, 'unidades', id));
  },
};

// ========== MINIKITS ==========

export const minikitsService = {
  async getAll(activoOnly: boolean = true): Promise<Minikit[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'minikits'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'minikits'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as Minikit[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<Minikit | null> {
    const snap = await getDoc(doc(db, 'minikits', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as Minikit;
  },

  async create(data: Omit<Minikit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'minikits', id), payload);
    logAudit({ action: 'create', collection: 'minikits', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Minikit, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'minikits', id), payload);
    logAudit({ action: 'update', collection: 'minikits', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'minikits', documentId: id });
    await deleteDoc(doc(db, 'minikits', id));
  },
};

// ========== MOVIMIENTOS DE STOCK (log inmutable) ==========

export const movimientosService = {
  async getAll(filters?: {
    articuloId?: string;
    unidadId?: string;
    tipo?: string;
    remitoId?: string;
    otNumber?: string;
    limitCount?: number;
  }): Promise<MovimientoStock[]> {
    let q = query(collection(db, 'movimientosStock'));
    if (filters?.articuloId) {
      q = query(q, where('articuloId', '==', filters.articuloId));
    }
    if (filters?.unidadId) {
      q = query(q, where('unidadId', '==', filters.unidadId));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    if (filters?.remitoId) {
      q = query(q, where('remitoId', '==', filters.remitoId));
    }
    if (filters?.otNumber) {
      q = query(q, where('otNumber', '==', filters.otNumber));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as MovimientoStock[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    if (filters?.limitCount && filters.limitCount > 0) {
      items = items.slice(0, filters.limitCount);
    }
    return items;
  },

  async getByUnidad(unidadId: string): Promise<MovimientoStock[]> {
    return this.getAll({ unidadId });
  },

  async create(data: Omit<MovimientoStock, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'movimientosStock', id), payload);
    logAudit({ action: 'create', collection: 'movimientos_stock', documentId: id, after: payload as any });
    return id;
  },
};

// ========== REMITOS ==========

export const remitosService = {
  async getNextRemitoNumber(): Promise<string> {
    const q = query(collection(db, 'remitos'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);

    let maxNum = 0;
    snap.docs.forEach(d => {
      const numero = d.data().numero;
      const match = numero?.match(/REM-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `REM-${String(nextNum).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    ingenieroId?: string;
    estado?: string;
    tipo?: string;
  }): Promise<Remito[]> {
    let q = query(collection(db, 'remitos'));
    if (filters?.ingenieroId) {
      q = query(q, where('ingenieroId', '==', filters.ingenieroId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    if (filters?.tipo) {
      q = query(q, where('tipo', '==', filters.tipo));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: d.data().fechaSalida?.toDate?.().toISOString() ?? d.data().fechaSalida ?? null,
      fechaDevolucion: d.data().fechaDevolucion?.toDate?.().toISOString() ?? d.data().fechaDevolucion ?? null,
    })) as Remito[];
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  },

  async getById(id: string): Promise<Remito | null> {
    const snap = await getDoc(doc(db, 'remitos', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      fechaSalida: snap.data().fechaSalida?.toDate?.().toISOString() ?? snap.data().fechaSalida ?? null,
      fechaDevolucion: snap.data().fechaDevolucion?.toDate?.().toISOString() ?? snap.data().fechaDevolucion ?? null,
    } as Remito;
  },

  async create(data: Omit<Remito, 'id' | 'numero' | 'createdAt' | 'updatedAt'> & { numero?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const numero = data.numero || await this.getNextRemitoNumber();
    const { numero: _num, ...rest } = data;
    const payload = deepCleanForFirestore({
      ...rest,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'remitos', id), payload);
    logAudit({ action: 'create', collection: 'remitos', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<Remito, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'remitos', id), payload);
    logAudit({ action: 'update', collection: 'remitos', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'remitos', documentId: id });
    await deleteDoc(doc(db, 'remitos', id));
  },
};

// --- Fichas Propiedad del Cliente ---

export const fichasService = {
  async getNextFichaNumber(): Promise<string> {
    const q = query(collection(db, 'fichasPropiedad'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const numero = d.data().numero;
      const match = numero?.match(/FPC-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return `FPC-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: {
    clienteId?: string;
    estado?: string;
    activasOnly?: boolean;
  }): Promise<FichaPropiedad[]> {
    let q = query(collection(db, 'fichasPropiedad'));
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.estado) {
      q = query(q, where('estado', '==', filters.estado));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as FichaPropiedad[];
    if (filters?.activasOnly) {
      items = items.filter(f => f.estado !== 'entregado');
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  },

  async getById(id: string): Promise<FichaPropiedad | null> {
    const snap = await getDoc(doc(db, 'fichasPropiedad', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    } as FichaPropiedad;
  },

  async create(data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextFichaNumber();
    const payload = deepCleanForFirestore({
      ...data,
      ...getCreateTrace(),
      numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'fichasPropiedad', id), payload);
    logAudit({ action: 'create', collection: 'fichas_propiedad', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<FichaPropiedad, 'id' | 'createdAt'>>): Promise<void> {
    const payload = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'fichasPropiedad', id), payload);
    logAudit({ action: 'update', collection: 'fichas_propiedad', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'fichas_propiedad', documentId: id });
    await deleteDoc(doc(db, 'fichasPropiedad', id));
  },

  async addHistorial(id: string, entry: Omit<HistorialFicha, 'id'>): Promise<void> {
    const ficha = await this.getById(id);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newEntry: HistorialFicha = { ...entry, id: crypto.randomUUID() };
    await this.update(id, {
      estado: entry.estadoNuevo,
      historial: [...ficha.historial, newEntry],
    });
  },

  async addDerivacion(id: string, derivacion: Omit<DerivacionProveedor, 'id'>): Promise<void> {
    const ficha = await this.getById(id);
    if (!ficha) throw new Error('Ficha no encontrada');
    const newDeriv: DerivacionProveedor = { ...derivacion, id: crypto.randomUUID() };
    await this.update(id, {
      estado: 'derivado_proveedor',
      derivaciones: [...ficha.derivaciones, newDeriv],
    });
  },

  async getByOtNumber(otNumber: string): Promise<FichaPropiedad[]> {
    const q = query(
      collection(db, 'fichasPropiedad'),
      where('otIds', 'array-contains', otNumber)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    })) as FichaPropiedad[];
  },
};

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

// ========== POSICIONES ARANCELARIAS ==========

export const posicionesArancelariasService = {
  async getAll(activoOnly: boolean = true): Promise<PosicionArancelaria[]> {
    let q;
    if (activoOnly) {
      q = query(collection(db, 'posiciones_arancelarias'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'posiciones_arancelarias'));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as PosicionArancelaria[];
    items.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return items;
  },

  async getById(id: string): Promise<PosicionArancelaria | null> {
    const snap = await getDoc(doc(db, 'posiciones_arancelarias', id));
    if (!snap.exists()) return null;
    return {
      id: snap.id, ...snap.data(),
      createdAt: snap.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: snap.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },

  async create(data: Omit<PosicionArancelaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'posiciones_arancelarias', id), payload);
    logAudit({ action: 'create', collection: 'posiciones_arancelarias', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Omit<PosicionArancelaria, 'id' | 'createdAt'>>): Promise<void> {
    const payload = cleanFirestoreData({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, 'posiciones_arancelarias', id), payload);
    logAudit({ action: 'update', collection: 'posiciones_arancelarias', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'posiciones_arancelarias', documentId: id });
    await deleteDoc(doc(db, 'posiciones_arancelarias', id));
  },

  async getByCodigo(codigo: string): Promise<PosicionArancelaria | null> {
    const q = query(collection(db, 'posiciones_arancelarias'), where('codigo', '==', codigo));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as PosicionArancelaria;
  },
};

// ========== REQUERIMIENTOS DE COMPRA ==========

export const requerimientosService = {
  async getNextNumber(): Promise<string> {
    const q = query(collection(db, 'requerimientos_compra'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/REQ-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `REQ-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string; origen?: string }): Promise<RequerimientoCompra[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.origen) constraints.unshift(where('origen', '==', filters.origen));
    const q = query(collection(db, 'requerimientos_compra'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      fechaSolicitud: d.data().fechaSolicitud?.toDate?.()?.toISOString() ?? d.data().fechaSolicitud,
      fechaAprobacion: d.data().fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as RequerimientoCompra[];
  },

  async getById(id: string): Promise<RequerimientoCompra | null> {
    const snap = await getDoc(doc(db, 'requerimientos_compra', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id, ...d,
      fechaSolicitud: d.fechaSolicitud?.toDate?.()?.toISOString() ?? d.fechaSolicitud,
      fechaAprobacion: d.fechaAprobacion?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as RequerimientoCompra;
  },

  async create(data: Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      fechaSolicitud: Timestamp.fromDate(new Date(data.fechaSolicitud)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    await setDoc(doc(db, 'requerimientos_compra', id), payload);
    logAudit({ action: 'create', collection: 'requerimientos_compra', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<RequerimientoCompra>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    if (data.fechaAprobacion) payload.fechaAprobacion = Timestamp.fromDate(new Date(data.fechaAprobacion));
    await updateDoc(doc(db, 'requerimientos_compra', id), payload);
    logAudit({ action: 'update', collection: 'requerimientos_compra', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'requerimientos_compra', documentId: id });
    await deleteDoc(doc(db, 'requerimientos_compra', id));
  },
};

// ========== IMPORTACIONES ==========

export const importacionesService = {
  async getNextNumber(): Promise<string> {
    const q = query(collection(db, 'importaciones'), orderBy('numero', 'desc'));
    const snap = await getDocs(q);
    let maxNum = 0;
    snap.docs.forEach(d => {
      const match = d.data().numero?.match(/IMP-(\d+)/);
      if (match) { const n = parseInt(match[1]); if (n > maxNum) maxNum = n; }
    });
    return `IMP-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async getAll(filters?: { estado?: string }): Promise<Importacion[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    const q = query(collection(db, 'importaciones'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
        fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
        fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
        fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
        vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    }) as Importacion[];
  },

  async getById(id: string): Promise<Importacion | null> {
    const snap = await getDoc(doc(db, 'importaciones', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id, ...data,
      fechaEmbarque: data.fechaEmbarque?.toDate?.()?.toISOString() ?? null,
      fechaEstimadaArribo: data.fechaEstimadaArribo?.toDate?.()?.toISOString() ?? null,
      fechaArriboReal: data.fechaArriboReal?.toDate?.()?.toISOString() ?? null,
      fechaDespacho: data.fechaDespacho?.toDate?.()?.toISOString() ?? null,
      vepFechaPago: data.vepFechaPago?.toDate?.()?.toISOString() ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    } as Importacion;
  },

  async create(data: Omit<Importacion, 'id' | 'numero' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const numero = await this.getNextNumber();
    const payload: any = {
      ...cleanFirestoreData(data as any),
      ...getCreateTrace(),
      numero,
      gastos: data.gastos || [],
      documentos: data.documentos || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago'] as const;
    for (const f of dateFields) {
      if (data[f]) payload[f] = Timestamp.fromDate(new Date(data[f]!));
    }
    await setDoc(doc(db, 'importaciones', id), payload);
    logAudit({ action: 'create', collection: 'importaciones', documentId: id, after: payload as any });
    return id;
  },

  async update(id: string, data: Partial<Importacion>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    const dateFields = ['fechaEmbarque', 'fechaEstimadaArribo', 'fechaArriboReal', 'fechaDespacho', 'vepFechaPago'] as const;
    for (const f of dateFields) {
      if ((data as any)[f]) payload[f] = Timestamp.fromDate(new Date((data as any)[f]));
    }
    await updateDoc(doc(db, 'importaciones', id), payload);
    logAudit({ action: 'update', collection: 'importaciones', documentId: id, after: payload as any });
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'importaciones', documentId: id });
    await deleteDoc(doc(db, 'importaciones', id));
  },
};

// =============================================
// --- Usuarios (Auth & RBAC) ---
// =============================================

export const usuariosService = {
  async upsertOnLogin(user: { uid: string; email: string; displayName: string; photoURL: string | null }): Promise<UsuarioAGS> {
    const docRef = doc(db, 'usuarios', user.uid);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, { lastLoginAt: Timestamp.now() });
      const d = existing.data();
      return {
        id: existing.id,
        email: d.email,
        displayName: d.displayName,
        photoURL: d.photoURL ?? null,
        role: d.role ?? null,
        status: d.status,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      } as UsuarioAGS;
    }
    const newUser = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      role: null,
      status: 'pendiente' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
    await setDoc(docRef, newUser);
    const now = new Date().toISOString();
    return { id: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL ?? null, role: null, status: 'pendiente', createdAt: now, updatedAt: now, lastLoginAt: now };
  },

  async getById(uid: string): Promise<UsuarioAGS | null> {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id, email: d.email, displayName: d.displayName, photoURL: d.photoURL ?? null,
      role: d.role ?? null, status: d.status,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? '', updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? '',
      lastLoginAt: d.lastLoginAt?.toDate?.()?.toISOString() ?? '',
    } as UsuarioAGS;
  },

  async getAll(): Promise<UsuarioAGS[]> {
    const q = query(collection(db, 'usuarios'), orderBy('displayName', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      role: d.data().role ?? null, photoURL: d.data().photoURL ?? null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? '',
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? '',
      lastLoginAt: d.data().lastLoginAt?.toDate?.()?.toISOString() ?? '',
    })) as UsuarioAGS[];
  },

  async updateRole(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { role, updatedAt: Timestamp.now() });
  },

  async updateStatus(uid: string, status: UserStatus): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status, updatedAt: Timestamp.now() });
  },

  async approveUser(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'usuarios', uid), { status: 'activo', role, updatedAt: Timestamp.now() });
  },
};

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
    const beforeSnap = await getDoc(docRef);
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
      before: beforeSnap.exists() ? (beforeSnap.data() as Record<string, unknown>) : null,
      after: payload as Record<string, unknown>,
    });
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, 'agendaEntries', id);
    const beforeSnap = await getDoc(docRef);
    logAudit({
      action: 'delete', collection: 'agendaEntries', documentId: id,
      before: beforeSnap.exists() ? (beforeSnap.data() as Record<string, unknown>) : null,
    });
    await deleteDoc(docRef);
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

// ── Postas Service ──

function parsePostaDoc(d: import('firebase/firestore').DocumentSnapshot): PostaWorkflow {
  const data = d.data()!;
  return {
    id: d.id,
    tipoEntidad: data.tipoEntidad,
    entidadId: data.entidadId,
    entidadNumero: data.entidadNumero,
    entidadDescripcion: data.entidadDescripcion,
    categoria: data.categoria,
    responsableId: data.responsableId,
    responsableNombre: data.responsableNombre,
    creadoPorId: data.creadoPorId,
    creadoPorNombre: data.creadoPorNombre,
    estado: data.estado,
    prioridad: data.prioridad,
    accionRequerida: data.accionRequerida,
    historial: data.historial ?? [],
    comentario: data.comentario ?? null,
    fechaCreacion: data.fechaCreacion,
    fechaVencimiento: data.fechaVencimiento ?? null,
    fechaCompletada: data.fechaCompletada ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
  } as PostaWorkflow;
}

export const postasService = {
  async getAll(filters?: { estado?: string; categoria?: string; tipoEntidad?: string; responsableId?: string }): Promise<PostaWorkflow[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (filters?.estado) constraints.unshift(where('estado', '==', filters.estado));
    if (filters?.categoria) constraints.unshift(where('categoria', '==', filters.categoria));
    if (filters?.tipoEntidad) constraints.unshift(where('tipoEntidad', '==', filters.tipoEntidad));
    if (filters?.responsableId) constraints.unshift(where('responsableId', '==', filters.responsableId));
    const q = query(collection(db, 'postas'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => parsePostaDoc(d));
  },

  async getById(id: string): Promise<PostaWorkflow | null> {
    const snap = await getDoc(doc(db, 'postas', id));
    if (!snap.exists()) return null;
    return parsePostaDoc(snap);
  },

  async create(data: Omit<PostaWorkflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = deepCleanForFirestore({
      ...data,
      historial: data.historial || [],
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = await addDoc(collection(db, 'postas'), payload);
    logAudit({ action: 'create', collection: 'postas', documentId: ref.id, after: payload as any });
    return ref.id;
  },

  async update(id: string, data: Partial<PostaWorkflow>): Promise<void> {
    const payload: any = { ...cleanFirestoreData(data as any), ...getUpdateTrace(), updatedAt: Timestamp.now() };
    await updateDoc(doc(db, 'postas', id), payload);
    logAudit({ action: 'update', collection: 'postas', documentId: id, after: payload as any });
  },

  async addHandoff(id: string, handoff: PostaHandoff): Promise<void> {
    await updateDoc(doc(db, 'postas', id), {
      historial: arrayUnion(deepCleanForFirestore(handoff)),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async complete(id: string, comentario?: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'postas', id), {
      estado: 'completada',
      fechaCompletada: now,
      ...(comentario ? { comentario } : {}),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async cancel(id: string, comentario?: string): Promise<void> {
    await updateDoc(doc(db, 'postas', id), {
      estado: 'cancelada',
      ...(comentario ? { comentario } : {}),
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });
  },

  async getByEntidad(tipoEntidad: string, entidadId: string): Promise<PostaWorkflow[]> {
    const q = query(collection(db, 'postas'), where('tipoEntidad', '==', tipoEntidad), where('entidadId', '==', entidadId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => parsePostaDoc(d));
  },

  async delete(id: string): Promise<void> {
    logAudit({ action: 'delete', collection: 'postas', documentId: id });
    await deleteDoc(doc(db, 'postas', id));
  },
};
