import { useState, useEffect } from 'react';
import { condicionesPagoService } from '../../services/firebaseService';
import type { CondicionPago } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props { open: boolean; onClose: () => void; }

const getDiasTexto = (dias: number) => dias === 0 ? 'Contado' : dias === 1 ? '1 día' : `${dias} días`;

export const CondicionesPagoModal: React.FC<Props> = ({ open, onClose }) => {
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', dias: 0, descripcion: '', activo: true });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    try { setCondiciones(await condicionesPagoService.getAll()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ nombre: '', dias: 0, descripcion: '', activo: true }); setEditingId(null); setShowForm(false); };

  const handleEdit = (c: CondicionPago) => {
    setForm({ nombre: c.nombre, dias: c.dias, descripcion: c.descripcion || '', activo: c.activo });
    setEditingId(c.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingId) await condicionesPagoService.update(editingId, form);
      else await condicionesPagoService.create(form);
      resetForm(); await loadData();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta condición de pago?')) return;
    await condicionesPagoService.delete(id); await loadData();
  };

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

  return (
    <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="Condiciones de pago" subtitle={`${condiciones.length} condiciones`}>
      <div className="space-y-3">
        {!showForm && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nueva condición</Button>
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">{editingId ? 'Editar condición' : 'Nueva condición'}</p>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div>
                <label className={lbl}>Nombre *</label>
                <Input inputSize="sm" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Diferido 30 días" />
              </div>
              <div>
                <label className={lbl}>Días</label>
                <Input inputSize="sm" type="number" min={0} value={String(form.dias)} onChange={e => setForm({ ...form, dias: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label className={lbl}>Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={2} className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
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
        ) : condiciones.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">No hay condiciones configuradas</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Nombre</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Plazo</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-slate-400 tracking-wider">Estado</th>
                <th className="px-3 py-1.5 text-right text-[10px] font-medium text-slate-400 tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {condiciones.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{c.nombre}</span>
                    {c.descripcion && <p className="text-[10px] text-slate-400 mt-0.5">{c.descripcion}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{getDiasTexto(c.dias)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
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
