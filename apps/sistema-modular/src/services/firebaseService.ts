import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import type { Cliente, ContactoCliente, CategoriaEquipo, Sistema, ModuloSistema } from '@ags/shared';

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

// Servicio para Clientes
export const clientesService = {
  // Crear cliente
  async create(clienteData: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>) {
    console.log('📝 Creando cliente:', clienteData.razonSocial);
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...clienteData,
      contactos: clienteData.contactos || [],
      activo: clienteData.activo !== undefined ? clienteData.activo : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Cliente creado exitosamente con ID:', docRef.id);
    return docRef.id;
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
    const clientes = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      // Cargar contactos desde subcolección
      const contactosSnapshot = await getDocs(collection(db, 'clientes', docSnap.id, 'contactos'));
      const contactos = contactosSnapshot.docs.map(contDoc => ({
        id: contDoc.id,
        ...contDoc.data(),
      })) as ContactoCliente[];
      
      return {
        id: docSnap.id,
        ...data,
        contactos,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Cliente;
    }));
    
    // Ordenar en memoria mientras se construye el índice
    clientes.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
    
    console.log(`✅ ${clientes.length} clientes cargados`);
    return clientes;
  },

  // Buscar clientes (por razón social, CUIT o nombre de contacto)
  async search(term: string) {
    console.log('🔍 Buscando clientes con término:', term);
    const allClientes = await this.getAll(false);
    const termLower = term.toLowerCase();
    return allClientes.filter(c => 
      c.razonSocial.toLowerCase().includes(termLower) ||
      (c.cuit && c.cuit.includes(term)) ||
      c.contactos.some(cont => cont.nombre.toLowerCase().includes(termLower))
    );
  },

  // Obtener cliente por ID
  async getById(id: string) {
    const docRef = doc(db, 'clientes', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Cargar contactos
      const contactosSnapshot = await getDocs(collection(db, 'clientes', id, 'contactos'));
      const contactos = contactosSnapshot.docs.map(contDoc => ({
        id: contDoc.id,
        ...contDoc.data(),
      })) as ContactoCliente[];
      
      return {
        id: docSnap.id,
        ...data,
        contactos,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Cliente;
    }
    return null;
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

// Servicio para Categorías Equipo
export const categoriasEquipoService = {
  // Crear categoría
  async create(categoriaData: Omit<CategoriaEquipo, 'id'>) {
    console.log('📝 Creando categoría:', categoriaData.nombre);
    const docRef = await addDoc(collection(db, 'categorias_equipo'), categoriaData);
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
    await updateDoc(docRef, data);
  },

  // Eliminar categoría
  async delete(id: string) {
    await deleteDoc(doc(db, 'categorias_equipo', id));
  },
};

// Servicio para Sistemas
export const sistemasService = {
  // Crear sistema
  async create(sistemaData: Omit<Sistema, 'id' | 'createdAt' | 'updatedAt'>) {
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

  // Obtener todos los sistemas (opcional: filtrar por cliente o activos)
  async getAll(filters?: { clienteId?: string; activosOnly?: boolean }) {
    console.log('📥 Cargando sistemas desde Firestore...');
    let q;
    
    // Construir query según filtros (sin orderBy mientras se construyen los índices)
    if (filters?.clienteId && filters?.activosOnly) {
      // Ambos filtros: filtrar por clienteId y luego filtrar activos en memoria
      q = query(collection(db, 'sistemas'), where('clienteId', '==', filters.clienteId));
    } else if (filters?.clienteId) {
      q = query(collection(db, 'sistemas'), where('clienteId', '==', filters.clienteId));
    } else if (filters?.activosOnly) {
      q = query(collection(db, 'sistemas'), where('activo', '==', true));
    } else {
      q = query(collection(db, 'sistemas'));
    }
    
    const querySnapshot = await getDocs(q);
    let sistemas = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    })) as Sistema[];
    
    // Si se filtró por clienteId pero también se requiere activosOnly, filtrar en memoria
    if (filters?.clienteId && filters?.activosOnly) {
      sistemas = sistemas.filter(s => s.activo === true);
    }
    
    // Ordenar en memoria mientras se construyen los índices
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
};

// Servicio para Módulos (subcolección de sistemas)
export const modulosService = {
  // Crear módulo
  async create(sistemaId: string, moduloData: Omit<ModuloSistema, 'id' | 'sistemaId'>) {
    console.log('📝 Creando módulo para sistema:', sistemaId);
    const docRef = await addDoc(collection(db, 'sistemas', sistemaId, 'modulos'), {
      ...moduloData,
      sistemaId,
      ubicaciones: moduloData.ubicaciones || [],
      otIds: moduloData.otIds || [],
    });
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
    const docRef = doc(db, 'sistemas', sistemaId, 'modulos', moduloId);
    await updateDoc(docRef, data);
  },

  // Eliminar módulo
  async delete(sistemaId: string, moduloId: string) {
    await deleteDoc(doc(db, 'sistemas', sistemaId, 'modulos', moduloId));
  },
};
