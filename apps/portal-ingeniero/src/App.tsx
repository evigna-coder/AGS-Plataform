import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Spinner } from './components/ui/Spinner';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import ReportesPage from './pages/ReportesPage';
import OTListPage from './pages/OTListPage';
import OTDetailPage from './pages/OTDetailPage';
import AgendaPage from './pages/AgendaPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import PerfilPage from './pages/PerfilPage';
import EquipoPublicPage from './pages/EquipoPublicPage';

// Rutas privadas (requieren auth)
function PrivateApp() {
  const { loading, isAuthenticated, isPending, isDisabled, authError } = useAuth();

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
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/reportes" replace />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="ordenes-trabajo" element={<OTListPage />} />
        <Route path="ordenes-trabajo/:otNumber" element={<OTDetailPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:leadId" element={<LeadDetailPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to="/reportes" replace />} />
      </Route>
    </Routes>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
