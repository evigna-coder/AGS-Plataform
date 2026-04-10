import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabsProvider } from './contexts/TabsContext';
import { BackgroundTasksProvider } from './contexts/BackgroundTasksContext';
import { FloatingPresupuestoProvider } from './contexts/FloatingPresupuestoContext';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { PendingApprovalPage } from './pages/auth/PendingApprovalPage';
import { useQRLeadNotifications } from './hooks/useQRLeadNotifications';
import { ToastContainer, showToast } from './components/notifications/Toast';
import { onForegroundNotification } from './services/notificationService';
import { TokenAutoRefresher } from './components/notifications/TokenAutoRefresher';

function ForegroundNotificationListener() {
  useEffect(() => {
    const unsub = onForegroundNotification(({ title, body, data }) => {
      showToast(title, body, data);
    });
    return unsub;
  }, []);
  return null;
}

function QRNotificationListener() {
  useQRLeadNotifications();
  return null;
}

function AuthGate() {
  const { loading, authError, firebaseUser, isAuthenticated, isPending, isDisabled } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-teal-600 font-bold text-xl tracking-tight">AGS</span>
          <p className="text-xs text-slate-400 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-md text-center">
          <span className="text-teal-600 font-bold text-xl tracking-tight">AGS</span>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4 text-left">
            <p className="text-xs text-amber-800 font-medium">Configuracion requerida</p>
            <p className="text-[11px] text-amber-700 mt-1">{authError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return <LoginPage />;
  if (isDisabled) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-sm text-center">
          <span className="text-teal-600 font-bold text-xl tracking-tight">AGS</span>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 mt-4">
            <p className="text-xs text-red-700 font-medium">Tu cuenta ha sido deshabilitada.</p>
            <p className="text-[11px] text-red-600 mt-0.5">Contacta al administrador.</p>
          </div>
        </div>
      </div>
    );
  }
  if (isPending || !isAuthenticated) return <PendingApprovalPage />;

  return (
    <>
      <QRNotificationListener />
      <ForegroundNotificationListener />
      <TokenAutoRefresher />
      <ConfirmDialogProvider>
      <BackgroundTasksProvider>
      <FloatingPresupuestoProvider>
      <TabsProvider>
        <Layout />
        <ToastContainer />
      </TabsProvider>
      </FloatingPresupuestoProvider>
      </BackgroundTasksProvider>
      </ConfirmDialogProvider>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
