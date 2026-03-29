import { useState } from 'react';
import { historialTallerService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import type { VisitaTaller } from '@ags/shared';

interface Props {
  vehiculoId: string;
  historial: VisitaTaller[];
  onChanged: () => void;
}

export const HistorialTallerPanel: React.FC<Props> = ({ vehiculoId, historial, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ taller: '', fecha: '', km: '', factura: '', monto: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.taller.trim() || !form.fecha) return alert('Taller y fecha son obligatorios');
    setSaving(true);
    try {
      await historialTallerService.create(vehiculoId, {
        vehiculoId,
        taller: form.taller.trim(),
        fecha: form.fecha,
        km: form.km ? parseInt(form.km) : null,
        factura: form.factura.trim() || null,
        monto: form.monto ? parseFloat(form.monto) : null,
        descripcion: form.descripcion.trim(),
      });
      setForm({ taller: '', fecha: '', km: '', factura: '', monto: '', descripcion: '' });
      setAdding(false);
      onChanged();
    } catch (err) {
      console.error(err);
      alert('Error al agregar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta visita?')) return;
    await historialTallerService.delete(vehiculoId, id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">Historial de Taller</h3>
        <Button size="sm" onClick={() => setAdding(true)}>+ Registrar visita</Button>
      </div>

      {historial.length === 0 && !adding ? (
        <div className="bg-white rounded-lg border border-slate-200 text-center py-8">
          <p className="text-xs text-slate-400">Sin visitas registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Taller</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Fecha</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">KM</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Factura</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Monto</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Descripción</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs font-medium text-slate-900">{h.taller}</td>
                  <td className="px-3 py-2 text-xs text-left text-slate-600">{h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">{h.km?.toLocaleString('es-AR') ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{h.factura ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">{h.monto != null ? `$ ${h.monto.toLocaleString('es-AR')}` : '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-xs">{h.descripcion}</td>
                  <td className="px-2 py-2"><button onClick={() => handleDelete(h.id)} className="text-[10px] text-red-500 hover:text-red-700">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="bg-white rounded-lg border border-teal-200 p-4 space-y-3">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-teal-700">Nueva Visita al Taller</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Taller *</label>
              <input value={form.taller} onChange={e => setForm(f => ({ ...f, taller: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Nombre del taller" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Fecha *</label>
              <input value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">KM</label>
              <input value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Factura</label>
              <input value={form.factura} onChange={e => setForm(f => ({ ...f, factura: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="N° factura" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Monto $</label>
              <input value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Trabajo realizado" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? 'Guardando...' : 'Agregar'}</Button>
          </div>
        </div>
      )}
    </div>
  );
};
