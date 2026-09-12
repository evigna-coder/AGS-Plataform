import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initNotifications } from './services/notificationService';
import './index.css';

// Sentry en el renderer: NO lleva DSN — lo hereda del main process (electron/main.cjs)
// por IPC. Si el main no inicializó Sentry (DSN vacío), esto queda no-op.
// Tracing de navegación al 20 % (2026-09-11, fase 0 de performance.md).
Sentry.init({
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

// Registrar Service Worker para notificaciones push
initNotifications();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
