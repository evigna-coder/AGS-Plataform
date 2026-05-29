/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Este archivo DEBE estar en la raíz del dominio (public/) para que FCM funcione.
// Usa importScripts porque Service Workers no soportan ES modules.

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

// Config pública de Firebase — se inicializa inmediatamente para que FCM
// registre los handlers de push/notificationclick en la evaluación inicial.
firebase.initializeApp({
  apiKey: 'AIzaSyD5oxchnQBK69zXGE-hrbRZ8vdduvwVjWw',
  authDomain: 'agssop-e7353.firebaseapp.com',
  projectId: 'agssop-e7353',
  storageBucket: 'agssop-e7353.firebasestorage.app',
  messagingSenderId: '818451692964',
  appId: '1:818451692964:web:e9c4c9485f81d823e45531',
});

// Inicializar messaging — esto registra los handlers de FCM internos
const messaging = firebase.messaging();

// Background message handler — cuando la app NO está en foreground
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};

  const title = data.title || 'Portal AGS';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.leadId || 'default',
    data: {
      url: data.url || '/',
      leadId: data.leadId || null,
      type: data.type || 'generic',
    },
    vibrate: [200, 100, 200],
    requireInteraction: data.type === 'lead_urgent',
  };

  return self.registration.showNotification(title, options);
});

// Fetch handler — REMOVIDO. Chromium se quejaba: "Fetch event handler is
// recognized as no-op. No-op fetch handler may bring overhead during navigation."
// Era un handler vacío agregado para que Chrome reconozca la PWA como
// instalable, pero (a) en Electron la app es un .exe (no necesita PWA install),
// y (b) interceptaba todas las requests del SDK Firebase agregando overhead.
// Sospecha investigada: puede estar relacionado con el bug del keyboard router
// stuck post-write en Electron.

// Click en notificación → abrir/focar el portal en el ticket
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
