import { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, clientesService, usuariosService, ingenierosService } from '../../services/firebaseService';
import { MOTIVO_LLAMADO_LABELS, TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_DIAS, getUserTicketAreas } from '@ags/shared';
import type { MotivoLlamado, TicketArea, TicketPrioridad, Ticket, ContactoCliente, Posta } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MOTIVOS = Object.entries(MOTIVO_LLAMADO_LABELS) as [MotivoLlamado, string][];

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

export default function CrearLeadModal({ open, onClose, onCreated }: Props) {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string; role: string | null; roles?: string[] }[]>([]);
  const [ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [clienteHighlight, setClienteHighlight] = useState(-1);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>('soporte');
  const [areaActual, setAreaActual] = useState<TicketArea | ''>('');
  const [asignadoId, setAsignadoId] = useState('');
  const [prioridad, setPrioridad] = useState<TicketPrioridad | 'custom'>('normal');
  const [descripcion, setDescripcion] = useState('');
  const [motivoOtros, setMotivoOtros] = useState('');
  const [fechaContactoCustom, setFechaContactoCustom] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      clientesService.getAll().then(setClientes);
      usuariosService.getIngenieros().then(setUsuarios);
      ingenierosService.getAll().then(setIngenieros);
      setStep(1);
    }
  }, [open]);

  useEffect(() => {
    if (clienteId) {
      clientesService.getContactos(clienteId).then(setContactos);
    } else {
      setContactos([]);
    }
  }, [clienteId]);

  useEffect(() => { setAsignadoId(''); }, [areaActual]);

  const filteredClientes = clienteSearch.trim()
    ? clientes.filter(c => c.razonSocial.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8)
    : [];

  const personList = useMemo(() => {
    if (!areaActual) return usuarios.map(u => ({ id: u.id, label: u.displayName }));
    return usuarios.filter(u => {
      if ((u as any).role === 'admin') return true;
      const areas = getUserTicketAreas(u as any);
      return areas.includes(areaActual as TicketArea);
    }).map(u => ({ id: u.id, label: u.displayName }));
  }, [usuarios, areaActual]);

  const getAsignadoNombre = () => {
    if (!asignadoId) return null;
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
  const canGoStep2 = razonSocial.trim() && contacto.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !usuario) return;
    setSaving(true);
    try {
      const asignadoNombre = getAsignadoNombre();
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: asignadoId || '',
        aUsuarioNombre: asignadoNombre || '',
        ...(areaActual ? { aArea: areaActual } : {}),
        ...(descripcion.trim() ? { comentario: descripcion.trim() } : {}),
        estadoAnterior: 'nuevo' as const,
        estadoNuevo: 'nuevo' as const,
      };
      await leadsService.create({
        razonSocial: razonSocial.trim(),
        contacto: contacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        motivoLlamado,
        motivoOtros: motivoLlamado === 'otros' ? motivoOtros.trim() || null : null,
        motivoContacto: '',
        descripcion: descripcion.trim() || null,
        clienteId: clienteId || null,
        contactoId: null,
        sistemaId: null,
        estado: 'nuevo' as const,
        postas: [posta],
        asignadoA: asignadoId || null,
        asignadoNombre: asignadoNombre,
        derivadoPor: usuario.id,
        areaActual: areaActual || null,
        accionPendiente: null,
        prioridad: prioridad === 'custom' ? 'normal' : (prioridad || 'normal'),
        proximoContacto: fechaContactoCustom || (() => {
          const d = new Date();
          const dias = prioridad === 'custom' ? 7 : (TICKET_PRIORIDAD_DIAS[prioridad as TicketPrioridad] ?? 7);
          d.setDate(d.getDate() + dias);
          return d.toISOString().split('T')[0];
        })(),
        source: 'portal',
      } as Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>);
      // Upload adjuntos if any
      if (pendingFiles.length > 0) {
        // Get the created lead ID from the list (last created)
        // For now adjuntos are uploaded separately after creation
        // TODO: leadsService.uploadAdjuntos once ID is returned
      }
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
    setPrioridad('normal');
    setMotivoOtros('');
    setDescripcion('');
    setPendingFiles([]);
    setFechaContactoCustom('');
    setClienteSearch('');
    setContactos([]);
    setStep(1);
  };

  /* ---- Shared field renderers ---- */

  const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
  const labelClass = 'text-[11px] font-medium text-slate-500 mb-0.5 block';

  const handleClienteKeyDown = (e: React.KeyboardEvent) => {
    if (!showClienteDropdown || filteredClientes.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setClienteHighlight(prev => prev < filteredClientes.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setClienteHighlight(prev => prev > 0 ? prev - 1 : filteredClientes.length - 1);
        break;
      case 'Tab':
      case 'Enter':
        if (clienteHighlight >= 0 && clienteHighlight < filteredClientes.length) {
          e.preventDefault();
          handleSelectCliente(filteredClientes[clienteHighlight]);
          setClienteHighlight(-1);
        }
        break;
      case 'Escape':
        setShowClienteDropdown(false);
        setClienteHighlight(-1);
        break;
    }
  };

  const clienteField = (
    <div className="relative">
      <label className={labelClass}>Razón social *</label>
      {clienteId ? (
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
          <span className="text-sm text-slate-700 font-medium flex-1 truncate">{razonSocial}</span>
          <button onClick={handleClearCliente} className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0">
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={razonSocial}
            onChange={e => { setRazonSocial(e.target.value); setClienteSearch(e.target.value); setShowClienteDropdown(true); setClienteHighlight(-1); }}
            onFocus={() => { if (razonSocial) setShowClienteDropdown(true); }}
            onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
            onKeyDown={handleClienteKeyDown}
            className={selectClass}
            placeholder="Buscar cliente existente o escribir nuevo..."
          />
          {showClienteDropdown && filteredClientes.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredClientes.map((c, i) => (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelectCliente(c)}
                  onMouseEnter={() => setClienteHighlight(i)}
                  className={`w-full text-left px-3 py-2.5 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors ${
                    i === clienteHighlight ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50'
                  }`}
                >
                  {c.razonSocial}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const contactoField = (
    <div>
      <label className={labelClass}>Contacto *</label>
      {contactos.length > 0 ? (
        <div className="space-y-1.5">
          <select
            value=""
            onChange={e => { const c = contactos.find(x => x.id === e.target.value); if (c) handleSelectContacto(c); }}
            className={selectClass}
          >
            <option value="">Seleccionar contacto del cliente...</option>
            {contactos.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}{c.cargo ? ` (${c.cargo})` : ''}</option>
            ))}
          </select>
          <Input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="O escribir nombre manualmente" />
        </div>
      ) : (
        <Input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Persona de contacto" />
      )}
    </div>
  );

  const emailTelFields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
    </div>
  );

  const motivoField = (
    <div>
      <label className={labelClass}>Motivo *</label>
      <select value={motivoLlamado} onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)} className={selectClass}>
        {MOTIVOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {motivoLlamado === 'otros' && (
        <Input className="mt-1" value={motivoOtros} onChange={e => setMotivoOtros(e.target.value)}
          placeholder="Describir el motivo..." />
      )}
    </div>
  );

  const proximoContactoField = (
    <div>
      <label className={labelClass}>Próximo contacto</label>
      <select
        value={prioridad}
        onChange={e => {
          const v = e.target.value;
          if (v === 'custom') {
            setPrioridad('custom');
          } else {
            setPrioridad(v as TicketPrioridad);
            setFechaContactoCustom('');
          }
        }}
        className={selectClass}
      >
        {Object.entries(TICKET_PRIORIDAD_DIAS).map(([k, dias]) => (
          <option key={k} value={k}>{dias <= 4 ? `${(dias as number) * 24} hs` : `${dias} días`} — {TICKET_PRIORIDAD_LABELS[k as TicketPrioridad]}</option>
        ))}
        <option value="custom">Elegir fecha específica...</option>
      </select>
      {prioridad === 'custom' && (
        <input type="date" value={fechaContactoCustom}
          onChange={e => setFechaContactoCustom(e.target.value)}
          className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
          title="Elegir fecha" />
      )}
    </div>
  );

  const areaField = (
    <div>
      <label className={labelClass}>Área destino *</label>
      <select value={areaActual} onChange={e => setAreaActual(e.target.value as TicketArea | '')} className={selectClass}>
        <option value="">Seleccionar área...</option>
        {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );

  const asignadoField = (
    <div>
      <label className={labelClass}>Asignar a</label>
      <select value={asignadoId} onChange={e => setAsignadoId(e.target.value)} className={selectClass} disabled={!areaActual}>
        <option value="">{areaActual ? 'Solo al área' : '— Elegí área primero —'}</option>
        {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    </div>
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files].slice(0, 10));
    e.target.value = '';
  };

  const descripcionField = (
    <div>
      <label className={labelClass}>Descripción</label>
      <textarea
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        rows={2}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
      />
    </div>
  );

  const adjuntosField = (
    <div>
      <label className={labelClass}>Adjuntos ({pendingFiles.length}/10)</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="text-xs text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg font-medium">
          + Archivos
        </button>
        {isMobile && (
          <button type="button" onClick={() => cameraInputRef.current?.click()}
            className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium">
            Tomar foto
          </button>
        )}
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      </div>
      {pendingFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] bg-slate-50 rounded px-2 py-1">
              <span className="truncate flex-1 text-slate-600">{f.name}</span>
              <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ---- Mobile: fullscreen wizard ---- */
  if (isMobile && open) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <button onClick={onClose} className="text-sm text-slate-500">Cancelar</button>
          <h3 className="text-sm font-semibold text-slate-900">Nuevo Ticket</h3>
          <span className="text-xs text-slate-400">{step}/2</span>
        </div>

        {/* Progress bar */}
        <div className="shrink-0 h-1 bg-slate-100">
          <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${step * 50}%` }} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Cliente y contacto</p>
              {clienteField}
              {contactoField}
              {emailTelFields}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Clasificación y asignación</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {motivoField}
                {areaField}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {asignadoField}
                {proximoContactoField}
              </div>
              {descripcionField}
              {adjuntosField}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="shrink-0 flex gap-3 px-4 py-3 border-t border-slate-100 bg-white" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {step === 1 ? (
            <Button className="flex-1" onClick={() => setStep(2)} disabled={!canGoStep2}>
              Siguiente
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>
                Anterior
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={saving || !canSubmit}>
                {saving ? 'Creando...' : 'Crear Ticket'}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---- Desktop: modal normal ---- */
  return (
    <Modal open={open} title="Nuevo Ticket" onClose={onClose}>
      <div className="space-y-2">
        {clienteField}
        {contactoField}
        {emailTelFields}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {motivoField}
          {areaField}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {asignadoField}
          {proximoContactoField}
        </div>
        {descripcionField}
        {adjuntosField}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Creando...' : 'Crear Ticket'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
