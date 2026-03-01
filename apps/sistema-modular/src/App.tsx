import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LeadsList, LeadDetail } from './pages/leads';
import { ClientesList, ClienteDetail } from './pages/clientes';
import { EstablecimientosList, EstablecimientoNew, EstablecimientoDetail } from './pages/establecimientos';
import { EquiposList, EquipoDetail, EquipoNew, CategoriasEquipo } from './pages/equipos';
import { OTList, OTNew, OTDetail, TiposServicio } from './pages/ordenes-trabajo';
import { PresupuestosList, PresupuestoDetail, CategoriasPresupuesto, CondicionesPago } from './pages/presupuestos';
import { TableCatalogPage, TableCatalogEditorPage } from './pages/protocol-catalog';
import { InstrumentosListPage, InstrumentoEditorPage } from './pages/instrumentos';
import { FichasList, FichaEditor, FichaDetail } from './pages/fichas';
import { LoanersList, LoanerEditor, LoanerDetail } from './pages/loaners';
import { MarcasPage, IngenierosPage, ProveedoresPage, PosicionesPage, ArticulosList, ArticuloEditor, ArticuloDetail, UnidadesList, MinikitsList, MinikitDetail, MovimientosPage, RemitosList, RemitoEditor, RemitoDetail, AlertasStockPage } from './pages/stock';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          {/* Clientes */}
          <Route path="/clientes" element={<ClientesList />} />
          <Route path="/clientes/nuevo" element={<Navigate to="/clientes" replace />} />
          <Route path="/clientes/:id" element={<ClienteDetail />} />
          {/* Establecimientos */}
          <Route path="/establecimientos" element={<EstablecimientosList />} />
          <Route path="/establecimientos/nuevo" element={<Navigate to="/establecimientos" replace />} />
          <Route path="/establecimientos/:id" element={<EstablecimientoDetail />} />
          <Route path="/establecimientos/:id/editar" element={<EstablecimientoNew />} />
          {/* Equipos */}
          <Route path="/equipos" element={<EquiposList />} />
          <Route path="/equipos/nuevo" element={<Navigate to="/equipos" replace />} />
          <Route path="/equipos/:id" element={<EquipoDetail />} />
          <Route path="/categorias-equipo" element={<CategoriasEquipo />} />
          {/* Órdenes de Trabajo */}
          <Route path="/ordenes-trabajo" element={<OTList />} />
          <Route path="/ordenes-trabajo/nuevo" element={<Navigate to="/ordenes-trabajo" replace />} />
          <Route path="/ordenes-trabajo/:otNumber" element={<OTDetail />} />
          {/* Redirección de ruta antigua a nueva */}
          <Route path="/categorias-tipo-servicio" element={<Navigate to="/tipos-servicio" replace />} />
          <Route path="/tipos-servicio" element={<TiposServicio />} />
          {/* Leads */}
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/nuevo" element={<Navigate to="/leads" replace />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          {/* Presupuestos */}
          <Route path="/presupuestos" element={<PresupuestosList />} />
          <Route path="/presupuestos/nuevo" element={<Navigate to="/presupuestos" replace />} />
          <Route path="/presupuestos/:id" element={<PresupuestoDetail />} />
          <Route path="/presupuestos/categorias" element={<CategoriasPresupuesto />} />
          <Route path="/presupuestos/condiciones-pago" element={<CondicionesPago />} />
          {/* Biblioteca de Tablas */}
          <Route path="/table-catalog" element={<TableCatalogPage />} />
          <Route path="/table-catalog/nuevo" element={<TableCatalogEditorPage />} />
          <Route path="/table-catalog/:tableId/edit" element={<TableCatalogEditorPage />} />
          {/* Instrumentos */}
          <Route path="/instrumentos" element={<InstrumentosListPage />} />
          <Route path="/instrumentos/nuevo" element={<Navigate to="/instrumentos" replace />} />
          <Route path="/instrumentos/:id/editar" element={<InstrumentoEditorPage />} />
          {/* Fichas Propiedad del Cliente */}
          <Route path="/fichas" element={<FichasList />} />
          <Route path="/fichas/nuevo" element={<Navigate to="/fichas" replace />} />
          <Route path="/fichas/:id" element={<FichaDetail />} />
          <Route path="/fichas/:id/editar" element={<FichaEditor />} />
          {/* Loaners */}
          <Route path="/loaners" element={<LoanersList />} />
          <Route path="/loaners/nuevo" element={<Navigate to="/loaners" replace />} />
          <Route path="/loaners/:id" element={<LoanerDetail />} />
          <Route path="/loaners/:id/editar" element={<LoanerEditor />} />
          {/* Stock */}
          <Route path="/stock" element={<Navigate to="/stock/articulos" replace />} />
          <Route path="/stock/articulos" element={<ArticulosList />} />
          <Route path="/stock/articulos/nuevo" element={<Navigate to="/stock/articulos" replace />} />
          <Route path="/stock/articulos/:id" element={<ArticuloDetail />} />
          <Route path="/stock/articulos/:id/editar" element={<ArticuloEditor />} />
          <Route path="/stock/unidades" element={<UnidadesList />} />
          <Route path="/stock/minikits" element={<MinikitsList />} />
          <Route path="/stock/minikits/:id" element={<MinikitDetail />} />
          <Route path="/stock/remitos" element={<RemitosList />} />
          <Route path="/stock/remitos/nuevo" element={<Navigate to="/stock/remitos" replace />} />
          <Route path="/stock/remitos/:id" element={<RemitoDetail />} />
          <Route path="/stock/movimientos" element={<MovimientosPage />} />
          <Route path="/stock/alertas" element={<AlertasStockPage />} />
          <Route path="/stock/ingenieros" element={<IngenierosPage />} />
          <Route path="/stock/proveedores" element={<ProveedoresPage />} />
          <Route path="/stock/posiciones" element={<PosicionesPage />} />
          <Route path="/stock/marcas" element={<MarcasPage />} />
          <Route path="/agenda" element={<div className="text-center py-12"><p className="text-slate-400">Agenda - Próximamente</p></div>} />
          <Route path="/facturacion" element={<div className="text-center py-12"><p className="text-slate-400">Facturación - Próximamente</p></div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
