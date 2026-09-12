import { lazy, Suspense, useEffect, useRef } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTabs } from '../../contexts/TabsContext';
import { TabOverlayScope } from '../../contexts/TabOverlayContext';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { useLandingPath } from './navigation';
import { LoadingState } from '../ui/LoadingState';
import { marcarPantalla } from '../../utils/perfReads';

// ── Páginas a demanda (2026-09-11, fase 1 de .claude/plans/performance.md) ──
// Cada módulo (carpeta de pages/) es un chunk propio que se baja recién al
// abrir una ruta suya. Antes las 33 carpetas se importaban estáticas y el
// bundle principal pesaba 4,6 MB de JS a parsear antes del primer render.
type PageMod<T> = { default: T };
/** Cargadores de todos los módulos, para precalentarlos cuando la app queda ociosa. */
const CARGADORES: Array<() => Promise<unknown>> = [];
const pagina = <T,>(load: () => Promise<T>) => {
  CARGADORES.push(load);
  return lazy(() => load().then(c => ({ default: c })) as Promise<PageMod<any>>);
};

/**
 * Precarga en segundo plano (2026-09-11). React Router v7 navega dentro de una
 * transición: mientras baja el chunk de la página nueva deja la vieja en
 * pantalla, y el clic en un módulo "no hacía nada" hasta que el archivo
 * estaba. Con la precarga, el arranque sigue liviano (solo lo que se ve) y
 * cuando el usuario hace clic el módulo ya está en memoria. Se dispara cuando
 * el navegador está ocioso, de a uno, para no competir con la pantalla activa.
 * En dev además calienta la compilación de Vite sin bloquear.
 */
