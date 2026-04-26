// Bound a la instancia de Firestore + getCurrentUser de sistema-modular.
// Implementación en @ags/shared/services/qfDocumentos — antes estaba duplicada
// con portal-ingeniero (200 LOC byte-cercanos).
import { makeQfDocumentosService, type CreateQFInput } from '@ags/shared';
import { db } from './firebase';
import { getCurrentUser } from './currentUser';

export const qfDocumentosService = makeQfDocumentosService({ db, getCurrentUser });
export type { CreateQFInput };
