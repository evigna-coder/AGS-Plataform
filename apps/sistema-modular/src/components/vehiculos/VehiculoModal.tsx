import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { vehiculosService } from '../../services/firebaseService';
import type { Vehiculo, CriterioServicioVehiculo, VencimientoVehiculo } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: Vehiculo | null;
}

const DEFAULT_CRITERIOS: CriterioServicioVehiculo[] = [
  { servicio: 'Aceite y Filtros', cadaKm: 10000, cadaTiempo: null, comentario: '' },
  { servicio: 'Correa', cadaKm: 50000, cadaTiempo: null, comentario: '' },
  { servicio: 'Cubiertas', cadaKm: 40000, cadaTiempo: null, comentario: '' },
  { servicio: 'Frenos', cadaKm: 30000, cadaTiempo: null, comentario: '' },
  { servicio: 'Batería', cadaKm: null, cadaTiempo: '3 años', comentario: '' },
  { servicio: 'Amortiguación y Tren', cadaKm: 60000, cadaTiempo: null, comentario: '' },
  { servicio: 'Escobillas', cadaKm: null, cadaTiempo: '3 años', comentario: '' },
  { servicio: 'Bujías', cadaKm: null, cadaTiempo: null, comentario: '' },
];

const getEmpty = () => ({
  patente: '',
  marca: '',
  modelo: '',
  anio: '' as string,
  color: '',
  asignadoA: '',
  notas: '',
  criteriosServicio: DEFAULT_CRITERIOS.map(c => ({ ...c })),
  vencimientos: [
    { tipo: 'VTV', fecha: '', notas: '' },
    { tipo: 'Matafuegos', fecha: '', notas: '' },
    { tipo: 'Seguro', fecha: '', notas: '' },
  ] as VencimientoVehiculo[],
});

export const VehiculoModal: React.FC<Props> = ({ open, onClose, onSaved, editData }) => {
  const [form, setForm] = useState(getEmpty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        patente: editData.patente,
        marca: editData.marca,
        modelo: editData.modelo,
        anio: editData.anio?.toString() ?? '',
        color: editData.color ?? '',
        asignadoA: editData.asignadoA,
        notas: editData.notas ?? '',
        criteriosServicio: editData.criteriosServicio.length > 0
          ? editData.criteriosServicio.map(c => ({ ...c }))
          : DEFAULT_CRITERIOS.map(c => ({ ...c })),
        vencimientos: editData.vencimientos.length > 0
          ? editData.vencimientos.map(v => ({ ...v }))
          : getEmpty().vencimientos,
      });
    } else {
      setForm(getEmpty());
    }
  }, [open, editData]);

  const updateCriterio = (idx: number, field: string, val: any) => {
    setForm(f => ({
      ...f,
      criteriosServicio: f.criteriosServicio.map((c, i) => i === idx ? { ...c, [field]: val } : c),
    }));
  };

  const updateVencimiento = (idx: number, field: string, val: string) => {
    setForm(f => ({
      ...f,
      vencimientos: f.vencimientos.map((v, i) => i === idx ? { ...v, [field]: val } : v),
    }));
  };

  const addCriterio = () => {
    setForm(f => ({
      ...f,
      criteriosServicio: [...f.criteriosServicio, { servicio: '', cadaKm: null, cadaTiempo: null, comentario: '' }],
    }));
  };

  const removeCriterio = (idx: number) => {
    setForm(f => ({ ...f, criteriosServicio: f.criteriosServicio.filter((_, i) => i !== idx) }));
  };

  const addVencimiento = () => {
    setForm(f => ({ ...f, vencimientos: [...f.vencimientos, { tipo: '', fecha: '', notas: '' }] }));
  };

  const removeVencimiento = (idx: number) => {
    setForm(f => ({ ...f, vencimientos: f.vencimientos.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.patente.trim()) return alert('La patente es obligatoria');
    setSaving(true);
    try {
      const payload = {
        patente: form.patente.toUpperCase().trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        anio: form.anio ? parseInt(form.anio) : null,
        color: form.color.trim() || null,
        asignadoA: form.asignadoA.trim(),
        notas: form.notas.trim() || '',
        criteriosServicio: form.criteriosServicio.filter(c => c.servicio.trim()),
        vencimientos: form.vencimientos.filter(v => v.tipo.trim()),
        activo: true,
      };
      if (editData) {
        await vehiculosService.update(editData.id, payload);
      } else {
        await vehiculosService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error guardando vehículo:', err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editData ? 'Editar Vehículo' : 'Nuevo Vehículo'} maxWidth="xl">
      <div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
        {/* Datos básicos */}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Patente *" value={form.patente} onChange={e => setForm(f => ({ ...f, patente: e.target.value }))} placeholder="ABC123" />
          <Input label="Marca" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Ej: Renault" />
          <Input label="Modelo" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ej: Kangoo" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Input label="Año" value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} type="number" placeholder="2023" />
          <Input label="Color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
          <div className="col-span-2">
            <Input label="Asignado a" value={form.asignadoA} onChange={e => setForm(f => ({ ...f, asignadoA: e.target.value }))} placeholder="Nombre del ingeniero" />
          </div>
        </div>

        {/* Criterios de servicio */}
        <fieldset className="border border-slate-200 rounded-lg p-3">
          <legend className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">Criterios de Servicio</legend>
          <div className="space-y-1.5">
            {form.criteriosServicio.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={c.servicio} onChange={e => updateCriterio(i, 'servicio', e.target.value)} placeholder="Servicio" className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <input value={c.cadaKm ?? ''} onChange={e => updateCriterio(i, 'cadaKm', e.target.value ? parseInt(e.target.value) : null)} placeholder="Cada KM" type="number" className="col-span-2 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <input value={c.cadaTiempo ?? ''} onChange={e => updateCriterio(i, 'cadaTiempo', e.target.value || null)} placeholder="Cada tiempo" className="col-span-2 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <input value={c.comentario} onChange={e => updateCriterio(i, 'comentario', e.target.value)} placeholder="Comentario" className="col-span-4 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <button onClick={() => removeCriterio(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            ))}
          </div>
          <button onClick={addCriterio} className="mt-2 text-[11px] text-teal-600 hover:text-teal-800 font-medium">+ Agregar criterio</button>
        </fieldset>

        {/* Vencimientos */}
        <fieldset className="border border-slate-200 rounded-lg p-3">
          <legend className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">Vencimientos</legend>
          <div className="space-y-1.5">
            {form.vencimientos.map((v, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={v.tipo} onChange={e => updateVencimiento(i, 'tipo', e.target.value)} placeholder="Tipo (VTV, Seguro...)" className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <input value={v.fecha} onChange={e => updateVencimiento(i, 'fecha', e.target.value)} type="date" className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <input value={v.notas ?? ''} onChange={e => updateVencimiento(i, 'notas', e.target.value)} placeholder="Notas" className="col-span-5 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                <button onClick={() => removeVencimiento(i)} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            ))}
          </div>
          <button onClick={addVencimiento} className="mt-2 text-[11px] text-teal-600 hover:text-teal-800 font-medium">+ Agregar vencimiento</button>
        </fieldset>

        {/* Notas */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Notas</label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 bg-[#F0F0F0] border-t border-slate-200">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : editData ? 'Guardar cambios' : 'Crear vehículo'}
        </Button>
      </div>
    </Modal>
  );
};
