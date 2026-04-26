// Bound a la instancia de Firestore de sistema-modular. La implementación
// vive en @ags/shared/services/fcm — antes estaba duplicada con portal-ingeniero.
import { makeFcmTokensService, makeNotificationPrefsService } from '@ags/shared';
import { db } from './firebase';

export const fcmTokensService = makeFcmTokensService(db);
export const notificationPrefsService = makeNotificationPrefsService(db);