let precargaLanzada = false;
export function precargarModulosEnIdle(): void {
  if (precargaLanzada || typeof window === 'undefined') return;
  precargaLanzada = true;
  const pendientes = [...CARGADORES];
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window ? (window as any).requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300);
  const siguiente = () => {
    const load = pendientes.shift();
    if (!load) return;
    load().catch(() => undefined).finally(() => idle(siguiente));
  };
  // Arranca recién cuando la primera pantalla ya se pintó.
  setTimeout(() => idle(siguiente), 1500);
}
const NotFoundPage = pagina(() => import('../../pages/auth').then(m => m.NotFoundPage));
const LeadsList = pagina(() => import('../../pages/leads').then(m => m.LeadsList));
const LeadDetail = pagina(() => import('../../pages/leads').then(m => m.LeadDetail));
const ClientesList = pagina(() => import('../../pages/clientes').then(m => m.ClientesList));
const ClienteDetail = pagina(() => import('../../pages/clientes').then(m => m.ClienteDetail));
const EstablecimientosList = pagina(() => import('../../pages/establecimientos').then(m => m.EstablecimientosList));
const EstablecimientoNew = pagina(() => import('../../pages/establecimientos').then(m => m.EstablecimientoNew));
const EstablecimientoDetail = pagina(() => import('../../pages/establecimientos').then(m => m.EstablecimientoDetail));
const EquiposList = pagina(() => import('../../pages/equipos').then(m => m.EquiposList));
const EquipoDetail = pagina(() => import('../../pages/equipos').then(m => m.EquipoDetail));
const CategoriasEquipo = pagina(() => import('../../pages/equipos').then(m => m.CategoriasEquipo));
const OTList = pagina(() => import('../../pages/ordenes-trabajo').then(m => m.OTList));
const OTNew = pagina(() => import('../../pages/ordenes-trabajo').then(m => m.OTNew));
const OTDetail = pagina(() => import('../../pages/ordenes-trabajo').then(m => m.OTDetail));
const TiposServicio = pagina(() => import('../../pages/ordenes-trabajo').then(m => m.TiposServicio));
const PresupuestosList = pagina(() => import('../../pages/presupuestos').then(m => m.PresupuestosList));
const PresupuestoNew = pagina(() => import('../../pages/presupuestos').then(m => m.PresupuestoNew));
const PresupuestoDetail = pagina(() => import('../../pages/presupuestos').then(m => m.PresupuestoDetail));
const CategoriasPresupuesto = pagina(() => import('../../pages/presupuestos').then(m => m.CategoriasPresupuesto));
const CondicionesPago = pagina(() => import('../../pages/presupuestos').then(m => m.CondicionesPago));
const ConceptosServicio = pagina(() => import('../../pages/presupuestos').then(m => m.ConceptosServicio));
const AnaliticaPresupuestos = pagina(() => import('../../pages/presupuestos').then(m => m.AnaliticaPresupuestos));
const TableCatalogPage = pagina(() => import('../../pages/protocol-catalog').then(m => m.TableCatalogPage));
const TableCatalogEditorPage = pagina(() => import('../../pages/protocol-catalog').then(m => m.TableCatalogEditorPage));
const MigrateRenameConclusion = pagina(() => import('../../pages/protocol-catalog').then(m => m.MigrateRenameConclusion));
const InstrumentosList = pagina(() => import('../../pages/instrumentos').then(m => m.InstrumentosList));
const InstrumentoEditorPage = pagina(() => import('../../pages/instrumentos').then(m => m.InstrumentoEditorPage));
const PatronesList = pagina(() => import('../../pages/patrones').then(m => m.PatronesList));
const PatronEditorPage = pagina(() => import('../../pages/patrones').then(m => m.PatronEditorPage));
const ColumnasList = pagina(() => import('../../pages/columnas').then(m => m.ColumnasList));
const ColumnaEditorPage = pagina(() => import('../../pages/columnas').then(m => m.ColumnaEditorPage));
const FichasList = pagina(() => import('../../pages/fichas').then(m => m.FichasList));
const FichaDetail = pagina(() => import('../../pages/fichas').then(m => m.FichaDetail));
const LoanersList = pagina(() => import('../../pages/loaners').then(m => m.LoanersList));
const LoanerEditor = pagina(() => import('../../pages/loaners').then(m => m.LoanerEditor));
const LoanerDetail = pagina(() => import('../../pages/loaners').then(m => m.LoanerDetail));
const StockHome = pagina(() => import('../../pages/stock').then(m => m.StockHome));
const MarcasPage = pagina(() => import('../../pages/stock').then(m => m.MarcasPage));
const IngenierosPage = pagina(() => import('../../pages/stock').then(m => m.IngenierosPage));
const ProveedoresPage = pagina(() => import('../../pages/stock').then(m => m.ProveedoresPage));
const PosicionesPage = pagina(() => import('../../pages/stock').then(m => m.PosicionesPage));
const ArticulosList = pagina(() => import('../../pages/stock').then(m => m.ArticulosList));
const ArticuloEditor = pagina(() => import('../../pages/stock').then(m => m.ArticuloEditor));
const ArticuloDetail = pagina(() => import('../../pages/stock').then(m => m.ArticuloDetail));
const UnidadesList = pagina(() => import('../../pages/stock').then(m => m.UnidadesList));
const MinikitsList = pagina(() => import('../../pages/stock').then(m => m.MinikitsList));
const MinikitDetail = pagina(() => import('../../pages/stock').then(m => m.MinikitDetail));
const MinikitFaltantesPage = pagina(() => import('../../pages/stock').then(m => m.MinikitFaltantesPage));
const MovimientosPage = pagina(() => import('../../pages/stock').then(m => m.MovimientosPage));
const ConsumosPage = pagina(() => import('../../pages/stock').then(m => m.ConsumosPage));
const RemitosList = pagina(() => import('../../pages/stock').then(m => m.RemitosList));
const RemitoDetail = pagina(() => import('../../pages/stock').then(m => m.RemitoDetail));
const AlertasStockPage = pagina(() => import('../../pages/stock').then(m => m.AlertasStockPage));
const PosicionesArancelariasPage = pagina(() => import('../../pages/stock').then(m => m.PosicionesArancelariasPage));
const ProveedorDetail = pagina(() => import('../../pages/stock').then(m => m.ProveedorDetail));
const RequerimientosList = pagina(() => import('../../pages/stock').then(m => m.RequerimientosList));
const OCList = pagina(() => import('../../pages/stock').then(m => m.OCList));
const OCEditor = pagina(() => import('../../pages/stock').then(m => m.OCEditor));
const OCDetail = pagina(() => import('../../pages/stock').then(m => m.OCDetail));
const ImportacionesList = pagina(() => import('../../pages/stock').then(m => m.ImportacionesList));
const PagosVEPPage = pagina(() => import('../../pages/stock').then(m => m.PagosVEPPage));
const ImportacionEditor = pagina(() => import('../../pages/stock').then(m => m.ImportacionEditor));
const ImportacionDetail = pagina(() => import('../../pages/stock').then(m => m.ImportacionDetail));
const AsignacionesVistaPage = pagina(() => import('../../pages/stock').then(m => m.AsignacionesVistaPage));
const AsignacionesList = pagina(() => import('../../pages/stock').then(m => m.AsignacionesList));
const AsignacionDetail = pagina(() => import('../../pages/stock').then(m => m.AsignacionDetail));
const InventarioIngenieroPage = pagina(() => import('../../pages/stock').then(m => m.InventarioIngenieroPage));
const PlanificacionStockPage = pagina(() => import('../../pages/stock').then(m => m.PlanificacionStockPage));
const IngresoEmpresasList = pagina(() => import('../../pages/ingreso-empresas').then(m => m.IngresoEmpresasList));
const DispositivosList = pagina(() => import('../../pages/dispositivos').then(m => m.DispositivosList));
const VehiculosList = pagina(() => import('../../pages/vehiculos').then(m => m.VehiculosList));
const VehiculoDetail = pagina(() => import('../../pages/vehiculos').then(m => m.VehiculoDetail));
const UsuariosList = pagina(() => import('../../pages/usuarios').then(m => m.UsuariosList));
const ImportacionDatos = pagina(() => import('../../pages/admin').then(m => m.ImportacionDatos));
const RevisionClienteIdPage = pagina(() => import('../../pages/admin').then(m => m.RevisionClienteIdPage));
const ModulosAdminPage = pagina(() => import('../../pages/admin').then(m => m.ModulosAdminPage));
const ConfigFlujosPage = pagina(() => import('../../pages/admin').then(m => m.ConfigFlujosPage));
const AccionesPendientesPage = pagina(() => import('../../pages/admin').then(m => m.AccionesPendientesPage));
const RelinkearArticulosPage = pagina(() => import('../../pages/admin').then(m => m.RelinkearArticulosPage));
const BackfillTicketNumerosPage = pagina(() => import('../../pages/admin').then(m => m.BackfillTicketNumerosPage));
const BackfillClienteIdsPage = pagina(() => import('../../pages/admin').then(m => m.BackfillClienteIdsPage));
const BackfillResponsablesPage = pagina(() => import('../../pages/admin').then(m => m.BackfillResponsablesPage));
const BackfillVentasInsumosDerivadorPage = pagina(() => import('../../pages/admin').then(m => m.BackfillVentasInsumosDerivadorPage));
const AuditoriaPage = pagina(() => import('../../pages/admin').then(m => m.AuditoriaPage));
const AgendaPage = pagina(() => import('../../pages/agenda').then(m => m.AgendaPage));
const ControlSemanal = pagina(() => import('../../pages/control-semanal').then(m => m.ControlSemanal));
const CierresSemanalesList = pagina(() => import('../../pages/control-semanal/CierresSemanalesList').then(m => m.CierresSemanalesList));
const PendientesList = pagina(() => import('../../pages/pendientes').then(m => m.PendientesList));
const FacturacionList = pagina(() => import('../../pages/facturacion').then(m => m.FacturacionList));
const FacturacionDetail = pagina(() => import('../../pages/facturacion').then(m => m.FacturacionDetail));
const PendientesDocumentacionPage = pagina(() => import('../../pages/facturacion').then(m => m.PendientesDocumentacionPage));
const CuotasPorFacturarPage = pagina(() => import('../../pages/facturacion').then(m => m.CuotasPorFacturarPage));
const ControlFacturasList = pagina(() => import('../../pages/control-facturas').then(m => m.ControlFacturasList));
const CalificacionesList = pagina(() => import('../../pages/calificacion-proveedores').then(m => m.CalificacionesList));
const ContratosList = pagina(() => import('../../pages/contratos').then(m => m.ContratosList));
const ContratoDetail = pagina(() => import('../../pages/contratos').then(m => m.ContratoDetail));
const TiposEquipoList = pagina(() => import('../../pages/tipos-equipo').then(m => m.TiposEquipoList));
const ConsumiblesPorModuloList = pagina(() => import('../../pages/consumibles-por-modulo').then(m => m.ConsumiblesPorModuloList));
const QFDocumentosList = pagina(() => import('../../pages/qf-documentos').then(m => m.QFDocumentosList));
const NuevaPestanaPage = pagina(() => import('../../pages/nueva-pestana').then(m => m.NuevaPestanaPage));
const DashboardPage = pagina(() => import('../../pages/dashboard').then(m => m.DashboardPage));
const EntregasList = pagina(() => import('../../pages/entregas').then(m => m.EntregasList));

