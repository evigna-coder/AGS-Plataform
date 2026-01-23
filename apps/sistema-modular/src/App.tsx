import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LeadsList, LeadNew, LeadDetail } from './pages/leads';
import { ClientesList, ClienteNew, ClienteDetail } from './pages/clientes';
import { EquiposList, EquipoDetail, EquipoNew, CategoriasEquipo } from './pages/equipos';

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
          {/* Leads */}
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/nuevo" element={<LeadNew />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          {/* Otros módulos */}
          <Route path="/presupuestos" element={<div className="text-center py-12"><p className="text-slate-400">Presupuestos - Próximamente</p></div>} />
          <Route path="/stock" element={<div className="text-center py-12"><p className="text-slate-400">Stock - Próximamente</p></div>} />
          <Route path="/agenda" element={<div className="text-center py-12"><p className="text-slate-400">Agenda - Próximamente</p></div>} />
          <Route path="/facturacion" element={<div className="text-center py-12"><p className="text-slate-400">Facturación - Próximamente</p></div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
