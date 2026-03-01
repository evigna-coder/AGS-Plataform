import { useState, useEffect } from 'react';
import { posicionesStockService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { PosicionStock, TipoPosicionStock } from '@ags/shared';

const TIPO_LABELS: Record<TipoPosicionStock, string> = {
  cajonera: 'Cajonera',
  estante: 'Estante',
  deposito: 'Depósito',
  vitrina: 'Vitrina',
  otro: 'Otro',
};

const TIPO_OPTIONS: TipoPosicionStock[] = ['cajonera', 'estante', 'deposito', 'vitrina', 'otro'];

interface FormState { codigo: string; nombre: string; descripcion: string; tipo: TipoPosicionStock; }
const emptyForm: FormState = { codigo: '', nombre: '', descripcion: '', tipo: 'cajonera' };

export const PosicionesPage = () => {
  const [items, setItems] = useState<PosicionStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const reload = async () => {
    setLoading(true);
    try { setItems(await posicionesStockService.getAll(!showInactive)); }
    catch (err) { console.error('Error cargando posiciones:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [showInactive]);

  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return;
    setSaving(true);
    try {
      await posicionesStockService.create({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        activo: true,
      });
      setForm(emptyForm);
      setShowCreate(false);
      reload();
    } catch { alert('Error al crear la posición'); }
    finally { setSaving(false); }
  };

  const startEdit = (pos: PosicionStock) => {
    setEditingId(pos.id);
    setEditForm({ codigo: pos.codigo, nombre: pos.nombre, descripcion: pos.descripcion || '', tipo: pos.tipo });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.codigo.trim() || !editForm.nombre.trim()) return;
    try {
      await posicionesStockService.update(id, {
        codigo: editForm.codigo.trim(),
        nombre: editForm.nombre.trim(),
        descripcion: editForm.descripcion.trim() || null,
        tipo: editForm.tipo,
      });
      setEditingId(null);
      reload();
    } catch { alert('Error al actualizar'); }
  };

  const handleToggle = async (pos: PosicionStock) => {
    try { await posicionesStockService.update(pos.id, { activo: !pos.activo }); reload(); }
    catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (pos: PosicionStock) => {
    if (!confirm(`¿Eliminar permanentemente "${pos.codigo} - ${pos.nombre}"?`)) return;
    try { await posicionesStockService.delete(pos.id); reload(); }
    catch { alert('Error al eliminar'); }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Posiciones de stock"
        subtitle="Ubicaciones fisicas: cajoneras, estantes, depositos"
        count={items.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Agregar'}
          </Button>
        }
      >
        {showCreate && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Codigo *" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="CAJ-01" autoFocus />
              <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Cajonera 1" />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoPosicionStock }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white">
                  {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
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

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        <div className="flex justify-end">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600" />
            Mostrar inactivas
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : items.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay posiciones registradas.</p></div></Card>
        ) : (
          <Card>
            <div className="divide-y divide-slate-50">
              {items.map(pos => (
                <div key={pos.id} className={`flex items-center justify-between py-2 px-2 ${!pos.activo ? 'opacity-50' : ''}`}>
                  {editingId === pos.id ? (
                    <div className="flex-1 mr-4 space-y-1.5">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <input type="text" value={editForm.codigo} onChange={e => setEditForm(f => ({ ...f, codigo: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Codigo" autoFocus />
                        <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Nombre" />
                        <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value as TipoPosicionStock }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                          {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                        </select>
                        <input type="text" value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Descripcion" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(pos.id)} className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-indigo-700">{pos.codigo}</span>
                          <span className="font-medium text-slate-900 text-xs">{pos.nombre}</span>
                          <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{TIPO_LABELS[pos.tipo]}</span>
                        </div>
                        {pos.descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{pos.descripcion}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(pos)} className="text-blue-600 hover:underline font-medium text-[11px]">Editar</button>
                        <button onClick={() => handleToggle(pos)}
                          className={`font-medium text-[11px] ${pos.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
                          {pos.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleDelete(pos)} className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
