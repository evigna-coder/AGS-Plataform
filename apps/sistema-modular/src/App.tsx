import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabsProvider } from './contexts/TabsContext';
import { BackgroundTasksProvider } from './contexts/BackgroundTasksContext';
import { FloatingPresupuestoProvider } from './contexts/FloatingPresupuestoContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { PendingApprovalPage } from './pages/auth/PendingApprovalPage';
import { LeadsList, LeadDetail } from './pages/leads';
import { ClientesList, ClienteDetail } from './pages/clientes';
import { EstablecimientosList, EstablecimientoNew, EstablecimientoDetail } from './pages/establecimientos';
import { EquiposList, EquipoDetail, CategoriasEquipo } from './pages/equipos';
import { OTList, OTNew, OTDetail, TiposServicio } from './pages/ordenes-trabajo';
import { PresupuestosList, PresupuestoNew, PresupuestoDetail, CategoriasPresupuesto, CondicionesPago, ConceptosServicio } from './pages/presupuestos';
import { TableCatalogPage, TableCatalogEditorPage } from './pages/protocol-catalog';
import { InstrumentosListPage, InstrumentoEditorPage } from './pages/instrumentos';
import { FichasList, FichaEditor, FichaDetail } from './pages/fichas';
import { LoanersList, LoanerEditor, LoanerDetail } from './pages/loaners';
import { MarcasPage, IngenierosPage, ProveedoresPage, PosicionesPage, ArticulosList, ArticuloEditor, ArticuloDetail, UnidadesList, MinikitsList, MinikitDetail, MinikitTemplatesPage, MovimientosPage, RemitosList, RemitoDetail, AlertasStockPage, PosicionesArancelariasPage, ProveedorDetail, RequerimientosList, OCList, OCEditor, OCDetail, ImportacionesList, ImportacionEditor, ImportacionDetail, AsignacionRapidaPage, AsignacionesList, AsignacionDetail, InventarioIngenieroPage } from './pages/stock';
import { IngresoEmpresasList } from './pages/ingreso-empresas';
import { DispositivosList } from './pages/dispositivos';
import { VehiculosList, VehiculoDetail } from './pages/vehiculos';
import { UsuariosList } from './pages/usuarios';
import { ImportacionDatos } from './pages/admin';
import { AgendaPage } from './pages/agenda';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useQRLeadNotifications } from './hooks/useQRLeadNotifications';

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
      <BackgroundTasksProvider>
      <FloatingPresupuestoProvider>
      <TabsProvider>
      <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/clientes" replace />} />
        {/* Clientes — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/clientes" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ClientesList /></ProtectedRoute>} />
        <Route path="/clientes/nuevo" element={<Navigate to="/clientes" replace />} />
        <Route path="/clientes/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ClienteDetail /></ProtectedRoute>} />
        {/* Establecimientos — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/establecimientos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientosList /></ProtectedRoute>} />
        <Route path="/establecimientos/nuevo" element={<Navigate to="/establecimientos" replace />} />
        <Route path="/establecimientos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientoDetail /></ProtectedRoute>} />
        <Route path="/establecimientos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientoNew /></ProtectedRoute>} />
        {/* Equipos — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/equipos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EquiposList /></ProtectedRoute>} />
        <Route path="/equipos/nuevo" element={<Navigate to="/equipos" replace />} />
        <Route path="/equipos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EquipoDetail /></ProtectedRoute>} />
        <Route path="/categorias-equipo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><CategoriasEquipo /></ProtectedRoute>} />
        {/* Ordenes de Trabajo — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/ordenes-trabajo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTList /></ProtectedRoute>} />
        <Route path="/ordenes-trabajo/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTNew /></ProtectedRoute>} />
        <Route path="/ordenes-trabajo/:otNumber" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTDetail /></ProtectedRoute>} />
        <Route path="/categorias-tipo-servicio" element={<Navigate to="/tipos-servicio" replace />} />
        <Route path="/tipos-servicio" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TiposServicio /></ProtectedRoute>} />
        {/* Leads — admin, admin_soporte, administracion */}
        <Route path="/leads" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><LeadsList /></ProtectedRoute>} />
        <Route path="/leads/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><LeadDetail /></ProtectedRoute>} />
        {/* Presupuestos — admin, admin_soporte, administracion */}
        <Route path="/presupuestos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestosList /></ProtectedRoute>} />
        <Route path="/presupuestos/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoNew /></ProtectedRoute>} />
        <Route path="/presupuestos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoDetail /></ProtectedRoute>} />
        <Route path="/presupuestos/categorias" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CategoriasPresupuesto /></ProtectedRoute>} />
        <Route path="/presupuestos/condiciones-pago" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CondicionesPago /></ProtectedRoute>} />
        <Route path="/presupuestos/conceptos-servicio" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ConceptosServicio /></ProtectedRoute>} />
        {/* Biblioteca de Tablas — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/table-catalog" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogPage /></ProtectedRoute>} />
        <Route path="/table-catalog/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogEditorPage /></ProtectedRoute>} />
        <Route path="/table-catalog/:tableId/edit" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogEditorPage /></ProtectedRoute>} />
        {/* Ingreso a Empresas */}
        <Route path="/ingreso-empresas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><IngresoEmpresasList /></ProtectedRoute>} />
        {/* Dispositivos */}
        <Route path="/dispositivos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><DispositivosList /></ProtectedRoute>} />
        {/* Vehículos */}
        <Route path="/vehiculos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><VehiculosList /></ProtectedRoute>} />
        <Route path="/vehiculos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><VehiculoDetail /></ProtectedRoute>} />
        {/* Instrumentos — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/instrumentos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentosListPage /></ProtectedRoute>} />
        <Route path="/instrumentos/nuevo" element={<Navigate to="/instrumentos" replace />} />
        <Route path="/instrumentos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentoEditorPage /></ProtectedRoute>} />
        {/* Fichas Propiedad del Cliente — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/fichas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichasList /></ProtectedRoute>} />
        <Route path="/fichas/nuevo" element={<Navigate to="/fichas" replace />} />
        <Route path="/fichas/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichaDetail /></ProtectedRoute>} />
        <Route path="/fichas/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichaEditor /></ProtectedRoute>} />
        {/* Loaners — admin, ingeniero_soporte, admin_soporte */}
        <Route path="/loaners" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanersList /></ProtectedRoute>} />
        <Route path="/loaners/nuevo" element={<Navigate to="/loaners" replace />} />
        <Route path="/loaners/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerDetail /></ProtectedRoute>} />
        <Route path="/loaners/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerEditor /></ProtectedRoute>} />
        {/* Stock — admin, admin_soporte, administracion */}
        <Route path="/stock" element={<Navigate to="/stock/articulos" replace />} />
        <Route path="/stock/articulos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticulosList /></ProtectedRoute>} />
        <Route path="/stock/articulos/nuevo" element={<Navigate to="/stock/articulos" replace />} />
        <Route path="/stock/articulos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticuloDetail /></ProtectedRoute>} />
        <Route path="/stock/articulos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticuloEditor /></ProtectedRoute>} />
        <Route path="/stock/unidades" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><UnidadesList /></ProtectedRoute>} />
        <Route path="/stock/minikits" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitsList /></ProtectedRoute>} />
        <Route path="/stock/minikits/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitDetail /></ProtectedRoute>} />
        <Route path="/stock/minikit-plantillas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitTemplatesPage /></ProtectedRoute>} />
        <Route path="/stock/remitos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RemitosList /></ProtectedRoute>} />
        <Route path="/stock/remitos/nuevo" element={<Navigate to="/stock/remitos" replace />} />
        <Route path="/stock/remitos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RemitoDetail /></ProtectedRoute>} />
        <Route path="/stock/movimientos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MovimientosPage /></ProtectedRoute>} />
        <Route path="/stock/alertas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AlertasStockPage /></ProtectedRoute>} />
        <Route path="/stock/requerimientos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RequerimientosList /></ProtectedRoute>} />
        <Route path="/stock/ordenes-compra" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCList /></ProtectedRoute>} />
        <Route path="/stock/ordenes-compra/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCEditor /></ProtectedRoute>} />
        <Route path="/stock/ordenes-compra/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCDetail /></ProtectedRoute>} />
        <Route path="/stock/ordenes-compra/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCEditor /></ProtectedRoute>} />
        <Route path="/stock/importaciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ImportacionesList /></ProtectedRoute>} />
        <Route path="/stock/importaciones/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ImportacionEditor /></ProtectedRoute>} />
        <Route path="/stock/importaciones/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ImportacionDetail /></ProtectedRoute>} />
        <Route path="/stock/ingenieros" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><IngenierosPage /></ProtectedRoute>} />
        <Route path="/stock/ingenieros/:id/inventario" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><InventarioIngenieroPage /></ProtectedRoute>} />
        <Route path="/stock/proveedores" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ProveedoresPage /></ProtectedRoute>} />
        <Route path="/stock/proveedores/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ProveedorDetail /></ProtectedRoute>} />
        <Route path="/stock/posiciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PosicionesPage /></ProtectedRoute>} />
        <Route path="/stock/posiciones-arancelarias" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PosicionesArancelariasPage /></ProtectedRoute>} />
        <Route path="/stock/marcas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MarcasPage /></ProtectedRoute>} />
        <Route path="/stock/asignaciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionRapidaPage /></ProtectedRoute>} />
        <Route path="/stock/asignaciones/historial" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionesList /></ProtectedRoute>} />
        <Route path="/stock/asignaciones/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionDetail /></ProtectedRoute>} />
        {/* Usuarios — admin only */}
        <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><UsuariosList /></ProtectedRoute>} />
        {/* Placeholders */}
        <Route path="/agenda" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><AgendaPage /></ProtectedRoute>} />
        <Route path="/facturacion" element={<ProtectedRoute allowedRoles={['admin', 'administracion']}><div className="text-center py-12"><p className="text-slate-400">Facturacion - Proximamente</p></div></ProtectedRoute>} />
        {/* Admin — admin only */}
        <Route path="/admin/importar" element={<ProtectedRoute allowedRoles={['admin']}><ImportacionDatos /></ProtectedRoute>} />
      </Routes>
    </Layout>
    </TabsProvider>
    </FloatingPresupuestoProvider>
    </BackgroundTasksProvider>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