// ── Bridge: syncs MemoryRouter ↔ TabsContext ↔ browser URL ──
function TabRouterBridge({ tabId, isActive }: { tabId: string; isActive: boolean }) {
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const location = useLocation();
  const { registerTabNavigate, registerTabGoBack, updateTabLocation } = useTabs();

  // Register this tab's navigate function so external code can navigate within it
  useEffect(() => {
    registerTabNavigate(tabId, navigate);
    return () => registerTabNavigate(tabId, null);
  }, [tabId, navigate, registerTabNavigate]);

  // Register this tab's goBack (state.from → navigate(-1) → module-root fallback)
  // so global shortcuts (Escape) can trigger the same back behavior as the
  // header arrow button.
  useEffect(() => {
    registerTabGoBack(tabId, goBack);
    return () => registerTabGoBack(tabId, null);
  }, [tabId, goBack, registerTabGoBack]);

  // Sync location changes → TabsContext + browser URL (if active)
  useEffect(() => {
    updateTabLocation(tabId, location.pathname, location.search);
    if (isActive) {
      // Bucket de medición por pantalla (fase 0 de performance.md).
      marcarPantalla(location.pathname);
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
  // Landing según permisos del usuario (no hardcodeado a /clientes): también es
  // el destino del botón "Volver al inicio" de AccessDeniedPage.
  const landing = useLandingPath();
  return (
    <Suspense fallback={<LoadingState message="Cargando módulo…" />}>
    <Routes>
      <Route path="/" element={<Navigate to={landing} replace />} />
      {/* Pestaña nueva (el "+" de la barra de pestañas) — sin gate: lo que lista
          adentro ya viene filtrado por permisos. */}
      <Route path="/nueva-pestana" element={<NuevaPestanaPage />} />
      {/* Dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'admin_ing_soporte']}><DashboardPage /></ProtectedRoute>} />
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
      {/* Analítica: visible para todos los roles por ahora (decisión 2026-07-17);
          para restringir a dirección, agregar allowedRoles={['admin']} acá. */}
      <Route path="/presupuestos/analitica" element={<ProtectedRoute><AnaliticaPresupuestos /></ProtectedRoute>} />
      <Route path="/presupuestos/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoNew /></ProtectedRoute>} />
      <Route path="/presupuestos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PresupuestoDetail /></ProtectedRoute>} />
      <Route path="/presupuestos/categorias" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CategoriasPresupuesto /></ProtectedRoute>} />
      <Route path="/presupuestos/condiciones-pago" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CondicionesPago /></ProtectedRoute>} />
      <Route path="/presupuestos/conceptos-servicio" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ConceptosServicio /></ProtectedRoute>} />
      <Route path="/presupuestos/tipos-equipo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><TiposEquipoList /></ProtectedRoute>} />
      <Route path="/presupuestos/consumibles-por-modulo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ConsumiblesPorModuloList /></ProtectedRoute>} />
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
      <Route path="/instrumentos" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentosList /></ProtectedRoute>} />
      <Route path="/instrumentos/nuevo" element={<Navigate to="/instrumentos" replace />} />
      <Route path="/instrumentos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><InstrumentoEditorPage /></ProtectedRoute>} />
      {/* Patrones */}
      <Route path="/patrones" element={<ProtectedRoute modulo="patrones"><PatronesList /></ProtectedRoute>} />
      <Route path="/patrones/:id/editar" element={<ProtectedRoute modulo="patrones"><PatronEditorPage /></ProtectedRoute>} />
      {/* Columnas */}
      <Route path="/columnas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ColumnasList /></ProtectedRoute>} />
      <Route path="/columnas/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><ColumnaEditorPage /></ProtectedRoute>} />
      {/* Fichas — edición es modal desde FichaDetail (política del sistema) */}
      <Route path="/fichas" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichasList /></ProtectedRoute>} />
      <Route path="/fichas/nuevo" element={<Navigate to="/fichas" replace />} />
      <Route path="/fichas/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><FichaDetail /></ProtectedRoute>} />
      <Route path="/fichas/:id/editar" element={<Navigate to="/fichas/:id" replace />} />
      {/* Loaners */}
      <Route path="/loaners" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanersList /></ProtectedRoute>} />
      <Route path="/loaners/nuevo" element={<Navigate to="/loaners" replace />} />
      <Route path="/loaners/:id" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerDetail /></ProtectedRoute>} />
      <Route path="/loaners/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><LoanerEditor /></ProtectedRoute>} />
      {/* Stock */}
      <Route path="/stock" element={<StockHome />} />
      <Route path="/stock/articulos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticulosList /></ProtectedRoute>} />
      <Route path="/stock/articulos/nuevo" element={<Navigate to="/stock/articulos" replace />} />
      <Route path="/stock/articulos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticuloDetail /></ProtectedRoute>} />
      <Route path="/stock/articulos/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ArticuloEditor /></ProtectedRoute>} />
      <Route path="/stock/unidades" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><UnidadesList /></ProtectedRoute>} />
      <Route path="/stock/minikits" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitsList /></ProtectedRoute>} />
      <Route path="/stock/minikits/faltantes" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitFaltantesPage /></ProtectedRoute>} />
      <Route path="/stock/minikits/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MinikitDetail /></ProtectedRoute>} />
      <Route path="/stock/remitos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RemitosList /></ProtectedRoute>} />
      <Route path="/stock/remitos/nuevo" element={<Navigate to="/stock/remitos" replace />} />
      <Route path="/stock/remitos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RemitoDetail /></ProtectedRoute>} />
      <Route path="/stock/movimientos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><MovimientosPage /></ProtectedRoute>} />
      <Route path="/stock/consumos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ConsumosPage /></ProtectedRoute>} />
      <Route path="/stock/alertas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AlertasStockPage /></ProtectedRoute>} />
      <Route path="/stock/requerimientos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RequerimientosList /></ProtectedRoute>} />
      <Route path="/stock/requerimientos/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><RequerimientosList /></ProtectedRoute>} />
      <Route path="/stock/ordenes-compra" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCList /></ProtectedRoute>} />
      <Route path="/stock/ordenes-compra/nuevo" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCEditor /></ProtectedRoute>} />
      <Route path="/stock/ordenes-compra/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCDetail /></ProtectedRoute>} />
      <Route path="/stock/ordenes-compra/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><OCEditor /></ProtectedRoute>} />
      <Route path="/stock/importaciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><ImportacionesList /></ProtectedRoute>} />
      <Route path="/stock/pagos-vep" element={<ProtectedRoute modulo="pagos"><PagosVEPPage /></ProtectedRoute>} />
      <Route path="/entregas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><EntregasList /></ProtectedRoute>} />
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
      <Route path="/stock/asignaciones" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionesVistaPage /></ProtectedRoute>} />
      <Route path="/stock/asignaciones/historial" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionesList /></ProtectedRoute>} />
      <Route path="/stock/asignaciones/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><AsignacionDetail /></ProtectedRoute>} />
      {/* Usuarios */}
      <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><UsuariosList /></ProtectedRoute>} />
      {/* Agenda */}
      <Route path="/agenda" element={<ProtectedRoute allowedRoles={['admin', 'ingeniero_soporte', 'admin_soporte']}><AgendaPage /></ProtectedRoute>} />
      {/* Control semanal — cierre de coordinación (agenda + avisos a facturación) */}
      {/* Gate por MÓDULO, no por rol (2026-08-21): era la única pantalla de
          Operaciones sin `modulo`, así que no aparecía en el detalle de permisos
          y el acceso solo se podía mover cambiándole el rol a la persona. */}
      <Route path="/control-semanal" element={<ProtectedRoute modulo="control-semanal"><ControlSemanal /></ProtectedRoute>} />
      <Route path="/control-semanal/cierres" element={<ProtectedRoute modulo="control-semanal"><CierresSemanalesList /></ProtectedRoute>} />
      <Route path="/pendientes" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><PendientesList /></ProtectedRoute>} />
      {/* Facturacion */}
      <Route path="/facturacion" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><FacturacionList /></ProtectedRoute>} />
      <Route path="/facturacion/pendientes-documentacion" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><PendientesDocumentacionPage /></ProtectedRoute>} />
      <Route path="/facturacion/cuotas-por-facturar" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><CuotasPorFacturarPage /></ProtectedRoute>} />
      <Route path="/facturacion/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><FacturacionDetail /></ProtectedRoute>} />
      {/* Contratos */}
      <Route path="/contratos" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><ContratosList /></ProtectedRoute>} />
      <Route path="/contratos/:id" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'admin_ing_soporte']}><ContratoDetail /></ProtectedRoute>} />
      {/* Control de facturas */}
      <Route path="/control-facturas" element={<ProtectedRoute modulo="control-facturas"><ControlFacturasList /></ProtectedRoute>} />
      {/* Calificación de proveedores */}
      <Route path="/calificacion-proveedores" element={<ProtectedRoute modulo="calificacion-proveedores"><CalificacionesList /></ProtectedRoute>} />
      {/* Documentos QF — visible para todos los usuarios autenticados */}
      <Route path="/qf-documentos" element={<ProtectedRoute><QFDocumentosList /></ProtectedRoute>} />
      {/* Admin */}
      <Route path="/admin/auditoria" element={<ProtectedRoute allowedRoles={['admin']}><AuditoriaPage /></ProtectedRoute>} />
      <Route path="/admin/importar" element={<ProtectedRoute allowedRoles={['admin']}><ImportacionDatos /></ProtectedRoute>} />
      <Route path="/admin/revision-clienteid" element={<ProtectedRoute allowedRoles={['admin']}><RevisionClienteIdPage /></ProtectedRoute>} />
      <Route path="/admin/modulos" element={<ProtectedRoute allowedRoles={['admin']}><ModulosAdminPage /></ProtectedRoute>} />
      <Route path="/admin/config-flujos" element={<ProtectedRoute allowedRoles={['admin']}><ConfigFlujosPage /></ProtectedRoute>} />
      <Route path="/admin/acciones-pendientes" element={<ProtectedRoute allowedRoles={['admin']}><AccionesPendientesPage /></ProtectedRoute>} />
      <Route path="/admin/relinkear-articulos" element={<ProtectedRoute allowedRoles={['admin']}><RelinkearArticulosPage /></ProtectedRoute>} />
      <Route path="/admin/backfill-ticket-numeros" element={<ProtectedRoute allowedRoles={['admin']}><BackfillTicketNumerosPage /></ProtectedRoute>} />
      <Route path="/admin/backfill-cliente-ids" element={<ProtectedRoute allowedRoles={['admin']}><BackfillClienteIdsPage /></ProtectedRoute>} />
      <Route path="/admin/backfill-responsables" element={<ProtectedRoute allowedRoles={['admin']}><BackfillResponsablesPage /></ProtectedRoute>} />
      <Route path="/admin/backfill-ventas-insumos-derivador" element={<ProtectedRoute allowedRoles={['admin']}><BackfillVentasInsumosDerivadorPage /></ProtectedRoute>} />
      {/* Catch-all: render inline como AccessDeniedPage (sin redirect — cada tab tiene su MemoryRouter) */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

/**
 * Renders open tabs, each inside its own MemoryRouter. Inactive tabs are
 * hidden with display:none — components stay mounted, preserving forms,
 * scroll position, and local state (Chrome-like tabs).
 *
 * Montaje diferido (2026-09-11, fase 2 de performance): una pestaña se monta
 * la PRIMERA vez que se activa, no al arrancar. Las pestañas restauradas al
 * abrir la app (agenda, OTs, planificación…) cargaban todas sus colecciones a
 * la vez sobre la pantalla de login; ahora solo carga la activa y el resto al
 * clickearla. Una vez montada queda montada, como antes.
 */
export function TabContentManager() {
  const { tabs, activeTabId } = useTabs();
  useEffect(() => { precargarModulosEnIdle(); }, []);
  const montadas = useRef(new Set<string>());
  montadas.current.add(activeTabId);
  const abiertas = new Set(tabs.map(t => t.id));
  for (const id of montadas.current) if (!abiertas.has(id)) montadas.current.delete(id);

  return (
    <>
      {tabs.filter(tab => montadas.current.has(tab.id)).map(tab => (
        <TabOverlayScope key={tab.id} isTabActive={tab.id === activeTabId}>
          <MemoryRouter initialEntries={[tab.path]}>
            <TabRouterBridge tabId={tab.id} isActive={tab.id === activeTabId} />
            <AppRoutes />
          </MemoryRouter>
        </TabOverlayScope>
      ))}
    </>
  );
}
