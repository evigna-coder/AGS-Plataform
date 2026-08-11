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
import { AgendaControlSection, TareasSinOTSection } from '../../components/control-semanal/AgendaControlSection';
import { EntregasControlSection } from '../../components/control-semanal/EntregasControlSection';
import { PresupuestosControlSection } from '../../components/control-semanal/PresupuestosControlSection';
import { FacturacionControlSection } from '../../components/control-semanal/FacturacionControlSection';
import { facturacionService } from '../../services/firebaseService';

const FILTER_SCHEMA = {
  /** Lunes de la semana bajo control (YYYY-MM-DD). '' = semana actual. */
  semana:          { type: 'string' as const,  default: '' },
  mostrarEnviados: { type: 'boolean' as const, default: false },
  /** Pestaña: control (default) | tareas sin OT (2026-08-11). */
  tab:             { type: 'string' as const,  default: 'control' },
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
    entregasPendientes, presupuestoIdByNumero,
    presupuestoRows, presupuestoKpis,
    facturacionRows, facturacionKpis,
  } = useControlSemanal(weekStart, weekEnd);

  // Comentarios del control (2026-08-05): soporte anota en el ppto, administración
  // en la solicitud. Se guardan en el doc — no dependen de la semana.
  const saveComentarioPresupuesto = async (presupuestoId: string, comentario: string) => {
    try { await presupuestosService.update(presupuestoId, { comentarioControlSemanal: comentario || null }); }
    catch (err) { console.error('[ControlSemanal] comentario ppto:', err); alert('No se pudo guardar el comentario'); }
  };
  const saveComentarioSolicitud = async (solicitudId: string, comentario: string) => {
    try { await facturacionService.update(solicitudId, { comentarioControl: comentario || null }); }
    catch (err) { console.error('[ControlSemanal] comentario solicitud:', err); alert('No se pudo guardar el comentario'); }
  };

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
        <div className="flex gap-2 mb-2">
          {([['control', 'Control'], ['tareas', `Tareas sin OT (${tareasSinOT.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter('tab', k)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${filters.tab === k ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
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
          filters.tab === 'tareas' ? (
            <TareasSinOTSection tareas={tareasSinOT} />
          ) : (
          <>
            <AgendaControlSection
              rows={agendaRows}
              kpis={agendaKpis}
              onOpenOT={(otNumber) => navigateInActiveTab(`/ordenes-trabajo/${otNumber}`)}
            />
            <EntregasControlSection
              entregas={entregasPendientes}
              onOpenOT={(otNumber) => navigateInActiveTab(`/ordenes-trabajo/${otNumber}`)}
              onOpenPresupuestoNumero={(numero) => {
                const id = presupuestoIdByNumero.get(numero);
                if (id) navigateInActiveTab(`/presupuestos/${id}`);
              }}
            />
            <PresupuestosControlSection
              rows={presupuestoRows}
              kpis={presupuestoKpis}
              mostrarEnviados={filters.mostrarEnviados}
              onToggleEnviados={(v) => setFilter('mostrarEnviados', v)}
              onOpenPresupuesto={(id) => navigateInActiveTab(`/presupuestos/${id}`)}
              onGenerarAviso={handleGenerarAviso}
              generandoId={generandoId}
              onSaveComentario={saveComentarioPresupuesto}
            />
            <FacturacionControlSection
              rows={facturacionRows}
              kpis={facturacionKpis}
              onOpenSolicitud={(id) => navigateInActiveTab(`/facturacion/${id}`)}
              onSaveComentario={saveComentarioSolicitud}
            />
          </>
          )
        )}
      </div>
    </div>
  );
};
