import { useState, useEffect, useMemo } from 'react';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { consumiblesPorModuloService } from '../../services/consumiblesPorModuloService';
import type { ConsumiblesPorModulo, ConsumibleModulo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ConsumibleModuloForm } from './ConsumibleModuloForm';

const FILTER_SCHEMA = {
  q: { type: 'string' as const, default: '' },
};

interface FormInitial {
  codigoModulo: string;
  descripcion: string;
  activo: boolean;
  consumibles: ConsumibleModulo[];
}

const EMPTY_FORM: FormInitial = { codigoModulo: '', descripcion: '', activo: true, consumibles: [] };

const thClass = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap';

export const ConsumiblesPorModuloList = () => {
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const [items, setItems] = useState<ConsumiblesPorModulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState<FormInitial>(EMPTY_FORM);
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const q = filters.q;

  const load = async () => {
    try {
      setLoading(true);
      setItems(await consumiblesPorModuloService.getAll());
    } catch (err) {
      console.error('Error cargando consumibles por módulo:', err);
      alert('Error al cargar los módulos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it =>
      it.codigoModulo.toLowerCase().includes(needle) ||
      (it.descripcion ?? '').toLowerCase().includes(needle),
    );
  }, [items, q]);

  const handleNew = () => {
    setFormInitial(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (it: ConsumiblesPorModulo) => {
    setFormInitial({
      codigoModulo: it.codigoModulo,
      descripcion: it.descripcion || '',
      activo: it.activo,
      consumibles: it.consumibles.map(c => ({ ...c })),
    });
    setEditingId(it.id);
    setShowForm(true);
  };

  const handleDelete = async (it: ConsumiblesPorModulo) => {
    const ok = await confirm(
      `¿Eliminar el módulo "${it.codigoModulo}"? El catálogo de presupuestos seguirá funcionando para el resto de módulos.`,
    );
    if (!ok) return;
    try {
      await consumiblesPorModuloService.delete(it.id);
      await load();
    } catch (err) {
      console.error('Error eliminando módulo:', err);
      alert('Error al eliminar el módulo');
    }
  };

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Consumibles por módulo</h2>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo declarativo: cada módulo lleva la lista de consumibles que se adjunta al PDF anexo del presupuesto cuando aplica MPCC.
          </p>
        </div>
        <div className="flex gap-3">
          {!showForm && <Button onClick={handleNew}>+ Nuevo módulo</Button>}
          <Button variant="outline" onClick={() => goBack()}>Volver</Button>
        </div>
      </div>

      {showForm ? (
        <ConsumibleModuloForm
          initial={formInitial}
          editingId={editingId}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          onSaved={async () => { setShowForm(false); setEditingId(null); await load(); }}
        />
      ) : (
        <Card>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <input
              type="text"
              value={q}
              onChange={e => setFilter('q', e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
            />
            <span className="text-[11px] text-slate-400 ml-auto">{filtered.length} módulo(s)</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-slate-400">Sin módulos en el catálogo.</p>
              <Button onClick={handleNew}>Crear primer módulo</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-xs">No se encontraron módulos para "{q}"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Código módulo</th>
                    <th className={thClass}>Descripción</th>
                    <th className={thClass}># Consumibles</th>
                    <th className={thClass}>Estado</th>
                    <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(it => (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{it.codigoModulo}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 truncate max-w-[280px]">
                        {it.descripcion || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 whitespace-nowrap">{it.consumibles.length}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${it.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {it.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => handleEdit(it)} className="text-xs px-3 py-1">Editar</Button>
                          <Button variant="outline" onClick={() => handleDelete(it)} className="text-xs px-3 py-1 text-red-600 hover:text-red-700 hover:border-red-300">Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
