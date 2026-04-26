import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Spinner } from './components/ui/Spinner';
import { ToastContainer } from './components/ui/Toast';
import { onForegroundNotification } from './services/notificationService';
import { TokenAutoRefresher } from './components/notifications/TokenAutoRefresher';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import OTListPage from './pages/OTListPage';
import OTDetailPage from './pages/OTDetailPage';
import AgendaPage from './pages/AgendaPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import HistorialPage from './pages/HistorialPage';
import ReportesPage from './pages/ReportesPage';
import PerfilPage from './pages/PerfilPage';
import ViaticosPage from './pages/ViaticosPage';
import EquipoPublicPage from './pages/EquipoPublicPage';
import QFDocumentosPage from './pages/QFDocumentosPage';
import RecepcionPage from './pages/RecepcionPage';
import FichaFotosEgresoPage from './pages/FichaFotosEgresoPage';
import { UploadQueueIndicator } from './components/recepcion/UploadQueueIndicator';
import { uploadQueueManager } from './services/uploadQueueManager';

/** Listener de notificaciones foreground — componente separado para respetar rules of hooks */
function ForegroundNotificationListener() {
  useEffect(() => {
    try {
      const unsub = onForegroundNotification(({ title, body, data }) => {
        // Notificación nativa del SO (Windows/Android).
        // En foreground, FCM no dispara showNotification automáticamente —
        // lo hacemos manualmente via el Service Worker registrado.
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          navigator.serviceWorker.getRegistration('/').then(reg => {
            if (!reg) return;
            reg.showNotification(title, {
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: data.leadId || 'default',
              data: {
                url: data.url || '/',
                leadId: data.leadId,
                type: data.type,
              },
              vibrate: [200, 100, 200],
              requireInteraction: data.type === 'lead_urgent',
            } as NotificationOptions);
          });
        }
      });
      return unsub;
    } catch {
      // Firebase Messaging no soportado en este contexto
    }
  }, []);
  return null;
}

/** Arranca el manager de cola de subidas una vez que el usuario está autenticado. */
function UploadQueueLifecycle() {
  useEffect(() => {
    uploadQueueManager.start();
    return () => uploadQueueManager.stop();
  }, []);
  return null;
}

// Rutas privadas (requieren auth)
function PrivateApp() {
  const { loading, isAuthenticated, isPending, isDisabled, authError, hasRole } = useAuth();
  const canRecepcion = hasRole('admin', 'admin_soporte');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700">Error de configuración</p>
          <p className="text-xs text-slate-500">{authError}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (isDisabled) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">Cuenta deshabilitada</p>
            <p className="text-xs text-slate-500">Contactá a tu administrador AGS.</p>
          </div>
        </div>
      );
    }
    if (isPending) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">Acceso pendiente</p>
            <p className="text-xs text-slate-500">Tu cuenta fue creada y está esperando aprobación de rol.</p>
          </div>
        </div>
      );
    }
    return <LoginPage />;
  }

  return (
    <>
      <UploadQueueLifecycle />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/leads" replace />} />
          <Route path="ordenes-trabajo" element={<OTListPage />} />
          <Route path="ordenes-trabajo/:otNumber" element={<OTDetailPage />} />
          <Route path="historial" element={<HistorialPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:leadId" element={<LeadDetailPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="viaticos" element={<ViaticosPage />} />
          <Route path="qf-documentos" element={<QFDocumentosPage />} />
          {canRecepcion && (
            <>
              <Route path="recepcion" element={<RecepcionPage />} />
              <Route path="recepcion/egreso" element={<FichaFotosEgresoPage />} />
              <Route path="recepcion/egreso/:fichaId" element={<FichaFotosEgresoPage />} />
            </>
          )}
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="*" element={<Navigate to="/leads" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública — accesible sin autenticación (landing QR) */}
          <Route path="/equipo/:agsId" element={<EquipoPublicPage />} />
          {/* Todas las demás rutas → auth gate */}
          <Route path="/*" element={<PrivateApp />} />
        </Routes>
        <ForegroundNotificationListener />
        <TokenAutoRefresher />
        <ToastContainer />
        <UploadQueueIndicator />
      </AuthProvider>
    </BrowserRouter>
  );
}
