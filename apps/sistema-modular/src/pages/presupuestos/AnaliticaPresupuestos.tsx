import { useEffect, useMemo, useState } from 'react';
import type { Cliente, UsuarioAGS } from '@ags/shared';
import { clientesService, usuariosService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useTabs } from '../../contexts/TabsContext';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAnaliticaPresupuestos } from '../../hooks/useAnaliticaPresupuestos';
import {
  aplicarFiltros, computePeriodo, computeSerieMensual, computeAgingEnviados, computeOCAdeudada, formatMonto,
} from '../../utils/analitica/presupuestosMetrics';
import { AnaliticaFiltros, type AnaliticaUrlFilters } from '../../components/presupuestos/analitica/AnaliticaFiltros';
import { AnaliticaKpiRow } from '../../components/presupuestos/analitica/AnaliticaKpiRow';
import { EnviadosAceptadosChart } from '../../components/presupuestos/analitica/EnviadosAceptadosChart';
import { AgingTable, type AgingTableRow } from '../../components/presupuestos/analitica/AgingTable';

const fmtDia = (iso: string) => {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
};

export const AnaliticaPresupuestos = () => {
  const { navigateInActiveTab } = useTabs();
  const floatingPres = useFloatingPresupuesto();
  const { data, loading, error, refetch } = useAnaliticaPresupuestos();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);

  const FILTER_SCHEMA = useMemo(() => ({
    fechaDesde:  { type: 'string' as const, default: '' },
    fechaHasta:  { type: 'string' as const, default: '' },
    cliente:     { type: 'string' as const, default: '' },
    tipo:        { type: 'string' as const, default: '' },
    responsable: { type: 'string' as const, default: '' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);

  useEffect(() => {
    Promise.all([clientesService.getAll(true), usuariosService.getAll()])
      .then(([cs, us]) => { setClientes(cs); setUsuarios(us); })
      .catch(err => console.error('Error cargando datos de referencia:', err));
  }, []);

  const metrics = useMemo(() => {
    if (!data) return null;
    const filtrados = aplicarFiltros(data.presupuestos, {
      clienteId: filters.cliente || undefined,
      tipo: filters.tipo || undefined,
      responsableId: filters.responsable || undefined,
    });
    const rango = { desde: filters.fechaDesde || undefined, hasta: filters.fechaHasta || undefined };
    const now = new Date();
    return {
      periodo: computePeriodo(filtrados, rango),
      serie: computeSerieMensual(filtrados, rango),
      aging: computeAgingEnviados(filtrados, now),
      ocAdeudada: computeOCAdeudada(filtrados, data.ots, now),
    };
  }, [data, filters]);

  const clienteNombre = (id: string) => clientes.find(c => c.id === id)?.razonSocial || '—';

  // Drill-down a la lista arrastrando los filtros activos de la analítica.
  const drillToLista = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    if (filters.cliente) sp.set('cliente', filters.cliente);
    if (filters.tipo) sp.set('tipo', filters.tipo);
    if (filters.responsable) sp.set('responsable', filters.responsable);
    navigateInActiveTab(`/presupuestos?${sp.toString()}`);
  };

  const agingRows: AgingTableRow[] = useMemo(() => (metrics?.aging.rows ?? []).map(r => ({
    id: r.presupuesto.id,
    numero: r.presupuesto.numero,
    clienteNombre: clienteNombre(r.presupuesto.clienteId),
    responsableNombre: r.presupuesto.responsableNombre || '—',
    montoLabel: formatMonto(r.monto),
    dias: r.dias,
    extra: r.diasHastaVencer === null ? undefined
      : r.diasHastaVencer < 0 ? `Vencido hace ${Math.abs(r.diasHastaVencer)}d`
      : `Vence en ${r.diasHastaVencer}d`,
    extraTone: (r.diasHastaVencer ?? 0) < 0 ? 'danger' : 'default',
  })), [metrics, clientes]);

  const ocRows: AgingTableRow[] = useMemo(() => (metrics?.ocAdeudada.rows ?? []).map(r => ({
    id: r.presupuesto.id,
    numero: r.presupuesto.numero,
    clienteNombre: clienteNombre(r.presupuesto.clienteId),
    responsableNombre: r.presupuesto.responsableNombre || '—',
    montoLabel: formatMonto(r.monto),
    dias: r.dias,
    extra: `${r.otsCerradas.join(', ')}${r.fechaPrimerCierre ? ` · 1er cierre ${fmtDia(r.fechaPrimerCierre)}` : ''}`,
  })), [metrics, clientes]);

  const periodoLabel = filters.fechaDesde || filters.fechaHasta
    ? `${filters.fechaDesde ? fmtDia(filters.fechaDesde) : 'inicio'} – ${filters.fechaHasta ? fmtDia(filters.fechaHasta) : 'hoy'}`
    : 'Histórico completo';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Analítica de presupuestos"
        subtitle={data ? `Última actualización: ${new Date(data.loadedAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : undefined}
        actions={
          <button
            onClick={refetch}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        }
      >
        <AnaliticaFiltros
          filters={filters as AnaliticaUrlFilters}
          onChange={(k, v) => setFilter(k, v)}
          onReset={resetFilters}
          clientes={clientes}
          usuarios={usuarios}
        />
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700 font-medium">Error cargando la analítica</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={refetch} className="mt-3 text-xs text-red-700 underline">Reintentar</button>
          </div>
        )}
        {!error && loading && !data && (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando analítica…</p></div>
        )}
        {!error && metrics && (
          <>
            <AnaliticaKpiRow
              resumen={metrics.periodo}
              ocAdeudada={{ count: metrics.ocAdeudada.totalCount, monto: metrics.ocAdeudada.totalMonto }}
              periodoLabel={periodoLabel}
              onEnviadosClick={() => drillToLista({ kpi: 'enviados' })}
              onAceptadosClick={() => drillToLista({ kpi: 'aceptados' })}
              onOCAdeudadaClick={() => drillToLista({ ocPendiente: 'true' })}
            />

            <section className="rounded-xl bg-white border border-slate-200 p-4">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-2">
                Enviados vs. aprobados por mes — {periodoLabel}
              </p>
              <EnviadosAceptadosChart serie={metrics.serie} />
            </section>

            <AgingTable
              title={`Enviados sin aprobar (aging) — ${metrics.aging.totalCount}`}
              subtitle={`Snapshot de hoy, no depende del período · ${formatMonto(metrics.aging.totalMonto)}`}
              extraHeader="Validez"
              rows={agingRows}
              buckets={metrics.aging.buckets}
              emptyText="No hay presupuestos enviados esperando respuesta"
              onRowClick={id => floatingPres.open(id)}
              onDrilldown={() => drillToLista({ kpi: 'enviados', sortField: 'fechaEnvio', sortDir: 'asc' })}
            />

            <AgingTable
              title={`OC del cliente adeudadas con servicio realizado — ${metrics.ocAdeudada.totalCount}`}
              subtitle={`Snapshot de hoy: OT cerrada y el cliente todavía no mandó la OC · ${formatMonto(metrics.ocAdeudada.totalMonto)}`}
              extraHeader="OTs cerradas"
              rows={ocRows}
              buckets={metrics.ocAdeudada.buckets}
              emptyText="Sin deudas de OC con trabajo ya realizado"
              onRowClick={id => floatingPres.open(id)}
              onDrilldown={() => drillToLista({ ocPendiente: 'true' })}
              accent
            />
          </>
        )}
      </div>
    </div>
  );
};
