import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, modulosService, contactosService, presupuestosService } from '../services/firebaseService';
import { ingenierosService } from '../services/personalService';
import type { WorkOrder, Cliente, Sistema, TipoServicio, ModuloSistema, ContactoCliente, Ingeniero, OTEstadoAdmin } from '@ags/shared';
import { useOTFormState } from './useOTFormState';
import { useOTFieldHandlers } from './useOTFieldHandlers';
import { useOTActions } from './useOTActions';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

export function useOTDetail(otNumber?: string) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { firebaseUser, usuario } = useAuth();
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
    if (!otNumber || !await confirm(`Eliminar OT ${otNumber}?`)) return;
    try { setSaving(true); await ordenesTrabajoService.delete(otNumber); alert('OT eliminada'); navigate('/ordenes-trabajo'); }
    catch (err) { alert(err instanceof Error ? err.message : 'Error al eliminar'); } finally { setSaving(false); }
  }, [otNumber, navigate]);

  // ── FLOW-04: wrapper that intercepts CIERRE_ADMINISTRATIVO transitions ─
  // When the user moves to CIERRE_ADMINISTRATIVO, run the atomic
  // `cerrarAdministrativamente` (updates OT + creates ticket admin + mailQueue doc
  // in one runTransaction). For any other target estado, delegate to the default
  // handler from `useOTFieldHandlers`.
  //
  // If the tx fails, we register a pendingAction on each linked presupuesto so the
  // admin can retry from the dashboard.
  const handleEstadoAdminChange = useCallback(async (nuevoEstado: OTEstadoAdmin) => {
    if (!otNumber || nuevoEstado !== 'CIERRE_ADMINISTRATIVO') {
      // Non-cierre transitions fall through to the default path.
      fields.handleEstadoAdminChange(nuevoEstado);
      return;
    }
    // Idempotency — if ya está en CIERRE_ADMINISTRATIVO o FINALIZADO, no re-trigger.
    if (form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || form.estadoAdmin === 'FINALIZADO') {
      fields.handleEstadoAdminChange(nuevoEstado);
      return;
    }
    const ahora = new Date().toISOString();
    try {
      const { adminTicketId } = await ordenesTrabajoService.cerrarAdministrativamente(
        otNumber,
        { fechaCierre: ahora },
        { uid: firebaseUser?.uid || '', name: usuario?.displayName },
      );
      // Reflect the transition locally so UI updates without waiting for the subscribe.
      // The tx already wrote estadoAdmin + fechaCierre to Firestore; fields here keep form in sync.
      setFields({
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: [...form.estadoHistorial, { estado: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin, fecha: ahora }],
      });
      setField('cierreAdmin', { ...form.cierreAdmin, avisoAdminEnviado: true, avisoAdminFecha: ahora });
      console.log(`[useOTDetail] Cierre admin OK — ticket admin ${adminTicketId.slice(0, 6)}`);
    } catch (err: any) {
      console.error('[useOTDetail] cerrarAdministrativamente failed:', err);
      alert(`Error al cerrar administrativamente: ${err?.message || 'Error desconocido'}\nLa transición local se aplicará pero el mail y el ticket admin podrían no haberse creado — revise /admin/acciones-pendientes.`);
      // Best-effort: register pendingAction on each linked presupuesto so the admin can retry.
      const ot = await ordenesTrabajoService.getByOtNumber(otNumber).catch(() => null);
      const presupuestoNumeros = ot?.budgets || [];
      if (presupuestoNumeros.length > 0) {
        try {
          const allPres = await presupuestosService.getAll();
          const presupuestosVinculados = presupuestoNumeros
            .map((num: string) => allPres.find(p => p.numero === num))
            .filter((p): p is NonNullable<typeof p> => !!p);
          for (const pres of presupuestosVinculados) {
            await presupuestosService._appendPendingAction(pres.id, {
              type: 'enviar_mail_facturacion',
              reason: err?.message || 'cerrarAdministrativamente failed',
            }).catch(() => { /* swallow — already best-effort */ });
          }
        } catch (appendErr) {
          console.error('[useOTDetail] Failed to register pendingAction fallback:', appendErr);
        }
      }
      // Fall through to the default handler so the user still sees the estado advance.
      fields.handleEstadoAdminChange(nuevoEstado);
    }
  }, [otNumber, firebaseUser?.uid, usuario?.displayName, form.estadoAdmin, form.estadoHistorial, form.cierreAdmin, setField, setFields, fields.handleEstadoAdminChange]);

  // ── Confirmar cierre (FINALIZADO transition — mail+ticket admin ya corrieron en CIERRE_ADMINISTRATIVO) ──
  const handleConfirmarCierre = useCallback(async () => {
    if (!form.cierreAdmin.horasConfirmadas) { alert('Debe confirmar las horas trabajadas'); return; }
    if (!form.cierreAdmin.partesConfirmadas && form.articulos.length > 0) { alert('Debe confirmar los materiales/repuestos'); return; }
    if (!otNumber) return;
    const ahora = new Date().toISOString();
    setField('cierreAdmin', { ...form.cierreAdmin, fechaCierreAdmin: ahora });
    // El mail + ticket admin ya se encolaron/crearon en la transición a CIERRE_ADMINISTRATIVO (FLOW-04).
    // Este paso solo marca la OT como FINALIZADO.
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
    // Override: handleEstadoAdminChange intercepts CIERRE_ADMINISTRATIVO to run cerrarAdministrativamente atomically (FLOW-04).
    handleEstadoAdminChange,
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
