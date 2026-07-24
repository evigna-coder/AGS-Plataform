import { useEffect, useMemo, useState, useRef } from 'react';
import { FACTURA_ESTADO_LABELS, FACTURA_ESTADO_COLORS } from '@ags/shared';
import type { Factura } from '@ags/shared';
import { facturasService } from '../../services/facturasService';
import { useAuth } from '../../contexts/AuthContext';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CargarFacturaModal } from '../../components/control-facturas/CargarFacturaModal';
import { FacturaComentariosModal } from '../../components/control-facturas/FacturaComentariosModal';

const ESTADO_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'pagada', label: 'Pagadas' },
];

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const formatFecha = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return iso; }
};
/** Antigüedad en días desde la carga (createdAt) hasta hoy. */
const diasDesde = (iso?: string): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : null;
};

export const ControlFacturasList = () => {
  const { usuario } = useAuth();
  const FILTER_SCHEMA = useMemo(() => ({
    estado: { type: 'string' as const, default: '' },
    proveedor: { type: 'string' as const, default: '' },
    desde: { type: 'string' as const, default: '' },
    hasta: { type: 'string' as const, default: '' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCargar, setShowCargar] = useState(false);
  const [comentando, setComentando] = useState<Factura | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = facturasService.subscribe(
      (data) => { setFacturas(data); setLoading(false); },
      (err) => { console.error('Error cargando facturas:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  // Mantener abierto el modal de comentarios sincronizado con los datos frescos.
  useEffect(() => {
    if (comentando) {
      const fresh = facturas.find(f => f.id === comentando.id);
      if (fresh && fresh !== comentando) setComentando(fresh);
    }
  }, [facturas]); // eslint-disable-line react-hooks/exhaustive-deps

  const proveedorOptions = useMemo(() => {
    const nombres = Array.from(new Set(facturas.map(f => f.proveedorNombre).filter(Boolean))).sort();
    return [{ value: '', label: 'Proveedor: Todos' }, ...nombres.map(n => ({ value: n, label: n }))];
  }, [facturas]);

  const filtered = useMemo(() => facturas.filter(f => {
    if (filters.estado && f.estado !== filters.estado) return false;
    if (filters.proveedor && f.proveedorNombre !== filters.proveedor) return false;
    // Rango por fecha de CARGA (createdAt). Comparo la porción YYYY-MM-DD del ISO.
    const cargaDia = (f.createdAt ?? '').slice(0, 10);
    if (filters.desde && cargaDia < filters.desde) return false;
    if (filters.hasta && cargaDia > filters.hasta) return false;
    return true;
  }), [facturas, filters]);

  const hasAdvanced = !!(filters.proveedor || filters.desde || filters.hasta);

  const actor = usuario?.displayName ?? 'Sistema';
  const aprobar = async (f: Factura) => {
    setBusyId(f.id);
    try { await facturasService.aprobar(f.id, actor); }
    catch (err) { console.error(err); alert('Error al aprobar la factura'); }
    finally { setBusyId(null); }
  };
  const marcarPagada = async (f: Factura) => {
    setBusyId(f.id);
    try { await facturasService.marcarPagada(f.id, actor); }
    catch (err) { console.error(err); alert('Error al marcar como pagada'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Control de facturas"
        subtitle="Facturas a pagar — carga, aprobación y seguimiento"
        count={loading ? undefined : filtered.length}
        actions={<Button size="sm" onClick={() => setShowCargar(true)}>+ Cargar factura</Button>}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {ESTADO_TABS.map(tab => (
              <button key={tab.value} onClick={() => setFilter('estado', tab.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  filters.estado === tab.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <div className="min-w-[200px]">
            <SearchableSelect value={filters.proveedor} onChange={v => setFilter('proveedor', v)} size="sm"
              options={proveedorOptions} placeholder="Proveedor" emptyMessage="Sin proveedores" />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-mono uppercase tracking-wide text-slate-400">Desde</span>
            <input type="date" value={filters.desde} onChange={e => setFilter('desde', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-mono uppercase tracking-wide text-slate-400">Hasta</span>
            <input type="date" value={filters.hasta} onChange={e => setFilter('hasta', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          {hasAdvanced && <Button size="sm" variant="ghost" onClick={resetFilters}>Limpiar</Button>}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {loading && facturas.length === 0 ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando facturas...</p></div>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron facturas</p>
            <button onClick={() => setShowCargar(true)} className="text-teal-600 hover:underline mt-2 inline-block text-xs">Cargar primera factura</button>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}>Nº</th>
                  <th className={thClass}>Carga</th>
                  <th className={`${thClass} text-right`}>Días</th>
                  <th className={thClass}>Proveedor</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Coment.</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-[11px] font-mono text-slate-500 whitespace-nowrap">{f.numero ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">{formatFecha(f.createdAt)}</td>
                    <td className="px-3 py-2 text-[11px] text-right tabular-nums whitespace-nowrap">
                      {(() => {
                        const d = diasDesde(f.createdAt);
                        if (d === null) return <span className="text-slate-400">—</span>;
                        const alerta = f.estado !== 'pagada' && d >= 15;
                        const cls = alerta ? (d >= 30 ? 'text-red-600 font-semibold' : 'text-amber-600 font-medium') : 'text-slate-500';
                        return <span className={cls}>{d} d</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[220px]">{f.proveedorNombre}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusBadge label={FACTURA_ESTADO_LABELS[f.estado]} colorClass={FACTURA_ESTADO_COLORS[f.estado]} />
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap">{f.comentarios.length || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <a href={f.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
                          Previsualizar
                        </a>
                        {f.estado === 'pendiente' && (
                          <button onClick={() => aprobar(f)} disabled={busyId === f.id}
                            className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 disabled:opacity-50">
                            Aprobar
                          </button>
                        )}
                        {f.estado === 'aprobada' && (
                          <button onClick={() => marcarPagada(f)} disabled={busyId === f.id}
                            className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 disabled:opacity-50">
                            Marcar pagada
                          </button>
                        )}
                        <button onClick={() => setComentando(f)}
                          className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100">
                          Comentar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCargar && <CargarFacturaModal onClose={() => setShowCargar(false)} onCreated={() => setShowCargar(false)} />}
      {comentando && <FacturaComentariosModal factura={comentando} autor={actor} onClose={() => setComentando(null)} />}
    </div>
  );
};
