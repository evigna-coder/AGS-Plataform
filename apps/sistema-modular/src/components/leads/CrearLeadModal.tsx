import { useState, useEffect, useRef } from 'react';
import type { UsuarioAGS, MotivoLlamado, LeadArea, LeadPrioridad, Cliente, Sistema, ModuloSistema } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS, LEAD_AREA_LABELS, LEAD_AREA_GROUPS, LEAD_PRIORIDAD_LABELS, LEAD_MAX_ADJUNTOS } from '@ags/shared';
import { leadsService, usuariosService, clientesService, sistemasService, modulosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';

interface CrearLeadModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

export const CrearLeadModal = ({ onClose, onCreated }: CrearLeadModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [saving, setSaving] = useState(false);

  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>('soporte');
  const [descripcion, setDescripcion] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sistemaId, setSistemaId] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [asignadoA, setAsignadoA] = useState('');
  const [areaActual, setAreaActual] = useState<LeadArea | ''>('');
  const [accionPendiente, setAccionPendiente] = useState('');
  const [prioridad, setPrioridad] = useState<LeadPrioridad>('media');
  const [diasProximoContacto, setDiasProximoContacto] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Client search state for free-text entry
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  useEffect(() => {
    Promise.all([
      usuariosService.getAll(),
      clientesService.getAll(true),
      sistemasService.getAll(),
    ]).then(([u, c, s]) => {
      setUsuarios(u.filter(x => x.status === 'activo'));
      setClientes(c);
      setSistemas(s);
    });
  }, []);

  const filteredClientes = clienteSearch.trim()
    ? clientes.filter(c => c.razonSocial.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleSelectCliente = (cli: Cliente) => {
    setClienteId(cli.id);
    setRazonSocial(cli.razonSocial);
    setClienteSearch('');
    setShowClienteDropdown(false);
    setSistemaId('');
    setModuloId('');
    setModulos([]);
  };

  const handleClearCliente = () => {
    setClienteId('');
    setRazonSocial('');
    setSistemaId('');
    setModuloId('');
    setModulos([]);
    setSistemas(prev => prev);
  };

  const handleSistemaChange = async (id: string) => {
    setSistemaId(id);
    setModuloId('');
    if (id) {
      const mods = await modulosService.getBySistema(id);
      setModulos(mods);
    } else {
      setModulos([]);
    }
  };

  const sistemasFiltrados = clienteId
    ? sistemas.filter(s => s.clienteId === clienteId)
    : sistemas;

  const calcProximoContacto = (): string | null => {
    const dias = parseInt(diasProximoContacto);
    if (isNaN(dias) || dias <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + dias);
    return date.toISOString().split('T')[0];
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!razonSocial.trim()) errs.razonSocial = 'Ingrese o seleccione un cliente';
    if (!contacto.trim()) errs.contacto = 'Obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const responsable = usuarios.find(u => u.id === asignadoA);
      const initialPosta = usuario ? {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: asignadoA || usuario.id,
        aUsuarioNombre: responsable?.displayName || usuario.displayName,
        comentario: descripcion.trim() || undefined,
        estadoAnterior: 'nuevo' as const,
        estadoNuevo: 'nuevo' as const,
      } : null;

      const leadId = await leadsService.create({
        clienteId: clienteId || null,
        contactoId: null,
        razonSocial: razonSocial.trim(),
        contacto: contacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        motivoLlamado,
        motivoContacto: descripcion.trim(),
        descripcion: descripcion.trim() || null,
        sistemaId: sistemaId || null,
        moduloId: moduloId || null,
        estado: 'nuevo',
        postas: initialPosta ? [initialPosta] : [],
        asignadoA: asignadoA || null,
        asignadoNombre: usuarios.find(u => u.id === asignadoA)?.displayName || null,
        derivadoPor: null,
        areaActual: areaActual || null,
        accionPendiente: accionPendiente.trim() || null,
        prioridad: prioridad || 'media',
        proximoContacto: calcProximoContacto(),
        valorEstimado: null,
        createdBy: usuario?.id,
        finalizadoAt: null,
        presupuestosIds: [],
        otIds: [],
      });
      if (pendingFiles.length > 0) {
        await leadsService.uploadAdjuntos(leadId, pendingFiles, 0);
      }
      onCreated?.();
      onClose();
    } catch {
      alert('Error al crear el lead');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
  const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

  return (
    <Modal open title="Nuevo Lead" subtitle="Registrar nueva consulta" onClose={onClose}>
      <div className="space-y-3">
        {/* Motivo */}
        <div>
          <label className={labelClass}>Motivo *</label>
          <select value={motivoLlamado} onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)} className={selectClass}>
            {Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Prioridad + Próximo contacto (días) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value as LeadPrioridad)} className={selectClass}>
              {Object.entries(LEAD_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Próximo contacto (días)</label>
            <input type="number" min="1" value={diasProximoContacto}
              onChange={e => setDiasProximoContacto(e.target.value)}
              className={selectClass} placeholder="Ej: 10" />
            {diasProximoContacto && parseInt(diasProximoContacto) > 0 && (
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {(() => { const d = new Date(); d.setDate(d.getDate() + parseInt(diasProximoContacto)); return d.toLocaleDateString('es-AR'); })()}
              </span>
            )}
          </div>
        </div>

        {/* Cliente — búsqueda con texto libre */}
        <div className="relative">
          <label className={labelClass}>Cliente / Razón Social *</label>
          {clienteId ? (
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50">
              <span className="text-xs text-slate-700 font-medium flex-1 truncate">{razonSocial}</span>
              <button onClick={handleClearCliente} className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0">Cambiar</button>
            </div>
          ) : (
            <>
              <input type="text" value={razonSocial}
                onChange={e => { setRazonSocial(e.target.value); setClienteSearch(e.target.value); setShowClienteDropdown(true); }}
                onFocus={() => { if (razonSocial) setShowClienteDropdown(true); }}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                className={selectClass}
                placeholder="Buscar cliente o escribir razón social nueva..." />
              {errors.razonSocial && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.razonSocial}</span>}
              {showClienteDropdown && filteredClientes.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClientes.map(c => (
                    <button key={c.id} onMouseDown={() => handleSelectCliente(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 text-slate-700 border-b border-slate-100 last:border-0">
                      {c.razonSocial}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Contacto + Email + Teléfono */}
        <div>
          <Input inputSize="sm" label="Contacto *" value={contacto}
            onChange={e => setContacto(e.target.value)} error={errors.contacto} placeholder="Persona de contacto" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          <Input inputSize="sm" label="Teléfono" value={telefono}
            onChange={e => setTelefono(e.target.value)} placeholder="011 1234 5678" />
        </div>

        {/* Sistema/Equipo (solo si hay cliente seleccionado) */}
        {clienteId && sistemasFiltrados.length > 0 && (
          <div>
            <label className={labelClass}>Sistema/Equipo (opcional)</label>
            <SearchableSelect value={sistemaId} onChange={handleSistemaChange}
              options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
              placeholder="Buscar sistema..." />
          </div>
        )}

        {sistemaId && modulos.length > 0 && (
          <div>
            <label className={labelClass}>Módulo (opcional)</label>
            <SearchableSelect value={moduloId} onChange={setModuloId}
              options={modulos.map(m => ({ value: m.id, label: m.nombre }))}
              placeholder="Buscar módulo..." />
          </div>
        )}

        {/* Área destino */}
        <div>
          <label className={labelClass}>Área destino (opcional)</label>
          <select value={areaActual} onChange={e => setAreaActual(e.target.value as LeadArea | '')} className={selectClass}>
            <option value="">Sin área específica</option>
            {LEAD_AREA_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.areas.map(a => <option key={a} value={a}>{LEAD_AREA_LABELS[a]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Asignar a */}
        <div>
          <label className={labelClass}>Asignar a (opcional)</label>
          <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} className={selectClass}>
            <option value="">Sin asignar</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
        </div>

        {/* Descripción — al final */}
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Detalle de la consulta o solicitud..." />
        </div>

        {/* Acción pendiente — debajo de descripción */}
        <div>
          <label className={labelClass}>Acción pendiente (opcional)</label>
          <input type="text" value={accionPendiente} onChange={e => setAccionPendiente(e.target.value)}
            className={selectClass}
            placeholder="Ej: Averiguar N° de parte, Confirmar disponibilidad..." />
        </div>

        {/* Adjuntos */}
        <div>
          <label className={labelClass}>Adjuntos ({pendingFiles.length}/{LEAD_MAX_ADJUNTOS})</label>
          <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={e => {
              const files = e.target.files;
              if (!files) return;
              const total = [...pendingFiles, ...Array.from(files)].slice(0, LEAD_MAX_ADJUNTOS);
              setPendingFiles(total);
              if (fileRef.current) fileRef.current.value = '';
            }} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={pendingFiles.length >= LEAD_MAX_ADJUNTOS}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium disabled:text-slate-400 disabled:cursor-not-allowed">
              + Seleccionar archivos
            </button>
            {pendingFiles.length > 0 && (
              <span className="text-[10px] text-slate-400">{pendingFiles.length} archivo(s) seleccionado(s)</span>
            )}
          </div>
          {pendingFiles.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.type.startsWith('image/') ? 'bg-green-400' : 'bg-blue-400'}`} />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
