import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where, orderBy, writeBatch, runTransaction, Timestamp } from "firebase/firestore";
import { OT_TO_LEAD_ESTADO } from "@ags/shared";
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject, getBlob } from "firebase/storage";
import type { TableCatalogEntry } from '../types/tableCatalog';
import type { ClienteOption, EstablecimientoOption, ContactoOption, SistemaOption, ModuloOption } from '../types/entities';
import type { InstrumentoPatronOption, AdjuntoMeta, CertificadoIngeniero, Patron, Columna } from '../types/instrumentos';
import { deepCleanForFirestore } from '@ags/shared';

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
  console.error('❌ Variables de entorno faltantes:', missingVars);
  console.error('Por favor, verifica tu archivo .env.local');
} else {
  console.log('✅ Variables de entorno de Firebase cargadas correctamente');
  console.log('📋 Project ID:', firebaseConfig.projectId);
}

let app;
let db;
let storage;

/**
 * Verifica si un error es de autenticación de Firebase
 */
function isAuthError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || '';
  
  return (
    errorMessage.includes('authentication') ||
    errorMessage.includes('credentials') ||
    errorMessage.includes('no longer valid') ||
    errorMessage.includes('invalid api key') ||
    errorCode === 'auth/invalid-api-key' ||
    errorCode === 'auth/api-key-not-valid'
  );
}

/**
 * Obtiene un mensaje de error amigable para errores de autenticación
 */
function getAuthErrorMessage(error: any): string {
  if (isAuthError(error)) {
    return `Error de autenticación de Firebase: Las credenciales ya no son válidas. 
    
Por favor, verifica:
1. Que las credenciales en .env.local sean correctas
2. Que el proyecto Firebase esté activo en la consola
3. Que la API key no haya sido revocada o deshabilitada
4. Que no haya restricciones de dominio/IP bloqueando el acceso

Para obtener nuevas credenciales:
- Ve a https://console.firebase.google.com/
- Selecciona tu proyecto: ${firebaseConfig.projectId}
- Ve a Configuración del proyecto > Configuración general
- Copia las nuevas credenciales a tu archivo .env.local`;
  }
  return error?.message || 'Error desconocido';
}

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('✅ Firebase inicializado correctamente');
} catch (error: any) {
  console.error('❌ Error al inicializar Firebase:', error);
  if (isAuthError(error)) {
    console.error('🔐 ERROR DE AUTENTICACIÓN:', getAuthErrorMessage(error));
  }
  throw error;
}

export { app };

/**
 * Guarda o actualiza el documento del reporte en Firestore.
 * @param ot Número de orden de trabajo (ID del documento)
 * @param data Datos del reporte a guardar
 */
// Mapping OT estadoAdmin → Ticket estado vive en @ags/shared/services/leads
// (OT_TO_LEAD_ESTADO). Antes estaba duplicado acá con un comentario que pedía
// mantenerlo sincronizado a mano — ahora es single source of truth.

