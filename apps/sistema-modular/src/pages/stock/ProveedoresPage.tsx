import { useState, useEffect } from 'react';
import { proveedoresService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Proveedor } from '@ags/shared';

interface FormState {
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  pais: string;
  cuit: string;
  notas: string;
}

const emptyForm: FormState = { nombre: '', contacto: '', email: '', telefono: '', direccion: '', pais: '', cuit: '', notas: '' };

export const ProveedoresPage = () => {
  const [items, setItems] = useState<Proveedor[]>([]);
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
      const data = await proveedoresService.getAll(!showInactive);
      setItems(data);
    } catch (err) {
      console.error('Error cargando proveedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [showInactive]);

  const handleCreate = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await proveedoresService.create({
        nombre: form.nombre.trim(),
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        pais: form.pais.trim() || null,
        cuit: form.cuit.trim() || null,
        notas: form.notas.trim() || null,
        activo: true,
      });
      setForm(emptyForm);
      setShowCreate(false);
      reload();
    } catch { alert('Error al crear el proveedor'); }
    finally { setSaving(false); }
  };

  const toForm = (p: Proveedor): FormState => ({
    nombre: p.nombre, contacto: p.contacto || '', email: p.email || '',
    telefono: p.telefono || '', direccion: p.direccion || '',
    pais: p.pais || '', cuit: p.cuit || '', notas: p.notas || '',
  });

  const startEdit = (p: Proveedor) => { setEditingId(p.id); setEditForm(toForm(p)); };

  const handleUpdate = async (id: string) => {
    if (!editForm.nombre.trim()) return;
    try {
      await proveedoresService.update(id, {
        nombre: editForm.nombre.trim(),
        contacto: editForm.contacto.trim() || null,
        email: editForm.email.trim() || null,
        telefono: editForm.telefono.trim() || null,
        direccion: editForm.direccion.trim() || null,
        pais: editForm.pais.trim() || null,
        cuit: editForm.cuit.trim() || null,
        notas: editForm.notas.trim() || null,
      });
      setEditingId(null);
      reload();
    } catch { alert('Error al actualizar'); }
  };

  const handleToggle = async (p: Proveedor) => {
    try { await proveedoresService.update(p.id, { activo: !p.activo }); reload(); }
    catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (p: Proveedor) => {
    if (!confirm(`¿Eliminar permanentemente "${p.nombre}"?`)) return;
    try { await proveedoresService.delete(p.id); reload(); }
    catch { alert('Error al eliminar'); }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Proveedores"
        subtitle="Catálogo de proveedores de partes e insumos"
        count={items.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Agregar'}
          </Button>
        }
      >
        {showCreate && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Razon social" autoFocus />
              <Input label="Contacto" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Persona de contacto" />
              <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@proveedor.com" />
              <Input label="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+1 ..." />
              <Input label="CUIT" value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" />
              <Input label="Pais" value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} placeholder="EE.UU., Alemania..." />
              <div className="sm:col-span-2 lg:col-span-3">
                <Input label="Direccion" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Direccion completa" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Input label="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Notas adicionales" />
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
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay proveedores registrados.</p></div></Card>
        ) : (
          <Card>
            <div className="divide-y divide-slate-50">
              {items.map(p => (
                <div key={p.id} className={`py-2 px-2 ${!p.activo ? 'opacity-50' : ''}`}>
                  {editingId === p.id ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Nombre" autoFocus />
                        <input type="text" value={editForm.contacto} onChange={e => setEditForm(f => ({ ...f, contacto: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Contacto" />
                        <input type="text" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Email" />
                        <input type="text" value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Telefono" />
                        <input type="text" value={editForm.cuit} onChange={e => setEditForm(f => ({ ...f, cuit: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="CUIT" />
                        <input type="text" value={editForm.pais} onChange={e => setEditForm(f => ({ ...f, pais: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Pais" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(p.id)} className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 text-xs">{p.nombre}</span>
                        <div className="flex flex-wrap gap-x-2 mt-0.5 text-[11px] text-slate-400">
                          {p.contacto && <span>{p.contacto}</span>}
                          {p.email && <span>{p.email}</span>}
                          {p.telefono && <span>{p.telefono}</span>}
                          {p.pais && <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.pais}</span>}
                          {p.cuit && <span>CUIT: {p.cuit}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline font-medium text-[11px]">Editar</button>
                        <button onClick={() => handleToggle(p)}
                          className={`font-medium text-[11px] ${p.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
                      </div>
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
