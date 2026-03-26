import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { vehiculosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { VehiculoModal } from '../../components/vehiculos/VehiculoModal';
import type { Vehiculo } from '@ags/shared';

function vencimientoStatus(fecha: string): 'ok' | 'warning' | 'expired' {
  if (!fecha) return 'ok';
  const diff = new Date(fecha).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days < 30) return 'warning';
  return 'ok';
}

const STATUS_CLS = { ok: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', expired: 'bg-red-50 text-red-700 font-bold' };

export const VehiculosList = () => {
  const navigate = useNavigate();

  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);

  const [items, setItems] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Vehiculo | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setItems(await vehiculosService.getAll());
    } catch (err) {
      console.error('Error cargando vehículos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return items;
    const t = debouncedSearch.toLowerCase();
    return items.filter(v =>
      v.patente.toLowerCase().includes(t) || v.marca.toLowerCase().includes(t) || v.modelo.toLowerCase().includes(t) || v.asignadoA.toLowerCase().includes(t)
    );
  }, [items, debouncedSearch]);

  const handleDelete = async (v: Vehiculo) => {
    if (!confirm(`Eliminar vehículo "${v.patente}"?`)) return;
    try {
      await vehiculosService.delete(v.id);
      await loadData();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Vehículos"
        subtitle="Seguimiento vehicular y service"
        count={filtered.length}
        actions={<Button size="sm" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Nuevo vehículo</Button>}
      >
        <input
          type="text"
          placeholder="Buscar por patente, marca, modelo o asignado..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </PageHeader>

      <div className="flex-1 overflow-auto px-5 pb-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 text-center py-12">
            <p className="text-slate-400">No se encontraron vehículos</p>
            <button onClick={() => { setEditItem(null); setShowModal(true); }} className="text-teal-600 hover:underline mt-2 inline-block text-xs">Crear primer vehículo</button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(v => (
              <div key={v.id} className="bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <button onClick={() => navigate(`/vehiculos/${v.id}`)} className="font-mono text-sm font-bold tracking-wider hover:text-teal-300 transition-colors">{v.patente}</button>
                    <p className="text-[11px] text-slate-400">{[v.marca, v.modelo, v.anio].filter(Boolean).join(' ')}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{v.asignadoA}</span>
                </div>

                {/* Vencimientos */}
                {v.vencimientos.length > 0 && (
                  <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1.5">
                    {v.vencimientos.map((vc, i) => {
                      const st = vencimientoStatus(vc.fecha);
                      return (
                        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CLS[st]}`}>
                          {vc.tipo}: {vc.fecha ? new Date(vc.fecha).toLocaleDateString('es-AR') : '—'}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Criterios resumen */}
                <div className="px-4 py-2 text-[11px] text-slate-500">
                  {v.criteriosServicio.length} criterios de servicio configurados
                  {v.kmActual != null && <span className="ml-2 font-mono text-slate-700">{v.kmActual.toLocaleString('es-AR')} km</span>}
                </div>

                {/* Actions */}
                <div className="px-4 py-2 border-t border-slate-100 flex justify-end gap-1">
                  <button onClick={() => navigate(`/vehiculos/${v.id}`)} className="px-2 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-50 rounded transition-colors">Ver detalle</button>
                  <button onClick={() => { setEditItem(v); setShowModal(true); }} className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Editar</button>
                  <button onClick={() => handleDelete(v)} className="px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <VehiculoModal open={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} onSaved={loadData} editData={editItem} />
    </div>
  );
};
