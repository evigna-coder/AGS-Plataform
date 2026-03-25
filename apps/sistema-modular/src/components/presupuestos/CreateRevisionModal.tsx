import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { presupuestosService } from '../../services/presupuestosService';
import type { Presupuesto } from '@ags/shared';

interface Props {
  open: boolean;
  presupuesto: Presupuesto | null;
  onClose: () => void;
  onCreated: (newId: string) => void;
}

export const CreateRevisionModal: React.FC<Props> = ({ open, presupuesto, onClose, onCreated }) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => { setMotivo(''); onClose(); };

  const handleCreate = async () => {
    if (!presupuesto || !motivo.trim()) return;
    setSaving(true);
    try {
      const result = await presupuestosService.createRevision(presupuesto.id, motivo.trim());
      setMotivo('');
      onCreated(result.id);
    } catch (e) {
      console.error('Error creando revisión:', e);
      alert('Error al crear la revisión');
    } finally {
      setSaving(false);
    }
  };

  if (!presupuesto) return null;

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

  return (
    <Modal open={open} onClose={handleClose} title="Crear revisión"
      subtitle={`A partir de ${presupuesto.numero}`}
      footer={<>
        <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCreate} disabled={saving || !motivo.trim()}>
          {saving ? 'Creando...' : 'Crear revisión'}
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <p className="text-xs text-amber-800">
            El presupuesto <strong>{presupuesto.numero}</strong> pasará a estado <strong>Anulado</strong> y se creará una nueva revisión en borrador con los mismos items.
          </p>
        </div>
        <div>
          <label className={lbl}>Motivo de anulación *</label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej: Cliente solicita ajuste de precios, cambio de alcance..."
            className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
};
