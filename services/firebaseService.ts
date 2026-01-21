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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Guarda o actualiza el documento del reporte en Firestore.
 * @param ot Número de orden de trabajo (ID del documento)
 * @param data Datos del reporte a guardar
 */
export const saveReporte = async (ot: string, data: any): Promise<void> => {
  if (!ot) return;
  const docRef = doc(db, "reportes", ot);
  await setDoc(docRef, data, { merge: true });
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
    return saveReporte(reportId, data);
  }

  async getReport(reportId: string) {
    const docRef = doc(db, this.collectionName, reportId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  subscribeToReport(reportId: string, callback: (data: any) => void) {
    return listenReporte(reportId, callback);
  }

  async updateSignature(reportId: string, signatureData: string) {
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
}

  /**
   * Sube un Blob de PDF a Firebase Storage y devuelve la URL de descarga
   * @param ot Número de orden de trabajo
   * @param blob Blob del PDF
   * @param filename Nombre del archivo
   * @returns URL de descarga pública
   */
  async uploadReportBlob(ot: string, blob: Blob, filename: string): Promise<string> {
    const storageRef = ref(storage, `reports/${ot}/${filename}`);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(storageRef);
    return url;
  }
}