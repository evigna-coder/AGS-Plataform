import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { RequerimientosListPage } from '@/pages/RequerimientosListPage';
import { RequerimientoDetailPage } from '@/pages/RequerimientoDetailPage';
import { OrdenesListPage } from '@/pages/OrdenesListPage';
import { OrdenDetailPage } from '@/pages/OrdenDetailPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { LoginPage } from '@/pages/LoginPage';

function GatedApp() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="requerimientos" element={<RequerimientosListPage />} />
        <Route path="requerimientos/:id" element={<RequerimientoDetailPage />} />
        <Route path="ordenes" element={<OrdenesListPage />} />
        <Route path="ordenes/:numero" element={<OrdenDetailPage />} />
        <Route path="entregas" element={<PlaceholderPage title="Entregas" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
