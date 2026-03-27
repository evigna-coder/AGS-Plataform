import { useState, useEffect, useRef } from 'react';
import type { UsuarioAGS, MotivoLlamado, LeadArea, LeadPrioridad, Cliente, Sistema, ModuloSistema } from '@ags/shared';
import { LEAD_MAX_ADJUNTOS } from '@ags/shared';
import { leadsService, usuariosService, clientesService, sistemasService, modulosService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

export function useCrearLeadForm(onClose: () => void, onCreated?: (leadId?: string) => void) {
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

  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  useEffect(() => {
    Promise.all([
      usuariosService.getAll(), clientesService.getAll(true), sistemasService.getAll(),
    ]).then(([u, c, s]) => {
      setUsuarios(u.filter(x => x.status === 'activo'));
      setClientes(c); setSistemas(s);
    });
  }, []);

  const filteredClientes = clienteSearch.trim()
    ? clientes.filter(c => c.razonSocial.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleSelectCliente = (cli: Cliente) => {
    setClienteId(cli.id); setRazonSocial(cli.razonSocial);
    setClienteSearch(''); setShowClienteDropdown(false);
    setSistemaId(''); setModuloId(''); setModulos([]);
  };

  const handleClearCliente = () => {
    setClienteId(''); setRazonSocial('');
    setSistemaId(''); setModuloId(''); setModulos([]);
  };

  const handleSistemaChange = async (id: string) => {
    setSistemaId(id); setModuloId('');
    if (id) { setModulos(await modulosService.getBySistema(id)); }
    else { setModulos([]); }
  };

  const sistemasFiltrados = clienteId ? sistemas.filter(s => s.clienteId === clienteId) : sistemas;

  const calcProximoContacto = (): string | null => {
    const dias = parseInt(diasProximoContacto);
    if (isNaN(dias) || dias <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + dias);
    return date.toISOString().split('T')[0];
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    const total = [...pendingFiles, ...Array.from(files)].slice(0, LEAD_MAX_ADJUNTOS);
    setPendingFiles(total);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

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
        id: crypto.randomUUID(), fecha: new Date().toISOString(),
        deUsuarioId: usuario.id, deUsuarioNombre: usuario.displayName,
        aUsuarioId: asignadoA || usuario.id,
        aUsuarioNombre: responsable?.displayName || usuario.displayName,
        comentario: descripcion.trim() || undefined,
        estadoAnterior: 'nuevo' as const, estadoNuevo: 'nuevo' as const,
      } : null;

      const leadId = await leadsService.create({
        clienteId: clienteId || null, contactoId: null,
        razonSocial: razonSocial.trim(), contacto: contacto.trim(),
        email: email.trim(), telefono: telefono.trim(),
        motivoLlamado, motivoContacto: descripcion.trim(),
        descripcion: descripcion.trim() || null,
        sistemaId: sistemaId || null, moduloId: moduloId || null,
        estado: 'nuevo', postas: initialPosta ? [initialPosta] : [],
        asignadoA: asignadoA || null,
        asignadoNombre: usuarios.find(u => u.id === asignadoA)?.displayName || null,
        derivadoPor: null, areaActual: areaActual || null,
        accionPendiente: accionPendiente.trim() || null,
        prioridad: prioridad || 'media',
        proximoContacto: calcProximoContacto(),
        valorEstimado: null, createdBy: usuario?.id,
        finalizadoAt: null, presupuestosIds: [], otIds: [],
      });
      if (pendingFiles.length > 0) await leadsService.uploadAdjuntos(leadId, pendingFiles, 0);
      onCreated?.(leadId);
      onClose();
    } catch { alert('Error al crear el lead'); }
    finally { setSaving(false); }
  };

  return {
    saving, errors, usuarios, fileRef, pendingFiles,
    motivoLlamado, setMotivoLlamado, descripcion, setDescripcion,
    clienteId, razonSocial, setRazonSocial, contacto, setContacto,
    email, setEmail, telefono, setTelefono,
    sistemaId, moduloId, setModuloId, modulos,
    asignadoA, setAsignadoA, areaActual, setAreaActual,
    accionPendiente, setAccionPendiente, prioridad, setPrioridad,
    diasProximoContacto, setDiasProximoContacto,
    clienteSearch, setClienteSearch, showClienteDropdown, setShowClienteDropdown,
    filteredClientes, sistemasFiltrados,
    handleSelectCliente, handleClearCliente, handleSistemaChange,
    handleFileChange, removeFile, handleSubmit,
  };
}
