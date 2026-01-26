import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LeadsList, LeadNew, LeadDetail } from './pages/leads';
import { ClientesList, ClienteNew, ClienteDetail } from './pages/clientes';
import { EquiposList, EquipoDetail, EquipoNew, CategoriasEquipo } from './pages/equipos';
import { OTList, OTNew, OTDetail, TiposServicio } from './pages/ordenes-trabajo';
import { PresupuestosList, PresupuestoNew, PresupuestoDetail, CategoriasPresupuesto, CondicionesPago } from './pages/presupuestos';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          {/* Clientes */}
          <Route path="/clientes" element={<ClientesList />} />
          <Route path="/clientes/nuevo" element={<ClienteNew />} />
          <Route path="/clientes/:id" element={<ClienteDetail />} />
          {/* Equipos */}
          <Route path="/equipos" element={<EquiposList />} />
          <Route path="/equipos/nuevo" element={<EquipoNew />} />
          <Route path="/equipos/:id" element={<EquipoDetail />} />
          <Route path="/categorias-equipo" element={<CategoriasEquipo />} />
          {/* Órdenes de Trabajo */}
          <Route path="/ordenes-trabajo" element={<OTList />} />
          <Route path="/ordenes-trabajo/nuevo" element={<OTNew />} />
          <Route path="/ordenes-trabajo/:otNumber" element={<OTDetail />} />
          {/* Redirección de ruta antigua a nueva */}
          <Route path="/categorias-tipo-servicio" element={<Navigate to="/tipos-servicio" replace />} />
          <Route path="/tipos-servicio" element={<TiposServicio />} />
          {/* Leads */}
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/nuevo" element={<LeadNew />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          {/* Presupuestos */}
          <Route path="/presupuestos" element={<PresupuestosList />} />
          <Route path="/presupuestos/nuevo" element={<PresupuestoNew />} />
          <Route path="/presupuestos/:id" element={<PresupuestoDetail />} />
          <Route path="/presupuestos/categorias" element={<CategoriasPresupuesto />} />
          <Route path="/presupuestos/condiciones-pago" element={<CondicionesPago />} />
          <Route path="/stock" element={<div className="text-center py-12"><p className="text-slate-400">Stock - Próximamente</p></div>} />
          <Route path="/agenda" element={<div className="text-center py-12"><p className="text-slate-400">Agenda - Próximamente</p></div>} />
          <Route path="/facturacion" element={<div className="text-center py-12"><p className="text-slate-400">Facturación - Próximamente</p></div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
