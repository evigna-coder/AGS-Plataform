import {
  Firestore,
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
import type { QFDocumento, QFEstado, QFHistorialEntry, QFTipo, UsuarioAGS } from '../types';
import { formatQFNumeroCompleto, incrementQFVersion } from '../types';
import { cleanFirestoreData } from '../utils';

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
  /** Fecha de alta del protocolo (ISO yyyy-mm-dd). Default: hoy. Para cargar protocolos
   * que ya existían en papel y querés respetar la fecha original. */
  fechaCreacion?: string;
}

export interface QFDocumentosServiceDeps {
  db: Firestore;
  getCurrentUser: () => UsuarioAGS | null;
}

const QF_TIPOS: QFTipo[] = ['QF', 'QI', 'QD', 'QP'];

/**
 * Parsea el número QF de una CARÁTULA de la Biblioteca (tabla `tableType: 'cover'`).
 * El dato vive partido en dos campos del pie de carátula:
 *   - `coverQF`       → "Formulario N°: QF7.0606" (suele traer prefijo) → tipo+familia+numero
 *   - `coverRevision` → "REV: 09" / "Rev. 09"                          → versión
 * El match del número es LAXO (busca `XX{fam}.{num}` en cualquier parte del texto) porque
 * el campo se escribe a mano con prefijos variables. Si no hay revisión, asume "01".
 */
export function parseQFNumero(
  coverQF: string | null | undefined,
  coverRevision?: string | null,
): { tipo: QFTipo; familia: number; numero: string; version: string } | null {
  const m = /([A-Za-z]{2})\s*(\d+)\.(\d+)/.exec(coverQF ?? '');
  if (!m) return null;
  const tipo = m[1].toUpperCase() as QFTipo;
  if (!QF_TIPOS.includes(tipo)) return null;
  const rev = /(\d+)/.exec(coverRevision ?? '');
  const version = (rev ? rev[1] : '01').padStart(2, '0').slice(-2);
  return { tipo, familia: Number(m[2]), numero: m[3].padStart(4, '0'), version };
}

