import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebaseService';

/**
 * Escucha nuevos leads con source='qr' y dispara notificaciones nativas de Electron.
 * Solo notifica leads creados DESPUÉS de que se montó el componente (no los existentes).
 */
export function useQRLeadNotifications() {
  const startTimeRef = useRef<Timestamp>(Timestamp.now());

  useEffect(() => {
    // Pedir permiso de notificaciones (Electron las muestra como notificaciones del sistema)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'leads'),
      where('source', '==', 'qr'),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (Notification.permission !== 'granted') return;

      snap.docChanges()
        .filter(change => change.type === 'added')
        .filter(change => {
          const createdAt = change.doc.data().createdAt as Timestamp | undefined;
          return createdAt != null && createdAt.toMillis() > startTimeRef.current.toMillis();
        })
        .forEach(change => {
          const lead = change.doc.data();
          const empresa = (lead.razonSocial as string) || 'Sin empresa';
          const motivo = (lead.motivoContacto as string) || 'Sin descripción';
          const equipo = (lead.sistemaAgsVisibleId as string) || '';

          new Notification('Nueva solicitud de soporte (QR)', {
            body: `${empresa}${equipo ? ` · ${equipo}` : ''}\n${motivo}`,
            icon: '/favicon.ico',
            tag: `qr-lead-${change.doc.id}`,
          });
        });
    }, (err) => {
      console.warn('[QR Notif] Error en listener de leads:', err);
    });

    return () => unsub();
  }, []);
}
