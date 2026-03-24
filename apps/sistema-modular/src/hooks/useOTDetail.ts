import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, modulosService, contactosService, fichasService, usuariosService } from '../services/firebaseService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ModuloSistema, Part, ContactoCliente, OTEstadoAdmin, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_ORDER } from '@ags/shared';
import { useOTFormState } from './useOTFormState';

export function useOTDetail(otNumber?: string) {
  const navigate = useNavigate();
  const { form, setField, setFields, markInteracted, hasUserInteracted, loadFromOT, buildSavePayload, validate } = useOTFormState();

  // Related entities
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [modulo, setModulo] = useState<ModuloSistema | null>(null);
  const [items, setItems] = useState<WorkOrder[]>([]);

  // Select lists
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [modulosFiltrados, setModulosFiltrados] = useState<ModuloSistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [ingenieros, setIngenieros] = useState<UsuarioAGS[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New item modal
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '',
  });

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => { if (otNumber) loadData(); }, [otNumber]);

  const loadData = async () => {
    if (!otNumber) return;
    try {
      setLoading(true);
      const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
      if (!ot) { alert('Orden de trabajo no encontrada'); navigate('/ordenes-trabajo'); return; }

      loadFromOT(ot);

      // Load related entities
      if (ot.clienteId) { setCliente(await clientesService.getById(ot.clienteId)); }
      if (ot.sistemaId) {
        const s = await sistemasService.getById(ot.sistemaId); setSistema(s);
        if (ot.moduloId && s) { try { setModulo(await modulosService.getById(ot.sistemaId, ot.moduloId)); } catch { /* optional */ } }
      }
      if (!otNumber.includes('.')) { setItems(await ordenesTrabajoService.getItemsByOtPadre(otNumber)); }

      // Load catalogs
      const [tiposData, clientesData, sistemasData, usersData] = await Promise.all([
        tiposServicioService.getAll(), clientesService.getAll(true),
        sistemasService.getAll(), usuariosService.getAll(),
      ]);
      setTiposServicio(tiposData); setClientes(clientesData); setSistemas(sistemasData);
      setIngenieros(usersData.filter(u => u.role === 'ingeniero_soporte' && u.status === 'activo'));

      // Cascade
      if (ot.clienteId) {
        setSistemasFiltrados(sistemasData.filter(s => s.clienteId === ot.clienteId));
        try { setContactos(await contactosService.getByCliente(ot.clienteId)); } catch { /* optional */ }
      }
      if (ot.sistemaId) {
        try { setModulosFiltrados(await modulosService.getBySistema(ot.sistemaId)); } catch { /* optional */ }
      }
    } catch { alert('Error al cargar la orden de trabajo'); } finally { setLoading(false); }
  };

  // ── Cascading selects ─────────────────────────────────────────
  useEffect(() => {
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
    } else { setSistemasFiltrados([]); setContactos([]); }
  }, [form.clienteId, sistemas]);

  useEffect(() => {
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulosFiltrados).catch(() => setModulosFiltrados([]));
    } else { setModulosFiltrados([]); }
  }, [form.sistemaId]);

  // ── Autosave ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasUserInteracted.current || !otNumber || loading) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => handleSave(), 1000);
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [form]);

  // ── Save / Delete ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!otNumber) return;
    try { setSaving(true); await ordenesTrabajoService.update(otNumber, buildSavePayload()); }
    catch { alert('Error al guardar los cambios'); }
    finally { setSaving(false); }
  }, [otNumber, buildSavePayload]);

  const handleDelete = useCallback(async () => {
    if (!otNumber || !window.confirm(`Eliminar OT ${otNumber}?`)) return;
    try { setSaving(true); await ordenesTrabajoService.delete(otNumber); alert('OT eliminada'); navigate('/ordenes-trabajo'); }
    catch { alert('Error al eliminar'); } finally { setSaving(false); }
  }, [otNumber, navigate]);

  // ── Field handlers ────────────────────────────────────────────
  const handleFieldChange = useCallback((field: string, value: string) => {
    markInteracted();
    setField(field as keyof typeof form, value as any);
  }, [markInteracted, setField]);

  const handleCheckboxChange = useCallback((field: string, checked: boolean) => {
    markInteracted();
    setField(field as keyof typeof form, checked as any);
  }, [markInteracted, setField]);

  const handleClienteChange = useCallback((id: string) => {
    const c = clientes.find(cl => cl.id === id);
    if (!c) return;
    setFields({
      clienteId: id, razonSocial: c.razonSocial,
      direccion: c.direccion || '', localidad: c.localidad || '', provincia: c.provincia || '',
      sistemaId: undefined, moduloId: undefined,
      sistemaNombre: '', moduloModelo: '', moduloDescripcion: '', moduloSerie: '',
    });
    markInteracted();
  }, [clientes, setFields, markInteracted]);

  const handleContactoChange = useCallback((id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (c) { setFields({ contacto: c.nombre, emailPrincipal: c.email || '' }); markInteracted(); }
  }, [contactos, setFields, markInteracted]);

  const handleSistemaChange = useCallback((id: string) => {
    const s = sistemasFiltrados.find(si => si.id === id);
    if (!s) return;
    setFields({ sistemaId: id, sistemaNombre: s.nombre, codigoInternoCliente: s.codigoInternoCliente, moduloId: undefined });
    markInteracted();
  }, [sistemasFiltrados, setFields, markInteracted]);

  const handleModuloChange = useCallback((id: string) => {
    const m = modulosFiltrados.find(mo => mo.id === id);
    if (m) { setFields({ moduloId: id, moduloModelo: m.nombre || '', moduloDescripcion: m.descripcion || '', moduloSerie: m.serie || '' }); markInteracted(); }
  }, [modulosFiltrados, setFields, markInteracted]);

  const handleIngenieroChange = useCallback((uid: string) => {
    const u = ingenieros.find(i => i.id === uid);
    setFields({ ingenieroAsignadoId: u?.id ?? null, ingenieroAsignadoNombre: u?.displayName ?? null });
    markInteracted();
  }, [ingenieros, setFields, markInteracted]);

  // ── Estado admin ──────────────────────────────────────────────
  const handleEstadoAdminChange = useCallback((nuevoEstado: OTEstadoAdmin) => {
    // Validate before allowing state transition (skip for going backwards)
    const currentIdx = OT_ESTADO_ORDER.indexOf(form.estadoAdmin);
    const targetIdx = OT_ESTADO_ORDER.indexOf(nuevoEstado);
    if (targetIdx > currentIdx) {
      const errors = validate(nuevoEstado);
      if (Object.keys(errors).length > 0) {
        alert('No se puede avanzar el estado:\n' + Object.values(errors).join('\n'));
        return;
      }
    }
    const ahora = new Date().toISOString();
    setFields({
      estadoAdmin: nuevoEstado, estadoAdminFecha: ahora,
      estadoHistorial: [...form.estadoHistorial, { estado: nuevoEstado, fecha: ahora }],
      ...(nuevoEstado === 'FINALIZADO' ? { status: 'FINALIZADO' as const } : {}),
    });
    markInteracted();
  }, [form.estadoAdmin, form.estadoHistorial, setFields, markInteracted, validate]);

  const handleStatusChange = useCallback(async (val: string) => {
    const newStatus = val as 'BORRADOR' | 'FINALIZADO';
    setField('status', newStatus);
    markInteracted();

    if (newStatus === 'FINALIZADO' && otNumber) {
      try {
        const fichas = await fichasService.getByOtNumber(otNumber);
        for (const ficha of fichas) {
          if (ficha.estado === 'entregado') continue;
          await fichasService.addHistorial(ficha.id, {
            fecha: new Date().toISOString(), estadoAnterior: ficha.estado, estadoNuevo: ficha.estado,
            nota: `OT ${otNumber} finalizada`, otNumber,
            reporteTecnico: form.reporteTecnico || null, creadoPor: 'admin',
          });
        }
      } catch (err) { console.error('Error actualizando fichas vinculadas:', err); }
    }
  }, [otNumber, form.reporteTecnico, setField, markInteracted]);

  // ── Cierre administrativo ─────────────────────────────────────
  const handleCierreChange = useCallback((field: string, value: any) => {
    setField('cierreAdmin', { ...form.cierreAdmin, [field]: value });
    markInteracted();
  }, [form.cierreAdmin, setField, markInteracted]);

  const handleConfirmarCierre = useCallback(async () => {
    if (!form.cierreAdmin.horasConfirmadas) { alert('Debe confirmar las horas trabajadas'); return; }
    if (!form.cierreAdmin.partesConfirmadas && form.articulos.length > 0) { alert('Debe confirmar los materiales/repuestos'); return; }
    if (!otNumber) return;

    const ahora = new Date().toISOString();
    try {
      await ordenesTrabajoService.enviarAvisoCierreAdmin(otNumber, {
        razonSocial: form.razonSocial, tipoServicio: form.tipoServicio,
        horasLab: form.horasTrabajadas, horasViaje: form.tiempoViaje,
        cierreAdmin: { ...form.cierreAdmin, fechaCierreAdmin: ahora },
        partesCount: form.articulos.length, ingenieroNombre: form.ingenieroAsignadoNombre,
      });
      setField('cierreAdmin', { ...form.cierreAdmin, avisoAdminEnviado: true, avisoAdminFecha: ahora, fechaCierreAdmin: ahora });
    } catch (err) {
      console.error('Error encolando aviso:', err);
      alert('Error al enviar aviso a administración. El cierre se realizará pero verifique el envío manualmente.');
      setField('cierreAdmin', { ...form.cierreAdmin, fechaCierreAdmin: ahora });
    }
    handleEstadoAdminChange('FINALIZADO');
  }, [form, otNumber, setField, handleEstadoAdminChange]);

  // ── Reabrir OT ──────────────────────────────────────────────
  const handleReabrirOT = useCallback(() => {
    if (!window.confirm('¿Reabrir esta OT? Volverá al estado Cierre Administrativo.')) return;
    const ahora = new Date().toISOString();
    setFields({
      estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
      estadoAdminFecha: ahora,
      status: 'BORRADOR' as const,
      estadoHistorial: [...form.estadoHistorial, { estado: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin, fecha: ahora, nota: 'Reabierta desde Finalizado' }],
      cierreAdmin: { ...form.cierreAdmin, avisoAdminEnviado: false, fechaCierreAdmin: undefined },
    });
    markInteracted();
  }, [form.estadoHistorial, form.cierreAdmin, setFields, markInteracted]);

  // ── Parts ─────────────────────────────────────────────────────
  const addPart = useCallback((prefill?: { codigo: string; descripcion: string }) => {
    setField('articulos', [...form.articulos, {
      id: `part-${Date.now()}`, codigo: prefill?.codigo || '', descripcion: prefill?.descripcion || '', cantidad: 1, origen: prefill ? 'stock' : '',
    }]);
    markInteracted();
  }, [form.articulos, setField, markInteracted]);

  const updatePart = useCallback((id: string, field: keyof Part, value: any) => {
    setField('articulos', form.articulos.map(p => p.id === id ? { ...p, [field]: value } : p));
    markInteracted();
  }, [form.articulos, setField, markInteracted]);

  const removePart = useCallback((id: string) => {
    setField('articulos', form.articulos.filter(p => p.id !== id));
    markInteracted();
  }, [form.articulos, setField, markInteracted]);

  // ── Budgets ───────────────────────────────────────────────────
  const addBudget = useCallback(() => { setField('budgets', [...form.budgets, '']); markInteracted(); }, [form.budgets, setField, markInteracted]);
  const updateBudget = useCallback((idx: number, val: string) => {
    const u = [...form.budgets]; u[idx] = val.substring(0, 15); setField('budgets', u); markInteracted();
  }, [form.budgets, setField, markInteracted]);
  const removeBudget = useCallback((idx: number) => {
    setField('budgets', form.budgets.length > 1 ? form.budgets.filter((_, i) => i !== idx) : ['']); markInteracted();
  }, [form.budgets, setField, markInteracted]);

  // ── External actions ──────────────────────────────────────────
  const openInReportesOT = useCallback((otNum?: string) => {
    const n = otNum || otNumber;
    if (!n) return;
    const url = `http://localhost:3000?reportId=${n}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  }, [otNumber]);

  const handleCreateNewItem = useCallback(async () => {
    if (!otNumber || !cliente) { alert('Error: No se puede crear item sin OT padre o cliente'); return; }
    if (!newItemData.tipoServicio.trim()) { alert('El tipo de servicio es obligatorio'); return; }
    try {
      const nextNum = await ordenesTrabajoService.getNextItemNumber(otNumber);
      await ordenesTrabajoService.create({
        otNumber: nextNum, status: 'BORRADOR', budgets: [],
        tipoServicio: newItemData.tipoServicio,
        esFacturable: newItemData.necesitaPresupuesto,
        tieneContrato: newItemData.tieneContrato || (cliente as any).tipoServicio === 'contrato',
        esGarantia: false, razonSocial: form.razonSocial, contacto: form.contacto,
        direccion: form.direccion, localidad: form.localidad, provincia: form.provincia,
        sistema: form.sistemaNombre, moduloModelo: form.moduloModelo,
        moduloDescripcion: form.moduloDescripcion, moduloSerie: form.moduloSerie,
        codigoInternoCliente: form.codigoInternoCliente,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: newItemData.descripcion || '', accionesTomar: '', articulos: [],
        emailPrincipal: form.emailPrincipal || '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: form.aclaracionCliente || '',
        materialesParaServicio: form.materialesParaServicio || '',
        problemaFallaInicial: form.problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId || null, sistemaId: form.sistemaId || null,
        moduloId: form.moduloId || null,
      } as any);
      alert(`Item ${nextNum} creado exitosamente`);
      setShowNewItemModal(false);
      setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' });
      await loadData();
    } catch { alert('Error al crear el item'); }
  }, [otNumber, cliente, newItemData, form]);

  // ── Computed ──────────────────────────────────────────────────
  const readOnly = form.estadoAdmin === 'FINALIZADO';
  const readOnlyTecnico = readOnly || form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || form.status === 'FINALIZADO';
  const enCierreAdmin = form.estadoAdmin === 'CIERRE_ADMINISTRATIVO';

  // ── Return (same API as before) ───────────────────────────────
  return {
    loading, saving, status: form.status,
    readOnly, readOnlyTecnico, enCierreAdmin,
    handleSave, handleDelete, openInReportesOT, handleFieldChange, handleCheckboxChange,
    handleClienteChange, handleContactoChange, handleSistemaChange, handleModuloChange,
    handleStatusChange, handleEstadoAdminChange, handleIngenieroChange,
    estadoAdmin: form.estadoAdmin, estadoAdminFecha: form.estadoAdminFecha,
    estadoHistorial: form.estadoHistorial, ordenCompra: form.ordenCompra,
    fechaServicioAprox: form.fechaServicioAprox,
    ingenieroAsignadoId: form.ingenieroAsignadoId, ingenieroAsignadoNombre: form.ingenieroAsignadoNombre,
    ingenieros,
    cierreAdmin: form.cierreAdmin, handleCierreChange, handleConfirmarCierre, handleReabrirOT,
    clienteId: form.clienteId, clientes, cliente,
    contacto: form.contacto, contactos,
    emailPrincipal: form.emailPrincipal, direccion: form.direccion,
    localidad: form.localidad, provincia: form.provincia,
    sistemaId: form.sistemaId, sistemasFiltrados, sistema,
    codigoInternoCliente: form.codigoInternoCliente,
    moduloId: form.moduloId, modulosFiltrados, modulo,
    moduloModelo: form.moduloModelo, moduloDescripcion: form.moduloDescripcion,
    moduloSerie: form.moduloSerie,
    tipoServicio: form.tipoServicio, tiposServicio,
    fechaInicio: form.fechaInicio, fechaFin: form.fechaFin,
    horasTrabajadas: form.horasTrabajadas, tiempoViaje: form.tiempoViaje,
    esFacturable: form.esFacturable, tieneContrato: form.tieneContrato, esGarantia: form.esGarantia,
    budgets: form.budgets, addBudget, updateBudget, removeBudget,
    problemaFallaInicial: form.problemaFallaInicial, reporteTecnico: form.reporteTecnico,
    materialesParaServicio: form.materialesParaServicio, accionesTomar: form.accionesTomar,
    articulos: form.articulos, addPart, updatePart, removePart,
    items, showNewItemModal, setShowNewItemModal,
    newItemData, setNewItemData, handleCreateNewItem,
    validate,
  };
}
