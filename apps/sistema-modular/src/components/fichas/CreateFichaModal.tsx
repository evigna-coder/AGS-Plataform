import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { fichasService, clientesService, establecimientosService, sistemasService, modulosService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, Sistema, ModuloSistema, ViaIngreso, FichaPropiedad } from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateFichaModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [sistemaId, setSistemaId] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [descripcionLibre, setDescripcionLibre] = useState('');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>('ingeniero');
  const [traidoPor, setTraidoPor] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [otReferencia, setOtReferencia] = useState('');
  const [descripcionProblema, setDescripcionProblema] = useState('');

  useEffect(() => {
    if (open) clientesService.getAll().then(setClientes);
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); setEstablecimientoId(''); setSistemaId(''); setModuloId(''); return; }
    establecimientosService.getByCliente(clienteId).then(setEstablecimientos);
  }, [clienteId]);

  useEffect(() => {
    if (!establecimientoId) { setSistemas([]); setSistemaId(''); setModuloId(''); return; }
    sistemasService.getAll({ establecimientoId }).then(setSistemas);
  }, [establecimientoId]);

  useEffect(() => {
    if (!sistemaId) { setModulos([]); setModuloId(''); return; }
    modulosService.getBySistema(sistemaId).then(setModulos);
  }, [sistemaId]);

  const resetForm = () => {
    setClienteId(''); setEstablecimientoId(''); setSistemaId(''); setModuloId('');
    setDescripcionLibre(''); setViaIngreso('ingeniero'); setTraidoPor('');
    setFechaIngreso(new Date().toISOString().split('T')[0]);
    setOtReferencia(''); setDescripcionProblema(''); setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.clienteId = 'Requerido';
    if (!traidoPor.trim()) e.traidoPor = 'Requerido';
    if (!fechaIngreso) e.fechaIngreso = 'Requerido';
    if (!descripcionProblema.trim()) e.descripcionProblema = 'Requerido';
    if (!sistemaId && !descripcionLibre.trim()) e.descripcionLibre = 'Indicar sistema o descripcion';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedCliente = clientes.find(c => c.id === clienteId);
      const selectedEstab = establecimientos.find(e => e.id === establecimientoId);
      const selectedSistema = sistemas.find(s => s.id === sistemaId);
      const selectedModulo = modulos.find(m => m.id === moduloId);

      const data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'> = {
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        sistemaId: sistemaId || null,
        sistemaNombre: selectedSistema?.nombre || null,
        moduloId: moduloId || null,
        moduloNombre: selectedModulo?.nombre || null,
        descripcionLibre: descripcionLibre.trim() || null,
        codigoArticulo: null,
        serie: null,
        accesorios: [],
        condicionFisica: null,
        viaIngreso,
        traidoPor: traidoPor.trim(),
        fechaIngreso: new Date(fechaIngreso).toISOString(),
        otReferencia: otReferencia.trim() || null,
        descripcionProblema: descripcionProblema.trim(),
        sintomasReportados: null,
        estado: 'recibido',
        historial: [{
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          estadoAnterior: 'recibido',
          estadoNuevo: 'recibido',
          nota: 'Ficha creada',
          creadoPor: 'admin',
        }],
        derivaciones: [],
        repuestosPendientes: [],
        remitoDevolucionId: null,
        fechaEntrega: null,
        loanerId: null,
        loanerCodigo: null,
        otIds: otReferencia.trim() ? [otReferencia.trim()] : [],
      };

      const fichaId = await fichasService.create(data);
      resetForm();
      onCreated();
      onClose();
      navigate(`/fichas/${fichaId}`);
    } catch (err) {
      console.error('Error creando ficha:', err);
      alert('Error al crear la ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nueva ficha propiedad del cliente" subtitle="Registrar ingreso de modulo/equipo" maxWidth="lg">
      <div className="space-y-5 p-5">
        {/* Cliente y origen */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Cliente y origen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente *</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Seleccionar cliente</option>
                {clientes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
              </select>
              {errors.clienteId && <p className="text-[10px] text-red-500 mt-0.5">{errors.clienteId}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Establecimiento</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={establecimientoId} onChange={e => setEstablecimientoId(e.target.value)} disabled={!clienteId}>
                <option value="">Seleccionar</option>
                {establecimientos.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Via de ingreso</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={viaIngreso} onChange={e => setViaIngreso(e.target.value as ViaIngreso)}>
                {(Object.keys(VIA_INGRESO_LABELS) as ViaIngreso[]).map(v => <option key={v} value={v}>{VIA_INGRESO_LABELS[v]}</option>)}
              </select>
            </div>
            <Input size="sm" label="Traido por *" value={traidoPor} onChange={e => setTraidoPor(e.target.value)} error={errors.traidoPor} placeholder="Ingeniero o transporte" />
            <Input size="sm" label="Fecha de ingreso *" type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} error={errors.fechaIngreso} />
            <Input size="sm" label="OT de referencia" value={otReferencia} onChange={e => setOtReferencia(e.target.value)} placeholder="Ej: 25660" />
          </div>
        </div>

        {/* Identificacion */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Identificacion del modulo/equipo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sistema/Equipo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={sistemaId} onChange={e => { setSistemaId(e.target.value); setModuloId(''); }} disabled={!establecimientoId}>
                <option value="">Seleccionar</option>
                {sistemas.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Modulo</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={moduloId} onChange={e => setModuloId(e.target.value)} disabled={!sistemaId}>
                <option value="">Seleccionar</option>
                {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.serie ? ` (S/N: ${m.serie})` : ''}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Input size="sm" label="Descripcion libre (si no esta en el sistema)" value={descripcionLibre} onChange={e => setDescripcionLibre(e.target.value)} error={errors.descripcionLibre} placeholder="Ej: Bomba cuaternaria G1311A" />
            </div>
          </div>
        </div>

        {/* Problema */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">Problema / Falla</h3>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descripcion del problema *</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-h-[60px]" value={descripcionProblema} onChange={e => setDescripcionProblema(e.target.value)} placeholder="Describir la falla o problema reportado" />
            {errors.descripcionProblema && <p className="text-[10px] text-red-500 mt-0.5">{errors.descripcionProblema}</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear ficha'}
        </Button>
      </div>
    </Modal>
  );
}
