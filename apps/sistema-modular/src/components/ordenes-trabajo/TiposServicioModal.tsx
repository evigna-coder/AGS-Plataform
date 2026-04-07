import { useState, useEffect } from 'react';
import { tiposServicioService } from '../../services/firebaseService';
import type { TipoServicio } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props { open: boolean; onClose: () => void; }

export const TiposServicioModal: React.FC<Props> = ({ open, onClose }) => {
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', activo: true, requiresProtocol: false });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    try { setTipos(await tiposServicioService.getAll()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ nombre: '', activo: true, requiresProtocol: false }); setEditingId(null); setShowForm(false); };

  const handleEdit = (t: TipoServicio) => {
    setForm({ nombre: t.nombre, activo: t.activo, requiresProtocol: t.requiresProtocol ?? false });
    setEditingId(t.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingId) await tiposServicioService.update(editingId, form);
      else await tiposServicioService.create(form);
      resetForm(); await loadData();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este tipo de servicio?')) return;
    await tiposServicioService.delete(id); await loadData();
  };

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

  return (
    <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="Tipos de servicio" subtitle={`${tipos.length} tipos`}>
      <div className="space-y-3">
        {!showForm && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nuevo tipo</Button>
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">{editingId ? 'Editar tipo' : 'Nuevo tipo'}</p>
            <div>
              <label className={lbl}>Nombre *</label>
              <Input inputSize="sm" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Mantenimiento preventivo" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="rounded border-slate-300" />
                Activo
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={form.requiresProtocol} onChange={e => setForm({ ...form, requiresProtocol: e.target.checked })} className="rounded border-slate-300" />
                Requiere protocolo
              </label>
            </div>
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
        ) : tipos.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">No hay tipos de servicio configurados</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Nombre</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Protocolo</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Estado</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipos.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{t.nombre}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-slate-500">
                    {t.requiresProtocol ? '✓' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center space-x-2">
                    <button className="text-teal-600 hover:underline" onClick={() => handleEdit(t)}>Editar</button>
                    <button className="text-red-500 hover:underline" onClick={() => handleDelete(t.id)}>Eliminar</button>
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
