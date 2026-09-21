import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import {
  armarMovimientosLoaners, filtrarMovimientos, TIPO_MOVIMIENTO_COLORS, TIPO_MOVIMIENTO_LABELS,
  type MovimientoLoaner, type TipoMovimientoLoaner,
} from '../../utils/loanerMovimientos';

const FILTER_SCHEMA = {
  search: { type: 'string' as const, default: '' },
  /** '' = todos los tipos. */
  tipo: { type: 'string' as const, default: '' },
  soloAbiertos: { type: 'boolean' as const, default: false },
};

const TABS: { value: '' | TipoMovimientoLoaner; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'prestamo', label: 'Préstamos' },
  { value: 'parte', label: 'Partes' },
  { value: 'asignacion', label: 'A ingeniero' },
  { value: 'derivacion', label: 'Proveedor' },
  { value: 'extraccion', label: 'Extracciones' },
  { value: 'venta', label: 'Ventas' },
];

const ESTADO_CLS: Record<MovimientoLoaner['estado'], string> = {
  abierto: 'bg-amber-100 text-amber-700',
  cerrado: 'bg-slate-100 text-slate-500',
  cancelado: 'bg-red-100 text-red-700',
};
const ESTADO_LABEL: Record<MovimientoLoaner['estado'], string> = { abierto: 'Afuera', cerrado: 'Cerrado', cancelado: 'Cancelado' };

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const m = d.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return d; }
};

/**
 * Historial de movimientos de loaners (2026-09-21): todos los préstamos,
 * partes, derivaciones, extracciones y ventas de todos los módulos en una
 * lista, buscable por módulo, serie, cliente, proveedor, ingeniero o número de
 * parte. "¿Qué detector estuvo en Bagó?" se responde acá y no loaner por loaner.
 */
export function LoanersHistorial() {
  const navigate = useNavigate();
  const [loaners, setLoaners] = useState<Awaited<ReturnType<typeof loanersService.getAll>>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [busq, setBusq] = useDebouncedUrlText(filters.search, v => setFilter('search', v));

  useEffect(() => {
    let vivo = true;
    // Incluye inactivos y vendidos: el historial es justamente lo que ya no está.
    loanersService.getAll()
      .then(l => { if (vivo) setLoaners(l); })
      .catch(err => console.error('[LoanersHistorial] carga:', err))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);

  const movimientos = useMemo(() => armarMovimientosLoaners(loaners), [loaners]);
  const filtrados = useMemo(() => {
    let r = filtrarMovimientos(movimientos, filters.search);
    if (filters.tipo) r = r.filter(m => m.tipo === filters.tipo);
    if (filters.soloAbiertos) r = r.filter(m => m.estado === 'abierto');
    return r;
  }, [movimientos, filters.search, filters.tipo, filters.soloAbiertos]);

  const abrirLoaner = (m: MovimientoLoaner) => navigate(`/loaners/${m.loanerId}`);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Historial de movimientos" subtitle="Loaners" count={loading ? undefined : filtrados.length}
        actions={<Button size="sm" variant="outline" onClick={() => navigate('/loaners')}>← Loaners</Button>}>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="text" value={busq} onChange={e => setBusq(e.target.value)}
            placeholder="Buscar por módulo, serie, cliente, proveedor, ingeniero o N° de parte…"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-96" />
          <div className="flex items-center gap-1.5">
            {TABS.map(tab => (
              <button key={tab.value} onClick={() => setFilter('tipo', tab.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  filters.tipo === tab.value ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto">
            <input type="checkbox" checked={filters.soloAbiertos} onChange={e => setFilter('soloAbiertos', e.target.checked)} className="rounded border-slate-300" />
            Solo lo que está afuera
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {loading && movimientos.length === 0 ? (
          <LoadingState message="Cargando movimientos…" />
        ) : filtrados.length === 0 ? (
          <EmptyState message="No hay movimientos para mostrar" hint={filters.search ? 'Probá con otras palabras: descripción del módulo, serie, cliente o N° de parte' : 'Todavía no hay préstamos ni derivaciones registrados'} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="tabla-compacta w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}>Salida</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Loaner</th>
                  <th className={thClass}>Módulo</th>
                  <th className={thClass}>Parte</th>
                  <th className={thClass}>Destino</th>
                  <th className={thClass}>Retorno</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>OT</th>
                  <th className={thClass}>Remito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => abrirLoaner(m)}>
                    <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(m.fechaSalida)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIPO_MOVIMIENTO_COLORS[m.tipo]}`}>{TIPO_MOVIMIENTO_LABELS[m.tipo]}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-teal-600 whitespace-nowrap">{m.loanerCodigo}</td>
                    <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[220px]" title={`${m.loanerDescripcion}${m.loanerSerie ? ` · S/N ${m.loanerSerie}` : ''}`}>
                      {m.loanerDescripcion}
                      {m.loanerSerie && <span className="text-[10px] text-slate-400 font-mono"> · {m.loanerSerie}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[200px]" title={m.parteDescripcion ?? ''}>
                      {m.parteDescripcion ? (
                        <>
                          {m.parteCodigo && <span className="font-mono text-[10px] text-slate-400 mr-1">{m.parteCodigo}</span>}
                          {m.parteDescripcion}
                          {m.parteSerie && <span className="text-[10px] text-slate-400 font-mono"> · {m.parteSerie}</span>}
                        </>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[220px]" title={`${m.destino}${m.establecimiento ? ` — ${m.establecimiento}` : ''}`}>
                      {m.destino}{m.establecimiento && <span className="text-slate-400"> — {m.establecimiento}</span>}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(m.fechaRetorno)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_CLS[m.estado]}`}>{ESTADO_LABEL[m.estado]}</span>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-mono text-slate-500 whitespace-nowrap">{m.otNumber ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                      {m.remitoSalida ?? <span className="text-slate-300">—</span>}{m.remitoRetorno && <span className="text-slate-400"> / {m.remitoRetorno}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
