import { useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTabs } from '../../contexts/TabsContext';
import { ProtectedRoute } from '../auth/ProtectedRoute';

// ── Page imports ──
import { LeadsList, LeadDetail } from '../../pages/leads';
import { ClientesList, ClienteDetail } from '../../pages/clientes';
import { EstablecimientosList, EstablecimientoNew, EstablecimientoDetail } from '../../pages/establecimientos';
import { EquiposList, EquipoDetail, CategoriasEquipo } from '../../pages/equipos';
import { OTList, OTNew, OTDetail, TiposServicio } from '../../pages/ordenes-trabajo';
import { PresupuestosList, PresupuestoNew, PresupuestoDetail, CategoriasPresupuesto, CondicionesPago, ConceptosServicio } from '../../pages/presupuestos';
import { TableCatalogPage, TableCatalogEditorPage, MigrateRenameConclusion } from '../../pages/protocol-catalog';
import { InstrumentosListPage, InstrumentoEditorPage } from '../../pages/instrumentos';
import { PatronesListPage, PatronEditorPage } from '../../pages/patrones';
import { ColumnasListPage, ColumnaEditorPage } from '../../pages/columnas';
import { FichasList, FichaEditor, FichaDetail } from '../../pages/fichas';
import { LoanersList, LoanerEditor, LoanerDetail } from '../../pages/loaners';
import { MarcasPage, IngenierosPage, ProveedoresPage, PosicionesPage, ArticulosList, ArticuloEditor, ArticuloDetail, UnidadesList, MinikitsList, MinikitDetail, MinikitTemplatesPage, MovimientosPage, RemitosList, RemitoDetail, AlertasStockPage, PosicionesArancelariasPage, ProveedorDetail, RequerimientosList, OCList, OCEditor, OCDetail, ImportacionesList, ImportacionEditor, ImportacionDetail, AsignacionRapidaPage, AsignacionesList, AsignacionDetail, InventarioIngenieroPage, PlanificacionStockPage } from '../../pages/stock';
import { IngresoEmpresasList } from '../../pages/ingreso-empresas';
import { DispositivosList } from '../../pages/dispositivos';
import { VehiculosList, VehiculoDetail } from '../../pages/vehiculos';
import { UsuariosList } from '../../pages/usuarios';
import { ImportacionDatos, RevisionClienteIdPage, ModulosAdminPage, ConfigFlujosPage, AccionesPendientesPage, RelinkearArticulosPage } from '../../pages/admin';
import { AgendaPage } from '../../pages/agenda';
import { PendientesList } from '../../pages/pendientes';
import { FacturacionList, FacturacionDetail } from '../../pages/facturacion';
import { ContratosList, ContratoDetail } from '../../pages/contratos';
import { TiposEquipoList } from '../../pages/tipos-equipo';

