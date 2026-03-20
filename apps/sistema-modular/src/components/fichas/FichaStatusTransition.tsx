import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { EstadoFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';

const TRANSITIONS: Record<EstadoFicha, EstadoFicha[]> = {
  recibido: ['en_diagnostico'],
  en_diagnostico: ['en_reparacion', 'derivado_proveedor', 'esperando_repuesto', 'listo_para_entrega'],
  en_reparacion: ['listo_para_entrega', 'derivado_proveedor', 'esperando_repuesto'],
  derivado_proveedor: ['en_reparacion', 'esperando_repuesto', 'listo_para_entrega'],
  esperando_repuesto: ['en_reparacion', 'listo_para_entrega'],
  listo_para_entrega: ['entregado'],
  entregado: [],
};

interface Props {
  currentEstado: EstadoFicha;
  onTransition: (nuevoEstado: EstadoFicha, nota: string) => Promise<void>;
}

export function FichaStatusTransition({ currentEstado, onTransition }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState<EstadoFicha | ''>('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const options = TRANSITIONS[currentEstado] || [];

  if (options.length === 0) return null;

  const handleConfirm = async () => {
    if (!selectedEstado || !nota.trim()) return;
    setSaving(true);
    try {
      await onTransition(selectedEstado, nota.trim());
      setOpen(false);
      setSelectedEstado('');
      setNota('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Cambiar estado
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cambiar estado de la ficha"
        subtitle={`Estado actual: ${ESTADO_FICHA_LABELS[currentEstado]}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!selectedEstado || !nota.trim() || saving}>
              {saving ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo estado *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value as EstadoFicha)}
            >
              <option value="">Seleccionar</option>
              {options.map(e => (
                <option key={e} value={e}>{ESTADO_FICHA_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nota / comentario *</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Describir el motivo del cambio de estado"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
