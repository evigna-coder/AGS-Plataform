import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, deepCleanForFirestore } from './firebase';

/**
 * Feature flags runtime override para módulos del sidebar.
 *
 * Coexistencia con VITE_DESKTOP_MVP:
 *   - Env flag = default de build (fallback si Firestore no tiene override para el módulo).
 *   - Firestore = override runtime; si existe para un módulo, gana sobre el env.
 *
 * Shape del doc `/featureFlags/modules`:
 *   { modules: { [path]: { enabled, updatedAt, updatedBy } }, updatedAt }
 *
 * Se usa `item.path` como key (estable y único) en lugar de `moduloId` (se repite —
 * p.ej. tres entries comparten `modulo: 'instrumentos'`).
 */

export interface ModuleFlag {
  enabled: boolean;
  /** ISO string. El doc en Firestore guarda Timestamp; acá lo exponemos normalizado. */
  updatedAt: string;
  /** uid del admin que tocó el toggle. */
  updatedBy: string;
}

export interface FeatureFlagsModules {
  modules: Record<string, ModuleFlag>;
}

const COLLECTION = 'featureFlags';
const DOC_ID = 'modules';

/**
 * Suscribe a cambios del doc `/featureFlags/modules`. El callback recibe el estado
 * actual (o `{ modules: {} }` si el doc no existe todavía). Devuelve la función de
 * unsubscribe que el caller debe invocar en unmount.
 */
export function subscribeFeatureFlags(
  cb: (flags: FeatureFlagsModules) => void
): () => void {
  const ref = doc(db, COLLECTION, DOC_ID);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) {
      cb({ modules: {} });
      return;
    }
    const data = snap.data();
    const modules: Record<string, ModuleFlag> = {};
    if (data && typeof data.modules === 'object' && data.modules !== null) {
      for (const [path, raw] of Object.entries<any>(data.modules)) {
        modules[path] = {
          enabled: !!raw?.enabled,
          updatedAt: raw?.updatedAt?.toDate?.()?.toISOString() ?? '',
          updatedBy: raw?.updatedBy ?? '',
        };
      }
    }
    cb({ modules });
  });
}

/** Lee el doc una vez (no-reactive). Útil para carga inicial fuera de React. */
export async function getFeatureFlagsOnce(): Promise<FeatureFlagsModules> {
  const ref = doc(db, COLLECTION, DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { modules: {} };
  const data = snap.data();
  const modules: Record<string, ModuleFlag> = {};
  for (const [path, raw] of Object.entries<any>(data?.modules ?? {})) {
    modules[path] = {
      enabled: !!raw?.enabled,
      updatedAt: raw?.updatedAt?.toDate?.()?.toISOString() ?? '',
      updatedBy: raw?.updatedBy ?? '',
    };
  }
  return { modules };
}

/**
 * Setea el flag `enabled` de un módulo en particular (creando el doc si no existe).
 * Usa setDoc con `merge: true` para no pisar el resto del map.
 *
 * Firestore rules: escritura debe restringirse a rol admin (ver SUMMARY de 05-04).
 */
export async function setModuleEnabled(
  modulePath: string,
  enabled: boolean,
  uid: string
): Promise<void> {
  const ref = doc(db, COLLECTION, DOC_ID);
  const now = Timestamp.now();
  const payload = deepCleanForFirestore({
    modules: {
      [modulePath]: { enabled, updatedAt: now, updatedBy: uid },
    },
    updatedAt: now,
  });
  await setDoc(ref, payload, { merge: true });
}
