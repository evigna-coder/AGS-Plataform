import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, clientesService } from '../../services/firebaseService';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_GROUPS } from '@ags/shared';
import type { MotivoLlamado, LeadArea, Lead, ContactoCliente } from '@ags/shared';

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
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>('soporte');
  const [areaActual, setAreaActual] = useState<LeadArea | ''>('');
  const [motivoContacto, setMotivoContacto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (open) clientesService.getAll().then(setClientes);
  }, [open]);

  useEffect(() => {
    if (clienteId) {
      clientesService.getContactos(clienteId).then(setContactos);
    } else {
      setContactos([]);
    }
  }, [clienteId]);

  const filteredClientes = clienteSearch.trim()
    ? clientes.filter(c => c.razonSocial.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8)
    : [];

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

  const handleSubmit = async () => {
    if (!razonSocial.trim() || !contacto.trim()) return;
    setSaving(true);
    try {
      await leadsService.create({
        razonSocial: razonSocial.trim(),
        contacto: contacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        motivoLlamado,
        motivoContacto: motivoContacto.trim(),
        descripcion: descripcion.trim() || null,
        clienteId: clienteId || null,
        contactoId: null,
        sistemaId: null,
        estado: 'nuevo',
        postas: [],
        asignadoA: usuario?.id ?? null,
        asignadoNombre: usuario?.displayName ?? null,
        derivadoPor: null,
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
    setMotivoContacto('');
    setDescripcion('');
    setClienteSearch('');
    setContactos([]);
  };

  return (
    <Modal open={open} title="Nuevo Lead" onClose={onClose}>
      <div className="space-y-3">
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

        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Área destino</label>
          <select
            value={areaActual}
            onChange={e => setAreaActual(e.target.value as LeadArea | '')}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin área específica</option>
            {LEAD_AREA_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.areas.map(a => <option key={a} value={a}>{LEAD_AREA_LABELS[a]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <Input label="Motivo de contacto" value={motivoContacto} onChange={e => setMotivoContacto(e.target.value)} />
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Descripción</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !razonSocial.trim() || !contacto.trim()}>
            {saving ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
