import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, modulosService, contactosService, fichasService } from '../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ModuloSistema, Part, ContactoCliente } from '@ags/shared';

export function useOTDetail(otNumber?: string) {
  const navigate = useNavigate();

  // Related data
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [modulo, setModulo] = useState<ModuloSistema | null>(null);
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Select lists
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [modulosFiltrados, setModulosFiltrados] = useState<ModuloSistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);

  // Editable fields
  const [razonSocial, setRazonSocial] = useState('');
  const [contacto, setContacto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [emailPrincipal, setEmailPrincipal] = useState('');
  const [sistemaNombre, setSistemaNombre] = useState('');
  const [codigoInternoCliente, setCodigoInternoCliente] = useState('');
  const [moduloModelo, setModuloModelo] = useState('');
  const [moduloDescripcion, setModuloDescripcion] = useState('');
  const [moduloSerie, setModuloSerie] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [horasTrabajadas, setHorasTrabajadas] = useState('');
  const [tiempoViaje, setTiempoViaje] = useState('');
  const [reporteTecnico, setReporteTecnico] = useState('');
  const [accionesTomar, setAccionesTomar] = useState('');
  const [articulos, setArticulos] = useState<Part[]>([]);
  const [budgets, setBudgets] = useState<string[]>(['']);
  const [esFacturable, setEsFacturable] = useState(false);
  const [tieneContrato, setTieneContrato] = useState(false);
  const [esGarantia, setEsGarantia] = useState(false);
  const [status, setStatus] = useState<'BORRADOR' | 'FINALIZADO'>('BORRADOR');
  const [aclaracionCliente, setAclaracionCliente] = useState('');
  const [aclaracionEspecialista, setAclaracionEspecialista] = useState('');
  const [materialesParaServicio, setMaterialesParaServicio] = useState('');
  const [problemaFallaInicial, setProblemaFallaInicial] = useState('');

  // IDs
  const [clienteId, setClienteId] = useState<string | undefined>();
  const [sistemaId, setSistemaId] = useState<string | undefined>();
  const [moduloId, setModuloId] = useState<string | undefined>();

  // Autosave
  const hasUserInteracted = useRef(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New item modal
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '',
  });

  useEffect(() => { if (otNumber) loadData(); }, [otNumber]);

  useEffect(() => {
    if (clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === clienteId));
      contactosService.getByCliente(clienteId).then(setContactos).catch(() => setContactos([]));
    } else { setSistemasFiltrados([]); setContactos([]); }
  }, [clienteId, sistemas]);

  useEffect(() => {
    if (sistemaId) {
      modulosService.getBySistema(sistemaId).then(d => { setModulos(d); setModulosFiltrados(d); }).catch(() => setModulosFiltrados([]));
    } else { setModulosFiltrados([]); }
  }, [sistemaId]);

  // Autosave debounce
  useEffect(() => {
    if (!hasUserInteracted.current || !otNumber || loading) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => handleSave(), 1000);
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [
    razonSocial, contacto, direccion, localidad, provincia, emailPrincipal,
    sistemaNombre, codigoInternoCliente, moduloModelo, moduloDescripcion, moduloSerie,
    tipoServicio, fechaInicio, fechaFin, horasTrabajadas, tiempoViaje,
    reporteTecnico, accionesTomar, articulos, budgets, esFacturable, tieneContrato, esGarantia,
    aclaracionCliente, aclaracionEspecialista, materialesParaServicio, problemaFallaInicial,
    clienteId || '', sistemaId || '', moduloId || '',
  ]);

  const loadData = async () => {
    if (!otNumber) return;
    try {
      setLoading(true);
      const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
      if (!ot) { alert('Orden de trabajo no encontrada'); navigate('/ordenes-trabajo'); return; }
      setRazonSocial(ot.razonSocial || ''); setContacto(ot.contacto || '');
      setDireccion(ot.direccion || ''); setLocalidad(ot.localidad || '');
      setProvincia(ot.provincia || ''); setEmailPrincipal(ot.emailPrincipal || '');
      setSistemaNombre(ot.sistema || ''); setCodigoInternoCliente(ot.codigoInternoCliente || '');
      setModuloModelo(ot.moduloModelo || ''); setModuloDescripcion(ot.moduloDescripcion || '');
      setModuloSerie(ot.moduloSerie || ''); setTipoServicio(ot.tipoServicio || '');
      setFechaInicio(ot.fechaInicio || ''); setFechaFin(ot.fechaFin || '');
      setHorasTrabajadas(ot.horasTrabajadas || ''); setTiempoViaje(ot.tiempoViaje || '');
      setReporteTecnico(ot.reporteTecnico || ''); setAccionesTomar(ot.accionesTomar || '');
      setArticulos(ot.articulos || []);
      setBudgets(ot.budgets && ot.budgets.length > 0 ? ot.budgets : ['']);
      setEsFacturable(ot.esFacturable || false); setTieneContrato(ot.tieneContrato || false);
      setEsGarantia(ot.esGarantia || false); setStatus(ot.status || 'BORRADOR');
      setAclaracionCliente(ot.aclaracionCliente || '');
      setAclaracionEspecialista(ot.aclaracionEspecialista || '');
      setMaterialesParaServicio(ot.materialesParaServicio || '');
      setProblemaFallaInicial(ot.problemaFallaInicial || '');
      setClienteId(ot.clienteId); setSistemaId(ot.sistemaId); setModuloId(ot.moduloId);

      if (ot.clienteId) { const c = await clientesService.getById(ot.clienteId); setCliente(c); }
      if (ot.sistemaId) {
        const s = await sistemasService.getById(ot.sistemaId); setSistema(s);
        if (ot.moduloId && s) { try { setModulo(await modulosService.getById(ot.sistemaId, ot.moduloId)); } catch {} }
      }
      if (otNumber && !otNumber.includes('.')) { setItems(await ordenesTrabajoService.getItemsByOtPadre(otNumber)); }
      setTiposServicio(await tiposServicioService.getAll());
      const [cd, sd] = await Promise.all([clientesService.getAll(true), sistemasService.getAll()]);
      setClientes(cd); setSistemas(sd);
      if (ot.clienteId) {
        setSistemasFiltrados(sd.filter(s => s.clienteId === ot.clienteId));
        try { setContactos(await contactosService.getByCliente(ot.clienteId)); } catch {}
      }
      if (ot.sistemaId) {
        try { const md = await modulosService.getBySistema(ot.sistemaId); setModulos(md); setModulosFiltrados(md); } catch {}
      }
      hasUserInteracted.current = false;
    } catch { alert('Error al cargar la orden de trabajo'); } finally { setLoading(false); }
  };

  const cleanValue = (v: any) => (v === undefined || v === '' ? null : v);

  const handleSave = async () => {
    if (!otNumber) return;
    try {
      setSaving(true);
      await ordenesTrabajoService.update(otNumber, {
        razonSocial: cleanValue(razonSocial), contacto: cleanValue(contacto),
        direccion: cleanValue(direccion), localidad: cleanValue(localidad),
        provincia: cleanValue(provincia), emailPrincipal: cleanValue(emailPrincipal),
        sistema: cleanValue(sistemaNombre), codigoInternoCliente: cleanValue(codigoInternoCliente),
        moduloModelo: cleanValue(moduloModelo), moduloDescripcion: cleanValue(moduloDescripcion),
        moduloSerie: cleanValue(moduloSerie), tipoServicio: cleanValue(tipoServicio),
        fechaInicio: cleanValue(fechaInicio), fechaFin: cleanValue(fechaFin),
        horasTrabajadas: cleanValue(horasTrabajadas), tiempoViaje: cleanValue(tiempoViaje),
        reporteTecnico: cleanValue(reporteTecnico), accionesTomar: cleanValue(accionesTomar),
        articulos, budgets: budgets.filter(b => b.trim() !== ''),
        esFacturable, tieneContrato, esGarantia, status,
        aclaracionCliente: cleanValue(aclaracionCliente),
        aclaracionEspecialista: cleanValue(aclaracionEspecialista),
        materialesParaServicio: cleanValue(materialesParaServicio),
        problemaFallaInicial: cleanValue(problemaFallaInicial),
        clienteId: cleanValue(clienteId), sistemaId: cleanValue(sistemaId), moduloId: cleanValue(moduloId),
      } as Partial<WorkOrder>);
    } catch { alert('Error al guardar los cambios'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!otNumber || !window.confirm(`Eliminar OT ${otNumber}?`)) return;
    try { setSaving(true); await ordenesTrabajoService.delete(otNumber); alert('OT eliminada'); navigate('/ordenes-trabajo'); }
    catch { alert('Error al eliminar'); } finally { setSaving(false); }
  };

  const markInteracted = () => { if (!hasUserInteracted.current) hasUserInteracted.current = true; };

  const addPart = () => { setArticulos([...articulos, { id: `part-${Date.now()}`, codigo: '', descripcion: '', cantidad: 1, origen: '' }]); markInteracted(); };
  const updatePart = (id: string, field: keyof Part, value: any) => { setArticulos(articulos.map(p => p.id === id ? { ...p, [field]: value } : p)); markInteracted(); };
  const removePart = (id: string) => { setArticulos(articulos.filter(p => p.id !== id)); markInteracted(); };

  const addBudget = () => { setBudgets([...budgets, '']); markInteracted(); };
  const updateBudget = (idx: number, val: string) => { const u = [...budgets]; u[idx] = val.substring(0, 15); setBudgets(u); markInteracted(); };
  const removeBudget = (idx: number) => { budgets.length > 1 ? setBudgets(budgets.filter((_, i) => i !== idx)) : setBudgets(['']); markInteracted(); };

  const openInReportesOT = (otNum?: string) => {
    const n = otNum || otNumber;
    if (!n) return;
    const url = `http://localhost:3000?reportId=${n}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  const handleCreateNewItem = async () => {
    if (!otNumber || !cliente) { alert('Error: No se puede crear item sin OT padre o cliente'); return; }
    if (!newItemData.tipoServicio.trim()) { alert('El tipo de servicio es obligatorio'); return; }
    try {
      const nextNum = await ordenesTrabajoService.getNextItemNumber(otNumber);
      const itemData: any = {
        otNumber: nextNum, status: 'BORRADOR' as const, budgets: [],
        tipoServicio: newItemData.tipoServicio,
        esFacturable: newItemData.necesitaPresupuesto,
        tieneContrato: newItemData.tieneContrato || (cliente as any).tipoServicio === 'contrato',
        esGarantia: false, razonSocial, contacto, direccion, localidad, provincia,
        sistema: sistemaNombre, moduloModelo: moduloModelo || '', moduloDescripcion: moduloDescripcion || '',
        moduloSerie: moduloSerie || '', codigoInternoCliente,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: newItemData.descripcion || '', accionesTomar: '', articulos: [],
        emailPrincipal: emailPrincipal || '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: aclaracionCliente || '',
        materialesParaServicio: materialesParaServicio || '',
        problemaFallaInicial: problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
        clienteId: cleanValue(clienteId), sistemaId: cleanValue(sistemaId), moduloId: cleanValue(moduloId),
      };
      await ordenesTrabajoService.create(itemData);
      alert(`Item ${nextNum} creado exitosamente`);
      setShowNewItemModal(false);
      setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
      await loadData();
    } catch { alert('Error al crear el item'); }
  };

  // Generic field change handler for subcomponents
  const handleFieldChange = (field: string, value: string) => {
    markInteracted();
    const setters: Record<string, (v: any) => void> = {
      emailPrincipal: setEmailPrincipal, direccion: setDireccion,
      localidad: setLocalidad, provincia: setProvincia,
      codigoInternoCliente: setCodigoInternoCliente,
      moduloModelo: setModuloModelo, moduloDescripcion: setModuloDescripcion,
      moduloSerie: setModuloSerie, tipoServicio: setTipoServicio,
      fechaInicio: setFechaInicio, fechaFin: setFechaFin,
      horasTrabajadas: setHorasTrabajadas, tiempoViaje: setTiempoViaje,
      problemaFallaInicial: setProblemaFallaInicial, reporteTecnico: setReporteTecnico,
      materialesParaServicio: setMaterialesParaServicio, accionesTomar: setAccionesTomar,
    };
    setters[field]?.(value);
  };

  const handleCheckboxChange = (field: string, checked: boolean) => {
    markInteracted();
    if (field === 'esFacturable') setEsFacturable(checked);
    else if (field === 'tieneContrato') setTieneContrato(checked);
    else if (field === 'esGarantia') setEsGarantia(checked);
  };

  const handleClienteChange = (id: string) => {
    const c = clientes.find(cl => cl.id === id);
    if (!c) return;
    setClienteId(id); setRazonSocial(c.razonSocial); setDireccion(c.direccion || '');
    setLocalidad(c.localidad || ''); setProvincia(c.provincia || '');
    setSistemaId(undefined); setModuloId(undefined);
    setSistemaNombre(''); setModuloModelo(''); setModuloDescripcion(''); setModuloSerie('');
    markInteracted();
  };

  const handleContactoChange = (id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (c) { setContacto(c.nombre); setEmailPrincipal(c.email || ''); markInteracted(); }
  };

  const handleSistemaChange = (id: string) => {
    const s = sistemasFiltrados.find(si => si.id === id);
    if (!s) return;
    setSistemaId(id); setSistemaNombre(s.nombre); setCodigoInternoCliente(s.codigoInternoCliente);
    setModuloId(undefined); markInteracted();
  };

  const handleModuloChange = (id: string) => {
    const m = modulosFiltrados.find(mo => mo.id === id);
    if (m) { setModuloId(id); setModuloModelo(m.nombre || ''); setModuloDescripcion(m.descripcion || ''); setModuloSerie(m.serie || ''); markInteracted(); }
  };

  const handleStatusChange = async (val: string) => {
    const newStatus = val as 'BORRADOR' | 'FINALIZADO';
    setStatus(newStatus);
    markInteracted();

    // Auto-update fichas when OT is finalized
    if (newStatus === 'FINALIZADO' && otNumber) {
      try {
        const fichas = await fichasService.getByOtNumber(otNumber);
        for (const ficha of fichas) {
          if (ficha.estado === 'entregado') continue;
          await fichasService.addHistorial(ficha.id, {
            fecha: new Date().toISOString(),
            estadoAnterior: ficha.estado,
            estadoNuevo: ficha.estado, // Keep same status, just add history entry
            nota: `OT ${otNumber} finalizada`,
            otNumber,
            reporteTecnico: reporteTecnico || null,
            creadoPor: 'admin',
          });
        }
      } catch (err) {
        console.error('Error actualizando fichas vinculadas:', err);
      }
    }
  };

  return {
    loading, saving, status, readOnly: status === 'FINALIZADO',
    // Handlers
    handleSave, handleDelete, openInReportesOT, handleFieldChange, handleCheckboxChange,
    handleClienteChange, handleContactoChange, handleSistemaChange, handleModuloChange,
    handleStatusChange,
    // Sidebar props
    clienteId, clientes, cliente, contacto, contactos,
    emailPrincipal, direccion, localidad, provincia,
    sistemaId, sistemasFiltrados, sistema, codigoInternoCliente,
    moduloId, modulosFiltrados, modulo, moduloModelo, moduloDescripcion, moduloSerie,
    tipoServicio, tiposServicio, fechaInicio, fechaFin,
    horasTrabajadas, tiempoViaje, esFacturable, tieneContrato, esGarantia,
    budgets, addBudget, updateBudget, removeBudget,
    // Protocol props
    problemaFallaInicial, reporteTecnico, materialesParaServicio, accionesTomar,
    // Items props
    articulos, addPart, updatePart, removePart,
    items, showNewItemModal, setShowNewItemModal,
    newItemData, setNewItemData, handleCreateNewItem,
  };
}
