import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PresupuestoComex } from '@ags/shared';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { presupuestosComexService } from '../../services/presupuestosComexService';
import { calcularPresupuestoComex, usd } from '../../utils/presupuestoComex';
import { matchesSearch } from '../../utils/searchTerms';
import { notify } from '../../utils/notify';

const th = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400';

/** Lista del presupuestador de comex (2026-10-01). Se entra desde Importaciones. */
export function PresupuestosComexList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState<PresupuestoComex[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const cargar = () => {
    setLoading(true);
    presupuestosComexService.getAll().then(setItems)
      .catch(err => { console.error('[PresupuestosComexList]', err); notify.error('No se pudieron cargar los presupuestos'); })
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const filas = useMemo(() => items
    .filter(p => matchesSearch(busqueda, p.numero, p.titulo, p.cliente, ...p.posiciones.map(x => x.ncm)))
    .map(p => ({ p, r: calcularPresupuestoComex(p) })), [items, busqueda]);

  const eliminar = async (p: PresupuestoComex) => {
    if (!await confirm({ title: 'Eliminar presupuesto', message: `¿Eliminar ${p.numero} — ${p.titulo}?`, danger: true, confirmLabel: 'Eliminar' })) return;
    await presupuestosComexService.delete(p.id).then(cargar).catch(() => notify.error('No se pudo eliminar'));
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Presupuestador de comex" subtitle="Estimaciones de costo de importación" count={filas.length}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/stock/importaciones')}>Importaciones</Button>
            <Button size="sm" onClick={() => navigate('/stock/importaciones/comex/nuevo')}>+ Nuevo presupuesto</Button>
          </div>
        }>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por número, título, cliente o NCM…"
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </PageHeader>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        {loading ? <LoadingState message="Cargando presupuestos…" /> : filas.length === 0 ? (
          <EmptyState message="Todavía no hay presupuestos de comex" hint="Creá uno con + Nuevo presupuesto." />
        ) : (
          <table className="tabla-compacta w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className={th}>Número</th><th className={th}>Título</th><th className={th}>Cliente</th>
                <th className={th}>Fecha</th><th className={`${th} text-right`}>Valor CIF</th>
                <th className={`${th} text-right`}>Costo total</th><th className={`${th} text-right`}>Factor</th><th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map(({ p, r }) => (
                <tr key={p.id} onClick={() => navigate(`/stock/importaciones/comex/${p.id}`)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-3 py-2 font-mono text-xs text-teal-700 font-semibold">{p.numero}</td>
                  <td className="px-3 py-2 text-xs text-slate-800">{p.titulo}
                    {p.posiciones.length > 1 && <span className="ml-1.5 text-[10px] text-slate-400">{p.posiciones.length} posiciones</span>}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{p.cliente || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{p.fecha ? new Date(`${p.fecha}T12:00:00`).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">{usd(r.valorCif)}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono tabular-nums font-semibold">{usd(r.costoTotal)}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-teal-700">{r.factor ? r.factor.toFixed(3) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={e => { e.stopPropagation(); void eliminar(p); }} className="text-[11px] text-slate-400 hover:text-red-600">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