async function _syncTicketFromOTInline(otNumber: string, newEstadoAdmin: string, userTrace: { uid?: string; name?: string }) {
  try {
    console.info(`[syncTicketFromOT] invoked: ot=${otNumber}, newEstadoAdmin=${newEstadoAdmin}`);
    const nuevoEstadoTicket = OT_TO_LEAD_ESTADO[newEstadoAdmin as keyof typeof OT_TO_LEAD_ESTADO];
    if (!nuevoEstadoTicket) {
      console.info(`[syncTicketFromOT] no mapping for estadoAdmin=${newEstadoAdmin}, skip`);
      return;
    }
    // Fresh read de la OT para conseguir budgets
    const otSnap = await getDoc(doc(db, 'reportes', otNumber));
    if (!otSnap.exists()) {
      console.info(`[syncTicketFromOT] OT ${otNumber} not found`);
      return;
    }
    const otData = otSnap.data();
    const budgets: string[] = Array.isArray(otData.budgets) ? otData.budgets : [];
    console.info(`[syncTicketFromOT] OT budgets:`, budgets);
    if (budgets.length === 0) {
      console.info(`[syncTicketFromOT] OT has no budgets, cannot resolve tickets`);
      return;
    }
    // Query presupuestos por numero (limit 10 por Firestore 'in' operator)
    const presSnap = await getDocs(query(collection(db, 'presupuestos'), where('numero', 'in', budgets.slice(0, 10))));
    const presIds = presSnap.docs.map(d => d.id);
    console.info(`[syncTicketFromOT] resolved ${presIds.length} presupuesto ids:`, presIds);
    if (presIds.length === 0) return;
    // Buscar tickets linkeados a cada ppto via presupuestosIds array-contains
    const ticketsToSync = new Set<string>();
    for (const pid of presIds) {
      const tksSnap = await getDocs(query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', pid)));
      console.info(`[syncTicketFromOT] ppto ${pid} has ${tksSnap.docs.length} tickets linked`);
      for (const d of tksSnap.docs) {
        const t = d.data();
        console.info(`[syncTicketFromOT] ticket ${d.id} estado=${t.estado}, target=${nuevoEstadoTicket}`);
        if (t.estado !== 'finalizado' && t.estado !== 'no_concretado' && t.estado !== nuevoEstadoTicket) {
          ticketsToSync.add(d.id);
        }
      }
    }
    console.info(`[syncTicketFromOT] will update ${ticketsToSync.size} tickets:`, Array.from(ticketsToSync));
    if (ticketsToSync.size === 0) return;

    // FLOW-05: si la transición es a CIERRE_TECNICO, derivar el ticket al
    // responsable de Materiales (configurado en adminConfig/flujos.usuarioMaterialesId).
    // Mirror exacto de leadsService.syncFromOT en sistema-modular — duplicación
    // intencional porque reportes-ot escribe directo a Firestore vía setDoc y
    // bypasea el service de sistema-modular.
    let derivAsignadoA: string | null = null;
    let derivAsignadoNombre: string | null = null;
    if (newEstadoAdmin === 'CIERRE_TECNICO') {
      try {
        const cfgSnap = await getDoc(doc(db, 'adminConfig', 'flujos'));
        if (cfgSnap.exists()) {
          const cfg = cfgSnap.data();
          const matId = cfg.usuarioMaterialesId;
          if (matId) {
            const matSnap = await getDoc(doc(db, 'usuarios', matId));
            if (matSnap.exists()) {
              const mat = matSnap.data();
              if (mat.status === 'activo') {
                derivAsignadoA = matId;
                derivAsignadoNombre = mat.displayName ?? null;
                console.info(`[syncTicketFromOT] FLOW-05: derivando a Materiales (${derivAsignadoNombre})`);
              } else {
                console.warn(`[syncTicketFromOT] usuario Materiales ${matId} no está activo, ticket queda con coord`);
              }
            }
          } else {
            console.info('[syncTicketFromOT] FLOW-05: usuarioMaterialesId no configurado, skip derivación');
          }
        }
      } catch (err) {
        console.warn('[syncTicketFromOT] derivación a Materiales falló, ticket queda con coord:', err);
      }
    }

    // Update cada ticket con nuevo estado + posta de audit.
    // posta.fecha es ISO string (lo lee el formatter de timeline en sistema-modular).
    // updatedAt usa Timestamp.now() para alinearse con el resto del codebase.
    const nowIso = new Date().toISOString();
    for (const tid of ticketsToSync) {
      const tkSnap = await getDoc(doc(db, 'leads', tid));
      if (!tkSnap.exists()) continue;
      const tk = tkSnap.data();
      const posta = {
        id: crypto.randomUUID(),
        fecha: nowIso,
        deUsuarioId: userTrace.uid || 'tecnico',
        deUsuarioNombre: userTrace.name || 'Técnico',
        aUsuarioId: derivAsignadoA ?? tk.asignadoA ?? '',
        aUsuarioNombre: derivAsignadoNombre ?? tk.asignadoNombre ?? '',
        comentario: derivAsignadoA
          ? `OT-${otNumber} → ${newEstadoAdmin} · derivado a ${derivAsignadoNombre || 'Materiales'}`
          : `OT-${otNumber} → ${newEstadoAdmin}`,
        estadoAnterior: tk.estado,
        estadoNuevo: nuevoEstadoTicket,
      };
      const updates: any = {
        estado: nuevoEstadoTicket,
        postas: [...(tk.postas || []), posta],
        updatedAt: Timestamp.now(),
      };
      if (derivAsignadoA) {
        updates.asignadoA = derivAsignadoA;
        updates.asignadoNombre = derivAsignadoNombre;
        updates.areaActual = 'administracion';
        updates.accionPendiente = `OT-${otNumber} cerrada técnicamente — ejecutar cierre administrativo (descarga artículos + facturación)`;
      }
      await updateDoc(doc(db, 'leads', tid), updates);
      console.log(`✅ Ticket ${tid} sincronizado: ${tk.estado} → ${nuevoEstadoTicket}${derivAsignadoA ? ' (derivado a Materiales)' : ''}`);
    }
  } catch (err) {
    console.error('❌ _syncTicketFromOTInline failed:', err);
    // No bloquear el save del reporte por este fallo.
  }
}

export const saveReporte = async (ot: string, data: any): Promise<void> => {
  if (!ot) {
    console.warn('⚠️ saveReporte: OT vacía, no se guardará');
    return;
  }

  try {
    console.log('💾 Guardando reporte:', ot);
    console.log('📋 Datos a guardar:', JSON.stringify(data, null, 2));
    const docRef = doc(db, "reportes", ot);
    await setDoc(docRef, deepCleanForFirestore(data), { merge: true });
    console.log('✅ Reporte guardado exitosamente:', ot);
    // Phase 10 UAT fix: si el save cambia estadoAdmin, propagar al ticket
    // linkeado (normalmente CIERRE_TECNICO cuando el técnico finaliza).
    // reportes-ot usa setDoc directo y bypasea el post-commit hook de
    // ordenesTrabajoService.update → hay que hacer el sync acá inline.
    console.info('[saveReporte] post-save hook check: data.estadoAdmin =', data?.estadoAdmin);
    if (data?.estadoAdmin && typeof data.estadoAdmin === 'string') {
      await _syncTicketFromOTInline(ot, data.estadoAdmin, {
        uid: data.updatedBy || undefined,
        name: data.updatedByName || undefined,
      });
    } else {
      console.info('[saveReporte] skipping ticket sync — no estadoAdmin in payload');
    }
  } catch (error: any) {
    console.error('❌ Error al guardar reporte:', error);
    console.error('Código de error:', error.code);
    console.error('Mensaje:', error.message);
    console.error('📋 Datos que fallaron:', JSON.stringify(data, null, 2));
    throw error;
  }
};

/**
 * Escucha cambios en tiempo real de un reporte específico.
 * @param ot Número de orden de trabajo
 * @param callback Función que recibe los datos actualizados
 * @returns Función para cancelar la suscripción
 */
export const listenReporte = (ot: string, callback: (data: any) => void) => {
  if (!ot) return () => {};
  const docRef = doc(db, "reportes", ot);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    }
  });
};