// ── Bridge: syncs MemoryRouter ↔ TabsContext ↔ browser URL ──
function TabRouterBridge({ tabId, isActive }: { tabId: string; isActive: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { registerTabNavigate, updateTabLocation } = useTabs();

  // Register this tab's navigate function so external code can navigate within it
  useEffect(() => {
    registerTabNavigate(tabId, navigate);
    return () => registerTabNavigate(tabId, null);
  }, [tabId, navigate, registerTabNavigate]);

  // Sync location changes → TabsContext + browser URL (if active)
  useEffect(() => {
    updateTabLocation(tabId, location.pathname, location.search);
    if (isActive) {
      const fullPath = location.pathname + location.search;
      if (window.location.pathname + window.location.search !== fullPath) {
        window.history.replaceState(null, '', fullPath);
      }
    }
  }, [tabId, isActive, location.pathname, location.search, updateTabLocation]);

  return null;
}

// ── All app routes (shared across every tab's MemoryRouter) ──
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/clientes" replace />} />
      {/* Clientes */}
      <Route path="/clientes" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ClientesList /></ProtectedRoute>} />
      <Route path="/clientes/nuevo" element={<Navigate to="/clientes" replace />} />
      <Route path="/clientes/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ClienteDetail /></ProtectedRoute>} />
      {/* Establecimientos */}
      <Route path="/establecimientos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientosList /></ProtectedRoute>} />
      <Route path="/establecimientos/nuevo" element={<Navigate to="/establecimientos" replace />} />
      <Route path="/establecimientos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientoDetail /></ProtectedRoute>} />
      <Route path="/establecimientos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EstablecimientoNew /></ProtectedRoute>} />
      {/* Equipos */}
      <Route path="/equipos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EquiposList /></ProtectedRoute>} />
      <Route path="/equipos/nuevo" element={<Navigate to="/equipos" replace />} />
      <Route path="/equipos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><EquipoDetail /></ProtectedRoute>} />
      <Route path="/categorias-equipo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><CategoriasEquipo /></ProtectedRoute>} />
      {/* Ordenes de Trabajo */}
      <Route path="/ordenes-trabajo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTList /></ProtectedRoute>} />
      <Route path="/ordenes-trabajo/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTNew /></ProtectedRoute>} />
      <Route path="/ordenes-trabajo/:otNumber" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><OTDetail /></ProtectedRoute>} />
      <Route path="/categorias-tipo-servicio" element={<Navigate to="/tipos-servicio" replace />} />
      <Route path="/tipos-servicio" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TiposServicio /></ProtectedRoute>} />
      {/* Leads */}
      <Route path="/leads" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><LeadsList /></ProtectedRoute>} />
      <Route path="/leads/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><LeadDetail /></ProtectedRoute>} />
      {/* Presupuestos */}
      <Route path="/presupuestos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestosList /></ProtectedRoute>} />
      <Route path="/presupuestos/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoNew /></ProtectedRoute>} />
      <Route path="/presupuestos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoDetail /></ProtectedRoute>} />
      <Route path="/presupuestos/categorias" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CategoriasPresupuesto /></ProtectedRoute>} />
      <Route path="/presupuestos/condiciones-pago" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CondicionesPago /></ProtectedRoute>} />
      <Route path="/presupuestos/conceptos-servicio" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ConceptosServicio /></ProtectedRoute>} />
      <Route path="/presupuestos/tipos-equipo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><TiposEquipoList /></ProtectedRoute>} />
      {/* Biblioteca de Tablas */}
      <Route path="/table-catalog" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogPage /></ProtectedRoute>} />
      <Route path="/table-catalog/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogEditorPage /></ProtectedRoute>} />
      <Route path="/table-catalog/:tableId/edit" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><TableCatalogEditorPage /></ProtectedRoute>} />
      <Route path="/table-catalog/migrar-conclusion" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte']}><MigrateRenameConclusion /></ProtectedRoute>} />
      {/* Ingreso a Empresas */}
      <Route path="/ingreso-empresas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><IngresoEmpresasList /></ProtectedRoute>} />
      {/* Dispositivos */}
      <Route path="/dispositivos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><DispositivosList /></ProtectedRoute>} />
      {/* Vehiculos */}
      <Route path="/vehiculos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><VehiculosList /></ProtectedRoute>} />
      <Route path="/vehiculos/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><VehiculoDetail /></ProtectedRoute>} />
      {/* Instrumentos */}
      <Route path="/instrumentos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentosListPage /></ProtectedRoute>} />
      <Route path="/instrumentos/nuevo" element={<Navigate to="/instrumentos" replace />} />
      <Route path="/instrumentos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentoEditorPage /></ProtectedRoute>} />
      {/* Patrones */}
      <Route path="/patrones" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><PatronesListPage /></ProtectedRoute>} />
      <Route path="/patrones/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><PatronEditorPage /></ProtectedRoute>} />
      {/* Columnas */}
      <Route path="/columnas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ColumnasListPage /></ProtectedRoute>} />
      <Route path="/columnas/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ColumnaEditorPage /></ProtectedRoute>} />
      {/* Fichas */}
      <Route path="/fichas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichasList /></ProtectedRoute>} />
      <Route path="/fichas/nuevo" element={<Navigate to="/fichas" replace />} />
      <Route path="/fichas/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichaDetail /></ProtectedRoute>} />
      <Route path="/fichas/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichaEditor /></ProtectedRoute>} />
      {/* Loaners */}
      <Route path="/loaners" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanersList /></ProtectedRoute>} />
      <Route path="/loaners/nuevo" element={<Navigate to="/loaners" replace />} />
      <Route path="/loaners/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerDetail /></ProtectedRoute>} />
      <Route path="/loaners/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerEditor /></ProtectedRoute>} />
      {/* Stock */}
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
      {/* RBAC locked to ['admin', 'admin_soporte'] per 09-RESEARCH.md — planificacion is planner/Comex only */}
      <Route path="/stock/planificacion" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte']}><PlanificacionStockPage /></ProtectedRoute>} />
      <Route path="/stock/asignaciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionRapidaPage /></ProtectedRoute>} />
      <Route path="/stock/asignaciones/historial" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionesList /></ProtectedRoute>} />
      <Route path="/stock/asignaciones/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionDetail /></ProtectedRoute>} />
      {/* Usuarios */}
      <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><UsuariosList /></ProtectedRoute>} />
      {/* Agenda */}
      <Route path="/agenda" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><AgendaPage /></ProtectedRoute>} />
      <Route path="/pendientes" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><PendientesList /></ProtectedRoute>} />
      {/* Facturacion */}
      <Route path="/facturacion" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><FacturacionList /></ProtectedRoute>} />
      <Route path="/facturacion/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><FacturacionDetail /></ProtectedRoute>} />
      {/* Contratos */}
      <Route path="/contratos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><ContratosList /></ProtectedRoute>} />
      <Route path="/contratos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><ContratoDetail /></ProtectedRoute>} />
      {/* Admin */}
      <Route path="/admin/importar" element={<ProtectedRoute allowedRoles={['admin']}><ImportacionDatos /></ProtectedRoute>} />
      <Route path="/admin/revision-clienteid" element={<ProtectedRoute allowedRoles={['admin']}><RevisionClienteIdPage /></ProtectedRoute>} />
      <Route path="/admin/modulos" element={<ProtectedRoute allowedRoles={['admin']}><ModulosAdminPage /></ProtectedRoute>} />
      <Route path="/admin/config-flujos" element={<ProtectedRoute allowedRoles={['admin']}><ConfigFlujosPage /></ProtectedRoute>} />
      <Route path="/admin/acciones-pendientes" element={<ProtectedRoute allowedRoles={['admin']}><AccionesPendientesPage /></ProtectedRoute>} />
      <Route path="/admin/relinkear-articulos" element={<ProtectedRoute allowedRoles={['admin']}><RelinkearArticulosPage /></ProtectedRoute>} />
    </Routes>
  );
}

/**
 * Renders ALL open tabs simultaneously, each inside its own MemoryRouter.
 * Inactive tabs are hidden with display:none — components stay mounted,
 * preserving forms, scroll position, and local state (Chrome-like tabs).
 */
export function TabContentManager() {
  const { tabs, activeTabId } = useTabs();

  return (
    <>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className="h-full"
          style={{ display: tab.id === activeTabId ? undefined : 'none' }}
        >
          <MemoryRouter initialEntries={[tab.path]}>
            <TabRouterBridge tabId={tab.id} isActive={tab.id === activeTabId} />
            <AppRoutes />
          </MemoryRouter>
        </div>
      ))}
    </>
  );
}
