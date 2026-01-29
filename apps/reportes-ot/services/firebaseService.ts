import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
export const saveReporte = async (ot: string, data: any): Promise<void> => {
  if (!ot) {
    console.warn('⚠️ saveReporte: OT vacía, no se guardará');
    return;
  }
  
  try {
    console.log('💾 Guardando reporte:', ot);
    console.log('📋 Datos a guardar:', JSON.stringify(data, null, 2));
    const docRef = doc(db, "reportes", ot);
    await setDoc(docRef, data, { merge: true });
    console.log('✅ Reporte guardado exitosamente:', ot);
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
          signedAt: Date.now(),
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
   * Sube un Blob de PDF a Firebase Storage y devuelve la URL de descarga
   * @param ot Número de orden de trabajo
   * @param blob Blob del PDF
   * @param filename Nombre del archivo
   * @returns URL de descarga pública
   */
  async uploadReportBlob(ot: string, blob: Blob, filename: string): Promise<string> {
    try {
      const storageRef = ref(storage, `reports/${ot}/${filename}`);
      await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error: any) {
      console.error('❌ Error al subir PDF a Storage:', error);
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
}