import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { dashboardService, type DashboardData } from '../../services/dashboardService';
import { KpiCard } from './components/KpiCard';
import { OTFunnelChart } from './components/OTFunnelChart';
import { TicketAreaBars } from './components/TicketAreaBars';

const fmtMoney = (value: number, moneda: 'USD' | 'ARS') => {
  if (!value) return moneda === 'USD' ? 'US$ 0' : '$ 0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(value);
};

const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardService.load();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium">Error cargando dashboard</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-red-700 underline">Reintentar</button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { pipeline, operacion, tickets, equipos } = data;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard ejecutivo"
        subtitle={`Última actualización: ${fmtDate(data.loadedAt)} ${fmtTime(data.loadedAt)}`}
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Pipeline comercial</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              label="Presupuestos abiertos"
              value={pipeline.abiertos.count}
              hint={
                <>
                  {fmtMoney(pipeline.abiertos.montoUSD, 'USD')} · {fmtMoney(pipeline.abiertos.montoARS, 'ARS')}
                </>
              }
              onClick={() => navigate('/presupuestos')}
            />
            <KpiCard
              label="Aceptados este mes"
              value={pipeline.aceptadosMes.count}
              tone={pipeline.aceptadosMes.count > 0 ? 'positive' : 'default'}
              hint={
                <>
                  {fmtMoney(pipeline.aceptadosMes.montoUSD, 'USD')} · {fmtMoney(pipeline.aceptadosMes.montoARS, 'ARS')}
                </>
              }
              onClick={() => navigate('/presupuestos')}
            />
            <KpiCard
              label="Conversión 90 días"
              value={fmtPct(pipeline.conversion90d.ratio)}
              hint={`${pipeline.conversion90d.aceptados} aceptados / ${pipeline.conversion90d.enviados} enviados`}
            />
            <KpiCard
              label="Contratos por vencer (60d)"
              value={pipeline.contratosPorVencer.count}
              tone={pipeline.contratosPorVencer.count > 0 ? 'warning' : 'default'}
              hint={pipeline.contratosPorVencer.count > 0 ? 'Renovar antes de vencimiento' : 'Sin vencimientos próximos'}
              onClick={() => navigate('/contratos')}
            />
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Operación</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-4 lg:col-span-2">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-2">OTs por fase</p>
              <OTFunnelChart porEstado={operacion.otsPorEstado} />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <KpiCard
                label="OTs cerradas este mes"
                value={operacion.otsCerradasMes}
                tone={operacion.otsCerradasMes > 0 ? 'positive' : 'default'}
                onClick={() => navigate('/ordenes-trabajo')}
              />
              <KpiCard
                label="Lead time promedio"
                value={operacion.leadTimeDiasPromedio != null ? `${operacion.leadTimeDiasPromedio.toFixed(1)}d` : '—'}
                hint="Creación → finalización (90d)"
              />
              <KpiCard
                label="OTs sin ingeniero"
                value={operacion.otsSinIngeniero}
                tone={operacion.otsSinIngeniero > 0 ? 'warning' : 'positive'}
                onClick={() => navigate('/ordenes-trabajo')}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Tickets</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-4 lg:col-span-2">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-2">Abiertos por área</p>
              <TicketAreaBars porArea={tickets.porArea} />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <KpiCard
                label="Tickets abiertos"
                value={tickets.abiertos}
                onClick={() => navigate('/leads')}
              />
              <KpiCard
                label="Sin asignar"
                value={tickets.sinAsignar}
                tone={tickets.sinAsignar > 0 ? 'warning' : 'positive'}
                onClick={() => navigate('/leads')}
              />
              <KpiCard
                label="Alta prioridad > 48h"
                value={tickets.altaPrioridadVencida48h}
                tone={tickets.altaPrioridadVencida48h > 0 ? 'danger' : 'positive'}
                hint="Urgentes o altas pendientes hace más de 2 días"
                onClick={() => navigate('/leads')}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Equipos & Contratos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard
              label="Sistemas bajo contrato"
              value={equipos.bajoContratoTotal}
              hint={`${equipos.contratosActivos} contratos activos`}
              onClick={() => navigate('/contratos')}
            />
            <KpiCard
              label="Contratos activos"
              value={equipos.contratosActivos}
              tone={equipos.contratosActivos > 0 ? 'positive' : 'default'}
              onClick={() => navigate('/contratos')}
            />
            <KpiCard
              label="Contratos vencidos"
              value={equipos.contratosVencidos}
              tone={equipos.contratosVencidos > 0 ? 'danger' : 'positive'}
              onClick={() => navigate('/contratos')}
            />
          </div>
        </section>

      </div>
    </div>
  );
};
