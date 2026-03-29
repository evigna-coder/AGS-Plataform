import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { asignacionesService, ingenierosService } from '../../services/firebaseService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { InventarioIngenieroModal } from '../../components/stock/InventarioIngenieroModal';
import type { Asignacion, Ingeniero, EstadoAsignacion } from '@ags/shared';

const ESTADO_COLORS: Record<EstadoAsignacion, string> = {
  activa: 'bg-green-100 text-green-700',
  completada: 'bg-slate-100 text-slate-500',
  cancelada: 'bg-red-100 text-red-700',
};

export const AsignacionesList = () => {
  const [items, setItems] = useState<Asignacion[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroIngeniero, setFiltroIngeniero] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [inventarioIngId, setInventarioIngId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Reference data: one-shot load
    ingenierosService.getAll(true).then(setIngenieros).catch(console.error);

    // Main data: real-time subscription
    unsubRef.current?.();
    unsubRef.current = asignacionesService.subscribe(
      undefined,
      (items) => { setItems(items); setLoading(false); },
      (err) => { console.error('Error:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const filtered = items.filter(a => {
    if (filtroIngeniero && a.ingenieroId !== filtroIngeniero) return false;
    if (filtroEstado && a.estado !== filtroEstado) return false;
    return true;
  });

  const ingOpts = [{ value: '', label: 'Todos' }, ...ingenieros.map(i => ({ value: i.id, label: i.nombre }))];
  const estadoOpts = [
    { value: '', label: 'Todos' },
    { value: 'activa', label: 'Activa' },
    { value: 'completada', label: 'Completada' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Historial de asignaciones" subtitle="Registro de todas las asignaciones de stock" count={filtered.length}
        actions={<Link to="/stock/asignaciones" className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">+ Nueva asignación</Link>} />

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        <div className="flex gap-3">
          <div className="w-48">
            <SearchableSelect value={filtroIngeniero} onChange={setFiltroIngeniero} options={ingOpts} placeholder="Ingeniero" />
          </div>
          <div className="w-40">
            <SearchableSelect value={filtroEstado} onChange={setFiltroEstado} options={estadoOpts} placeholder="Estado" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay asignaciones.</p></div></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <Link key={a.id} to={`/stock/asignaciones/${a.id}`}
                className="block bg-white rounded-lg border border-slate-100 px-4 py-3 hover:border-teal-200 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-teal-700">{a.numero}</span>
                    <span className="text-xs text-slate-700 font-medium">{a.ingenieroNombre}</span>
                    {a.clienteNombre && <span className="text-[10px] text-slate-400">→ {a.clienteNombre}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.preventDefault(); setInventarioIngId(a.ingenieroId); }}
                      className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50"
                      title="Ver inventario del ingeniero">
                      Inventario
                    </button>
                    <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{a.items.length} items</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[a.estado]}`}>{a.estado}</span>
                    <span className="text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <InventarioIngenieroModal ingenieroId={inventarioIngId} onClose={() => setInventarioIngId(null)} />
    </div>
  );
};
