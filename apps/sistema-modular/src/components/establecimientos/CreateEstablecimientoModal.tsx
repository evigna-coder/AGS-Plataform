import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { establecimientosService, clientesService, condicionesPagoService } from '../../services/firebaseService';
import type { Cliente, CondicionPago } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  preselectedClienteId?: string;
}

const TIPO_OPTIONS = [
  { value: 'planta', label: 'Planta' },
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'otro', label: 'Otro' },
];

const emptyForm = {
  clienteCuit: '', nombre: '', direccion: '', localidad: '', provincia: '',
  pais: 'Argentina', codigoPostal: '', tipo: '', condicionPagoId: '',
  tipoServicio: '', infoPagos: '', pagaEnTiempo: false, sueleDemorar: false,
};

export const CreateEstablecimientoModal: React.FC<Props> = ({ open, onClose, onCreated, preselectedClienteId }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([clientesService.getAll(true), condicionesPagoService.getAll()])
      .then(([c, cp]) => {
        setClientes(c);
        setCondiciones(cp.filter((p: any) => p.activo !== false));
      });
  }, [open]);

  useEffect(() => {
    if (open && preselectedClienteId) {
      setForm(prev => ({ ...prev, clienteCuit: preselectedClienteId }));
    }
  }, [open, preselectedClienteId]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleClose = () => { onClose(); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.clienteCuit) { alert('Seleccione un cliente'); return; }
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    if (!form.direccion.trim()) { alert('La direccion es obligatoria'); return; }
    if (!form.localidad.trim()) { alert('La localidad es obligatoria'); return; }
    if (!form.provincia.trim()) { alert('La provincia es obligatoria'); return; }

    setSaving(true);
    try {
      const payload: any = {
        nombre: form.nombre.trim(), direccion: form.direccion.trim(),
        localidad: form.localidad.trim(), provincia: form.provincia.trim(),
        pais: form.pais.trim() || null, codigoPostal: form.codigoPostal.trim() || null,
        tipo: form.tipo || null, condicionPagoId: form.condicionPagoId || null,
        tipoServicio: form.tipoServicio || null, infoPagos: form.infoPagos.trim() || null,
        pagaEnTiempo: form.pagaEnTiempo, sueleDemorar: form.sueleDemorar,
        activo: true,
      };
      const newId = await establecimientosService.create(form.clienteCuit, payload);
      handleClose();
      onCreated();
      navigate(`/establecimientos/${newId}`);
    } catch { alert('Error al crear el establecimiento'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo establecimiento"
      subtitle="Complete los datos del establecimiento" maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Crear establecimiento'}
        </Button>
      </>}>
      <div className="space-y-5">
        {/* Cliente y nombre */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Datos basicos</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Cliente *</label>
              <SearchableSelect value={form.clienteCuit}
                onChange={v => set('clienteCuit', v)}
                options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
                placeholder="Seleccionar cliente..." />
            </div>
            <Input inputSize="sm" label="Nombre *" value={form.nombre}
              onChange={e => set('nombre', e.target.value)} placeholder="Ej: Planta CABA" />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Direccion */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Ubicacion</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input inputSize="sm" label="Direccion *" value={form.direccion}
                onChange={e => set('direccion', e.target.value)} />
            </div>
            <Input inputSize="sm" label="Localidad *" value={form.localidad}
              onChange={e => set('localidad', e.target.value)} />
            <Input inputSize="sm" label="Provincia *" value={form.provincia}
              onChange={e => set('provincia', e.target.value)} />
            <Input inputSize="sm" label="Pais" value={form.pais}
              onChange={e => set('pais', e.target.value)} />
            <Input inputSize="sm" label="Codigo postal" value={form.codigoPostal}
              onChange={e => set('codigoPostal', e.target.value)} />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Tipo y pagos */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Configuracion</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={selectCls}>
                <option value="">Sin especificar</option>
                {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Condicion de pago</label>
              <SearchableSelect value={form.condicionPagoId}
                onChange={v => set('condicionPagoId', v)}
                options={condiciones.map(c => ({ value: c.id, label: c.nombre }))}
                placeholder="Seleccionar..." />
            </div>
            <div>
              <label className={lbl}>Tipo de servicio</label>
              <select value={form.tipoServicio} onChange={e => set('tipoServicio', e.target.value)} className={selectCls}>
                <option value="">Sin especificar</option>
                <option value="contrato">Contrato</option>
                <option value="per_incident">Per incident</option>
              </select>
            </div>
            <Input inputSize="sm" label="Info pagos" value={form.infoPagos}
              onChange={e => set('infoPagos', e.target.value)} placeholder="Notas sobre pagos..." />
          </div>
          <div className="flex gap-6 mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.pagaEnTiempo} onChange={e => set('pagaEnTiempo', e.target.checked)} className="w-3.5 h-3.5" />
              <span className="text-xs text-slate-600">Paga en tiempo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.sueleDemorar} onChange={e => set('sueleDemorar', e.target.checked)} className="w-3.5 h-3.5" />
              <span className="text-xs text-slate-600">Suele demorarse</span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
