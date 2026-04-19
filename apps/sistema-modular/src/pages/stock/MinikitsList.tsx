import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { minikitsService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Minikit, EstadoMinikit } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const ESTADO_LABELS: Record<EstadoMinikit, string> = {
  en_base: 'En base', en_campo: 'En campo', en_transito: 'En tránsito', en_revision: 'En revisión',
};
const ESTADO_COLORS: Record<EstadoMinikit, string> = {
  en_base: 'bg-green-100 text-green-700', en_campo: 'bg-blue-100 text-teal-600',
  en_transito: 'bg-amber-100 text-amber-700', en_revision: 'bg-purple-100 text-purple-700',
};

export const MinikitsList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('minikits-list');
  const FILTER_SCHEMA = useMemo(() => ({
    showInactive: { type: 'boolean' as const, default: false },
    sortField: { type: 'string' as const, default: 'codigo' },
    sortDir:   { type: 'string' as const, default: 'asc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [loading, setLoading] = useState(true);
  const sortedMinikits = useMemo(
    () => sortByField(minikits, filters.sortField, filters.sortDir as SortDir),
    [minikits, filters.sortField, filters.sortDir],
  );

  // Inline create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '' });
  const [creating, setCreating] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = minikitsService.subscribe(
      !filters.showInactive,
      (data) => { setMinikits(data); setLoading(false); },
      (err) => { console.error('Error cargando minikits:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [filters.showInactive]);


  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return;
    setCreating(true);
    try {
      await minikitsService.create({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        estado: 'en_base',
        asignadoA: null,
        activo: true,
      });
      setForm({ codigo: '', nombre: '', descripcion: '' });
      setShowCreate(false);
    } catch {
      alert('Error al crear el minikit');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActivo = async (mk: Minikit) => {
    try {
      await minikitsService.update(mk.id, { activo: !mk.activo });
    } catch {
      alert('Error al cambiar el estado');
    }
  };

  const handleDelete = async (mk: Minikit) => {
    if (!await confirm(`¿Eliminar permanentemente "${mk.codigo} - ${mk.nombre}"?`)) return;
    try {
      await minikitsService.delete(mk.id);
    } catch {
      alert('Error al eliminar el minikit');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Minikits"
        subtitle="Kits portables asignables a ingenieros con unidades de stock"
        count={minikits.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Nuevo minikit'}
          </Button>
        }
      >
        {showCreate && (
          <Card>
            <div className="grid grid-cols-3 gap-3 items-end">
              <Input
                label="Codigo"
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="Ej: MKGC1"
                autoFocus
              />
              <Input
                label="Nombre"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Kit GC campo"
              />
              <Input
                label="Descripcion (opcional)"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Breve descripcion..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setShowCreate(false); setForm({ codigo: '', nombre: '', descripcion: '' }); }
                }}
              />
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={creating || !form.codigo.trim() || !form.nombre.trim()}>
                {creating ? 'Creando...' : 'Agregar minikit'}
              </Button>
            </div>
          </Card>
        )}
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">{minikits.length} minikit(s)</p>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.showInactive} onChange={e => setFilter('showInactive', e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-600" />
            Mostrar inactivos
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : minikits.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay minikits registrados. Use el botón "+ Nuevo minikit" para agregar.</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white overflow-x-auto">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
              )}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortableHeader label="Código" field="codigo" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(0)}`}><ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} /><div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Nombre" field="nombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(1)}`}><ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} /><div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Estado" field="estado" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(2)}`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} /><div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <SortableHeader label="Asignado a" field="asignadoA.nombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`relative px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider ${getAlignClass(3)}`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></SortableHeader>
                  <th className="relative px-2 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Acciones<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMinikits.map(mk => (
                  <tr key={mk.id} className={`hover:bg-slate-50 ${!mk.activo ? 'opacity-50' : ''}`}>
                    <td className={`px-2 py-2 ${getAlignClass(0)}`}>
                      <span className="font-mono font-semibold text-teal-600 text-xs whitespace-nowrap">{mk.codigo}</span>
                    </td>
                    <td className={`px-2 py-2 text-xs text-slate-900 truncate ${getAlignClass(1)}`}>{mk.nombre}</td>
                    <td className={`px-2 py-2 ${getAlignClass(2)}`}>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[mk.estado]}`}>
                        {ESTADO_LABELS[mk.estado]}
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-[10px] text-slate-500 truncate ${getAlignClass(3)}`}>
                      {mk.asignadoA ? `${mk.asignadoA.tipo === 'ingeniero' ? 'Ing.' : 'OT'} ${mk.asignadoA.nombre}` : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-3">
                        <Link to={`/stock/minikits/${mk.id}`}
                          className="text-teal-600 hover:underline font-medium text-[10px]">Ver</Link>
                        <button onClick={() => handleToggleActivo(mk)}
                          className={`font-medium text-[10px] ${mk.activo ? 'text-amber-600 hover:underline' : 'text-green-600 hover:underline'}`}>
                          {mk.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleDelete(mk)}
                          className="text-red-600 hover:underline font-medium text-[10px]">Eliminar</button>
                      </div>
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
};
