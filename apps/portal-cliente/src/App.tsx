import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { BienvenidaPage } from '@/pages/BienvenidaPage';
import { EquiposPage } from '@/pages/EquiposPage';
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
        <Route index element={<BienvenidaPage />} />
        <Route path="equipos" element={<EquiposPage />} />
        <Route path="equipos/:id" element={<EquiposPage />} />
        <Route path="historial" element={<PlaceholderPage title="Historial" />} />
        <Route path="documentos" element={<PlaceholderPage title="Documentos" />} />
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
