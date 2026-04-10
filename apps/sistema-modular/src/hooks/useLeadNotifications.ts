import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Lead } from '@ags/shared';

/**
 * Hook que escucha cambios en leads asignados al usuario actual y dispara
 * notificaciones nativas del SO (Windows/Electron) cuando detecta eventos
 * relevantes: ticket nuevo asignado, derivación, comentario, urgente.
 *
 * Este hook es específico para sistema-modular (Electron) porque FCM Web
 * no funciona bien en ese entorno. Usa `new Notification()` nativo que sí
 * funciona en Electron y Chrome.
 */
export function useLeadNotifications() {
  const { usuario, isAuthenticated } = useAuth();
  const knownLeadsRef = useRef<Map<string, Lead>>(new Map());
  const isFirstSnapshotRef = useRef(true);

  useEffect(() => {
    if (!isAuthenticated || !usuario?.id) return;

    // Solo escucha leads donde el usuario es el asignado actual
    const q = query(
      collection(db, 'leads'),
      where('asignadoA', '==', usuario.id),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      // Primer snapshot: cargar estado inicial sin notificar
      if (isFirstSnapshotRef.current) {
        snapshot.docs.forEach(doc => {
          knownLeadsRef.current.set(doc.id, { id: doc.id, ...doc.data() } as Lead);
        });
        isFirstSnapshotRef.current = false;
        return;
      }

      // Procesar cambios reales
      snapshot.docChanges().forEach(change => {
        const newLead = { id: change.doc.id, ...change.doc.data() } as Lead;
        const oldLead = knownLeadsRef.current.get(change.doc.id);

        if (change.type === 'added' && !oldLead) {
          // Ticket nuevo asignado al usuario
          // Si el usuario es el creador, no notificar (se auto-asignó)
          if (newLead.createdBy !== usuario.id) {
            showNativeNotification(
              'Nuevo ticket asignado',
              formatLeadLabel(newLead),
              newLead.id,
            );
          }
        } else if (change.type === 'modified' && oldLead) {
          detectAndNotifyChanges(oldLead, newLead, usuario.id);
        }

        knownLeadsRef.current.set(change.doc.id, newLead);
      });
    }, (err) => {
      console.error('[Notifications] Error en suscripción a leads:', err);
    });

    return () => {
      unsub();
      knownLeadsRef.current.clear();
      isFirstSnapshotRef.current = true;
    };
  }, [isAuthenticated, usuario?.id]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLeadLabel(lead: Lead): string {
  const razon = lead.razonSocial || 'Sin nombre';
  const contacto = lead.contacto || '';
  return contacto ? `${razon} — ${contacto}` : razon;
}

function detectAndNotifyChanges(oldLead: Lead, newLead: Lead, userId: string): void {
  const label = formatLeadLabel(newLead);

  // Posta nueva (derivación, comentario, o cambio de estado)
  const oldPostas = oldLead.postas || [];
  const newPostas = newLead.postas || [];

  if (newPostas.length > oldPostas.length) {
    const newPosta = newPostas[newPostas.length - 1];

    // No notificar si el usuario es quien hizo la acción
    if (newPosta.deUsuarioId === userId) return;

    // Derivación (cambió el asignado y ahora es el usuario)
    if (newPosta.aUsuarioId === userId && oldLead.asignadoA !== userId) {
      showNativeNotification(
        'Ticket derivado a vos',
        `${label} — de ${newPosta.deUsuarioNombre || 'alguien'}`,
        newLead.id,
      );
      return;
    }

    // Comentario (posta sin cambio de estado)
    if (newPosta.comentario && newPosta.estadoAnterior === newPosta.estadoNuevo) {
      showNativeNotification(
        'Nuevo comentario en ticket',
        `${label} — "${newPosta.comentario.substring(0, 80)}"`,
        newLead.id,
      );
      return;
    }
  }

  // Prioridad cambiada a urgente
  if (oldLead.prioridad !== 'urgente' && newLead.prioridad === 'urgente') {
    if (newLead.updatedBy !== userId) {
      showNativeNotification(
        'Ticket marcado URGENTE',
        label,
        newLead.id,
      );
    }
  }
}

function showNativeNotification(title: string, body: string, leadId: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: leadId,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Podríamos navegar al ticket aquí, pero sistema-modular usa tabs
      // y la estructura es distinta. Por ahora solo focamos la ventana.
    };
  } catch (err) {
    console.error('[Notifications] Error mostrando notificación:', err);
  }
}
