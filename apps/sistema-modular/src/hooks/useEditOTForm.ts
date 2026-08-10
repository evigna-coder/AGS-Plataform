import { useState, useEffect, useCallback } from 'react';
import {
  ordenesTrabajoService, clientesService, sistemasService,
  tiposServicioService, contactosService, modulosService, presupuestosService,
} from '../services/firebaseService';
import { getResponsablesOT } from '../services/personalService';
import { deepCleanForFirestore } from '../services/firebase';
import type {
  WorkOrder, Cliente, Sistema, TipoServicio, ContactoCliente, ModuloSistema,
  Ingeniero, OTEstadoAdmin, CierreAdministrativo, Part, OTEstadoHistorial,
  PatronSeleccionado, Presupuesto,
} from '@ags/shared';

export interface EditOTFormState {
  clienteId: string;
  sistemaId: string;
  moduloId: string;
  tipoServicio: string;
  contactoId: string;
  ingenieroId: string;
  presupuestos: string[];
  ordenesCompra: string[];
  fechaServicioAprox: string;
  problemaFallaInicial: string;
  estadoAdmin: OTEstadoAdmin;
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  // Cierre administrativo
  cierreAdmin: CierreAdministrativo;
  articulos: Part[];
  horasTrabajadas: string;
  tiempoViaje: string;
  status: 'BORRADOR' | 'FINALIZADO';
  estadoHistorial: OTEstadoHistorial[];
  /**
   * Phase 14 BOM-05 — patronesSeleccionados leídos del reporte técnico via
   * ordenesTrabajoService.getPatronesSeleccionados. Solo se usan en read-mode
   * por CierrePatronesConsumidosSection — nunca se persisten desde acá
   * (el reporte técnico queda intocable).
   */
  patronesSeleccionados: PatronSeleccionado[];
}

const INITIAL_CIERRE: CierreAdministrativo = {
  horasConfirmadas: false,
  partesConfirmadas: false,
  stockDeducido: false,
  avisoAdminEnviado: false,
};

const INITIAL_FORM: EditOTFormState = {
  clienteId: '', sistemaId: '', moduloId: '', tipoServicio: '',
  contactoId: '', ingenieroId: '', presupuestos: [''], ordenesCompra: [''],
  fechaServicioAprox: '', problemaFallaInicial: '', estadoAdmin: 'CREADA',
  esFacturable: true, tieneContrato: false, esGarantia: false,
  cierreAdmin: INITIAL_CIERRE,
  articulos: [],
  horasTrabajadas: '',
  tiempoViaje: '',
  status: 'BORRADOR',
  estadoHistorial: [],
  patronesSeleccionados: [],
};

