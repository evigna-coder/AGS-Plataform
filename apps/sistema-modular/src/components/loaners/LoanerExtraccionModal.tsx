import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    descripcion: string;
    codigoArticulo: string | null;
    destino: string;
    otNumber: string | null;
    extraidoPor: string;
  }) => Promise<void>;
}

export function LoanerExtraccionModal({ open, onClose, onConfirm }: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [destino, setDestino] = useState('');
  const [otNumber, setOtNumber] = useState('');
  const [extraidoPor, setExtraidoPor] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!descripcion.trim() || !destino.trim() || !extraidoPor.trim()) return;
    setSaving(true);
    try {
      await onConfirm({
        descripcion: descripcion.trim(),
        codigoArticulo: codigoArticulo.trim() || null,
        destino: destino.trim(),
        otNumber: otNumber.trim() || null,
        extraidoPor: extraidoPor.trim(),
      });
      onClose();
      setDescripcion(''); setCodigoArticulo(''); setDestino(''); setOtNumber(''); setExtraidoPor('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar extraccion de pieza" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!descripcion.trim() || !destino.trim() || !extraidoPor.trim() || saving}>
          {saving ? 'Guardando...' : 'Registrar'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion de la pieza *</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Que pieza se extrae" />
        </div>
        <Input label="Codigo de articulo" value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)} placeholder="Part number (opcional)" />
        <Input label="Destino *" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej: OT 25660, Stock, Cliente X" />
        <Input label="OT asociada" value={otNumber} onChange={e => setOtNumber(e.target.value)} placeholder="Numero de OT (opcional)" />
        <Input label="Extraido por *" value={extraidoPor} onChange={e => setExtraidoPor(e.target.value)} placeholder="Nombre del ingeniero" />
      </div>
    </Modal>
  );
}