export class FirebaseService {
  private collectionName = "reportes";

  async saveReport(reportId: string, data: any) {
    try {
      return await saveReporte(reportId, data);
    } catch (error: any) {
      console.error('❌ FirebaseService.saveReport error:', error);
      // Re-lanzar el error para que el componente pueda manejarlo
      throw error;
    }
  }

  async getReport(reportId: string) {
    if (!reportId) {
      console.warn('⚠️ getReport: reportId vacío');
      return null;
    }
    
    try {
      console.log('📖 Leyendo reporte:', reportId);
      const docRef = doc(db, this.collectionName, reportId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        console.log('✅ Reporte encontrado:', reportId);
        return docSnap.data();
      } else {
        console.log('ℹ️ Reporte no encontrado:', reportId);
        return null;
      }
    } catch (error: any) {
      console.error('❌ Error al leer reporte:', error);
      console.error('Código de error:', error.code);
      console.error('Mensaje:', error.message);
      
      if (isAuthError(error)) {
        const authError = new Error(getAuthErrorMessage(error));
        (authError as any).code = error.code;
        (authError as any).isAuthError = true;
        throw authError;
      }
      
      throw error;
    }
  }

  subscribeToReport(reportId: string, callback: (data: any) => void) {
    return listenReporte(reportId, callback);
  }