export function useEditOTForm(open: boolean, otNumber: string, onClose: () => void, onSaved: () => void) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [presupuestosCliente, setPresupuestosCliente] = useState<Presupuesto[]>([]);
  const [otOriginal, setOtOriginal] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<EditOTFormState>(INITIAL_FORM);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // Load OT + catalogs
  useEffect(() => {
    if (!open || !otNumber) return;
    setLoading(true);

    Promise.all([
      ordenesTrabajoService.getByOtNumber(otNumber),
      clientesService.getAll(true),
      sistemasService.getAll(),
      tiposServicioService.getAll(),
      getResponsablesOT(),
      // Phase 14 BOM-05 — best-effort read; empty array si no hay reporte/campo
      // (deja CierrePatronesConsumidosSection en estado "sin BOM en esta OT")
      ordenesTrabajoService.getPatronesSeleccionados(otNumber).catch(() => [] as PatronSeleccionado[]),
    ]).then(async ([ot, c, s, ts, ings, patronesSel]) => {
      if (!ot) { alert('OT no encontrada'); onClose(); return; }
      setOtOriginal(ot);
      setClientes(c);
      setSistemas(s);
      setTiposServicio(ts);
      setIngenieros(ings);

      if (ot.clienteId) {
        setSistemasFiltrados(s.filter(si => si.clienteId === ot.clienteId));
        try { setContactos(await contactosService.getByCliente(ot.clienteId)); } catch { setContactos([]); }
      }
      if (ot.sistemaId) {
        try { setModulos(await modulosService.getBySistema(ot.sistemaId)); } catch { setModulos([]); }
      }

      let contactoId = '';
      if (ot.clienteId && ot.contacto) {
        try {
          const cts = await contactosService.getByCliente(ot.clienteId);
          setContactos(cts);
          contactoId = cts.find(ct => ct.nombre === ot.contacto)?.id || '';
        } catch { /* ignore */ }
      }

      setForm({
        clienteId: ot.clienteId || '',
        sistemaId: ot.sistemaId || '',
        moduloId: ot.moduloId || '',
        tipoServicio: ot.tipoServicio || '',
        contactoId,
        ingenieroId: ot.ingenieroAsignadoId || '',
        presupuestos: ot.budgets && ot.budgets.length > 0 ? ot.budgets : [''],
        ordenesCompra: ot.ordenesCompra && ot.ordenesCompra.length > 0
          ? ot.ordenesCompra
          : (ot.ordenCompra ? [ot.ordenCompra] : ['']),
        fechaServicioAprox: ot.fechaServicioAprox || '',
        problemaFallaInicial: ot.problemaFallaInicial || '',
        estadoAdmin: ot.estadoAdmin || (ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'CREADA'),
        esFacturable: ot.esFacturable ?? true,
        tieneContrato: ot.tieneContrato ?? false,
        esGarantia: ot.esGarantia ?? false,
        cierreAdmin: ot.cierreAdmin || INITIAL_CIERRE,
        articulos: ot.articulos || [],
        horasTrabajadas: ot.horasTrabajadas || '',
        tiempoViaje: ot.tiempoViaje || '',
        status: (ot.status === 'FINALIZADO' ? 'FINALIZADO' : 'BORRADOR'),
        estadoHistorial: ot.estadoHistorial || [],
        patronesSeleccionados: patronesSel ?? [],
      });
      setLoading(false);
    }).catch(() => { alert('Error al cargar la OT'); onClose(); });
  }, [open, otNumber]);

  // Normalizar ingenieroId legacy (2026-07-31): OTs asignadas por agenda (o
  // pre-vinculación) guardan el DOC ID del catálogo, pero el select trabaja con
  // usuarioId||id — sin esto, el select mostraba "Sin asignar" en OTs asignadas.
  useEffect(() => {
    if (!open || !form.ingenieroId || ingenieros.length === 0) return;
    const yaCanonico = ingenieros.some(u => (u.usuarioId || u.id) === form.ingenieroId);
    if (yaCanonico) return;
    const porDocId = ingenieros.find(u => u.id === form.ingenieroId);
    if (porDocId) setForm(prev => ({ ...prev, ingenieroId: porDocId.usuarioId || porDocId.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingenieros, form.ingenieroId]);

  // Cascade: client -> sistemas + contactos
  useEffect(() => {
    if (!open || loading) return;
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
      presupuestosService.getAll({ clienteId: form.clienteId })
        .then(pres => setPresupuestosCliente(pres.filter(p => p.estado !== 'anulado')))
        .catch(() => setPresupuestosCliente([]));
    } else {
      setSistemasFiltrados([]);
      setContactos([]);
      setPresupuestosCliente([]);
    }
  }, [form.clienteId, sistemas, open, loading]);

  // Cascade: sistema -> modulos
  useEffect(() => {
    if (!open || loading) return;
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulos).catch(() => setModulos([]));
    } else {
      setModulos([]);
    }
  }, [form.sistemaId, open, loading]);

  const readOnly = form.estadoAdmin === 'FINALIZADO';

  // ── Cierre admin: field change (local state only, persisted by handleSave or handleConfirmarCierre) ──
  const handleCierreChange = (field: keyof CierreAdministrativo, value: any) => {
    setForm(prev => ({ ...prev, cierreAdmin: { ...prev.cierreAdmin, [field]: value } }));
  };

  // ── Transition to CIERRE_ADMINISTRATIVO (atomic tx via service delegation) ──
  const handleCierreAdminTransition = async () => {
    // Idempotency: already in cierre or finalizado — no-op.
    if (form.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || form.estadoAdmin === 'FINALIZADO') return;
    setSaving(true);
    try {
      // otService.update delegates to cerrarAdministrativamente when target is CIERRE_ADMINISTRATIVO
      // (commit 1fbecf8): crea solicitudFacturacion, mailQueue, admin ticket in one tx.
      await ordenesTrabajoService.update(otNumber, {
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
      });
      // Refetch to get server-written fields (estadoHistorial, cierreAdmin.avisoAdminEnviado, etc.)
      const updated = await ordenesTrabajoService.getByOtNumber(otNumber);
      if (updated) {
        setOtOriginal(updated);
        setForm(prev => ({
          ...prev,
          estadoAdmin: updated.estadoAdmin || 'CIERRE_ADMINISTRATIVO',
          cierreAdmin: updated.cierreAdmin || prev.cierreAdmin,
          estadoHistorial: updated.estadoHistorial || prev.estadoHistorial,
          status: updated.status === 'FINALIZADO' ? 'FINALIZADO' : prev.status,
        }));
      } else {
        // Optimistic update if fetch fails
        setForm(prev => ({ ...prev, estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin }));
      }
    } catch (err) {
      console.error('[useEditOTForm] handleCierreAdminTransition failed:', err);
      alert('Error al transicionar a cierre administrativo');
    } finally {
      setSaving(false);
    }
  };

  // ── Confirm cierre (FINALIZADO transition — mail+ticket admin already ran in CIERRE_ADMINISTRATIVO) ──
  const handleConfirmarCierre = async () => {
    if (!form.cierreAdmin.horasConfirmadas) { alert('Debe confirmar las horas trabajadas'); return; }
    if (!form.cierreAdmin.partesConfirmadas && form.articulos.length > 0) {
      alert('Debe confirmar los materiales/repuestos');
      return;
    }
    const ahora = new Date().toISOString();
    const cierreActualizado: CierreAdministrativo = { ...form.cierreAdmin, fechaCierreAdmin: ahora };
    const historialActualizado: OTEstadoHistorial[] = [
      ...form.estadoHistorial,
      { estado: 'FINALIZADO' as OTEstadoAdmin, fecha: ahora },
    ];
    setSaving(true);
    try {
      // 1. Persistir el cierre (con las selecciones de stock) para que la deducción las lea.
      await ordenesTrabajoService.update(otNumber, { cierreAdmin: cierreActualizado } as Partial<WorkOrder>);

      // 2. Ejecutar la deducción de stock ACÁ, con las selecciones ya cargadas. La deducción
      //    corría al ENTRAR a cierre admin (cuando la selección de origen todavía estaba vacía)
      //    y nunca procesaba lo que el admin elegía en el panel → stock sin descontar (bug
      //    2026-07-23). Es idempotente (guard stockDeducido) y no re-notifica (guard yaCerrada).
      let dedujoOk = true;
      try {
        await ordenesTrabajoService.cerrarAdministrativamente(otNumber, {});
      } catch (err) {
        dedujoOk = false;
        console.error('[useEditOTForm] deducción de stock al finalizar falló:', err);
      }

      // 3. Pasar a FINALIZADO. SIN `cierreAdmin` en el payload: cerrarAdministrativamente ya
      //    escribió stockDeducido/notasCierre y pisarlos revertiría la deducción.
      await ordenesTrabajoService.update(otNumber, {
        estadoAdmin: 'FINALIZADO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        status: 'FINALIZADO',
      } as Partial<WorkOrder>);

      // 4. Releer para reflejar el cierre deducido (stockDeducido, notasCierre) en la UI.
      const updated = await ordenesTrabajoService.getByOtNumber(otNumber);
      setForm(prev => ({
        ...prev,
        estadoAdmin: 'FINALIZADO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        cierreAdmin: updated?.cierreAdmin ?? cierreActualizado,
        status: 'FINALIZADO',
      }));
      if (!dedujoOk) {
        alert('La OT se finalizó, pero la deducción de stock falló. Revisá el stock del cierre y descontá a mano si hace falta.');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[useEditOTForm] handleConfirmarCierre failed:', err);
      alert('Error al confirmar cierre');
    } finally {
      setSaving(false);
    }
  };

  // ── Reabrir OT (FINALIZADO → CIERRE_ADMINISTRATIVO) ──
  const handleReabrirOT = async () => {
    if (form.estadoAdmin !== 'FINALIZADO') return;
    const ahora = new Date().toISOString();
    const historialActualizado: OTEstadoHistorial[] = [
      ...form.estadoHistorial,
      { estado: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin, fecha: ahora },
    ];
    setSaving(true);
    try {
      await ordenesTrabajoService.update(otNumber, {
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        status: 'BORRADOR',
      } as Partial<WorkOrder>);
      setForm(prev => ({
        ...prev,
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        status: 'BORRADOR',
      }));
    } catch (err) {
      console.error('[useEditOTForm] handleReabrirOT failed:', err);
      alert('Error al reabrir la OT');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.tipoServicio) { alert('Seleccione un tipo de servicio'); return; }
    if (form.estadoAdmin !== 'CREADA' && !form.ingenieroId) { alert('Seleccione un responsable (ingeniero o admin de soporte) para estado "Asignada" o superior'); return; }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const contacto = contactos.find(c => c.id === form.contactoId);
    // Matching robusto (2026-07-31): el select entrega usuarioId||id, y las OTs
    // guardadas pueden traer el uid (modal) O el doc id del catálogo (agenda /
    // pre-vinculación). Comparar solo u.id perdía el ingeniero al guardar
    // (ingenieroAsignadoId: null) apenas se vincularon los usuarioId.
    const ingeniero = ingenieros.find(u => (u.usuarioId || u.id) === form.ingenieroId)
      ?? ingenieros.find(u => u.id === form.ingenieroId);

    if (!cliente) { alert('Cliente no encontrado'); return; }

    let estadoHistorial = otOriginal?.estadoHistorial || [];
    let estadoAdminFecha = otOriginal?.estadoAdminFecha || '';
    let status: 'BORRADOR' | 'FINALIZADO' = form.status;

    // Ingeniero asignado con la OT en CREADA → auto-promover a ASIGNADA (UAT
    // 2026-07-31: asignar ingeniero/fecha en la edición dejaba la OT en CREADA;
    // solo el drag de agenda promovía el estado).
    let estadoAdminFinal = form.estadoAdmin;
    if (ingeniero && (estadoAdminFinal === 'CREADA' || !estadoAdminFinal)) estadoAdminFinal = 'ASIGNADA';

    if (estadoAdminFinal !== otOriginal?.estadoAdmin) {
      const ahora = new Date().toISOString();
      estadoHistorial = [...estadoHistorial, { estado: estadoAdminFinal, fecha: ahora }];
      estadoAdminFecha = ahora;
      if (estadoAdminFinal === 'FINALIZADO') status = 'FINALIZADO';
    }

    setSaving(true);
    try {
      await ordenesTrabajoService.update(otNumber, {
        tipoServicio: form.tipoServicio,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? otOriginal?.contacto ?? '',
        emailPrincipal: contacto?.email ?? otOriginal?.emailPrincipal ?? '',
        sistema: sistema?.nombre ?? '',
        moduloModelo: modulo?.nombre ?? otOriginal?.moduloModelo ?? '',
        moduloDescripcion: modulo?.descripcion ?? otOriginal?.moduloDescripcion ?? '',
        moduloSerie: modulo?.serie ?? otOriginal?.moduloSerie ?? '',
        codigoInternoCliente: sistema?.codigoInternoCliente ?? '',
        clienteId: form.clienteId,
        sistemaId: form.sistemaId || null,
        moduloId: form.moduloId || null,
        ingenieroAsignadoId: ingeniero?.usuarioId ?? ingeniero?.id ?? null,
        ingenieroAsignadoNombre: ingeniero?.nombre ?? null,
        budgets: form.presupuestos.filter(b => b.trim() !== ''),
        ordenesCompra: form.ordenesCompra.filter(o => o.trim() !== ''),
        // Legacy: mantener ordenCompra (string) = primera OC, para lectores existentes.
        ordenCompra: form.ordenesCompra.find(o => o.trim() !== '')?.trim() || null,
        fechaServicioAprox: form.fechaServicioAprox || null,
        problemaFallaInicial: form.problemaFallaInicial || '',
        estadoAdmin: estadoAdminFinal,
        estadoAdminFecha: estadoAdminFecha || null,
        estadoHistorial,
        esFacturable: form.esFacturable,
        tieneContrato: form.tieneContrato,
        esGarantia: form.esGarantia,
        status,
        // Include cierre fields so edits in OTCierreAdminSection are persisted
        cierreAdmin: form.cierreAdmin,
        horasTrabajadas: form.horasTrabajadas,
        tiempoViaje: form.tiempoViaje,
        articulos: form.articulos,
      } as Partial<WorkOrder>);

      // Vínculo INVERSO al presupuesto (2026-08-06). Asociar un ppto a una OT
      // editándola guardaba `budgets` en la OT pero no avisaba al presupuesto:
      // quedaba sin `otsVinculadasNumbers`, en estado 'aceptado' para siempre y
      // figurando "sin OT creada" en el dashboard (P1-005046-01). Mismo efecto
      // que crear la OT desde el presupuesto. Best-effort: no rompe el guardado.
      const budgetsFinal = form.presupuestos.filter(b => b.trim() !== '');
      for (const numero of budgetsFinal) {
        try {
          const pres = presupuestosCliente.find(p => p.numero === numero)
            ?? (await presupuestosService.getAll()).find(p => p.numero === numero);
          if (!pres) continue;
          const prev = pres.otsVinculadasNumbers ?? [];
          if (prev.includes(otNumber) && pres.otVinculadaNumber) continue; // ya vinculado
          const yaAvanzado = !!pres.fechaEnvio
            || ['enviado', 'aceptado', 'en_ejecucion'].includes(pres.estado);
          await presupuestosService.update(pres.id, deepCleanForFirestore({
            otVinculadaNumber: otNumber,
            otsVinculadasNumbers: prev.includes(otNumber) ? prev : [...prev, otNumber],
            ...(yaAvanzado && pres.estado !== 'en_ejecucion' && pres.estado !== 'pendiente_facturacion'
              && pres.estado !== 'finalizado' ? { estado: 'en_ejecucion' } : {}),
          }) as any);
        } catch (err) {
          console.error(`[useEditOTForm] vínculo inverso con ppto ${numero} falló:`, err);
        }
      }

      onSaved();
      onClose();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  /**
   * Selección de un presupuesto en la fila `idx`. Además de setear el número,
   * ARRASTRA la OC del cliente a la OT — igual que `useCreateOTForm` (2026-08-09).
   * Antes solo lo hacía el alta: al abrir un item y elegir un presupuesto
   * aprobado, la OC no venía y había que copiarla a mano.
   *
   * La OC del cliente vive en `ordenCompraNumero` (lo escribe el modal "Adjuntar
   * OC"); `ordenesCompraIds` son las OCs de compra, otra cosa.
   */
  const handlePresupuestoChange = useCallback((idx: number, numero: string) => {
    setForm(prev => {
      const presupuestos = [...prev.presupuestos];
      presupuestos[idx] = numero;
      const pres = presupuestosCliente.find(p => p.numero === numero);
      const ocCliente = pres
        ? ((pres as { ordenCompraNumero?: string | null }).ordenCompraNumero || pres.ordenesCompraIds?.[0])
        : null;
      // No pisar una OC ya cargada a mano: solo completa los slots vacíos.
      if (!ocCliente || prev.ordenesCompra.some(o => o.trim() === ocCliente)) {
        return { ...prev, presupuestos };
      }
      const ordenesCompra = [...prev.ordenesCompra];
      const libre = ordenesCompra.findIndex(o => o.trim() === '');
      if (libre >= 0) ordenesCompra[libre] = ocCliente;
      else ordenesCompra.push(ocCliente);
      return { ...prev, presupuestos, ordenesCompra };
    });
  }, [presupuestosCliente]);

  const openInReportesOT = () => {
    const url = `http://localhost:3000?reportId=${otNumber}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  return {
    loading, saving, form, set, readOnly,
    clientes, sistemasFiltrados, tiposServicio, contactos, modulos, ingenieros, presupuestosCliente,
    otOriginal, handleSave, openInReportesOT, handlePresupuestoChange,
    handleCierreChange, handleCierreAdminTransition, handleConfirmarCierre, handleReabrirOT,
  };
}
