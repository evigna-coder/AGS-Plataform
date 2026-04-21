/**
 * FLOW-06: Dashboard agregado de pendingActions.
 *
 * Lista todas las pendingActions con `resolvedAt === null` across todos los
 * presupuestos. Filtros URL-persistidos (useUrlFilters) por tipo / antigüedad /
 * cliente. Cada row tiene botones "Reintentar" y "Marcar resuelta manual".
 *
 * Data source: presupuestosService.subscribe (onSnapshot global, filtrado
 * client-side por presupuestos con pendingActions no resueltas). Para AGS
 * (<1000 presupuestos) este enfoque es suficiente; optimizar con query
 * específica si el volumen escala (flagged en SUMMARY v2.1).
 *
 * RBAC admin gated en TabContentManager.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { presupuestosService } from '../../services/presupuestosService';
import type { Presupuesto } from '@ags/shared';
import {
  AccionesPendientesRow,
  TYPE_LABELS,
  matchesAntiguedad,
  type AccionPendienteRow,
} from './AccionesPendientesRow';

const FILTERS_SCHEMA = {
  tipo: { type: 'string' as const, default: '' },
  antiguedad: { type: 'string' as const, default: '' },
  clienteId: { type: 'string' as const, default: '' },
};

export default function AccionesPendientesPage() {
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTERS_SCHEMA);
  const [rows, setRows] = useState<AccionPendienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const unsub = presupuestosService.subscribe(
      undefined,
      (presupuestos: Presupuesto[]) => {
        const collected: AccionPendienteRow[] = [];
        for (const p of presupuestos) {
          for (const a of (p.pendingActions || [])) {
            if (a.resolvedAt) continue;
            collected.push({
              presupuestoId: p.id,
              presupuestoNumero: p.numero,
              clienteId: p.clienteId,
              action: a,
            });
          }
        }
        // Orden: más viejas primero (admin suele priorizar las de más antigüedad)
        collected.sort((a, b) => new Date(a.action.createdAt).getTime() - new Date(b.action.createdAt).getTime());
        setRows(collected);
        setLoading(false);
      },
      err => {
        console.error('[AccionesPendientesPage] subscribe error:', err);
        setBanner({ type: 'error', msg: `Error al cargar: ${err.message}` });
        setLoading(false);
      },
    );
    return () => { try { unsub(); } catch { /* noop */ } };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filters.tipo && r.action.type !== filters.tipo) return false;
      if (filters.clienteId && r.clienteId !== filters.clienteId) return false;
      if (!matchesAntiguedad(r.action.createdAt, filters.antiguedad)) return false;
      return true;
    });
  }, [rows, filters]);

  const clienteIds = useMemo(
    () => Array.from(new Set(rows.map(r => r.clienteId).filter(Boolean))).sort(),
    [rows],
  );

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  };

  const handleRetry = async (row: AccionPendienteRow) => {
    setActingOn(row.action.id);
    try {
      const result = await presupuestosService.retryPendingAction(row.presupuestoId, row.action.id);
      if (result.success) {
        showBanner('success', `Reintento OK — ${TYPE_LABELS[row.action.type]}`);
      } else {
        showBanner('error', `Reintento falló: ${result.error || 'sin detalle'}`);
      }
    } catch (err: any) {
      showBanner('error', `Error al reintentar: ${err?.message || err}`);
    } finally {
      setActingOn(null);
    }
  };

  const handleResolve = async (row: AccionPendienteRow) => {
    if (!window.confirm(`Marcar como resuelta la acción "${TYPE_LABELS[row.action.type]}" de ${row.presupuestoNumero}?`)) return;
    setActingOn(row.action.id);
    try {
      await presupuestosService.markPendingActionResolved(row.presupuestoId, row.action.id);
      showBanner('success', 'Marcada como resuelta');
    } catch (err: any) {
      showBanner('error', `Error al marcar resuelta: ${err?.message || err}`);
    } finally {
      setActingOn(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Cargando acciones pendientes…</div>;
  }

  const hasActiveFilter = !!filters.tipo || !!filters.antiguedad || !!filters.clienteId;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-slate-900 mb-1">Acciones Pendientes</h1>
        <p className="text-sm text-slate-500">Derivaciones automáticas que fallaron o están bloqueadas. Reintentar o marcar resuelta manualmente.</p>
      </div>

      {banner && (
        <div className={`text-sm rounded-lg p-3 border ${banner.type === 'success' ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {banner.msg}
        </div>
      )}

      <Card className="p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Tipo</label>
            <select
              value={filters.tipo}
              onChange={e => setFilter('tipo', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">Todos</option>
              <option value="crear_ticket_seguimiento">Crear ticket seguimiento</option>
              <option value="derivar_comex">Derivar a Comex</option>
              <option value="enviar_mail_facturacion">Enviar mail facturación</option>
              <option value="notificar_coordinador_ot">Notificar coordinador OT</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Antigüedad</label>
            <select
              value={filters.antiguedad}
              onChange={e => setFilter('antiguedad', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">Cualquier</option>
              <option value="nuevo">&lt; 1 día</option>
              <option value="mediana">1-7 días</option>
              <option value="vieja">&gt; 7 días</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1">Cliente</label>
            <select
              value={filters.clienteId}
              onChange={e => setFilter('clienteId', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white max-w-[200px]"
            >
              <option value="">Todos</option>
              {clienteIds.map(cid => (<option key={cid} value={cid}>{cid}</option>))}
            </select>
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar filtros</Button>
          )}
          <div className="ml-auto text-[11px] text-slate-500">
            {filtered.length} / {rows.length} acciones
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
          {rows.length === 0 ? 'Sin acciones pendientes.' : 'No hay acciones que coincidan con los filtros.'}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-wide text-slate-600 border-b border-slate-200">
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Presupuesto</th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">Razón</th>
                <th className="px-4 py-2 text-left">Creado</th>
                <th className="px-4 py-2 text-center">Intentos</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <AccionesPendientesRow
                  key={row.action.id}
                  row={row}
                  actingId={actingOn}
                  onRetry={handleRetry}
                  onResolve={handleResolve}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
