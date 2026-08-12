import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { IngenieroCard } from '../../components/stock/IngenieroCard';
import { AsignarMaterialModal } from '../../components/stock/AsignarMaterialModal';
import { InventarioIngenieroModal } from '../../components/stock/InventarioIngenieroModal';
import { useAsignacionesVista } from '../../hooks/useAsignacionesVista';

/**
 * Vista principal de Asignaciones (rediseño 2026-08-11): jerarquía invertida —
 * lo primero es QUÉ TIENE cada ingeniero (grilla de cards); el acto de asignar
 * (drag & drop con buscadores) vive detrás de "+ Asignar material" como modal.
 */
export const AsignacionesVistaPage = () => {
  const { loading, cards, kpis, search, setSearch, searchActive, loadData } = useAsignacionesVista();
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [asignarDestacadoId, setAsignarDestacadoId] = useState<string | null>(null);
  const [inventarioIngId, setInventarioIngId] = useState<string | null>(null);

  const abrirAsignar = (ingenieroId: string | null = null) => {
    setAsignarDestacadoId(ingenieroId);
    setAsignarOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Asignaciones" subtitle="Material en poder de cada ingeniero"
        actions={
          <>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
              placeholder="¿Quién tiene…? código, descripción, serie, lote" />
            <Button size="sm" onClick={() => abrirAsignar()}>+ Asignar material</Button>
          </>
        } />

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><p className="text-xs text-slate-400">Cargando...</p></div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Items en campo" value={kpis.itemsEnCampo} />
            <Kpi label="IST con material" value={`${kpis.conMaterial} / ${kpis.totalIngenieros}`} />
            <Kpi label="Patrones vencidos en campo" value={kpis.patronesVencidos} warn={kpis.patronesVencidos > 0} />
            <Kpi label="Remitos de salida abiertos" value={kpis.remitosAbiertos} />
          </div>

          {/* Grilla de ingenieros */}
          {cards.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">
              {searchActive ? 'Ningún ingeniero tiene material que coincida con la búsqueda' : 'Sin ingenieros activos'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cards.map(c => (
                <IngenieroCard key={c.ingeniero.id} data={c} searchActive={searchActive}
                  onVerInventario={() => setInventarioIngId(c.ingeniero.id)}
                  onDevolver={() => setInventarioIngId(c.ingeniero.id)}
                  onAsignar={() => abrirAsignar(c.ingeniero.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventario / devolución (mismo modal: la devolución en lote ya vive ahí) */}
      <InventarioIngenieroModal ingenieroId={inventarioIngId}
        onClose={() => { setInventarioIngId(null); loadData(); }} />

      {/* Asignar material — montado solo abierto para que cargue catálogos al abrir */}
      {asignarOpen && (
        <AsignarMaterialModal open ingenieroDestacadoId={asignarDestacadoId}
          onClose={() => { setAsignarOpen(false); setAsignarDestacadoId(null); loadData(); }} />
      )}
    </div>
  );
};

/** KPI chico del patrón de la app (label mono uppercase + valor grande). */
const Kpi = ({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) => (
  <div className={`rounded-xl border px-4 py-3 ${warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-xl font-semibold tabular-nums ${warn ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
  </div>
);