  async updateSignature(reportId: string, signatureData: string) {
    if (!reportId) {
      console.warn('⚠️ updateSignature: reportId vacío');
      throw new Error('reportId es requerido');
    }
    
    try {
      console.log('✍️ Actualizando firma:', reportId);
      const docRef = doc(db, this.collectionName, reportId);
      await setDoc(
        docRef,
        {
          signatureClient: signatureData,
          signedAt: Timestamp.now(),
          signedFrom: 'mobile'
        },
        { merge: true }
      );
      console.log('✅ Firma actualizada exitosamente:', reportId);
    } catch (error: any) {
      console.error('❌ Error al actualizar firma:', error);
      console.error('Código de error:', error.code);
      console.error('Mensaje:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene todas las tablas publicadas del catálogo, opcionalmente filtradas por sysType.
   * Lee de la colección /tableCatalog del mismo proyecto Firebase.
   */
  async getPublishedTables(sysType?: string): Promise<TableCatalogEntry[]> {
    try {
      const col = collection(db, 'tableCatalog');
      const q = sysType
        ? query(col, where('status', '==', 'published'), where('sysType', '==', sysType))
        : query(col, where('status', '==', 'published'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TableCatalogEntry));
    } catch (error: any) {
      console.error('❌ Error al leer tableCatalog:', error);
      return [];
    }
  }

  /**
   * Busca el sector del sistema en `reportes` (otNumber === doc id).
   * Si es item ("29397.01") sin sector/sistemaId propios, hace fallback al padre.
   */
  async getSectorFromOrdenesTrabajo(otNumber: string): Promise<string> {
    try {
      const snap = await getDoc(doc(db, 'reportes', otNumber));
      let data = snap.exists() ? snap.data() : null;
      if (!data && otNumber.includes('.')) {
        const padreSnap = await getDoc(doc(db, 'reportes', otNumber.split('.')[0]));
        data = padreSnap.exists() ? padreSnap.data() : null;
      }
      if (!data) return '';
      if (data.sector) return data.sector as string;
      if (data.sistemaId) {
        const sistemaSnap = await getDoc(doc(db, 'sistemas', data.sistemaId));
        if (sistemaSnap.exists()) return sistemaSnap.data().sector || '';
      }
      // Último intento: si sector/sistemaId faltan en el item, mirar el padre.
      if (otNumber.includes('.')) {
        const padreSnap = await getDoc(doc(db, 'reportes', otNumber.split('.')[0]));
        if (padreSnap.exists()) {
          const padreData = padreSnap.data();
          if (padreData.sector) return padreData.sector as string;
          if (padreData.sistemaId) {
            const sistemaSnap = await getDoc(doc(db, 'sistemas', padreData.sistemaId));
            if (sistemaSnap.exists()) return sistemaSnap.data().sector || '';
          }
        }
      }
      return '';
    } catch { return ''; }
  }

  /**
   * Obtiene una tabla del catálogo por ID, sin filtrar por status (incluye drafts).
   * Usado como fallback para resolver variables en snapshots obsoletos.
   */
  async getTableById(id: string): Promise<TableCatalogEntry | null> {
    try {
      const snap = await getDoc(doc(db, 'tableCatalog', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TableCatalogEntry;
    } catch { return null; }
  }

  /**
   * Obtiene todos los proyectos de tablas (para resolver headerTitle/footerQF a nivel proyecto).
   */
  async getProjects(): Promise<{ id: string; name?: string | null; headerTitle?: string | null; footerQF?: string | null }[]> {
    try {
      const q = query(collection(db, 'tableProjects'));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, name: data.name ?? null, headerTitle: data.headerTitle ?? null, footerQF: data.footerQF ?? null };
      });
    } catch (error: any) {
      console.error('Error al leer tableProjects:', error);
      return [];
    }
  }

  // ── Selectores de entidades (lectura desde colecciones de sistema-modular) ──

  async getClientes(): Promise<ClienteOption[]> {
    try {
      const q = query(collection(db, 'clientes'), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({
          id: d.id,
          razonSocial: d.data().razonSocial,
          cuit: d.data().cuit ?? null,
          requiereTrazabilidad: d.data().requiereTrazabilidad ?? false,
        } as ClienteOption))
        .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
    } catch (e) { console.error('Error cargando clientes:', e); return []; }
  }

  async getEstablecimientosByCliente(clienteId: string): Promise<EstablecimientoOption[]> {
    try {
      // Buscar por clienteCuit Y por clienteId (campo legacy de migración)
      const [byCuit, byId] = await Promise.all([
        getDocs(query(collection(db, 'establecimientos'), where('clienteCuit', '==', clienteId))),
        getDocs(query(collection(db, 'establecimientos'), where('clienteId', '==', clienteId))),
      ]);
      const map = new Map<string, EstablecimientoOption>();
      for (const snap of [byCuit, byId]) {
        snap.docs.forEach(d => {
          if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() } as EstablecimientoOption);
        });
      }
      return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (e) { console.error('Error cargando establecimientos:', e); return []; }
  }

  async getContactosByEstablecimiento(estabId: string): Promise<ContactoOption[]> {
    try {
      const snap = await getDocs(collection(db, 'establecimientos', estabId, 'contactos'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactoOption));
    } catch (e) { console.error('Error cargando contactos:', e); return []; }
  }

  async getSistemasByEstablecimiento(estabId: string): Promise<SistemaOption[]> {
    try {
      const q = query(collection(db, 'sistemas'), where('establecimientoId', '==', estabId), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as SistemaOption))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (e) { console.error('Error cargando sistemas:', e); return []; }
  }

  async getModulosBySistema(sistemaId: string): Promise<ModuloOption[]> {
    try {
      const snap = await getDocs(collection(db, 'sistemas', sistemaId, 'modulos'));
      return snap.docs.map(d => ({ id: d.id, sistemaId, ...d.data() } as ModuloOption));
    } catch (e) { console.error('Error cargando módulos:', e); return []; }
  }

  /**
   * Sube un Blob de PDF a Firebase Storage y devuelve la URL de descarga
   */
  async uploadReportBlob(ot: string, blob: Blob, filename: string): Promise<string> {
    try {
      const storageRef = ref(storage, `reports/${ot}/${filename}`);
      await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error: any) {
      console.error('❌ Error al subir PDF a Storage:', error);
      if (isAuthError(error)) {
        const authError = new Error(getAuthErrorMessage(error));
        (authError as any).code = error.code;
        (authError as any).isAuthError = true;
        throw authError;
      }
      throw error;
    }
  }

  // ── Instrumentos (lectura para técnicos) ──

  async getActiveInstrumentos(): Promise<InstrumentoPatronOption[]> {
    try {
      const q = query(collection(db, 'instrumentos'), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre,
          tipo: data.tipo,
          marca: data.marca,
          modelo: data.modelo,
          serie: data.serie,
          lote: data.lote ?? null,
          categorias: data.categorias ?? [],
          certificadoEmisor: data.certificadoEmisor ?? null,
          certificadoVencimiento: data.certificadoVencimiento ?? null,
          certificadoUrl: data.certificadoUrl ?? null,
          trazabilidadUrl: data.trazabilidadUrl ?? null,
        } as InstrumentoPatronOption;
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (e) { console.error('Error cargando instrumentos:', e); return []; }
  }

  /** Fallback: lee trazabilidadUrl fresh si el snapshot del reporte es viejo. */
  async getInstrumentoTrazabilidadUrl(id: string): Promise<string | null> {
    try {
      const snap = await getDoc(doc(db, 'instrumentos', id));
      if (!snap.exists()) return null;
      return (snap.data() as any).trazabilidadUrl ?? null;
    } catch (e) {
      console.warn('Error leyendo trazabilidadUrl:', e);
      return null;
    }
  }

  // ── Patrones (colección /patrones) ──

  async getActivePatrones(): Promise<Patron[]> {
    try {
      const q = query(collection(db, 'patrones'), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          codigoArticulo: data.codigoArticulo ?? '',
          descripcion: data.descripcion ?? '',
          marca: data.marca ?? '',
          categorias: data.categorias ?? [],
          lotes: data.lotes ?? [],
          activo: data.activo !== false,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
        } as Patron;
      }).sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
    } catch (e) { console.error('Error cargando patrones:', e); return []; }
  }

