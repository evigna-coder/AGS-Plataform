import { useState } from 'react';
import { serviciosVehiculoService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import type { ServicioVehiculo, CriterioServicioVehiculo } from '@ags/shared';

interface Props {
  vehiculoId: string;
  servicios: ServicioVehiculo[];
  criterios: CriterioServicioVehiculo[];
  kmActual: number;
  onChanged: () => void;
}

export const ServiciosPanel: React.FC<Props> = ({ vehiculoId, servicios, criterios, kmActual, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ servicio: '', kmRealizacion: '', extensionKm: '', fechaRealizacion: '', fechaEstimativa: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.servicio.trim()) return;
    setSaving(true);
    try {
      await serviciosVehiculoService.create(vehiculoId, {
        vehiculoId,
        servicio: form.servicio.trim(),
        kmRealizacion: parseInt(form.kmRealizacion) || 0,
        extensionKm: parseInt(form.extensionKm) || 0,
        fechaRealizacion: form.fechaRealizacion,
        fechaEstimativa: form.fechaEstimativa,
      });
      setForm({ servicio: '', kmRealizacion: '', extensionKm: '', fechaRealizacion: '', fechaEstimativa: '' });
      setAdding(false);
      onChanged();
    } catch (err) {
      console.error(err);
      alert('Error al agregar servicio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este registro de servicio?')) return;
    await serviciosVehiculoService.delete(vehiculoId, id);
    onChanged();
  };

  // Merge: para cada criterio, buscar si hay un servicio registrado
  const rows = criterios.map(c => {
    const svc = servicios.find(s => s.servicio === c.servicio);
    const kmFaltan = svc ? (svc.kmRealizacion + svc.extensionKm) - kmActual : null;
    return { criterio: c, servicio: svc, kmFaltan };
  });
  // servicios que no matchean criterios
  const extras = servicios.filter(s => !criterios.find(c => c.servicio === s.servicio));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">Estado de Servicios</h3>
        <Button size="sm" onClick={() => setAdding(true)}>+ Registrar servicio</Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Servicio</th>
              <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">KM Realización</th>
              <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Extensión</th>
              <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">KM Que Faltan</th>
              <th className="px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Fecha Estimativa</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ criterio, servicio, kmFaltan }, i) => {
              const isOverdue = kmFaltan != null && kmFaltan < 0;
              const isWarning = kmFaltan != null && kmFaltan >= 0 && kmFaltan < 2000;
              const rowCls = isOverdue ? 'bg-red-50' : isWarning ? 'bg-amber-50' : '';
              return (
                <tr key={i} className={`hover:bg-slate-50 ${rowCls}`}>
                  <td className="px-4 py-2 text-xs font-medium text-slate-900">{criterio.servicio}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">
                    {servicio ? servicio.kmRealizacion.toLocaleString('es-AR') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">
                    {servicio ? servicio.extensionKm.toLocaleString('es-AR') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-xs text-right font-mono font-bold ${isOverdue ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {kmFaltan != null ? kmFaltan.toLocaleString('es-AR') : <span className="text-slate-300 font-normal">N/A</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-center text-slate-600">
                    {servicio?.fechaEstimativa ? new Date(servicio.fechaEstimativa).toLocaleDateString('es-AR') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    {servicio && (
                      <button onClick={() => handleDelete(servicio.id)} className="text-[10px] text-red-500 hover:text-red-700">×</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {extras.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-xs font-medium text-slate-900">{s.servicio}</td>
                <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">{s.kmRealizacion.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">{s.extensionKm.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-xs text-right font-mono text-slate-700">{((s.kmRealizacion + s.extensionKm) - kmActual).toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-xs text-center text-slate-600">{s.fechaEstimativa ? new Date(s.fechaEstimativa).toLocaleDateString('es-AR') : '—'}</td>
                <td className="px-2 py-2"><button onClick={() => handleDelete(s.id)} className="text-[10px] text-red-500 hover:text-red-700">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-white rounded-lg border border-teal-200 p-4 space-y-3">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-teal-700">Registrar Servicio Realizado</h4>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Servicio</label>
              <select value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500">
                <option value="">Seleccionar...</option>
                {criterios.map(c => <option key={c.servicio} value={c.servicio}>{c.servicio}</option>)}
                <option value="__custom">Otro...</option>
              </select>
              {form.servicio === '__custom' && (
                <input value="" onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))} placeholder="Nombre" className="mt-1 w-full px-2 py-1 border border-slate-200 rounded text-xs" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">KM Realización</label>
              <input value={form.kmRealizacion} onChange={e => setForm(f => ({ ...f, kmRealizacion: e.target.value }))} type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Extensión KM</label>
              <input value={form.extensionKm} onChange={e => setForm(f => ({ ...f, extensionKm: e.target.value }))} type="number" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Fecha Realización</label>
              <input value={form.fechaRealizacion} onChange={e => setForm(f => ({ ...f, fechaRealizacion: e.target.value }))} type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Fecha Estimativa</label>
              <input value={form.fechaEstimativa} onChange={e => setForm(f => ({ ...f, fechaEstimativa: e.target.value }))} type="date" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
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
