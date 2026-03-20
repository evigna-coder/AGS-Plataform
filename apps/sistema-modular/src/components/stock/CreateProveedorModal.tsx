import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { proveedoresService } from '../../services/firebaseService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyForm = {
  nombre: '', tipo: 'nacional' as 'nacional' | 'internacional',
  contacto: '', email: '', telefono: '', pais: '', cuit: '',
  direccion: '', notas: '',
  banco: '', cuentaBancaria: '', swift: '', iban: '',
  bancoIntermediario: '', swiftIntermediario: '', abaIntermediario: '',
};

export const CreateProveedorModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleClose = () => { onClose(); setForm(emptyForm); };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await proveedoresService.create({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        pais: form.pais.trim() || null,
        cuit: form.cuit.trim() || null,
        direccion: form.direccion.trim() || null,
        notas: form.notas.trim() || null,
        ...(form.tipo === 'internacional' ? {
          banco: form.banco.trim() || null,
          cuentaBancaria: form.cuentaBancaria.trim() || null,
          swift: form.swift.trim() || null,
          iban: form.iban.trim() || null,
          bancoIntermediario: form.bancoIntermediario.trim() || null,
          swiftIntermediario: form.swiftIntermediario.trim() || null,
          abaIntermediario: form.abaIntermediario.trim() || null,
        } : {}),
        activo: true,
      });
      handleClose();
      onCreated();
    } catch { alert('Error al crear el proveedor'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo proveedor" subtitle="Complete los datos del proveedor" maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.nombre.trim()}>
          {saving ? 'Guardando...' : 'Crear proveedor'}
        </Button>
      </>}>

      <div className="space-y-5">
        {/* Datos basicos */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Datos basicos</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input inputSize="sm" label="Nombre *" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Razon social" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="nacional">Nacional</option>
                <option value="internacional">Internacional</option>
              </select>
            </div>
            <Input inputSize="sm" label="CUIT" value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="20-12345678-9" />
          </div>
        </div>

        {/* Contacto */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Contacto</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input inputSize="sm" label="Contacto" value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder="Persona de contacto" />
            <Input inputSize="sm" label="Email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@proveedor.com" />
            <Input inputSize="sm" label="Telefono" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 11 ..." />
            <Input inputSize="sm" label="Pais" value={form.pais} onChange={e => set('pais', e.target.value)} placeholder="Argentina, EE.UU..." />
            <div className="col-span-2">
              <Input inputSize="sm" label="Direccion" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Direccion completa" />
            </div>
          </div>
        </div>

        {/* Datos bancarios — solo internacional */}
        {form.tipo === 'internacional' && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Datos bancarios</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input inputSize="sm" label="Banco" value={form.banco} onChange={e => set('banco', e.target.value)} />
              <Input inputSize="sm" label="Cuenta bancaria" value={form.cuentaBancaria} onChange={e => set('cuentaBancaria', e.target.value)} />
              <Input inputSize="sm" label="SWIFT" value={form.swift} onChange={e => set('swift', e.target.value)} />
              <Input inputSize="sm" label="IBAN" value={form.iban} onChange={e => set('iban', e.target.value)} />
              <Input inputSize="sm" label="Banco intermediario" value={form.bancoIntermediario} onChange={e => set('bancoIntermediario', e.target.value)} />
              <Input inputSize="sm" label="SWIFT intermediario" value={form.swiftIntermediario} onChange={e => set('swiftIntermediario', e.target.value)} />
              <Input inputSize="sm" label="ABA intermediario" value={form.abaIntermediario} onChange={e => set('abaIntermediario', e.target.value)} />
            </div>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Notas internas..." />
        </div>
      </div>
    </Modal>
  );
};
