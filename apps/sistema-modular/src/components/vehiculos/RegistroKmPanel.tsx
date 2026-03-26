import { useState } from 'react';
import { registrosKmService, vehiculosService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import type { RegistroKm } from '@ags/shared';

interface Props {
  vehiculoId: string;
  registros: RegistroKm[];
  onChanged: () => void;
}

export const RegistroKmPanel: React.FC<Props> = ({ vehiculoId, registros, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fecha: '', km: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.fecha || !form.km) return alert('Fecha y KM son obligatorios');
    setSaving(true);
    try {
      const km = parseInt(form.km);
      await registrosKmService.create(vehiculoId, { vehiculoId, fecha: form.fecha, km });
      await vehiculosService.update(vehiculoId, { kmActual: km });
      setForm({ fecha: '', km: '' });
      setAdding(false);
      onChanged();
    } catch (err) {
      console.error(err);
      alert('Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este registro?')) return;
    await registrosKmService.delete(vehiculoId, id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">Registro de Kilometraje</h3>
        <Button size="sm" onClick={() => setAdding(true)}>+ Registrar KM</Button>
      </div>

      {registros.length === 0 && !adding ? (
        <div className="bg-white rounded-lg border border-slate-200 text-center py-8">
          <p className="text-xs text-slate-400">Sin registros de kilometraje</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Fecha</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Kilometraje</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Diferencia</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r, i) => {
                const prev = registros[i + 1];
                const diff = prev ? r.km - prev.km : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-700">{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-bold text-slate-900">{r.km.toLocaleString('es-AR')} km</td>
                    <td className="px-3 py-2 text-xs text-right font-mono text-slate-500">{diff != null ? `+${diff.toLocaleString('es-AR')}` : '—'}</td>
                    <td className="px-2 py-2"><button onClick={() => handleDelete(r.id)} className="text-[10px] text-red-500 hover:text-red-700">×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="bg-white rounded-lg border border-teal-200 p-4 space-y-3">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-teal-700">Nuevo Registro</h4>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Fecha *</label>
              <input value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Kilometraje *</label>
              <input value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Ej: 151539" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </div>
      )}
    </div>
  );
};
