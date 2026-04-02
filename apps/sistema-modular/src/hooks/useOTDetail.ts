import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, modulosService, contactosService, presupuestosService } from '../services/firebaseService';
import { ingenierosService } from '../services/personalService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ModuloSistema, ContactoCliente, Ingeniero } from '@ags/shared';
import { useOTFormState } from './useOTFormState';
import { useOTFieldHandlers } from './useOTFieldHandlers';
import { useOTActions } from './useOTActions';

export function useOTDetail(otNumber?: string) {
  const navigate = useNavigate();
  const { form, setField, setFields, markInteracted, hasUserInteracted, loadFromOT, buildSavePayload, validate } = useOTFormState();

  // Dirty flag: true while user has unsaved local edits — prevents remote snapshots from overwriting
  const dirtyRef = useRef(false);

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
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  const [presupuestoOrigenNumero, setPresupuestoOrigenNumero] = useState<string | null>(null);

  // ── Field handlers (extracted) ─────────────────────────────────
  const fields = useOTFieldHandlers({
    form, setField, setFields, markInteracted, validate, dirtyRef,
    clientes, contactos, sistemasFiltrados, modulosFiltrados, ingenieros,
  });

  // ── Actions (extracted) ────────────────────────────────────────
  const actions = useOTActions({ otNumber, form, cliente, setField, markInteracted, setItems });

  // ── Real-time OT subscription ──────────────────────────────────
  useEffect(() => {
    if (!otNumber) return;
    initialLoadDone.current = false;

    const unsub = ordenesTrabajoService.subscribeByOtNumber(otNumber, (ot) => {
      if (!ot) {
        if (initialLoadDone.current) return;
        alert('Orden de trabajo no encontrada');
        navigate('/ordenes-trabajo');
        return;
      }
      if (dirtyRef.current) return; // skip while user has unsaved edits
      loadFromOT(ot);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        loadRelatedData(ot);
      }
    }, (err) => {
      console.error('OT subscription error:', err);
      if (!initialLoadDone.current) { alert('Error al cargar la orden de trabajo'); setLoading(false); }
    });

    return () => unsub();
  }, [otNumber]);

  const loadRelatedData = useCallback(async (ot: WorkOrder) => {
    try {
      if (ot.clienteId) { const c = await clientesService.getById(ot.clienteId); setCliente(c); }
      if (ot.sistemaId) {
        const s = await sistemasService.getById(ot.sistemaId); setSistema(s);
        if (ot.moduloId && s) { try { const m = await modulosService.getById(ot.sistemaId, ot.moduloId); setModulo(m); } catch { /* optional */ } }
      }
      if (otNumber && !otNumber.includes('.')) { setItems(await ordenesTrabajoService.getItemsByOtPadre(otNumber)); }

      const [tiposData, clientesData, sistemasData, ingsData] = await Promise.all([
        tiposServicioService.getAll(), clientesService.getAll(true), sistemasService.getAll(), ingenierosService.getAll(true),
      ]);
      setTiposServicio(tiposData); setClientes(clientesData); setSistemas(sistemasData);
      setIngenieros(ingsData);

      if (ot.clienteId) {
        setSistemasFiltrados(sistemasData.filter(s => s.clienteId === ot.clienteId));
        try { setContactos(await contactosService.getByCliente(ot.clienteId)); } catch { /* optional */ }
      }
      if (ot.sistemaId) { try { setModulosFiltrados(await modulosService.getBySistema(ot.sistemaId)); } catch { /* optional */ } }
      if (ot.presupuestoOrigenId) { try { const p = await presupuestosService.getById(ot.presupuestoOrigenId); if (p) setPresupuestoOrigenNumero(p.numero); } catch { /* optional */ } }
    } catch { alert('Error al cargar datos relacionados'); } finally { setLoading(false); }
  }, [otNumber]);

  // ── Cascading selects ─────────────────────────────────────────
  useEffect(() => {
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
    } else { setSistemasFiltrados([]); setContactos([]); }
  }, [form.clienteId, sistemas]);

  useEffect(() => {
    if (form.sistemaId) { modulosService.getBySistema(form.sistemaId).then(setModulosFiltrados).catch(() => setModulosFiltrados([])); }
    else { setModulosFiltrados([]); }
  }, [form.sistemaId]);

  // ── Save / Delete ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!otNumber) return;
    try { setSaving(true); await ordenesTrabajoService.update(otNumber, buildSavePayload()); dirtyRef.current = false; }
    catch { alert('Error al guardar los cambios'); } finally { setSaving(false); }
  }, [otNumber, buildSavePayload]);

  useEffect(() => {
    if (!hasUserInteracted.current || !otNumber || loading) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => handleSave(), 1000);
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [form, handleSave]);

  const handleDelete = useCallback(async () => {
    if (!otNumber || !window.confirm(`Eliminar OT ${otNumber}?`)) return;
    try { setSaving(true); await ordenesTrabajoService.delete(otNumber); alert('OT eliminada'); navigate('/ordenes-trabajo'); }
    catch { alert('Error al eliminar'); } finally { setSaving(false); }
  }, [otNumber, navigate]);

  // ── Confirmar cierre (needs handleSave context + handleEstadoAdminChange) ──
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
      alert('Error al enviar aviso a administracion. El cierre se realizara pero verifique el envio manualmente.');
      setField('cierreAdmin', { ...form.cierreAdmin, fechaCierreAdmin: ahora });
    }
    fields.handleEstadoAdminChange('FINALIZADO');
  }, [form, otNumber, setField, fields.handleEstadoAdminChange]);

  // ── Computed ──────────────────────────────────────────────────
  const readOnly = form.estadoAdmin === 'FINALIZADO';
  const readOnlyTecnico = readOnly || form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || form.status === 'FINALIZADO';
  const enCierreAdmin = form.estadoAdmin === 'CIERRE_ADMINISTRATIVO';

  return {
    loading, saving, status: form.status, readOnly, readOnlyTecnico, enCierreAdmin,
    handleSave, handleDelete, handleConfirmarCierre,
    // Field handlers (spread from extracted hook)
    ...fields,
    // Actions (spread from extracted hook)
    openInReportesOT: actions.openInReportesOT, handleStatusChange: actions.handleStatusChange,
    showNewItemModal: actions.showNewItemModal, setShowNewItemModal: actions.setShowNewItemModal,
    newItemData: actions.newItemData, setNewItemData: actions.setNewItemData,
    handleCreateNewItem: actions.handleCreateNewItem,
    handleCreateLeadFromOT: actions.handleCreateLeadFromOT, creatingLead: actions.creatingLead,
    // Form data
    estadoAdmin: form.estadoAdmin, estadoAdminFecha: form.estadoAdminFecha,
    estadoHistorial: form.estadoHistorial, ordenCompra: form.ordenCompra,
    fechaServicioAprox: form.fechaServicioAprox,
    ingenieroAsignadoId: form.ingenieroAsignadoId, ingenieroAsignadoNombre: form.ingenieroAsignadoNombre,
    ingenieros,
    cierreAdmin: form.cierreAdmin,
    clienteId: form.clienteId, clientes, cliente,
    contacto: form.contacto, contactos, emailPrincipal: form.emailPrincipal,
    direccion: form.direccion, localidad: form.localidad, provincia: form.provincia,
    sistemaId: form.sistemaId, sistemasFiltrados, sistema, codigoInternoCliente: form.codigoInternoCliente,
    moduloId: form.moduloId, modulosFiltrados, modulo,
    moduloModelo: form.moduloModelo, moduloDescripcion: form.moduloDescripcion, moduloSerie: form.moduloSerie,
    tipoServicio: form.tipoServicio, tiposServicio,
    fechaInicio: form.fechaInicio, fechaFin: form.fechaFin,
    horasTrabajadas: form.horasTrabajadas, tiempoViaje: form.tiempoViaje,
    esFacturable: form.esFacturable, tieneContrato: form.tieneContrato, esGarantia: form.esGarantia,
    budgets: form.budgets, problemaFallaInicial: form.problemaFallaInicial,
    reporteTecnico: form.reporteTecnico, materialesParaServicio: form.materialesParaServicio,
    accionesTomar: form.accionesTomar, articulos: form.articulos, items,
    validate, leadId: form.leadId, presupuestoOrigenId: form.presupuestoOrigenId, presupuestoOrigenNumero,
  };
}
