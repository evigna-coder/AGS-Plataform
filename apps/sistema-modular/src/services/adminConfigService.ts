import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AdminConfigFlujos } from '@ags/shared';
import { db, deepCleanForFirestore, onSnapshot } from './firebase';

/**
 * Configuración global de flujos automáticos (FLOW-07).
 * Colección `adminConfig` con doc único `flujos` — editable desde `/admin/config-flujos`.
 */

const DOC_COLLECTION = 'adminConfig';
const DOC_ID = 'flujos';

/**
 * Defaults aplicados por `getWithDefaults()` cuando el doc aún no existe.
 * `mailFacturacion` es required en el tipo; este default asegura que los callers
 * nunca reciban undefined.
 */
export const ADMIN_CONFIG_DEFAULTS: Pick<AdminConfigFlujos, 'mailFacturacion'> = {
  mailFacturacion: 'mbarrios@agsanalitica.com',
};

function parseConfig(data: any): AdminConfigFlujos {
  return {
    ...ADMIN_CONFIG_DEFAULTS,
    ...data,
    updatedAt: typeof data?.updatedAt === 'string'
      ? data.updatedAt
      : (data?.updatedAt?.toDate?.().toISOString?.() ?? new Date().toISOString()),
  } as AdminConfigFlujos;
}

export const adminConfigService = {
  async get(): Promise<AdminConfigFlujos | null> {
    const snap = await getDoc(doc(db, DOC_COLLECTION, DOC_ID));
    if (!snap.exists()) return null;
    return parseConfig(snap.data());
  },

  /** Devuelve defaults si no hay doc. NO escribe — solo lee con fallback. */
  async getWithDefaults(): Promise<AdminConfigFlujos> {
    const cfg = await this.get();
    if (cfg) return cfg;
    return {
      ...ADMIN_CONFIG_DEFAULTS,
      updatedAt: new Date().toISOString(),
    } as AdminConfigFlujos;
  },

  async update(
    data: Partial<AdminConfigFlujos>,
    updatedBy: string,
    updatedByName?: string,
  ): Promise<void> {
    await setDoc(
      doc(db, DOC_COLLECTION, DOC_ID),
      deepCleanForFirestore({
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy,
        updatedByName: updatedByName ?? null,
      }),
      { merge: true },
    );
  },

  subscribe(
    callback: (cfg: AdminConfigFlujos | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, DOC_COLLECTION, DOC_ID),
      snap => callback(snap.exists() ? parseConfig(snap.data()) : null),
      err => {
        console.error('adminConfig subscription error:', err);
        onError?.(err);
      },
    );
  },
};
