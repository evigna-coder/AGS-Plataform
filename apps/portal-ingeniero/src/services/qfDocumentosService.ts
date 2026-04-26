// Bound a la instancia de Firestore + getCurrentUser de portal-ingeniero.
// Implementación en @ags/shared/services/qfDocumentos — antes estaba duplicada
// con sistema-modular (200 LOC byte-cercanos).
import { makeQfDocumentosService, type CreateQFInput } from '@ags/shared';
import { db } from './firebaseService';
import { getCurrentUser } from './currentUser';

export const qfDocumentosService = makeQfDocumentosService({ db, getCurrentUser });
export type { CreateQFInput };
