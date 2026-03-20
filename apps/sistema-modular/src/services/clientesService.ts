import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, setDoc } from 'firebase/firestore';
import type { Cliente, ContactoCliente } from '@ags/shared';
import { db, logAudit, normalizeCuit, generateLegacyClientId, getCreateTrace, getUpdateTrace } from './firebase';

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
    const q = query(collection(db, 'clientes'));
    const querySnapshot = await getDocs(q);
    let clientes = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const { contactos: _, ...rest } = data;
      return {
        id: docSnap.id,
        ...rest,
        activo: data.activo !== false, // undefined/true → true, false → false
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      } as Cliente;
    });

    if (activosOnly) {
      clientes = clientes.filter(c => c.activo !== false);
    }

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
