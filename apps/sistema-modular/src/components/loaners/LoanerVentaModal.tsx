import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clientesService } from '../../services/firebaseService';
import type { Cliente } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    clienteId: string;
    clienteNombre: string;
    precio: number | null;
    moneda: 'ARS' | 'USD' | null;
    notas: string | null;
  }) => Promise<void>;
}

export function LoanerVentaModal({ open, onClose, onConfirm }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) clientesService.getAll().then(c => setClientes(c.filter(x => x.activo)));
  }, [open]);

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const handleConfirm = async () => {
    if (!clienteId) return;
    setSaving(true);
    try {
      await onConfirm({
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        precio: precio ? parseFloat(precio) : null,
        moneda: precio ? moneda : null,
        notas: notas.trim() || null,
      });
      onClose();
      setClienteId(''); setPrecio(''); setNotas('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar venta de loaner" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!clienteId || saving}>
          {saving ? 'Registrando...' : 'Confirmar venta'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Precio" type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={moneda} onChange={e => setMoneda(e.target.value as any)}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones sobre la venta" />
        </div>
      </div>
    </Modal>
  );
}
