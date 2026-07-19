import { useMemo, useState } from 'react';
import { addWeeks, parseISO, subWeeks } from 'date-fns';
import type { Presupuesto } from '@ags/shared';
import { presupuestosService } from '../../services/firebaseService';
import { useControlSemanal } from '../../hooks/useControlSemanal';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabsContext';
import { formatDateKey, formatWeekRange, getMonday } from '../../utils/agendaDateUtils';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { AgendaControlSection } from '../../components/control-semanal/AgendaControlSection';
import { PresupuestosControlSection } from '../../components/control-semanal/PresupuestosControlSection';

const FILTER_SCHEMA = {
  /** Lunes de la semana bajo control (YYYY-MM-DD). '' = semana actual. */
  semana:          { type: 'string' as const,  default: '' },
  mostrarEnviados: { type: 'boolean' as const, default: false },
};

export const ControlSemanal = () => {
  const confirm = useConfirm();
  const { usuario } = useAuth();
  const { navigateInActiveTab } = useTabs();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [generandoId, setGenerandoId] = useState<string | null>(null);

  const lunesActual = formatDateKey(getMonday(new Date()));
  // Normalizar el filtro al lunes de su semana (tolera valores manuales en la URL).
  const monday = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.semana)) return parseISO(lunesActual);
    return getMonday(parseISO(filters.semana));
  }, [filters.semana, lunesActual]);
  const weekStart = formatDateKey(monday);
  const weekEnd = useMemo(() => {
    const fin = new Date(monday);
    fin.setDate(fin.getDate() + 6);
    return formatDateKey(fin);
  }, [monday]);

  const {
    loading, error, refetch,
    agendaRows, tareasSinOT, agendaKpis,
    presupuestoRows, presupuestoKpis,
  } = useControlSemanal(weekStart, weekEnd);

  const goSemana = (d: Date) => {
    const key = formatDateKey(d);
    setFilter('semana', key === lunesActual ? '' : key);
  };

  const handleGenerarAviso = async (p: Presupuesto) => {
    const ots = p.otsListasParaFacturar ?? [];
    if (ots.length === 0) { alert('El presupuesto no tiene OTs listas para facturar.'); return; }
    const detalle = ots.length === 1 ? `la OT ${ots[0]}` : `las OTs ${ots.join(', ')}`;
    if (!await confirm(`¿Generar el aviso a facturación de ${p.numero} por ${detalle}?`)) return;
    try {
      setGenerandoId(p.id);
      await presupuestosService.generarAvisoFacturacion(
        p.id, ots,
        { observaciones: 'Generado desde Control semanal' },
        usuario ? { uid: usuario.id, name: usuario.displayName || undefined } : undefined,
      );
      refetch();
    } catch (err) {
      console.error('Error generando aviso a facturación:', err);
      alert(err instanceof Error ? err.message : 'Error al generar el aviso a facturación');
    } finally {
      setGenerandoId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Control semanal"
        subtitle="Cierre de coordinación: OTs agendadas realizadas y avisos a facturación pendientes"
        actions={
          <Button size="sm" variant="secondary" onClick={refetch} disabled={loading}>
            {loading ? 'Cargando…' : 'Refrescar'}
          </Button>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => goSemana(subWeeks(monday, 1))}>
            ‹ Semana anterior
          </Button>
          <span className="text-[11px] font-mono uppercase tracking-wide text-slate-600 px-2 tabular-nums">
            {formatWeekRange(monday)}
          </span>
          <Button size="sm" variant="outline" onClick={() => goSemana(addWeeks(monday, 1))}>
            Semana siguiente ›
          </Button>
          {weekStart !== lunesActual && (
            <Button size="sm" variant="ghost" onClick={() => setFilter('semana', '')}>
              Hoy
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700 font-medium">Error cargando el control semanal</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={refetch} className="mt-3 text-xs text-red-700 underline">Reintentar</button>
          </div>
        )}
        {!error && loading && agendaRows.length === 0 && presupuestoRows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-400">Cargando control semanal…</p>
          </div>
        ) : !error && (
          <>
            <AgendaControlSection
              rows={agendaRows}
              tareasSinOT={tareasSinOT}
              kpis={agendaKpis}
              onOpenOT={(otNumber) => navigateInActiveTab(`/ordenes-trabajo/${otNumber}`)}
            />
            <PresupuestosControlSection
              rows={presupuestoRows}
              kpis={presupuestoKpis}
              mostrarEnviados={filters.mostrarEnviados}
              onToggleEnviados={(v) => setFilter('mostrarEnviados', v)}
              onOpenPresupuesto={(id) => navigateInActiveTab(`/presupuestos/${id}`)}
              onGenerarAviso={handleGenerarAviso}
              generandoId={generandoId}
            />
          </>
        )}
      </div>
    </div>
  );
};
