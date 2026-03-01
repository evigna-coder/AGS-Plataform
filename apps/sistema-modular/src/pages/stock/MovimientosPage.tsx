import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { movimientosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { CreateMovimientoModal } from '../../components/stock/CreateMovimientoModal';
import type { MovimientoStock, TipoMovimiento } from '@ags/shared';

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};
const TIPO_COLORS: Record<TipoMovimiento, string> = {
  ingreso: 'bg-green-100 text-green-700', egreso: 'bg-red-100 text-red-700',
  transferencia: 'bg-blue-100 text-blue-700', consumo: 'bg-amber-100 text-amber-700',
  devolucion: 'bg-purple-100 text-purple-700', ajuste: 'bg-slate-100 text-slate-600',
};

const TIPOS: TipoMovimiento[] = ['ingreso', 'egreso', 'transferencia', 'consumo', 'devolucion', 'ajuste'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export const MovimientosPage = () => {
  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState<TipoMovimiento | ''>('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const filters: { tipo?: string } = {};
      if (tipoFilter) filters.tipo = tipoFilter;
      const data = await movimientosService.getAll(filters);
      setItems(data);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tipoFilter]);

  const filtered = search
    ? items.filter(m =>
        m.articuloCodigo.toLowerCase().includes(search.toLowerCase()) ||
        m.articuloDescripcion.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Movimientos de Stock"
        subtitle="Historial de movimientos de inventario"
        count={filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Registrar movimiento</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value as TipoMovimiento | '')}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
          <input
            type="text"
            placeholder="Buscar por codigo o descripcion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Cargando movimientos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron movimientos</p>
            </div>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Fecha</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Codigo</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-right">Cant.</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Origen</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Destino</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Motivo</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Usuario</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider">Ref.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(m.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[m.tipo]}`}>
                        {TIPO_LABELS[m.tipo]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">{m.articuloCodigo}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{m.articuloDescripcion}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{m.cantidad}</td>
                    <td className="px-3 py-2 text-slate-600">{m.origenTipo} — {m.origenNombre}</td>
                    <td className="px-3 py-2 text-slate-600">{m.destinoTipo} — {m.destinoNombre}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">{m.motivo ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{m.creadoPor}</td>
                    <td className="px-3 py-2 space-x-2">
                      {m.remitoId && (
                        <Link to={`/stock/remitos/${m.remitoId}`} className="text-indigo-600 hover:underline text-[10px] font-medium">
                          Remito
                        </Link>
                      )}
                      {m.otNumber && (
                        <Link to={`/ordenes-trabajo/${m.otNumber}`} className="text-indigo-600 hover:underline text-[10px] font-medium">
                          OT
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateMovimientoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
};