/** "08/05/2026" → "2026-05-08". Devuelve null si no matchea dd/mm/yyyy. */
export function parseFechaCaratula(f: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(f ?? '');
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Una CARÁTULA de la Biblioteca (tabla `tableType: 'cover'`), aplanada para el sync. */
export interface QFSyncItem {
  /** Campo "N° QF" del pie de carátula. */
  coverQF: string | null | undefined;
  /** Campo "Revisión" del pie de carátula — de acá sale la versión. */
  coverRevision?: string | null;
  /** Campo "Fecha" del pie de carátula (dd/mm/yyyy). */
  coverFecha?: string | null;
  nombre: string;
  sistema?: string | null;
}

export interface QFSyncReport {
  creados: string[];       // numeroCompleto de los QF nuevos
  actualizados: string[];  // numeroCompleto de los que subieron de versión
  sinCambios: number;      // ya existían con versión igual o mayor
  salteados: { valor: string; motivo: string }[];
}

/** Factory: bind qfDocumentos a una instancia Firestore + accessor de usuario actual de cada app. */
export function makeQfDocumentosService(deps: QFDocumentosServiceDeps) {
  const { db, getCurrentUser } = deps;

  return {
    /** Real-time subscription ordenada por fecha desc. */
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

    /** Crea un QF nuevo. Valida unicidad de `tipo+familia+numero` usando doc id = numeroCompleto. */
    async create(input: CreateQFInput): Promise<QFDocumento> {
      const user = getCurrentUser();
      if (!user) throw new Error('Usuario no autenticado');

      const numero = input.numero.padStart(4, '0');
      const numeroCompleto = formatQFNumeroCompleto(input.tipo, input.familia, numero);
      const versionInicial = (input.versionInicial || '01').replace(/\D/g, '').padStart(2, '0').slice(-2);
      if (!/^\d{2}$/.test(versionInicial)) {
        throw new Error('La versión inicial debe ser un número entre 00 y 99.');
      }

      const ref = doc(db, COL, numeroCompleto);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        throw new Error(`Ya existe un documento con el número ${numeroCompleto}`);
      }

      // Si pasaron fechaCreacion (ISO yyyy-mm-dd), usarla como fecha de alta del
      // protocolo; sino, ahora. fechaUltimaActualizacion siempre = ahora (la última
      // edición es esta).
      const fechaAlta = input.fechaCreacion
        ? Timestamp.fromDate(new Date(input.fechaCreacion + 'T00:00:00'))
        : Timestamp.now();
      const now = Timestamp.now();
      const historialEntry = {
        version: versionInicial,
        fecha: fechaAlta,
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
        fechaCreacion: fechaAlta,
        fechaUltimaActualizacion: now,
        ultimoUsuarioEmail: user.email,
        ultimoUsuarioNombre: user.displayName,
        historial: [historialEntry],
      });
      await setDoc(ref, payload);

      const snap = await getDoc(ref);
      return toQFDocumento(snap.id, snap.data() as RawDocData);
    },

    /** Crea una nueva versión (+1), appendea historial y actualiza ultimo usuario. */
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

    /** Edita metadatos (nombre, descripción) sin crear versión. */
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

    /** Edita la fecha de creación (alta) del QF. Actualiza tanto fechaCreacion
     * como la fecha de la primera entrada del historial (que representa la creación). */
    async updateFechaCreacion(id: string, fechaIso: string): Promise<void> {
      const user = getCurrentUser();
      if (!user) throw new Error('Usuario no autenticado');
      const ref = doc(db, COL, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('QF no encontrado');

      const data = snap.data() as RawDocData;
      const newFecha = Timestamp.fromDate(new Date(fechaIso + 'T00:00:00'));

      const newHistorial = [...(data.historial ?? [])];
      if (newHistorial.length > 0) {
        newHistorial[0] = { ...newHistorial[0], fecha: newFecha };
      }

      await updateDoc(ref, cleanFirestoreData({
        fechaCreacion: newFecha,
        historial: newHistorial,
        ultimoUsuarioEmail: user.email,
        ultimoUsuarioNombre: user.displayName,
      }));
    },

    /** Cambia estado (vigente ↔ obsoleto). Preserva historial. */
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

    /**
     * Sincroniza el registro desde los proyectos de la Biblioteca de tablas: por cada
     * proyecto con `footerQF` válido, crea el QF si no existe o le sube la versión si la
     * carátula quedó adelante. NO pisa nombre/descripción de los que ya existen (el
     * registro sigue editable a mano) — solo crea faltantes y bumpea versiones. Idempotente.
     */
    async sincronizarDesdeBiblioteca(items: QFSyncItem[]): Promise<QFSyncReport> {
      const user = getCurrentUser();
      if (!user) throw new Error('Usuario no autenticado');
      const report: QFSyncReport = { creados: [], actualizados: [], sinCambios: 0, salteados: [] };

      // Dedup por numeroCompleto: si dos proyectos comparten QF, gana la mayor versión.
      const byNumero = new Map<string, { parsed: NonNullable<ReturnType<typeof parseQFNumero>>; item: QFSyncItem }>();
      for (const item of items) {
        // Salteados SIEMPRE reportados con motivo (antes se ignoraban en silencio y el
        // reporte daba 0 sin explicar nada).
        if (!item.coverQF || !item.coverQF.trim()) {
          report.salteados.push({ valor: item.nombre || '(sin nombre)', motivo: 'Carátula sin N° QF cargado' });
          continue;
        }
        const parsed = parseQFNumero(item.coverQF, item.coverRevision);
        if (!parsed) { report.salteados.push({ valor: item.coverQF, motivo: 'No se pudo leer el número QF' }); continue; }
        const nc = formatQFNumeroCompleto(parsed.tipo, parsed.familia, parsed.numero);
        const prev = byNumero.get(nc);
        if (!prev || Number(parsed.version) > Number(prev.parsed.version)) byNumero.set(nc, { parsed, item });
      }

      for (const [nc, { parsed, item }] of byNumero) {
        const ref = doc(db, COL, nc);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const fechaIso = parseFechaCaratula(item.coverFecha);
          const fechaAlta = fechaIso ? Timestamp.fromDate(new Date(fechaIso + 'T00:00:00')) : Timestamp.now();
          const now = Timestamp.now();
          await setDoc(ref, cleanFirestoreData({
            tipo: parsed.tipo, familia: parsed.familia, numero: parsed.numero, numeroCompleto: nc,
            versionActual: parsed.version,
            nombre: (item.nombre || nc).trim(),
            descripcion: item.sistema?.trim() || null,
            estado: 'vigente' as QFEstado,
            fechaCreacion: fechaAlta,
            fechaUltimaActualizacion: now,
            ultimoUsuarioEmail: user.email,
            ultimoUsuarioNombre: user.displayName,
            historial: [{ version: parsed.version, fecha: fechaAlta, usuarioEmail: user.email, usuarioNombre: user.displayName, cambios: 'Alta desde Biblioteca de tablas' }],
          }));
          report.creados.push(nc);
        } else {
          const data = snap.data() as RawDocData;
          if (Number(parsed.version) > Number(data.versionActual)) {
            const now = Timestamp.now();
            await updateDoc(ref, {
              versionActual: parsed.version,
              fechaUltimaActualizacion: now,
              ultimoUsuarioEmail: user.email,
              ultimoUsuarioNombre: user.displayName,
              historial: arrayUnion({ version: parsed.version, fecha: now, usuarioEmail: user.email, usuarioNombre: user.displayName, cambios: `Sincronizado desde Biblioteca (v${parsed.version})` }),
            });
            report.actualizados.push(nc);
          } else {
            report.sinCambios++;
          }
        }
      }
      return report;
    },
  };
}
