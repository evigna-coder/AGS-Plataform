import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { Cliente, ContactoCliente, ContactoEstablecimiento, CategoriaEquipo, CategoriaModulo, Sistema, ModuloSistema, Establecimiento, WorkOrder, TipoServicio, Presupuesto, PresupuestoItem, PresupuestoEstado, OrdenCompra, CategoriaPresupuesto, CondicionPago, TableCatalogEntry } from '@ags/shared';

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

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('%c✅ Firebase inicializado correctamente', 'color: green; font-weight: bold');
  console.log('%c🔥 Sistema Modular conectado a Firestore', 'color: orange; font-weight: bold');
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
  // No lanzar error para permitir que la app funcione sin Firebase (modo desarrollo)
}

export { db };

// Servicio para Leads
export const leadsService = {
  // Crear lead
  async create(leadData: {
    razonSocial: string;
    contacto: string;
    email: string;
    telefono: string;
    estado?: 'nuevo' | 'contactado' | 'presupuestado' | 'convertido' | 'perdido';
  }) {
    console.log('📝 Creando lead:', leadData.razonSocial);
    const docRef = await addDoc(collection(db, 'leads'), {
      ...leadData,
      estado: leadData.estado || 'nuevo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Lead creado exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Obtener todos los leads
  async getAll() {
    console.log('📥 Cargando leads desde Firestore...');
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const leads = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    }));
    console.log(`✅ ${leads.length} leads cargados`);
    return leads;
  },

  // Obtener lead por ID
  async getById(id: string) {
    const docRef = doc(db, 'leads', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      };
    }
    return null;
  },

  // Actualizar lead
  async update(id: string, data: Partial<{
    razonSocial: string;
    contacto: string;
    email: string;
    telefono: string;
    estado: 'nuevo' | 'contactado' | 'presupuestado' | 'convertido' | 'perdido';
  }>) {
    const docRef = doc(db, 'leads', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  // Eliminar lead
  async delete(id: string) {
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
      cuit: normalized || null,
      activo: clienteData.activo !== undefined ? clienteData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    delete (payload as any).contactos;
    const docRef = doc(db, 'clientes', id);
    await setDoc(docRef, payload);
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
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
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
      ubicaciones: data.ubicaciones || [],
      activo: data.activo !== undefined ? data.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const docRef = await addDoc(collection(db, 'establecimientos'), payload);
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
    await updateDoc(docRef, cleanFirestoreData({
      ...data,
      updatedAt: Timestamp.now(),
    }));
  },

  async delete(id: string) {
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
    const docRef = await addDoc(collection(db, 'categorias_equipo'), {
      ...categoriaData,
      modelos: categoriaData.modelos || [],
    });
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
    await updateDoc(docRef, {
      ...data,
      ...(data.modelos ? { modelos: data.modelos } : {}),
    });
  },

  // Eliminar categoría
  async delete(id: string) {
    await deleteDoc(doc(db, 'categorias_equipo', id));
  },
};

// Servicio para Categorías de Módulos
export const categoriasModuloService = {
  // Crear categoría de módulo
  async create(categoriaData: Omit<CategoriaModulo, 'id'>) {
    console.log('📝 Creando categoría de módulo:', categoriaData.nombre);
    const docRef = await addDoc(collection(db, 'categorias_modulo'), {
      ...categoriaData,
      modelos: categoriaData.modelos || [],
    });
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
    await updateDoc(docRef, {
      ...data,
      ...(data.modelos ? { modelos: data.modelos } : {}),
    });
  },

  // Eliminar categoría de módulo
  async delete(id: string) {
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
    const docRef = await addDoc(collection(db, 'sistemas'), {
      ...sistemaData,
      ubicaciones: sistemaData.ubicaciones || [],
      otIds: sistemaData.otIds || [],
      activo: sistemaData.activo !== undefined ? sistemaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
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
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  // Baja lógica
  async deactivate(id: string) {
    await this.update(id, { activo: false });
  },

  // Eliminar sistema (elimina también todos sus módulos)
  async delete(id: string) {
    console.log('🗑️ Eliminando sistema:', id);

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
      status: otData.status || 'BORRADOR',
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    await setDoc(docRef, cleanedData);
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
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
  },

  // Eliminar OT (baja lógica - cambiar status a inactivo o eliminar físicamente)
  async delete(otNumber: string) {
    // Por seguridad, no eliminamos físicamente, solo marcamos como inactivo
    // Si realmente se necesita eliminar, descomentar la línea siguiente
    // await deleteDoc(doc(db, 'reportes', otNumber));

    // Por ahora, solo actualizamos el status
    const docRef = doc(db, 'reportes', otNumber);
    await updateDoc(docRef, {
      status: 'BORRADOR', // O crear un campo 'activo: false'
      updatedAt: Timestamp.now(),
    });
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
    const docRef = await addDoc(collection(db, 'tipos_servicio'), {
      ...tipoData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Actualizar tipo de servicio
  async update(id: string, data: Partial<Omit<TipoServicio, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'tipos_servicio', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  // Eliminar tipo de servicio
  async delete(id: string) {
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

    const docRef = await addDoc(collection(db, 'presupuestos'), cleanData({
      ...presupuestoData,
      numero,
      items: presupuestoData.items || [],
      ordenesCompraIds: presupuestoData.ordenesCompraIds || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

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
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
  },

  // Eliminar presupuesto (baja lógica)
  async delete(id: string) {
    const docRef = doc(db, 'presupuestos', id);
    await updateDoc(docRef, {
      estado: 'borrador' as PresupuestoEstado,
      updatedAt: Timestamp.now(),
    });
  },
};

// Servicio para Ordenes de Compra
export const ordenesCompraService = {
  // Generar siguiente número de OC (OC-0000)
  async getNextOCNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de OC...');
    const q = query(collection(db, 'ordenes_compra'), orderBy('numero', 'desc'));
    const querySnapshot = await getDocs(q);

    let maxNum = 0;
    querySnapshot.docs.forEach(doc => {
      const numero = doc.data().numero;
      const match = numero.match(/OC-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const nextNumber = `OC-${String(nextNum).padStart(4, '0')}`;
    console.log(`✅ Siguiente OC: ${nextNumber}`);
    return nextNumber;
  },

  // Obtener todas las OCs
  async getAll() {
    console.log('📥 Cargando órdenes de compra desde Firestore...');
    const q = query(collection(db, 'ordenes_compra'), orderBy('fechaRecepcion', 'desc'));
    const querySnapshot = await getDocs(q);
    const ordenes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fechaRecepcion: doc.data().fechaRecepcion?.toDate().toISOString(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as OrdenCompra[];

    console.log(`✅ ${ordenes.length} órdenes de compra cargadas`);
    return ordenes;
  },

  // Obtener OC por ID
  async getById(id: string) {
    const docRef = doc(db, 'ordenes_compra', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        fechaRecepcion: docSnap.data().fechaRecepcion?.toDate().toISOString(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString(),
        updatedAt: docSnap.data().updatedAt?.toDate().toISOString(),
      } as OrdenCompra;
    }
    return null;
  },

  // Crear OC
  async create(ocData: Omit<OrdenCompra, 'id' | 'createdAt' | 'updatedAt'> & { numero?: string }) {
    console.log('📝 Creando orden de compra...');

    const numero = ocData.numero || await this.getNextOCNumber();

    const docRef = await addDoc(collection(db, 'ordenes_compra'), {
      ...ocData,
      numero,
      presupuestoIds: ocData.presupuestoIds || [],
      fechaRecepcion: ocData.fechaRecepcion ? Timestamp.fromDate(new Date(ocData.fechaRecepcion)) : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log('✅ Orden de compra creada exitosamente con ID:', docRef.id);
    return docRef.id;
  },

  // Actualizar OC
  async update(id: string, data: Partial<OrdenCompra>) {
    const docRef = doc(db, 'ordenes_compra', id);
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    if (data.fechaRecepcion) {
      updateData.fechaRecepcion = Timestamp.fromDate(new Date(data.fechaRecepcion));
    }

    await updateDoc(docRef, updateData);
  },

  // Eliminar OC
  async delete(id: string) {
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
    const docRef = await addDoc(collection(db, 'categorias_presupuesto'), {
      ...categoriaData,
      activo: categoriaData.activo !== undefined ? categoriaData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Actualizar categoría
  async update(id: string, data: Partial<Omit<CategoriaPresupuesto, 'id' | 'createdAt' | 'updatedAt'>>) {
    const docRef = doc(db, 'categorias_presupuesto', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  // Eliminar categoría
  async delete(id: string) {
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
    const docRef = await addDoc(collection(db, 'condiciones_pago'), {
      ...condicionData,
      activo: condicionData.activo !== undefined ? condicionData.activo : true,
    });
    return docRef.id;
  },

  // Actualizar condición
  async update(id: string, data: Partial<Omit<CondicionPago, 'id'>>) {
    const docRef = doc(db, 'condiciones_pago', id);
    await updateDoc(docRef, data);
  },

  // Eliminar condición
  async delete(id: string) {
    await deleteDoc(doc(db, 'condiciones_pago', id));
  },
};

// --- Biblioteca de Tablas (/tableCatalog) ---
/** Deep-clean: elimina undefined en objetos anidados usando JSON round-trip */
function deepCleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
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
  async getAll(filters?: { sysType?: string; status?: string }): Promise<TableCatalogEntry[]> {
    const q = query(collection(db, 'tableCatalog'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    let entries = snap.docs.map(d => toTableCatalogEntry(d.id, d.data()));
    if (filters?.sysType) entries = entries.filter(e => e.sysType === filters.sysType);
    if (filters?.status) entries = entries.filter(e => e.status === filters.status);
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
      updatedAt: Timestamp.now(),
    };
    if (id) {
      await setDoc(doc(db, 'tableCatalog', id), payload, { merge: true });
      return id;
    }
    const newId = crypto.randomUUID();
    await setDoc(doc(db, 'tableCatalog', newId), { ...payload, createdAt: Timestamp.now() });
    return newId;
  },

  async publish(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'published', updatedAt: Timestamp.now() });
  },

  async archive(id: string): Promise<void> {
    await updateDoc(doc(db, 'tableCatalog', id), { status: 'archived', updatedAt: Timestamp.now() });
  },

  async clone(id: string): Promise<string> {
    const original = await this.getById(id);
    if (!original) throw new Error('Tabla no encontrada');
    const newId = crypto.randomUUID();
    const { createdAt: _ca, updatedAt: _ua, ...rest } = original;
    await setDoc(doc(db, 'tableCatalog', newId), {
      ...deepCleanForFirestore(rest),
      id: newId,
      name: `${original.name} (copia)`,
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return newId;
  },

  async saveMany(entries: TableCatalogEntry[]): Promise<string[]> {
    return Promise.all(entries.map(e => this.save(e)));
  },
};
