import { useState, useEffect } from 'react';
import { categoriasPresupuestoService } from '../../services/firebaseService';
import type { CategoriaPresupuesto } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props { open: boolean; onClose: () => void; }

const INITIAL_FORM = {
  nombre: '', descripcion: '',
  incluyeIva: true, porcentajeIva: 21, ivaReduccion: false, porcentajeIvaReduccion: 0,
  incluyeGanancias: false, porcentajeGanancias: 0,
  incluyeIIBB: false, porcentajeIIBB: 0,
  activo: true,
};

export const CategoriasPresupuestoModal: React.FC<Props> = ({ open, onClose }) => {
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    try { setCategorias(await categoriasPresupuestoService.getAll()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const resetForm = () => { setForm(INITIAL_FORM); setEditingId(null); setShowForm(false); };

  const handleEdit = (c: CategoriaPresupuesto) => {
    setForm({
      nombre: c.nombre, descripcion: c.descripcion || '',
      incluyeIva: c.incluyeIva, porcentajeIva: c.porcentajeIva || 21,
      ivaReduccion: c.ivaReduccion || false, porcentajeIvaReduccion: c.porcentajeIvaReduccion || 0,
      incluyeGanancias: c.incluyeGanancias, porcentajeGanancias: c.porcentajeGanancias || 0,
      incluyeIIBB: c.incluyeIIBB, porcentajeIIBB: c.porcentajeIIBB || 0,
      activo: c.activo,
    });
    setEditingId(c.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingId) await categoriasPresupuestoService.update(editingId, form);
      else await categoriasPresupuestoService.create(form);
      resetForm(); await loadData();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar esta categoría?')) return;
    await categoriasPresupuestoService.delete(id); await loadData();
  };

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";
  const chk = "flex items-center gap-2 text-xs text-slate-600 cursor-pointer";

  return (
    <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="Categorías impositivas" subtitle={`${categorias.length} categorías`} maxWidth="lg">
      <div className="space-y-3">
        {!showForm && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nueva categoría</Button>
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">{editingId ? 'Editar categoría' : 'Nueva categoría'}</p>
            <div>
              <label className={lbl}>Nombre *</label>
              <Input inputSize="sm" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Servicios técnicos" />
            </div>
            <div>
              <label className={lbl}>Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={2} className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y" />
            </div>

            {/* IVA */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className={chk}>
                <input type="checkbox" checked={form.incluyeIva} onChange={e => setForm({ ...form, incluyeIva: e.target.checked })} className="rounded border-slate-300" />
                Incluye IVA
              </label>
              {form.incluyeIva && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className={lbl}>% IVA</label>
                    <Input inputSize="sm" type="number" step="0.1" value={String(form.porcentajeIva)} onChange={e => setForm({ ...form, porcentajeIva: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className={chk}>
                      <input type="checkbox" checked={form.ivaReduccion} onChange={e => setForm({ ...form, ivaReduccion: e.target.checked })} className="rounded border-slate-300" />
                      Reducción
                    </label>
                    {form.ivaReduccion && (
                      <Input inputSize="sm" type="number" step="0.1" value={String(form.porcentajeIvaReduccion)} onChange={e => setForm({ ...form, porcentajeIvaReduccion: parseFloat(e.target.value) || 0 })} className="mt-1" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ganancias + IIBB */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div className="space-y-2">
                <label className={chk}>
                  <input type="checkbox" checked={form.incluyeGanancias} onChange={e => setForm({ ...form, incluyeGanancias: e.target.checked })} className="rounded border-slate-300" />
                  Ganancias
                </label>
                {form.incluyeGanancias && (
                  <div className="pl-6">
                    <Input inputSize="sm" type="number" step="0.1" value={String(form.porcentajeGanancias)} onChange={e => setForm({ ...form, porcentajeGanancias: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className={chk}>
                  <input type="checkbox" checked={form.incluyeIIBB} onChange={e => setForm({ ...form, incluyeIIBB: e.target.checked })} className="rounded border-slate-300" />
                  IIBB
                </label>
                {form.incluyeIIBB && (
                  <div className="pl-6">
                    <Input inputSize="sm" type="number" step="0.1" value={String(form.porcentajeIIBB)} onChange={e => setForm({ ...form, porcentajeIIBB: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
            </div>

            <label className={`${chk} border-t border-slate-100 pt-3`}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="rounded border-slate-300" />
              Activa
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.nombre.trim()}>
                {saving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 text-xs py-6">Cargando...</p>
        ) : categorias.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">No hay categorías configuradas</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Nombre</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">IVA</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Ganancias</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">IIBB</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Estado</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorias.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{c.nombre}</span>
                    {c.descripcion && <p className="text-[10px] text-slate-400 mt-0.5">{c.descripcion}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.incluyeIva ? `${c.porcentajeIva}%${c.ivaReduccion ? ` (Red: ${c.porcentajeIvaReduccion}%)` : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.incluyeGanancias ? `${c.porcentajeGanancias}%` : '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{c.incluyeIIBB ? `${c.porcentajeIIBB}%` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center space-x-2">
                    <button className="text-teal-600 hover:underline" onClick={() => handleEdit(c)}>Editar</button>
                    <button className="text-red-500 hover:underline" onClick={() => handleDelete(c.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
};
