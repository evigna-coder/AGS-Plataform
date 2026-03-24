import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { requerimientosService } from '../../services/firebaseService';
import type { OrigenRequerimiento } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const ORIGEN_OPTIONS: { value: OrigenRequerimiento; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'stock_minimo', label: 'Stock mínimo' },
  { value: 'ingeniero', label: 'Ingeniero' },
];

const emptyForm = {
  articuloDescripcion: '',
  articuloId: '' as string | undefined,
  cantidad: 1,
  unidadMedida: 'unidad',
  motivo: '',
  origen: 'manual' as OrigenRequerimiento,
  solicitadoPor: '',
  notas: '',
};

export const CreateRequerimientoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleClose = () => { onClose(); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.articuloDescripcion.trim()) { alert('Ingrese la descripción del artículo'); return; }
    if (!form.cantidad || form.cantidad <= 0) { alert('Ingrese una cantidad válida'); return; }
    if (!form.motivo.trim()) { alert('Ingrese el motivo del requerimiento'); return; }
    if (!form.solicitadoPor.trim()) { alert('Ingrese quién solicita el requerimiento'); return; }

    setSaving(true);
    try {
      await requerimientosService.create({
        articuloDescripcion: form.articuloDescripcion.trim(),
        articuloId: form.articuloId?.trim() || null,
        articuloCodigo: null,
        cantidad: form.cantidad,
        unidadMedida: form.unidadMedida.trim() || 'unidad',
        motivo: form.motivo.trim(),
        origen: form.origen,
        origenRef: null,
        estado: 'pendiente',
        proveedorSugeridoId: null,
        proveedorSugeridoNombre: null,
        ordenCompraId: null,
        ordenCompraNumero: null,
        solicitadoPor: form.solicitadoPor.trim(),
        fechaSolicitud: new Date().toISOString(),
        fechaAprobacion: null,
        notas: form.notas.trim() || null,
      });
      handleClose();
      onCreated();
    } catch {
      alert('Error al crear el requerimiento');
    } finally {
      setSaving(false);
    }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo requerimiento de compra"
      subtitle="Complete los datos de la requisición de compra."
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear requerimiento'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <Input inputSize="sm" label="Descripción del artículo *" value={form.articuloDescripcion}
            onChange={e => set('articuloDescripcion', e.target.value)}
            placeholder="Ej: Filtro HEPA 0.3 micras..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Cantidad *" type="number" min={1} value={form.cantidad}
            onChange={e => set('cantidad', Number(e.target.value))} />
          <Input inputSize="sm" label="Unidad de medida" value={form.unidadMedida}
            onChange={e => set('unidadMedida', e.target.value)} placeholder="unidad" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Origen</label>
            <select value={form.origen} onChange={e => set('origen', e.target.value)} className={selectCls}>
              {ORIGEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Input inputSize="sm" label="Solicitado por *" value={form.solicitadoPor}
            onChange={e => set('solicitadoPor', e.target.value)} placeholder="Nombre del solicitante" />
        </div>

        <div>
          <Input inputSize="sm" label="Motivo *" value={form.motivo}
            onChange={e => set('motivo', e.target.value)}
            placeholder="Ej: Repuesto necesario para OT 25660" />
        </div>

        <div>
          <label className={lbl}>Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            placeholder="Notas adicionales..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
    </Modal>
  );
};
