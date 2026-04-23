import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import type { QFDocumento, QFEstado, QFHistorialEntry, QFTipo } from '@ags/shared';
import { formatQFNumeroCompleto, incrementQFVersion } from '@ags/shared';
import { db, cleanFirestoreData } from './firebase';
import { getCurrentUser } from './currentUser';

const COL = 'qfDocumentos';

interface RawDocData {
  tipo: QFTipo;
  familia: number;
  numero: string;
  numeroCompleto: string;
  versionActual: string;
  nombre: string;
  descripcion?: string | null;
  estado: QFEstado;
  fechaCreacion: Timestamp;
  fechaUltimaActualizacion: Timestamp;
  ultimoUsuarioEmail: string;
  ultimoUsuarioNombre?: string | null;
  historial: Array<{
    version: string;
    fecha: Timestamp | string;
    usuarioEmail: string;
    usuarioNombre?: string | null;
    cambios: string;
  }>;
}

function toQFDocumento(id: string, d: RawDocData): QFDocumento {
  const normalizeFecha = (f: Timestamp | string): string =>
    typeof f === 'string' ? f : f.toDate().toISOString();
  return {
    id,
    tipo: d.tipo,
    familia: d.familia,
    numero: d.numero,
    numeroCompleto: d.numeroCompleto,
    versionActual: d.versionActual,
    nombre: d.nombre,
    descripcion: d.descripcion ?? null,
    estado: d.estado,
    fechaCreacion: d.fechaCreacion.toDate().toISOString(),
    fechaUltimaActualizacion: d.fechaUltimaActualizacion.toDate().toISOString(),
    ultimoUsuarioEmail: d.ultimoUsuarioEmail,
    ultimoUsuarioNombre: d.ultimoUsuarioNombre ?? null,
    historial: (d.historial ?? []).map((h): QFHistorialEntry => ({
      version: h.version,
      fecha: normalizeFecha(h.fecha),
      usuarioEmail: h.usuarioEmail,
      usuarioNombre: h.usuarioNombre ?? null,
      cambios: h.cambios,
    })),
  };
}

export interface CreateQFInput {
  tipo: QFTipo;
  familia: number;
  numero: string;
  nombre: string;
  descripcion?: string | null;
  cambiosIniciales: string;
  /** Versión inicial (2 dígitos). Default: "01". Útil para cargar documentos que ya venían versionados. */
  versionInicial?: string;
}

export const qfDocumentosService = {
  subscribe(
    onData: (docs: QFDocumento[]) => void,
    onError: (err: Error) => void,
  ): () => void {
    const q = query(collection(db, COL), orderBy('fechaUltimaActualizacion', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((s) => toQFDocumento(s.id, s.data() as RawDocData));
        onData(docs);
      },
      (err) => onError(err),
    );
  },

  async getById(id: string): Promise<QFDocumento | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;
    return toQFDocumento(snap.id, snap.data() as RawDocData);
  },

  async create(input: CreateQFInput): Promise<QFDocumento> {
    const user = getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const numero = input.numero.padStart(4, '0');
    const numeroCompleto = formatQFNumeroCompleto(input.tipo, input.familia, numero);
    const versionInicial = (input.versionInicial || '01').replace(/\D/g, '').padStart(2, '0').slice(-2);
    if (!/^\d{2}$/.test(versionInicial) || versionInicial === '00') {
      throw new Error('La versión inicial debe ser un número entre 01 y 99.');
    }

    const ref = doc(db, COL, numeroCompleto);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error(`Ya existe un documento con el número ${numeroCompleto}`);
    }

    const now = Timestamp.now();
    const historialEntry = {
      version: versionInicial,
      fecha: now,
      usuarioEmail: user.email,
      usuarioNombre: user.displayName,
      cambios: input.cambiosIniciales.trim(),
    };

    const payload = cleanFirestoreData({
      tipo: input.tipo,
      familia: input.familia,
      numero,
      numeroCompleto,
      versionActual: versionInicial,
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      estado: 'vigente' as QFEstado,
      fechaCreacion: now,
      fechaUltimaActualizacion: now,
      ultimoUsuarioEmail: user.email,
      ultimoUsuarioNombre: user.displayName,
      historial: [historialEntry],
    });
    await setDoc(ref, payload);

    const snap = await getDoc(ref);
    return toQFDocumento(snap.id, snap.data() as RawDocData);
  },

  async crearNuevaVersion(id: string, cambios: string): Promise<void> {
    const user = getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const ref = doc(db, COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('QF no encontrado');

    const data = snap.data() as RawDocData;
    const nuevaVersion = incrementQFVersion(data.versionActual);
    const now = Timestamp.now();

    await updateDoc(ref, {
      versionActual: nuevaVersion,
      fechaUltimaActualizacion: now,
      ultimoUsuarioEmail: user.email,
      ultimoUsuarioNombre: user.displayName,
      historial: arrayUnion({
        version: nuevaVersion,
        fecha: now,
        usuarioEmail: user.email,
        usuarioNombre: user.displayName,
        cambios: cambios.trim(),
      }),
    });
  },

  async updateMetadata(
    id: string,
    data: { nombre?: string; descripcion?: string | null },
  ): Promise<void> {
    const user = getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const payload = cleanFirestoreData({
      ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion?.trim() || null } : {}),
      fechaUltimaActualizacion: Timestamp.now(),
      ultimoUsuarioEmail: user.email,
      ultimoUsuarioNombre: user.displayName,
    });
    await updateDoc(doc(db, COL, id), payload);
  },

  async setEstado(id: string, estado: QFEstado): Promise<void> {
    const user = getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    await updateDoc(doc(db, COL, id), {
      estado,
      fechaUltimaActualizacion: Timestamp.now(),
      ultimoUsuarioEmail: user.email,
      ultimoUsuarioNombre: user.displayName,
    });
  },
};
