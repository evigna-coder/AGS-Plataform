/**
 * Shim de 'firebase/firestore' con contadores de lectura (fase 0 de la
 * estrategia de tiempos de respuesta, 2026-09-11).
 *
 * Vite resuelve `import ... from 'firebase/firestore'` de TODA la app hacia
 * este archivo (plugin `ags-firestore-instrumentado` en vite.config.ts); solo
 * este archivo ve el SDK real. Re-exporta todo tal cual y envuelve las tres
 * formas de leer —getDoc, getDocs y onSnapshot— para registrar colección,
 * cantidad de documentos y milisegundos en `utils/perfReads.ts`.
 *
 * Cero cambio de comportamiento: las funciones devuelven exactamente lo que
 * devuelve el SDK. Los tests con tsx no pasan por Vite y usan el SDK directo.
 */
import {
  getDoc as _getDoc,
  getDocs as _getDocs,
  onSnapshot as _onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { registrarLectura } from '../utils/perfReads';

export * from 'firebase/firestore';

/** Nombre de colección de una referencia o consulta, sin depender de internals del SDK. */
function coleccionDe(ref: unknown, snap?: QuerySnapshot | DocumentSnapshot): string {
  const r = ref as { path?: string; type?: string };
  if (typeof r?.path === 'string') {
    // DocumentReference: 'coleccion/id' → 'coleccion'. CollectionReference: ya es la colección.
    const partes = r.path.split('/');
    return r.type === 'document' || partes.length % 2 === 0 ? partes.slice(0, -1).join('/') : r.path;
  }
  const qs = snap as QuerySnapshot | undefined;
  const primero = qs?.docs?.[0];
  if (primero) return primero.ref.parent.path;
  return '(consulta sin resultados)';
}

export const getDoc: typeof _getDoc = (async (ref: DocumentReference) => {
  const t0 = performance.now();
  const snap = await _getDoc(ref);
  registrarLectura(coleccionDe(ref), snap.exists() ? 1 : 0, performance.now() - t0);
  return snap;
}) as typeof _getDoc;

export const getDocs: typeof _getDocs = (async (q: Query) => {
  const t0 = performance.now();
  const snap = await _getDocs(q);
  registrarLectura(coleccionDe(q, snap), snap.size, performance.now() - t0);
  return snap;
}) as typeof _getDocs;

export const onSnapshot: typeof _onSnapshot = ((ref: unknown, ...rest: unknown[]) => {
  // El callback de datos es el primer argumento función (puede venir después de opciones).
  const idx = rest.findIndex(a => typeof a === 'function');
  if (idx === -1) return (_onSnapshot as any)(ref, ...rest);
  const original = rest[idx] as (snap: any) => void;
  const t0 = performance.now();
  let primera = true;
  rest[idx] = (snap: QuerySnapshot | DocumentSnapshot) => {
    const docs = 'size' in snap ? snap.size : (snap.exists() ? 1 : 0);
    // La primera entrega mide el arranque del listener; las siguientes son deltas.
    registrarLectura(coleccionDe(ref, snap as QuerySnapshot), primera ? docs : ('docChanges' in snap ? snap.docChanges().length : docs), primera ? performance.now() - t0 : 0, 'snapshot');
    primera = false;
    original(snap);
  };
  return (_onSnapshot as any)(ref, ...rest);
}) as typeof _onSnapshot;
