import { useState } from 'react';
import { posicionesStockService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { usePosicionesTree, type PosicionNode } from '../../hooks/usePosicionesTree';
import type { TipoPosicionStock, UnidadStock } from '@ags/shared';

const TIPO_LABELS: Record<TipoPosicionStock, string> = {
  cajonera: 'Cajonera', estante: 'Estante', deposito: 'Depósito', vitrina: 'Vitrina', otro: 'Otro',
};
const TIPO_OPTIONS: TipoPosicionStock[] = ['cajonera', 'estante', 'deposito', 'vitrina', 'otro'];

interface FormState {
  codigo: string; nombre: string; descripcion: string;
  tipo: TipoPosicionStock; parentId: string; zona: string;
}
const emptyForm: FormState = { codigo: '', nombre: '', descripcion: '', tipo: 'cajonera', parentId: '', zona: '' };

export const PosicionesPage = () => {
  const [showInactive, setShowInactive] = useState(false);
  const { tree, allPositions, loading, reload, expandedIds, toggleExpand, unitsCache, loadingUnits } = usePosicionesTree(showInactive);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [zonaFilter, setZonaFilter] = useState('');

  // Unique zones for filter
  const zonas = [...new Set(allPositions.map(p => p.zona).filter(Boolean))] as string[];

  const parentOptions = [
    { value: '', label: 'Ninguno (raíz)' },
    ...allPositions.map(p => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` })),
  ];

  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return;
    setSaving(true);
    try {
      await posicionesStockService.create({
        codigo: form.codigo.trim(), nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null, tipo: form.tipo,
        parentId: form.parentId || null, zona: form.zona.trim() || null,
        activo: true,
      });
      setForm(emptyForm);
      setShowCreate(false);
      reload(true);
    } catch { alert('Error al crear la posición'); }
    finally { setSaving(false); }
  };

  const startEdit = (pos: PosicionNode) => {
    setEditingId(pos.id);
    setEditForm({
      codigo: pos.codigo, nombre: pos.nombre, descripcion: pos.descripcion || '',
      tipo: pos.tipo, parentId: pos.parentId || '', zona: pos.zona || '',
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.codigo.trim() || !editForm.nombre.trim()) return;
    try {
      await posicionesStockService.update(id, {
        codigo: editForm.codigo.trim(), nombre: editForm.nombre.trim(),
        descripcion: editForm.descripcion.trim() || null, tipo: editForm.tipo,
        parentId: editForm.parentId || null, zona: editForm.zona.trim() || null,
      });
      setEditingId(null);
      reload(true);
    } catch { alert('Error al actualizar'); }
  };

  const handleToggle = async (pos: PosicionNode) => {
    try { await posicionesStockService.update(pos.id, { activo: !pos.activo }); reload(true); }
    catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (pos: PosicionNode) => {
    if (pos.children.length > 0) { alert('No se puede eliminar una posición con sub-posiciones. Elimine o mueva las hijas primero.'); return; }
    if (!confirm(`¿Eliminar permanentemente "${pos.codigo} — ${pos.nombre}"?`)) return;
    try { await posicionesStockService.delete(pos.id); reload(true); }
    catch { alert('Error al eliminar'); }
  };

  const filteredTree = zonaFilter
    ? tree.filter(n => filterByZona(n, zonaFilter))
    : tree;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Posiciones de stock"
        subtitle="Ubicaciones fisicas: cajoneras, estantes, depositos"
        count={allPositions.length}
        actions={<Button size="sm" onClick={() => setShowCreate(v => !v)}>{showCreate ? 'Cancelar' : '+ Agregar'}</Button>}
      >
        {showCreate && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Codigo *" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="CAJ-01" autoFocus />
              <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Cajonera 1" />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoPosicionStock }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white">
                  {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Posición padre</label>
                <SearchableSelect value={form.parentId} onChange={v => setForm(f => ({ ...f, parentId: v }))} options={parentOptions} placeholder="Ninguno (raíz)" />
              </div>
              <Input label="Zona" value={form.zona} onChange={e => setForm(f => ({ ...f, zona: e.target.value }))} placeholder="Almacén, Taller..." />
              <Input label="Descripcion" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={saving || !form.codigo.trim() || !form.nombre.trim()}>
                {saving ? 'Creando...' : 'Agregar'}
              </Button>
            </div>
          </Card>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {zonas.length > 0 && (
              <select value={zonaFilter} onChange={e => setZonaFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-600">
                <option value="">Todas las zonas</option>
                {zonas.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
            Mostrar inactivas
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : filteredTree.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay posiciones registradas.</p></div></Card>
        ) : (
          <div className="bg-white rounded-lg border border-slate-100">
            {filteredTree.map(node => (
              <PosicionRow
                key={node.id} node={node} depth={0}
                expandedIds={expandedIds} toggleExpand={toggleExpand}
                unitsCache={unitsCache} loadingUnits={loadingUnits}
                editingId={editingId} editForm={editForm} setEditForm={setEditForm}
                onStartEdit={startEdit} onUpdate={handleUpdate}
                onCancelEdit={() => setEditingId(null)}
                onToggle={handleToggle} onDelete={handleDelete}
                parentOptions={parentOptions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Tree Row ---
interface RowProps {
  node: PosicionNode; depth: number;
  expandedIds: Set<string>; toggleExpand: (id: string) => void;
  unitsCache: Record<string, UnidadStock[]>; loadingUnits: Set<string>;
  editingId: string | null; editForm: FormState; setEditForm: (f: FormState) => void;
  onStartEdit: (n: PosicionNode) => void; onUpdate: (id: string) => void;
  onCancelEdit: () => void; onToggle: (n: PosicionNode) => void; onDelete: (n: PosicionNode) => void;
  parentOptions: { value: string; label: string }[];
}

const PosicionRow = ({
  node, depth, expandedIds, toggleExpand, unitsCache, loadingUnits,
  editingId, editForm, setEditForm, onStartEdit, onUpdate, onCancelEdit, onToggle, onDelete, parentOptions,
}: RowProps) => {
  const isExpanded = expandedIds.has(node.id);
  const units = unitsCache[node.id];
  const isLoadingUnits = loadingUnits.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div className={`border-b border-slate-50 ${!node.activo ? 'opacity-50' : ''}`} style={{ paddingLeft: `${depth * 24 + 8}px` }}>
        {editingId === node.id ? (
          <div className="py-2 pr-2 space-y-1.5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <input type="text" value={editForm.codigo} onChange={e => setEditForm({ ...editForm, codigo: e.target.value })}
                className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Codigo" autoFocus />
              <input type="text" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Nombre" />
              <select value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value as TipoPosicionStock })}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
              <input type="text" value={editForm.zona} onChange={e => setEditForm({ ...editForm, zona: e.target.value })}
                className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Zona" />
              <input type="text" value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Descripcion" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => onUpdate(node.id)} className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
              <button onClick={onCancelEdit} className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2 pr-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <button onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-teal-600 shrink-0 text-xs">
                {hasChildren ? (isExpanded ? '▼' : '▶') : (isExpanded ? '▽' : '△')}
              </button>
              <span className="font-mono text-xs font-semibold text-teal-700">{node.codigo}</span>
              <span className="font-medium text-slate-900 text-xs truncate">{node.nombre}</span>
              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">{TIPO_LABELS[node.tipo]}</span>
              {node.zona && <span className="text-[10px] font-medium bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded shrink-0">{node.zona}</span>}
              {hasChildren && <span className="text-[10px] text-slate-400 shrink-0">{node.children.length} sub</span>}
              {units && units.length > 0 && (
                <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded shrink-0">{units.length} uds</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => onStartEdit(node)} className="text-teal-600 hover:underline font-medium text-[11px]">Editar</button>
              <button onClick={() => onToggle(node)}
                className={`font-medium text-[11px] ${node.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
                {node.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => onDelete(node)} className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
            </div>
          </div>
        )}

        {/* Expanded: units in this position */}
        {isExpanded && editingId !== node.id && (
          <div className="pb-2 pr-2" style={{ paddingLeft: 28 }}>
            {isLoadingUnits ? (
              <p className="text-[11px] text-slate-400">Cargando contenido...</p>
            ) : units && units.length > 0 ? (
              <div className="bg-slate-50 rounded p-2 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Contenido ({units.length})</p>
                {units.map(u => <UnitRow key={u.id} unit={u} />)}
              </div>
            ) : units ? (
              <p className="text-[11px] text-slate-400 italic">Sin unidades en esta posición</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && node.children.map(child => (
        <PosicionRow
          key={child.id} node={child} depth={depth + 1}
          expandedIds={expandedIds} toggleExpand={toggleExpand}
          unitsCache={unitsCache} loadingUnits={loadingUnits}
          editingId={editingId} editForm={editForm} setEditForm={setEditForm}
          onStartEdit={onStartEdit} onUpdate={onUpdate}
          onCancelEdit={onCancelEdit} onToggle={onToggle} onDelete={onDelete}
          parentOptions={parentOptions}
        />
      ))}
    </>
  );
};

const UnitRow = ({ unit }: { unit: UnidadStock }) => (
  <div className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-teal-700">{unit.articuloCodigo}</span>
      <span className="text-slate-700 truncate max-w-[200px]">{unit.articuloDescripcion}</span>
      {unit.nroSerie && <span className="text-[10px] text-slate-400">S/N: {unit.nroSerie}</span>}
    </div>
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        unit.estado === 'disponible' ? 'bg-green-50 text-green-700' :
        unit.estado === 'reservado' ? 'bg-amber-50 text-amber-700' :
        'bg-slate-100 text-slate-600'
      }`}>{unit.estado}</span>
      <span className="text-[10px] text-slate-400">{unit.condicion}</span>
    </div>
  </div>
);

function filterByZona(node: PosicionNode, zona: string): boolean {
  if (node.zona === zona) return true;
  return node.children.some(c => filterByZona(c, zona));
}
