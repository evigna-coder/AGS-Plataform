import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';
import type { CondicionIva } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyForm = {
  razonSocial: '', cuit: '', pais: 'Argentina', direccionFiscal: '',
  localidadFiscal: '', provinciaFiscal: '', codigoPostalFiscal: '',
  rubro: '', condicionIva: '' as CondicionIva | '', ingresosBrutos: '',
  convenioMultilateral: false, requiereTrazabilidad: false, notas: '',
};

export const CreateClienteModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClose = () => { onClose(); setForm(emptyForm); setErrors({}); };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.razonSocial.trim()) errs.razonSocial = 'Obligatorio';
    if (!form.rubro.trim()) errs.rubro = 'Obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSaving(true);
      const data: any = {
        razonSocial: form.razonSocial.trim(), pais: form.pais, rubro: form.rubro.trim(),
        convenioMultilateral: form.convenioMultilateral, requiereTrazabilidad: form.requiereTrazabilidad, activo: true,
      };
      data.cuit = form.cuit?.trim() || null;
      if (form.direccionFiscal?.trim()) data.direccionFiscal = form.direccionFiscal.trim();
      if (form.localidadFiscal?.trim()) data.localidadFiscal = form.localidadFiscal.trim();
      if (form.provinciaFiscal?.trim()) data.provinciaFiscal = form.provinciaFiscal.trim();
      if (form.codigoPostalFiscal?.trim()) data.codigoPostalFiscal = form.codigoPostalFiscal.trim();
      if (form.condicionIva) data.condicionIva = form.condicionIva;
      if (form.ingresosBrutos?.trim()) data.ingresosBrutos = form.ingresosBrutos.trim();
      if (form.notas?.trim()) data.notas = form.notas.trim();

      const clienteId = await clientesService.create(data);
      handleClose();
      onCreated();
      navigate(`/clientes/${clienteId}`);
    } catch { alert('Error al crear el cliente'); }
    finally { setSaving(false); }
  };

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const lbl = "block text-[11px] font-medium text-slate-600 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Cliente" subtitle="Complete los datos del cliente" maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Crear Cliente'}</Button>
      </>}>

      <div className="space-y-5">
        {/* Datos Basicos */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Datos Basicos</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input inputSize="sm" label="Razón Social *" value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} error={errors.razonSocial} />
            </div>
            <Input inputSize="sm" label="CUIT" value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="XX-XXXXXXXX-X" />
            <Input inputSize="sm" label="País" value={form.pais} onChange={e => set('pais', e.target.value)} />
            <Input inputSize="sm" label="Rubro *" value={form.rubro} onChange={e => set('rubro', e.target.value)} error={errors.rubro} />
          </div>
        </div>

        {/* Domicilio fiscal */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Domicilio fiscal</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <Input inputSize="sm" label="Dirección" value={form.direccionFiscal} onChange={e => set('direccionFiscal', e.target.value)} />
            </div>
            <Input inputSize="sm" label="Localidad" value={form.localidadFiscal} onChange={e => set('localidadFiscal', e.target.value)} />
            <Input inputSize="sm" label="Provincia" value={form.provinciaFiscal} onChange={e => set('provinciaFiscal', e.target.value)} />
            <Input inputSize="sm" label="Código postal" value={form.codigoPostalFiscal} onChange={e => set('codigoPostalFiscal', e.target.value)} />
          </div>
        </div>

        {/* Fiscal */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Fiscal / IVA</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Condición IVA</label>
              <SearchableSelect value={form.condicionIva} onChange={v => set('condicionIva', v)}
                options={[
                  { value: 'monotributo', label: 'Monotributo' },
                  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
                  { value: 'exento', label: 'Exento' },
                  { value: 'consumidor_final', label: 'Consumidor Final' },
                  { value: 'otro', label: 'Otro' },
                ]} placeholder="Seleccionar..." />
            </div>
            <Input inputSize="sm" label="Ingresos Brutos" value={form.ingresosBrutos} onChange={e => set('ingresosBrutos', e.target.value)} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.convenioMultilateral} onChange={e => set('convenioMultilateral', e.target.checked)} className="w-3.5 h-3.5" />
              <span className="text-xs text-slate-600">Convenio Multilateral</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requiereTrazabilidad} onChange={e => set('requiereTrazabilidad', e.target.checked)} className="w-3.5 h-3.5" />
              <span className="text-xs text-slate-600">Requiere Trazabilidad</span>
            </label>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className={lbl}>Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs resize-y" placeholder="Notas internas..." />
        </div>
      </div>
    </Modal>
  );
};
