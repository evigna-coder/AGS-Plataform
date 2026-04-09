import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initNotifications } from './services/notificationService';
import './index.css';

console.log('[ENV CHECK]', import.meta.env.MODE, import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

// Registrar Service Worker para notificaciones push
initNotifications();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
