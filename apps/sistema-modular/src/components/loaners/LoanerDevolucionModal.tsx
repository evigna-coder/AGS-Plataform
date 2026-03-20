import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
  clienteNombre: string;
  onConfirm: (data: { fechaRetornoReal: string; condicionRetorno: string }) => Promise<void>;
}

export function LoanerDevolucionModal({ open, onClose, clienteNombre, onConfirm }: Props) {
  const [condicion, setCondicion] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!condicion.trim() || !fecha) return;
    setSaving(true);
    try {
      await onConfirm({
        fechaRetornoReal: new Date(fecha).toISOString(),
        condicionRetorno: condicion.trim(),
      });
      onClose();
      setCondicion('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar devolucion" subtitle={`Cliente: ${clienteNombre}`} footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!condicion.trim() || saving}>
          {saving ? 'Guardando...' : 'Confirmar devolucion'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <Input label="Fecha de devolucion *" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Condicion al retorno *</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={condicion} onChange={e => setCondicion(e.target.value)} placeholder="Estado del equipo al ser devuelto" />
        </div>
      </div>
    </Modal>
  );
}
