import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { remitosService, ingenierosService, clientesService } from '../../services/firebaseService';
import type { Ingeniero, Cliente, TipoRemito } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TIPO_OPTIONS: { value: TipoRemito; label: string }[] = [
  { value: 'salida_campo', label: 'Salida a campo' },
  { value: 'entrega_cliente', label: 'Entrega a cliente' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'interno', label: 'Interno' },
  { value: 'derivacion_proveedor', label: 'Derivacion a proveedor' },
  { value: 'loaner_salida', label: 'Loaner salida' },
];

const emptyForm = {
  tipo: 'salida_campo' as TipoRemito,
  ingenieroId: '', clienteId: '', otNumbers: '',
  fechaSalida: new Date().toISOString().slice(0, 10),
  observaciones: '',
};

export const CreateRemitoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([ingenierosService.getAll(), clientesService.getAll(true)])
      .then(([ing, cli]) => { setIngenieros(ing); setClientes(cli); });
  }, [open]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleClose = () => { onClose(); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.ingenieroId) { alert('Seleccione un ingeniero'); return; }
    if (form.tipo === 'entrega_cliente' && !form.clienteId) { alert('Seleccione un cliente para entregas'); return; }

    const ingeniero = ingenieros.find(i => i.id === form.ingenieroId);
    const cliente = clientes.find(c => c.id === form.clienteId);

    setSaving(true);
    try {
      const otNums = form.otNumbers.split(',').map(s => s.trim()).filter(Boolean);
      const newId = await remitosService.create({
        tipo: form.tipo,
        estado: 'borrador',
        ingenieroId: form.ingenieroId,
        ingenieroNombre: ingeniero?.nombre ?? '',
        clienteId: form.tipo === 'entrega_cliente' ? form.clienteId : null,
        clienteNombre: form.tipo === 'entrega_cliente' ? (cliente?.razonSocial ?? null) : null,
        otNumbers: otNums,
        items: [],
        observaciones: form.observaciones.trim() || null,
        fechaSalida: form.fechaSalida || null,
      });
      handleClose();
      onCreated();
      navigate(`/stock/remitos/${newId}`);
    } catch { alert('Error al crear el remito'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo remito"
      subtitle="Complete los datos del remito. Los items se agregan despues."
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear remito'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={selectCls}>
              {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Ingeniero *</label>
            <SearchableSelect value={form.ingenieroId}
              onChange={v => set('ingenieroId', v)}
              options={ingenieros.map(i => ({ value: i.id, label: i.nombre }))}
              placeholder="Seleccionar ingeniero..." />
          </div>
        </div>

        {form.tipo === 'entrega_cliente' && (
          <div>
            <label className={lbl}>Cliente *</label>
            <SearchableSelect value={form.clienteId}
              onChange={v => set('clienteId', v)}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Seleccionar cliente..." />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Fecha salida" type="date" value={form.fechaSalida}
            onChange={e => set('fechaSalida', e.target.value)} />
          <Input inputSize="sm" label="OTs asociadas" value={form.otNumbers}
            onChange={e => set('otNumbers', e.target.value)} placeholder="30001, 30002..." />
        </div>

        <div>
          <label className={lbl}>Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
            placeholder="Observaciones del remito..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
    </Modal>
  );
};