  // ── Columnas (colección /columnas) ──

  async getActiveColumnas(): Promise<Columna[]> {
    try {
      const q = query(collection(db, 'columnas'), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          codigoArticulo: data.codigoArticulo ?? '',
          descripcion: data.descripcion ?? '',
          marca: data.marca ?? '',
          categorias: data.categorias ?? [],
          series: data.series ?? [],
          activo: data.activo !== false,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? new Date().toISOString(),
        } as Columna;
      }).sort((a, b) => a.codigoArticulo.localeCompare(b.codigoArticulo));
    } catch (e) { console.error('Error cargando columnas:', e); return []; }
  }

  // ── Ingenieros ──

  async getIngenieroByNombre(nombre: string): Promise<{ id: string; nombre: string } | null> {
    try {
      const q = query(collection(db, 'ingenieros'), where('nombre', '==', nombre), where('activo', '==', true));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, nombre: d.data().nombre };
    } catch { return null; }
  }

  async getActiveIngenieros(): Promise<{ id: string; nombre: string }[]> {
    try {
      const q = query(collection(db, 'ingenieros'), where('activo', '==', true));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, nombre: d.data().nombre as string }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch { return []; }
  }

  async getIngenieroByEmail(email: string): Promise<{ id: string; nombre: string } | null> {
    try {
      const q = query(collection(db, 'ingenieros'), where('email', '==', email), where('activo', '==', true));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, nombre: d.data().nombre };
    } catch { return null; }
  }

  // ── Certificados de ingeniero ──

  async getCertificadosIngeniero(ingenieroId: string): Promise<CertificadoIngeniero[]> {
    try {
      const q = query(collection(db, 'certificadosIngeniero'), where('ingenieroId', '==', ingenieroId));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ingenieroId: data.ingenieroId,
          ingenieroNombre: data.ingenieroNombre,
          categoria: data.categoria,
          descripcion: data.descripcion,
          certificadoUrl: data.certificadoUrl,
          certificadoNombre: data.certificadoNombre,
          certificadoStoragePath: data.certificadoStoragePath,
          fechaEmision: data.fechaEmision ?? null,
          fechaVencimiento: data.fechaVencimiento ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        } as CertificadoIngeniero;
      }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descripcion.localeCompare(b.descripcion));
    } catch (e) { console.error('Error cargando certificados ingeniero:', e); return []; }
  }

  // ── Adjuntos (fotos/archivos por OT) ──

  async getAdjuntosByOT(otNumber: string): Promise<AdjuntoMeta[]> {
    try {
      const q = query(
        collection(db, 'adjuntos'),
        where('otNumber', '==', otNumber),
        orderBy('orden', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdjuntoMeta));
    } catch (e) { console.error('Error cargando adjuntos:', e); return []; }
  }

  /** Listener en tiempo real para adjuntos — sincroniza entre dispositivos */
  listenAdjuntosByOT(otNumber: string, callback: (adjuntos: AdjuntoMeta[]) => void): () => void {
    if (!otNumber) return () => {};
    const q = query(
      collection(db, 'adjuntos'),
      where('otNumber', '==', otNumber),
      orderBy('orden', 'asc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdjuntoMeta)));
    }, (err) => {
      console.error('Error en listener de adjuntos:', err);
    });
  }

  async uploadAdjuntoFile(otNumber: string, file: File): Promise<{ url: string; path: string }> {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `adjuntos/${otNumber}/${timestamp}_${safeName}`;
    const storageR = ref(storage, storagePath);
    // uploadBytesResumable soporta archivos grandes sin timeout
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageR, file, { contentType: file.type });
      task.on('state_changed', null, reject, resolve);
    });
    const url = await getDownloadURL(storageR);
    return { url, path: storagePath };
  }

  async createAdjunto(data: Omit<AdjuntoMeta, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'adjuntos'), data);
    return docRef.id;
  }

  async updateAdjuntoCaption(adjuntoId: string, caption: string): Promise<void> {
    await updateDoc(doc(db, 'adjuntos', adjuntoId), { caption });
  }

  async updateAdjuntosOrden(items: { id: string; orden: number }[]): Promise<void> {
    const batch = writeBatch(db);
    for (const item of items) {
      batch.update(doc(db, 'adjuntos', item.id), { orden: item.orden });
    }
    await batch.commit();
  }

  async deleteAdjunto(adjuntoId: string, storagePath: string): Promise<void> {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (e) {
      console.warn('No se pudo borrar archivo de Storage:', e);
    }
    await deleteDoc(doc(db, 'adjuntos', adjuntoId));
  }

  /**
   * Obtiene la firma guardada del usuario autenticado desde /usuarios/{uid}.
   * Devuelve { firmaBase64, nombreAclaracion } o null si no tiene firma.
   */
  async getUserFirma(uid: string): Promise<{ firmaBase64: string; nombreAclaracion: string } | null> {
    if (!uid) return null;
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (!snap.exists()) return null;
      const data = snap.data();
      const firma = data.firmaBase64 as string | undefined;
      const nombre = data.nombreAclaracion as string | undefined;
      if (!firma) return null;
      return { firmaBase64: firma, nombreAclaracion: nombre || data.displayName || '' };
    } catch (e) {
      console.warn('No se pudo obtener firma del usuario:', e);
      return null;
    }
  }

  /** Obtiene todos los artículos activos del catálogo de stock (código + descripción). */
  async getArticulos(): Promise<Array<{ id: string; codigo: string; descripcion: string }>> {
    try {
      const snap = await getDocs(collection(db, 'articulos'));
      return snap.docs
        .filter(d => d.data().activo !== false)
        .map(d => ({
          id: d.id,
          codigo: (d.data().codigo as string) || '',
          descripcion: (d.data().descripcion as string) || '',
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
    } catch (e) {
      console.warn('No se pudieron obtener artículos:', e);
      return [];
    }
  }

  /**
   * Crea un ticket (lead) interno a partir de las acciones a tomar del reporte.
   * Se crea al finalizar el reporte cuando accionesInternaOnly es true.
   */
  async createTicketFromAcciones(data: {
    otNumber: string;
    razonSocial: string;
    contacto: string;
    sistema: string;
    moduloModelo: string;
    codigoInternoCliente: string;
    accionesTomar: string;
  }): Promise<string> {
    // Resolve clienteId and sistemaId from the OT document
    let clienteId: string | null = null;
    let sistemaId: string | null = null;
    try {
      // OTs viven en `reportes` (otNumber === doc id, sirve para padres "29397" e items "29397.01").
      const otSnap = await getDoc(doc(db, 'reportes', data.otNumber));
      if (otSnap.exists()) {
        const otData = otSnap.data();
        clienteId = (otData.clienteId as string) || null;
        sistemaId = (otData.sistemaId as string) || null;
        // Fallback: si es item ("29397.01") sin clienteId/sistemaId propios, heredar del padre.
        if ((!clienteId || !sistemaId) && data.otNumber.includes('.')) {
          const padre = data.otNumber.split('.')[0];
          const padreSnap = await getDoc(doc(db, 'reportes', padre));
          if (padreSnap.exists()) {
            const padreData = padreSnap.data();
            if (!clienteId) clienteId = (padreData.clienteId as string) || null;
            if (!sistemaId) sistemaId = (padreData.sistemaId as string) || null;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo resolver clienteId/sistemaId desde OT:', e);
    }

    // Generar correlativo TKT-XXXXX vía counter doc atómico (_counters/tickets).
    // Antes era scan-and-max no atómico — dos técnicos finalizando en simultáneo
    // obtenían el mismo número. Mismo patrón que otService.getNextItemNumber.
    let numero = '';
    try {
      numero = await runTransaction(db, async (tx) => {
        const counterRef = doc(db, '_counters', 'tickets');
        const counterSnap = await tx.get(counterRef);
        let currentMax: number;
        if (counterSnap.exists()) {
          currentMax = counterSnap.data().value as number;
        } else {
          // Primera vez: escanear leads existentes para inicializar el counter.
          const allLeads = await getDocs(collection(db, 'leads'));
          currentMax = 0;
          allLeads.docs.forEach(d => {
            const n = typeof d.data().numero === 'string' ? d.data().numero.match(/TKT-(\d+)/) : null;
            if (n) currentMax = Math.max(currentMax, parseInt(n[1], 10));
          });
        }
        const next = currentMax + 1;
        tx.set(counterRef, { value: next });
        return `TKT-${String(next).padStart(5, '0')}`;
      });
    } catch (e) {
      console.warn('No se pudo generar numero correlativo, ticket queda sin numero:', e);
    }

    // Resolver responsable del ticket de "Acciones a tomar". Antes era hardcoded
    // (uid de Esteban Vigna). Ahora lee adminConfig/flujos.usuarioMaterialesId
    // (mismo responsable que FLOW-05 — ambos son area=admin_soporte) con fallback
    // al uid hardcodeado si la config no está seteada o el usuario está inactivo.
    const FALLBACK_UID = 'pHDkcnzLEdX93APkPcf3ebqyOJL2';
    const FALLBACK_NOMBRE = 'Esteban Vigna';
    let asignadoUid = FALLBACK_UID;
    let asignadoNombre = FALLBACK_NOMBRE;
    try {
      const cfgSnap = await getDoc(doc(db, 'adminConfig', 'flujos'));
      if (cfgSnap.exists()) {
        const matId = cfgSnap.data().usuarioMaterialesId as string | null | undefined;
        if (matId) {
          const matSnap = await getDoc(doc(db, 'usuarios', matId));
          if (matSnap.exists() && matSnap.data().status === 'activo') {
            asignadoUid = matId;
            asignadoNombre = matSnap.data().displayName ?? FALLBACK_NOMBRE;
          }
        }
      }
    } catch (err) {
      console.warn('[createTicketFromAcciones] adminConfig lookup falló, uso fallback:', err);
    }

    const now = Timestamp.now();
    const { auth } = await import('./authService');
    const currentUser = auth.currentUser;
    const docRef = await addDoc(collection(db, 'leads'), {
      ...(numero ? { numero } : {}),
      razonSocial: data.razonSocial,
      contacto: data.contacto,
      email: '',
      telefono: '',
      motivoLlamado: 'soporte',
      motivoContacto: `[OT ${data.otNumber}] ${data.sistema} - ${data.moduloModelo}`,
      descripcion: data.accionesTomar,
      estado: 'nuevo',
      areaActual: 'admin_soporte',
      asignadoA: asignadoUid,
      asignadoNombre: asignadoNombre,
      derivadoPor: null,
      prioridad: 'urgente',
      clienteId,
      contactoId: null,
      sistemaId,
      postas: [],
      otIds: [data.otNumber],
      presupuestosIds: [],
      adjuntos: [],
      proximoContacto: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      source: 'manual',
      createdBy: currentUser?.uid || null,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  /** Descarga un archivo de Storage como Blob usando el SDK (sin CORS issues). */
  async downloadStorageBlob(url: string): Promise<Blob> {
    // Extraer el path del archivo de la URL de Firebase Storage
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) throw new Error('URL de Storage inválida');
    const filePath = decodeURIComponent(match[1]);
    const storageRef = ref(storage, filePath);
    return await getBlob(storageRef);
  }
}