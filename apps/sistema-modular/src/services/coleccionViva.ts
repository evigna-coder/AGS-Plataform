import { collection, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db, onSnapshot } from './firebase';

/**
 * Colección "viva" compartida por toda la sesión (2026-10-01, tanda de perf).
 *
 * Los catálogos grandes que casi todas las pantallas necesitan (artículos,
 * clientes, establecimientos, sistemas) se leían con `getDocs`: cada pantalla,
 * pasados los minutos de la caché en memoria, volvía a bajar la colección
 * entera del servidor (4.017 artículos en minikits, remitos, "Mover"…). La
 * caché persistente de Firestore NO acelera `getDocs`: siempre va al servidor.
 *
 * Acá hay UNA suscripción por colección mientras dure la sesión: la primera
 * entrega sale de la caché en disco (instantánea) y después el servidor manda
 * solo los cambios. Quien pide la lista recibe siempre la versión al día, sin
 * re-leer nada, y los writes propios aparecen al instante.
 *
 * Si la suscripción falla (sin sesión, permisos, logout) se descarta y el
 * próximo pedido la vuelve a abrir.
 */
export function crearColeccionViva<T>(nombre: string, mapear: (docs: QueryDocumentSnapshot<DocumentData>[]) => T[]) {
  let datos: T[] | null = null;
  let primera: Promise<T[]> | null = null;
  let cortar: (() => void) | null = null;
  const oyentes = new Set<(datos: T[]) => void>();

  const reiniciar = () => {
    cortar?.();
    cortar = null;
    primera = null;
    datos = null;
  };

  function obtener(): Promise<T[]> {
    if (datos) return Promise.resolve(datos);
    if (primera) return primera;
    primera = new Promise<T[]>((resolver, rechazar) => {
      let resuelta = false;
      cortar = onSnapshot(collection(db, nombre), snap => {
        datos = mapear(snap.docs);
        if (!resuelta) { resuelta = true; resolver(datos); }
        const actuales = datos;
        oyentes.forEach(fn => fn(actuales));
      }, err => {
        console.warn(`[coleccionViva] ${nombre}: la suscripción se cortó, se reabre en el próximo pedido`, err);
        reiniciar();
        if (!resuelta) { resuelta = true; rechazar(err); }
      });
    });
    return primera;
  }

  /**
   * Recibir la lista ahora y en cada cambio (2026-10-02): varias pantallas
   * escuchando la misma colección comparten UNA suscripción a Firestore.
   */
  function suscribir(fn: (datos: T[]) => void, onError?: (err: Error) => void): () => void {
    oyentes.add(fn);
    obtener().then(d => { if (oyentes.has(fn)) fn(d); }).catch(err => onError?.(err));
    return () => { oyentes.delete(fn); };
  }

  /** Los datos si la suscripción ya entregó, sin esperar ni abrir nada. */
  const yaCargada = (): T[] | null => datos;

  return { obtener, reiniciar, yaCargada, suscribir };
}
