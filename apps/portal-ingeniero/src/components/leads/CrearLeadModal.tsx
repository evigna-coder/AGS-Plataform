import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, clientesService, usuariosService, ingenierosService } from '../../services/firebaseService';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_GROUPS, LEAD_ESTADO_LABELS, LEAD_ESTADO_ORDER } from '@ags/shared';
import type { MotivoLlamado, LeadArea, LeadEstado, Lead, ContactoCliente, Posta } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MOTIVOS = Object.entries(MOTIVO_LLAMADO_LABELS) as [MotivoLlamado, string][];

export default function CrearLeadModal({ open, onClose, onCreated }: Props) {
  const { usuario } = useAuth();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);
  const [ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>('soporte');
  const [areaActual, setAreaActual] = useState<LeadArea | ''>('');
  const [asignadoId, setAsignadoId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<LeadEstado>('pendiente_info');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (open) {
      clientesService.getAll().then(setClientes);
      usuariosService.getIngenieros().then(setUsuarios);
      ingenierosService.getAll().then(setIngenieros);
    }
  }, [open]);

  useEffect(() => {
    if (clienteId) {
      clientesService.getContactos(clienteId).then(setContactos);
    } else {
      setContactos([]);
    }
  }, [clienteId]);

  // Reset asignado when area changes
  useEffect(() => { setAsignadoId(''); }, [areaActual]);

  const filteredClientes = clienteSearch.trim()
    ? clientes.filter(c => c.razonSocial.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8)
    : [];

  const isIngeniero = areaActual === 'ingeniero_soporte';
  const personList = isIngeniero
    ? ingenieros.map(i => ({ id: i.id, label: i.nombre }))
    : usuarios.map(u => ({ id: u.id, label: u.displayName }));

  const getAsignadoNombre = () => {
    if (!asignadoId) return null;
    if (isIngeniero) return ingenieros.find(i => i.id === asignadoId)?.nombre ?? null;
    return usuarios.find(u => u.id === asignadoId)?.displayName ?? null;
  };

  const handleSelectCliente = (c: { id: string; razonSocial: string }) => {
    setClienteId(c.id);
    setRazonSocial(c.razonSocial);
    setClienteSearch('');
    setShowClienteDropdown(false);
  };

  const handleSelectContacto = (c: ContactoCliente) => {
    setContacto(c.nombre);
    if (c.email) setEmail(c.email);
    if (c.telefono) setTelefono(c.telefono);
  };

  const handleClearCliente = () => {
    setClienteId(null);
    setRazonSocial('');
    setContactos([]);
    setContacto('');
    setEmail('');
    setTelefono('');
  };

  const canSubmit = razonSocial.trim() && contacto.trim() && areaActual;

  const handleSubmit = async () => {
    if (!canSubmit || !usuario) return;
    setSaving(true);
    try {
      const asignadoNombre = getAsignadoNombre();

      // Crear posta inicial de asignación
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: asignadoId || '',
        aUsuarioNombre: asignadoNombre || '',
        aArea: areaActual || undefined,
        comentario: descripcion.trim() || undefined,
        estadoAnterior: nuevoEstado,
        estadoNuevo: nuevoEstado,
      };

      await leadsService.create({
        razonSocial: razonSocial.trim(),
        contacto: contacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        motivoLlamado,
        motivoContacto: '',
        descripcion: descripcion.trim() || null,
        clienteId: clienteId || null,
        contactoId: null,
        sistemaId: null,
        estado: nuevoEstado,
        postas: [posta],
        asignadoA: asignadoId || null,
        asignadoNombre: asignadoNombre,
        derivadoPor: usuario.id,
        areaActual: areaActual || null,
        accionPendiente: null,
        source: 'portal',
      } as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>);
      onCreated();
      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClienteId(null);
    setRazonSocial('');
    setContacto('');
    setEmail('');
    setTelefono('');
    setMotivoLlamado('soporte');
    setAreaActual('');
    setAsignadoId('');
    setNuevoEstado('pendiente_info');
    setDescripcion('');
    setClienteSearch('');
    setContactos([]);
  };

  return (
    <Modal open={open} title="Nuevo Lead" onClose={onClose}>
      <div className="space-y-3">
        {/* Razón Social — búsqueda de cliente o texto libre */}
        <div className="relative">
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Razón social *</label>
          {clienteId ? (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <span className="text-xs text-slate-700 font-medium flex-1 truncate">{razonSocial}</span>
              <button onClick={handleClearCliente} className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={razonSocial}
                onChange={e => {
                  setRazonSocial(e.target.value);
                  setClienteSearch(e.target.value);
                  setShowClienteDropdown(true);
                }}
                onFocus={() => { if (razonSocial) setShowClienteDropdown(true); }}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Buscar cliente existente o escribir nuevo..."
              />
              {showClienteDropdown && filteredClientes.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredClientes.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => handleSelectCliente(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-slate-700 border-b border-slate-100 last:border-0"
                    >
                      {c.razonSocial}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Contacto — selección de DB o libre */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Contacto *</label>
          {contactos.length > 0 ? (
            <div className="space-y-1">
              <select
                value=""
                onChange={e => {
                  const c = contactos.find(x => x.id === e.target.value);
                  if (c) handleSelectContacto(c);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar contacto del cliente...</option>
                {contactos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` (${c.cargo})` : ''}</option>
                ))}
              </select>
              <Input
                value={contacto}
                onChange={e => setContacto(e.target.value)}
                placeholder="O escribir nombre manualmente"
              />
            </div>
          ) : (
            <Input
              value={contacto}
              onChange={e => setContacto(e.target.value)}
              placeholder="Persona de contacto"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Motivo *</label>
            <select
              value={motivoLlamado}
              onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MOTIVOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Estado inicial</label>
            <select
              value={nuevoEstado}
              onChange={e => setNuevoEstado(e.target.value as LeadEstado)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LEAD_ESTADO_ORDER.filter(e => e !== 'finalizado' && e !== 'no_concretado' && e !== 'nuevo').map(e => (
                <option key={e} value={e}>{LEAD_ESTADO_LABELS[e]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Área destino y asignación — obligatorios */}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Área destino *</label>
          <select
            value={areaActual}
            onChange={e => setAreaActual(e.target.value as LeadArea | '')}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar área...</option>
            {LEAD_AREA_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.areas.map(a => <option key={a} value={a}>{LEAD_AREA_LABELS[a]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {areaActual && (
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">
              Asignar a ({isIngeniero ? 'ingeniero' : 'usuario'})
            </label>
            <select
              value={asignadoId}
              onChange={e => setAsignadoId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Solo al área (sin persona específica)</option>
              {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Descripción</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
