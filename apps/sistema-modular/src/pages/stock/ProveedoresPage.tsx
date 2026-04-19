import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { proveedoresService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateProveedorModal } from '../../components/stock/CreateProveedorModal';
import type { Proveedor } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const TIPO_COLORS = { nacional: 'bg-blue-50 text-blue-700', internacional: 'bg-purple-50 text-purple-700' };

export const ProveedoresPage = () => {
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [sortField, setSortField] = useState<string>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const sorted = useMemo(() => sortByField(items, sortField, sortDir), [items, sortField, sortDir]);

  const unsubRef = useRef<(() => void) | null>(null);
  const [allItems, setAllItems] = useState<Proveedor[]>([]);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = proveedoresService.subscribe(
      !showInactive,
      (data) => { setAllItems(data); setLoading(false); },
      (err) => { console.error('Error cargando proveedores:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [showInactive]);

  useEffect(() => {
    setItems(filterTipo ? allItems.filter(p => p.tipo === filterTipo) : allItems);
  }, [allItems, filterTipo]);

  const reload = useCallback(() => {}, []);

  const handleToggle = async (p: Proveedor) => {
    try { await proveedoresService.update(p.id, { activo: !p.activo }); reload(); }
    catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (p: Proveedor) => {
    if (!await confirm(`¿Eliminar permanentemente "${p.nombre}"?`)) return;
    try { await proveedoresService.delete(p.id); reload(); }
    catch { alert('Error al eliminar'); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Proveedores"
        subtitle="Catálogo de proveedores de partes e insumos"
        count={items.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Agregar</Button>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los tipos</option>
            <option value="nacional">Nacional</option>
            <option value="internacional">Internacional</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
            Mostrar inactivos
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : items.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay proveedores registrados.</p></div></Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortableHeader label="Nombre" field="nombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="Contacto" field="contacto" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="País" field="pais" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider" />
                  <SortableHeader label="CUIT" field="cuit" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider" />
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(p => (
                  <tr key={p.id} className={`hover:bg-slate-50 ${!p.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-900 text-xs">{p.nombre}</span>
                      {p.email && <div className="text-[11px] text-slate-400">{p.email}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[p.tipo] || 'bg-slate-100 text-slate-600'}`}>
                        {p.tipo === 'internacional' ? 'Internacional' : 'Nacional'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{p.contacto || '-'}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{p.pais || '-'}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{p.cuit || '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link to={`/stock/proveedores/${p.id}`} className="text-xs text-teal-600 hover:underline font-medium">Ver</Link>
                        <button onClick={() => handleToggle(p)}
                          className={`font-medium text-[11px] ${p.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-[11px] text-red-600 hover:underline font-medium">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateProveedorModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </div>
  );
};
