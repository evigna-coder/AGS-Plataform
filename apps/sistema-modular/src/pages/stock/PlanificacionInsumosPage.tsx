import { useMemo, useState } from 'react';
import { GRUPOS_PLANIFICACION, GRUPO_PLANIFICACION_LABELS } from '@ags/shared';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { usePlanificacionInsumos } from '../../hooks/usePlanificacionInsumos';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PlanificacionTabla } from '../../components/planificacion/PlanificacionTabla';
import { PlanificacionDetalleDrawer } from '../../components/planificacion/PlanificacionDetalleDrawer';
import { PerfilesConsumoPanel } from '../../components/planificacion/PerfilesConsumoPanel';
import { PlanificablesModal } from '../../components/planificacion/PlanificablesModal';
import { buildPlanificacionInsumosColumns, buildPlanificacionInsumosFiltros } from '../../utils/exports/exportPlanificacionInsumos';
import type { FilaPlan } from '../../utils/planificacionInsumos';

const FILTER_SCHEMA = {
  horizonte: { type: 'string' as const, default: '2' },
  grupo:     { type: 'string' as const, default: '' },
  texto:     { type: 'string' as const, default: '' },
  vista:     { type: 'string' as const, default: 'plan' },
  soloFaltantes: { type: 'string' as const, default: '' },
};
const HORIZONTES = [['2', '60 días'], ['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses']] as const;

/**
 * Planificación de insumos críticos (2026-09-28): qué comprar, cuánto y cuándo,
 * a partir de los servicios previstos (agenda + contratos, o el año anterior
 * si fue más) y los perfiles de consumo por configuración de equipo.
 * Reemplaza a la vieja planificación por ATP, obsoleta desde que los
 * requerimientos son automáticos.
 */
export function PlanificacionInsumosPage() {
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [textoInput, setTextoInput] = useDebouncedUrlText(filters.texto, v => setFilter('texto', v));
  const horizonte = Math.max(1, Number(filters.horizonte) || 2);
  const p = usePlanificacionInsumos(horizonte);
  const [detalle, setDetalle] = useState<FilaPlan | null>(null);
  const [planificablesOpen, setPlanificablesOpen] = useState(false);

  const filas = useMemo(() => {
    const todas = p.resultado?.filas ?? [];
    const t = filters.texto.trim().toLowerCase();
    return todas.filter(f =>
      (!filters.grupo || f.grupo === filters.grupo)
      && (!t || f.codigo.toLowerCase().includes(t) || f.descripcion.toLowerCase().includes(t))
      && (filters.soloFaltantes !== 'true' || f.comprar > 0));
  }, [p.resultado, filters.grupo, filters.texto, filters.soloFaltantes]);

  const meses = p.resultado?.meses ?? [];
  const totalComprar = filas.filter(f => f.comprar > 0).length;
  const sinPerfil = p.resultado?.equiposSinPerfil ?? [];
  const tab = (v: string, label: string) => (
    <button onClick={() => setFilter('vista', v)}
      className={`px-3 py-1 text-xs rounded-lg border ${filters.vista === v ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'}`}>
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Planificación de insumos</h1>
            {!p.loading && p.resultado && (
              <p className="text-xs text-slate-400 mt-0.5">
                {p.articulos.length} insumos críticos · {totalComprar > 0 ? <span className="text-red-600 font-medium">{totalComprar} a comprar</span> : 'sin faltantes'} en el horizonte
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tab('plan', 'Planificación')}
            {tab('perfiles', `Perfiles de consumo (${p.perfiles.length + p.perfilesCatalogo.length})`)}
            <Button variant="outline" size="sm" onClick={() => setPlanificablesOpen(true)}>Insumos planificables</Button>
            <Button variant="outline" size="sm" onClick={p.recargar} disabled={p.loading}>Recalcular</Button>
            {filters.vista === 'plan' && (
              <ExportarButton columnas={buildPlanificacionInsumosColumns(meses)} data={filas} titulo="Planificación de insumos"
                filename="planificacion-insumos" orientacion="landscape" filtrosAplicados={buildPlanificacionInsumosFiltros(filters)} />
            )}
          </div>
        </div>
        {filters.vista === 'plan' && (
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" value={textoInput} onChange={e => setTextoInput(e.target.value)} placeholder="Buscar por código o descripción…"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <Select value={filters.grupo} onChange={e => setFilter('grupo', e.target.value)} className="w-36">
              <option value="">Grupo: todos</option>
              {GRUPOS_PLANIFICACION.map(g => <option key={g} value={g}>{GRUPO_PLANIFICACION_LABELS[g]}</option>)}
            </Select>
            <Select value={filters.horizonte} onChange={e => setFilter('horizonte', e.target.value)} className="w-36">
              {HORIZONTES.map(([v, l]) => <option key={v} value={v}>Horizonte: {l}</option>)}
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.soloFaltantes === 'true'} onChange={e => setFilter('soloFaltantes', e.target.checked ? 'true' : '')} className="rounded border-slate-300" />
              Solo con faltante
            </label>
            {sinPerfil.length > 0 && (
              <span className="ml-auto text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1"
                title={sinPerfil.map(e => e.sistemaNombre).join('\n')}>
                {sinPerfil.length} equipo{sinPerfil.length === 1 ? '' : 's'} con servicio previsto y sin perfil de consumo
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-4">
        {p.error ? (
          <EmptyState message="No se pudo calcular la planificación" hint={p.error} action={<Button size="sm" onClick={p.recargar}>Reintentar</Button>} />
        ) : p.loading ? (
          <LoadingState message="Leyendo agenda, contratos, compras y stock…" rows={8} />
        ) : filters.vista === 'perfiles' ? (
          <PerfilesConsumoPanel perfiles={p.perfiles} perfilesCatalogo={p.perfilesCatalogo} articulos={p.articulos} categorias={p.categorias} onChanged={p.recargarPerfiles} />
        ) : p.articulos.length === 0 ? (
          <EmptyState message="Todavía no hay insumos planificables" hint="Marcá los artículos críticos para empezar a proyectar."
            action={<Button size="sm" onClick={() => setPlanificablesOpen(true)}>Elegir insumos</Button>} />
        ) : filas.length === 0 ? (
          <EmptyState message="Ningún insumo coincide con los filtros" hint="Probá con otro grupo o sin 'Solo con faltante'." />
        ) : (
          <PlanificacionTabla meses={meses} filas={filas} onVerDetalle={setDetalle} />
        )}
      </div>

      <PlanificacionDetalleDrawer fila={detalle} onClose={() => setDetalle(null)} />
      <PlanificablesModal open={planificablesOpen} onClose={() => setPlanificablesOpen(false)} onChanged={p.recargar} planificables={p.articulos} />
    </div>
  );
}
