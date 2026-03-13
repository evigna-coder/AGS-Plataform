import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService } from '../../services/firebaseService';
import { MOTIVO_LLAMADO_LABELS } from '@ags/shared';
import type { MotivoLlamado, Lead } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MOTIVOS = Object.entries(MOTIVO_LLAMADO_LABELS) as [MotivoLlamado, string][];

export default function CrearLeadModal({ open, onClose, onCreated }: Props) {
  const { usuario } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razonSocial: '',
    contacto: '',
    email: '',
    telefono: '',
    motivoLlamado: 'soporte' as MotivoLlamado,
    motivoContacto: '',
    descripcion: '',
  });

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.razonSocial.trim() || !form.contacto.trim()) return;
    setSaving(true);
    try {
      await leadsService.create({
        razonSocial: form.razonSocial.trim(),
        contacto: form.contacto.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        motivoLlamado: form.motivoLlamado,
        motivoContacto: form.motivoContacto.trim(),
        descripcion: form.descripcion.trim() || null,
        clienteId: null,
        contactoId: null,
        sistemaId: null,
        estado: 'nuevo',
        postas: [],
        asignadoA: usuario?.id ?? null,
        derivadoPor: null,
        source: 'portal',
      } as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>);
      onCreated();
      onClose();
      setForm({ razonSocial: '', contacto: '', email: '', telefono: '', motivoLlamado: 'soporte', motivoContacto: '', descripcion: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Nuevo Lead" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Motivo *</label>
          <select
            value={form.motivoLlamado}
            onChange={e => set('motivoLlamado', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MOTIVOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Input label="Razón social *" value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} />
        <Input label="Contacto *" value={form.contacto} onChange={e => set('contacto', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Teléfono" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
        </div>
        <Input label="Motivo de contacto" value={form.motivoContacto} onChange={e => set('motivoContacto', e.target.value)} />
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.razonSocial.trim() || !form.contacto.trim()}>
            {saving ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
