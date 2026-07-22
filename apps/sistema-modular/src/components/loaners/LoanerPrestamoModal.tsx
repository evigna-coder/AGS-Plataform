import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clientesService, establecimientosService, remitosService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, Loaner } from '@ags/shared';
import { establecimientoUnicoId } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (data: {
    clienteId: string;
    clienteNombre: string;
    establecimientoId: string | null;
    establecimientoNombre: string | null;
    motivo: string;
    fechaRetornoPrevista: string | null;
    remitoSalidaId: string | null;
    remitoSalidaNumero: string | null;
    /** Fotos del estado de salida (opcionales) — se suben con contexto 'prestamo'. */
    fotos: File[];
  }) => Promise<void>;
}

export function LoanerPrestamoModal({ open, onClose, loaner, onConfirm }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fechaRetorno, setFechaRetorno] = useState('');
  const [generarRemito, setGenerarRemito] = useState(true);
  const [fotos, setFotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) clientesService.getAll().then(c => setClientes(c.filter(x => x.activo)));
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); return; }
    establecimientosService.getByCliente(clienteId).then(ests => {
      setEstablecimientos(ests);
      // Regla del proyecto: cliente con un único establecimiento (activo) → autoseleccionarlo.
      const unico = establecimientoUnicoId(ests.filter(e => e.activo));
      if (unico) setEstablecimientoId(unico);
    });
  }, [clienteId]);

  const selectedCliente = clientes.find(c => c.id === clienteId);
  const selectedEstab = establecimientos.find(e => e.id === establecimientoId);

  const handleConfirm = async () => {
    if (!clienteId || !motivo.trim()) return;
    setSaving(true);
    try {
      let remitoId: string | null = null;
      let remitoNumero: string | null = null;

      if (generarRemito) {
        remitoId = await remitosService.create({
          tipo: 'loaner_salida',
          estado: 'borrador',
          ingenieroId: '',
          ingenieroNombre: 'AGS Taller',
          clienteId,
          clienteNombre: selectedCliente?.razonSocial || '',
          loanerId: loaner.id,
          loanerCodigo: loaner.codigo,
          items: [],
          observaciones: `Loaner ${loaner.codigo}: ${motivo}`,
        });
      }

      await onConfirm({
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        motivo: motivo.trim(),
        fechaRetornoPrevista: fechaRetorno ? new Date(fechaRetorno).toISOString() : null,
        remitoSalidaId: remitoId,
        remitoSalidaNumero: remitoNumero,
        fotos,
      });

      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClienteId('');
    setEstablecimientoId('');
    setMotivo('');
    setFechaRetorno('');
    setGenerarRemito(true);
    setFotos([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar prestamo" maxWidth="md" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!clienteId || !motivo.trim() || saving}>
          {saving ? 'Registrando...' : 'Confirmar prestamo'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={clienteId} onChange={e => { setClienteId(e.target.value); setEstablecimientoId(''); }}>
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Establecimiento</label>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={establecimientoId} onChange={e => setEstablecimientoId(e.target.value)} disabled={!clienteId}>
            <option value="">Seleccionar</option>
            {establecimientos.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo del prestamo *</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que se presta este equipo" />
        </div>
        <Input label="Fecha de retorno prevista" type="date" value={fechaRetorno} onChange={e => setFechaRetorno(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={generarRemito} onChange={e => setGenerarRemito(e.target.checked)} className="rounded border-slate-300" />
          Generar remito de salida
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fotos de salida <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={e => setFotos(Array.from(e.target.files ?? []))}
            className="block w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-xs file:font-medium hover:file:bg-teal-100" />
          {fotos.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">{fotos.length} foto(s) seleccionada(s)</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
