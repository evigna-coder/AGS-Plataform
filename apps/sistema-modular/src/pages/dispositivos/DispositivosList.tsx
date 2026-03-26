import { useState, useEffect, useMemo } from 'react';
import { dispositivosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DispositivoModal } from '../../components/dispositivos/DispositivoModal';
import type { Dispositivo, TipoDispositivo } from '@ags/shared';

const TIPO_LABELS: Record<TipoDispositivo, string> = {
  celular: 'Celular', computadora: 'Computadora', tablet: 'Tablet', otro: 'Otro',
};
const TIPO_COLORS: Record<TipoDispositivo, string> = {
  celular: 'bg-blue-50 text-blue-700',
  computadora: 'bg-purple-50 text-purple-700',
  tablet: 'bg-teal-50 text-teal-700',
  otro: 'bg-slate-100 text-slate-600',
};

export const DispositivosList = () => {
  const [items, setItems] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Dispositivo | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setItems(await dispositivosService.getAll());
    } catch (err) {
      console.error('Error cargando dispositivos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return items;
    const t = debouncedSearch.toLowerCase();
    return items.filter(d =>
      d.marca.toLowerCase().includes(t) || d.modelo.toLowerCase().includes(t) ||
      d.serie.toLowerCase().includes(t) || (d.asignadoANombre ?? '').toLowerCase().includes(t)
    );
  }, [items, debouncedSearch]);

  const handleDelete = async (d: Dispositivo) => {
    if (!confirm(`Eliminar dispositivo "${d.marca} ${d.modelo}"?`)) return;
    try {
      await dispositivosService.delete(d.id);
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
        title="Dispositivos"
        subtitle="Celulares, computadoras y otros dispositivos"
        count={filtered.length}
        actions={<Button size="sm" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Nuevo dispositivo</Button>}
      >
        <input type="text" placeholder="Buscar por marca, modelo, serie o asignado..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-72 focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </PageHeader>

      <div className="flex-1 overflow-auto px-5 pb-4">
        {filtered.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No se encontraron dispositivos</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Tipo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Marca / Modelo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Serie</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Asignado a</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[d.tipo]}`}>
                        {TIPO_LABELS[d.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-semibold text-slate-900">{d.marca} {d.modelo}</span>
                      {d.descripcion && <p className="text-[10px] text-slate-400 mt-0.5">{d.descripcion}</p>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{d.serie || '-'}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{d.asignadoANombre || '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditItem(d); setShowModal(true); }} className="text-xs text-teal-600 hover:underline font-medium">Editar</button>
                        <button onClick={() => handleDelete(d)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DispositivoModal open={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} onSaved={loadData} editData={editItem} />
    </div>
  );
};
