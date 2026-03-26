import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { dispositivosService } from '../../services/firebaseService';
import type { Dispositivo, TipoDispositivo } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: Dispositivo | null;
}

const TIPO_OPTIONS: { value: TipoDispositivo; label: string }[] = [
  { value: 'celular', label: 'Celular' },
  { value: 'computadora', label: 'Computadora' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'otro', label: 'Otro' },
];

const getEmpty = () => ({
  tipo: 'celular' as TipoDispositivo,
  marca: '',
  modelo: '',
  serie: '',
  descripcion: '',
});

export const DispositivoModal: React.FC<Props> = ({ open, onClose, onSaved, editData }) => {
  const [form, setForm] = useState(getEmpty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        tipo: editData.tipo,
        marca: editData.marca,
        modelo: editData.modelo,
        serie: editData.serie,
        descripcion: editData.descripcion ?? '',
      });
    } else {
      setForm(getEmpty());
    }
  }, [open, editData]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.marca.trim() || !form.modelo.trim()) {
      alert('Complete marca y modelo');
      return;
    }
    setSaving(true);
    try {
      if (editData) {
        await dispositivosService.update(editData.id, {
          tipo: form.tipo,
          marca: form.marca.trim(),
          modelo: form.modelo.trim(),
          serie: form.serie.trim(),
          descripcion: form.descripcion.trim() || null,
        });
      } else {
        await dispositivosService.create({
          tipo: form.tipo,
          marca: form.marca.trim(),
          modelo: form.modelo.trim(),
          serie: form.serie.trim(),
          descripcion: form.descripcion.trim() || null,
          asignadoAId: null,
          asignadoANombre: null,
          activo: true,
        });
      }
      onClose();
      onSaved();
    } catch {
      alert('Error al guardar el dispositivo');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { onClose(); setForm(getEmpty()); };
  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <Modal open={open} onClose={handleClose}
      title={editData ? 'Editar dispositivo' : 'Nuevo dispositivo'}
      subtitle="Celulares, computadoras, tablets y otros dispositivos."
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : editData ? 'Guardar cambios' : 'Crear dispositivo'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Tipo</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={selectCls}>
            {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Marca *" value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: Samsung" />
          <Input inputSize="sm" label="Modelo *" value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Ej: Galaxy S24" />
        </div>
        <Input inputSize="sm" label="Numero de serie" value={form.serie} onChange={e => set('serie', e.target.value)} placeholder="S/N" />
        <Input inputSize="sm" label="Descripcion" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Notas adicionales..." />
      </div>
    </Modal>
  );
};
