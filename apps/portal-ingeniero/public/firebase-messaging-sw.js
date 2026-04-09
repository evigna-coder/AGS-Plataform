/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Este archivo DEBE estar en la raíz del dominio (public/) para que FCM funcione.
// Usa importScripts porque Service Workers no soportan ES modules.

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

// La config se inyecta desde el cliente al registrar el SW, pero FCM necesita
// firebase inicializado en el SW también. Usamos messagingSenderId mínimo.
// El resto de la config se pasa via postMessage desde la app.
let firebaseConfig = null;

// Escuchar mensaje de la app con la config completa
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    firebase.initializeApp(firebaseConfig);
    firebase.messaging();
  }
});

// Background push handler — cuando la app NO está en foreground
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || 'Portal AGS';
  const options = {
    body: notification.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.leadId || 'default',
    data: {
      url: data.url || '/',
      leadId: data.leadId || null,
      type: data.type || 'generic',
    },
    // Vibrar en mobile
    vibrate: [200, 100, 200],
    // Mantener la notificación hasta que el usuario interactúe
    requireInteraction: data.type === 'lead_urgent',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click en notificación → abrir/focar el portal en el ticket
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana del portal abierta, focarla y navegar
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Si no hay ventana, abrir una nueva
      return clients.openWindow(fullUrl);
    })
  );
});
