import { useState, useEffect } from 'react';
import type { UsuarioAGS, MotivoLlamado, Cliente, Sistema, ModuloSistema } from '@ags/shared';
import { MOTIVO_LLAMADO_LABELS } from '@ags/shared';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleClienteChange = (id: string) => {
    setClienteId(id);
    setSistemaId('');
    setModuloId('');
    setModulos([]);
    if (id) {
      const cli = clientes.find(c => c.id === id);
      if (cli) setRazonSocial(cli.razonSocial);
    }
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

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!razonSocial.trim() && !clienteId) errs.razonSocial = 'Ingrese razón social o seleccione cliente';
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

      await leadsService.create({
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
        derivadoPor: null,
        createdBy: usuario?.id,
        finalizadoAt: null,
        presupuestosIds: [],
        otIds: [],
      });
      onCreated?.();
      onClose();
    } catch {
      alert('Error al crear el lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Nuevo Lead" subtitle="Registrar nueva consulta" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Motivo *</label>
          <select value={motivoLlamado} onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Detalle de la consulta o solicitud..." />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Cliente (opcional)</label>
          <SearchableSelect value={clienteId} onChange={handleClienteChange}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Buscar cliente..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Razón Social *" value={razonSocial}
            onChange={e => setRazonSocial(e.target.value)} error={errors.razonSocial} placeholder="Nombre de la empresa" />
          <Input inputSize="sm" label="Contacto *" value={contacto}
            onChange={e => setContacto(e.target.value)} error={errors.contacto} placeholder="Persona de contacto" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          <Input inputSize="sm" label="Teléfono" value={telefono}
            onChange={e => setTelefono(e.target.value)} placeholder="011 1234 5678" />
        </div>

        {clienteId && sistemasFiltrados.length > 0 && (
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Sistema/Equipo (opcional)</label>
            <SearchableSelect value={sistemaId} onChange={handleSistemaChange}
              options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
              placeholder="Buscar sistema..." />
          </div>
        )}

        {sistemaId && modulos.length > 0 && (
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Módulo (opcional)</label>
            <SearchableSelect value={moduloId} onChange={setModuloId}
              options={modulos.map(m => ({ value: m.id, label: m.nombre }))}
              placeholder="Buscar módulo..." />
          </div>
        )}

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Asignar a (opcional)</label>
          <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Sin asignar</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
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
