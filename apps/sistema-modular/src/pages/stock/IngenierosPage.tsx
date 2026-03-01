import { useState, useEffect } from 'react';
import { ingenierosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Ingeniero, AreaIngeniero } from '@ags/shared';

const AREA_LABELS: Record<AreaIngeniero, string> = {
  campo: 'Campo',
  taller: 'Taller',
  electronica: 'Electrónica',
  mecanica: 'Mecánica',
  ventas: 'Ventas',
  admin: 'Administración',
};

const AREA_OPTIONS: AreaIngeniero[] = ['campo', 'taller', 'electronica', 'mecanica', 'ventas', 'admin'];

interface FormState {
  nombre: string;
  email: string;
  telefono: string;
  area: AreaIngeniero | '';
}

const emptyForm: FormState = { nombre: '', email: '', telefono: '', area: '' };

export const IngenierosPage = () => {
  const [items, setItems] = useState<Ingeniero[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await ingenierosService.getAll(!showInactive);
      setItems(data);
    } catch (err) {
      console.error('Error cargando ingenieros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [showInactive]);

  const handleCreate = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await ingenierosService.create({
        nombre: form.nombre.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        area: form.area || null,
        activo: true,
      });
      setForm(emptyForm);
      setShowCreate(false);
      reload();
    } catch { alert('Error al crear el ingeniero'); }
    finally { setSaving(false); }
  };

  const startEdit = (ing: Ingeniero) => {
    setEditingId(ing.id);
    setEditForm({
      nombre: ing.nombre,
      email: ing.email || '',
      telefono: ing.telefono || '',
      area: (ing.area as AreaIngeniero) || '',
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.nombre.trim()) return;
    try {
      await ingenierosService.update(id, {
        nombre: editForm.nombre.trim(),
        email: editForm.email.trim() || null,
        telefono: editForm.telefono.trim() || null,
        area: editForm.area || null,
      });
      setEditingId(null);
      reload();
    } catch { alert('Error al actualizar'); }
  };

  const handleToggle = async (ing: Ingeniero) => {
    try {
      await ingenierosService.update(ing.id, { activo: !ing.activo });
      reload();
    } catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (ing: Ingeniero) => {
    if (!confirm(`¿Eliminar permanentemente "${ing.nombre}"?`)) return;
    try {
      await ingenierosService.delete(ing.id);
      reload();
    } catch { alert('Error al eliminar'); }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Ingenieros"
        subtitle="Catálogo de técnicos e ingenieros de campo"
        count={items.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Agregar'}
          </Button>
        }
      >
        {showCreate && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" autoFocus />
              <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com" />
              <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+54 11 ..." />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Area</label>
                <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value as AreaIngeniero | '' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white">
                  <option value="">Sin asignar</option>
                  {AREA_OPTIONS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={saving || !form.nombre.trim()}>
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
            Mostrar inactivos
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : items.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay ingenieros registrados.</p></div></Card>
        ) : (
          <Card>
            <div className="divide-y divide-slate-50">
              {items.map(ing => (
                <div key={ing.id} className={`flex items-center justify-between py-2 px-2 ${!ing.activo ? 'opacity-50' : ''}`}>
                  {editingId === ing.id ? (
                    <div className="flex-1 mr-4 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Nombre" autoFocus />
                        <input type="text" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Email" />
                        <input type="text" value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Telefono" />
                        <select value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area: e.target.value as AreaIngeniero | '' }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                          <option value="">Sin area</option>
                          {AREA_OPTIONS.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(ing.id)} className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <span className="font-medium text-slate-900 text-xs">{ing.nombre}</span>
                      <div className="flex gap-2 mt-0.5 text-[11px] text-slate-400">
                        {ing.area && <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{AREA_LABELS[ing.area]}</span>}
                        {ing.email && <span>{ing.email}</span>}
                        {ing.telefono && <span>{ing.telefono}</span>}
                      </div>
                    </div>
                  )}
                  {editingId !== ing.id && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(ing)} className="text-blue-600 hover:underline font-medium text-[11px]">Editar</button>
                      <button onClick={() => handleToggle(ing)}
                        className={`font-medium text-[11px] ${ing.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
                        {ing.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => handleDelete(ing)} className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
                    </div>
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
