import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { asignacionesService, ingenierosService } from '../../services/firebaseService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { InventarioIngenieroModal } from '../../components/stock/InventarioIngenieroModal';
import type { Asignacion, Ingeniero, ItemAsignacion, EstadoItemAsignacion } from '@ags/shared';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { matchesSearch } from '../../utils/searchTerms';

const ITEM_ESTADO_COLORS: Record<EstadoItemAsignacion, string> = {
  asignado: 'bg-green-100 text-green-700',
  devuelto: 'bg-slate-100 text-slate-500',
  consumido: 'bg-amber-100 text-amber-700',
};
const ITEM_ESTADO_LABELS: Record<EstadoItemAsignacion, string> = {
  asignado: 'En poder',
  devuelto: 'Devuelto',
  consumido: 'Consumido',
};

const FILTER_SCHEMA = {
  busqueda: { type: 'string' as const, default: '' },
  ingenieroId: { type: 'string' as const, default: '' },
  estado: { type: 'string' as const, default: '' },
};

/** Fila del historial: el protagonista es el ITEM (instrumento, patrón, artículo…), no el comprobante. */
interface HistRow {
  asignacion: Asignacion;
  item: ItemAsignacion;
  label: string;
  detalle: string | null;
}

function itemLabel(it: ItemAsignacion): { label: string; detalle: string | null } {
  switch (it.tipo) {
    case 'instrumento': return { label: it.instrumentoNombre || '—', detalle: it.instrumentoTipo === 'patron' ? 'Patrón' : 'Instrumento' };
    case 'articulo': return { label: it.articuloCodigo || '—', detalle: it.articuloDescripcion || null };
    case 'minikit': return { label: it.minikitCodigo || '—', detalle: 'Minikit' };
    case 'loaner': return { label: it.loanerCodigo || '—', detalle: 'Loaner' };
    case 'dispositivo': return { label: it.dispositivoDescripcion || '—', detalle: 'Dispositivo' };
    case 'vehiculo': return { label: it.vehiculoPatente || '—', detalle: 'Vehículo' };
    default: return { label: '—', detalle: null };
  }
}

const fmtFecha = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-AR') : null;

export const AsignacionesList = () => {
  const [items, setItems] = useState<Asignacion[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const [inventarioIngId, setInventarioIngId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    ingenierosService.getAll(true).then(setIngenieros).catch(console.error);
    unsubRef.current?.();
    unsubRef.current = asignacionesService.subscribe(
      undefined,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('Error:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, []);

  // Desglose por item: quién tuvo QUÉ cosa, dónde y cuándo volvió.
  const rows = useMemo<HistRow[]>(() => {
    const q = filters.busqueda.trim();
    const out: HistRow[] = [];
    for (const a of items) {
      if (a.estado === 'cancelada') continue;
      if (filters.ingenieroId && a.ingenieroId !== filters.ingenieroId) continue;
      for (const it of a.items) {
        if (filters.estado && it.estado !== filters.estado) continue;
        const { label, detalle } = itemLabel(it);
        if (q && !matchesSearch(q, label, detalle, a.ingenieroNombre, it.clienteNombre, a.clienteNombre, it.otNumber, a.numero)) continue;
        out.push({ asignacion: a, item: it, label, detalle });
      }
    }
    out.sort((x, y) => (y.item.fechaAsignacion || y.asignacion.createdAt || '')
      .localeCompare(x.item.fechaAsignacion || x.asignacion.createdAt || ''));
    return out;
  }, [items, filters.busqueda, filters.ingenieroId, filters.estado]);

  const ingOpts = [{ value: '', label: 'Todos' }, ...ingenieros.map(i => ({ value: i.id, label: i.nombre }))];
  const estadoOpts = [
    { value: '', label: 'Todos' },
    { value: 'asignado', label: 'En poder' },
    { value: 'devuelto', label: 'Devuelto' },
    { value: 'consumido', label: 'Consumido' },
  ];

  const th = 'px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400';
  const td = 'px-3 py-2 text-xs';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Historial de asignaciones" subtitle="Quién tuvo cada instrumento, patrón o artículo, dónde y cuándo volvió" count={rows.length}
        actions={<Link to="/stock/asignaciones" className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">+ Nueva asignación</Link>} />

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        <div className="flex gap-3">
          <input
            value={filters.busqueda}
            onChange={e => setFilter('busqueda', e.target.value)}
            placeholder="Buscar artículo, instrumento, patrón, cliente…"
            className="w-72 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="w-48">
            <SearchableSelect value={filters.ingenieroId} onChange={(v) => setFilter('ingenieroId', v)} options={ingOpts} placeholder="Ingeniero" />
          </div>
          <div className="w-40">
            <SearchableSelect value={filters.estado} onChange={(v) => setFilter('estado', v)} options={estadoOpts} placeholder="Estado" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : rows.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay asignaciones.</p></div></Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={th}>Ítem</th>
                  <th className={th}>Cant.</th>
                  <th className={th}>Asignado</th>
                  <th className={th}>Ingeniero</th>
                  <th className={th}>Cliente / destino</th>
                  <th className={th}>Retorno</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Comp.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ asignacion: a, item: it, label, detalle }) => (
                  <tr key={`${a.id}-${it.id}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                    <td className={td}>
                      <span className="font-mono font-semibold text-teal-800">{label}</span>
                      {detalle && <span className="block text-[10px] text-slate-400 max-w-[260px] truncate">{detalle}</span>}
                    </td>
                    <td className={`${td} text-slate-500`}>{it.cantidad > 1 ? it.cantidad : ''}</td>
                    <td className={`${td} text-slate-600 whitespace-nowrap`}>{fmtFecha(it.fechaAsignacion) ?? fmtFecha(a.createdAt) ?? '—'}</td>
                    <td className={td}>
                      <button onClick={() => setInventarioIngId(a.ingenieroId)}
                        className="text-slate-700 hover:text-teal-700 hover:underline" title="Ver inventario del ingeniero">
                        {a.ingenieroNombre}
                      </button>
                    </td>
                    <td className={`${td} text-slate-600`}>
                      {it.clienteNombre || a.clienteNombre || '—'}
                      {it.otNumber && <span className="ml-1.5 font-mono text-[10px] text-slate-400">OT {it.otNumber}</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap ${it.fechaDevolucion ? 'text-slate-600' : 'text-slate-300'}`}>
                      {fmtFecha(it.fechaDevolucion) ?? (it.estado === 'asignado' ? 'En poder' : '—')}
                    </td>
                    <td className={td}>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ITEM_ESTADO_COLORS[it.estado]}`}>
                        {ITEM_ESTADO_LABELS[it.estado]}
                      </span>
                    </td>
                    <td className={td}>
                      <Link to={`/stock/asignaciones/${a.id}`} className="font-mono text-[10px] text-slate-400 hover:text-teal-700 hover:underline">
                        {a.numero}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <InventarioIngenieroModal ingenieroId={inventarioIngId} onClose={() => setInventarioIngId(null)} />
    </div>
  );
};
