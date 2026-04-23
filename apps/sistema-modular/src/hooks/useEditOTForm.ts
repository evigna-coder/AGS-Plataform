import { useState, useEffect } from 'react';
import {
  ordenesTrabajoService, clientesService, sistemasService,
  tiposServicioService, contactosService, modulosService,
} from '../services/firebaseService';
import { ingenierosService } from '../services/personalService';
import type {
  WorkOrder, Cliente, Sistema, TipoServicio, ContactoCliente, ModuloSistema,
  Ingeniero, OTEstadoAdmin, CierreAdministrativo, Part, OTEstadoHistorial,
} from '@ags/shared';

export interface EditOTFormState {
  clienteId: string;
  sistemaId: string;
  moduloId: string;
  tipoServicio: string;
  contactoId: string;
  ingenieroId: string;
  presupuestos: string[];
  ordenCompra: string;
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
}

const INITIAL_CIERRE: CierreAdministrativo = {
  horasConfirmadas: false,
  partesConfirmadas: false,
  stockDeducido: false,
  avisoAdminEnviado: false,
};

const INITIAL_FORM: EditOTFormState = {
  clienteId: '', sistemaId: '', moduloId: '', tipoServicio: '',
  contactoId: '', ingenieroId: '', presupuestos: [''], ordenCompra: '',
  fechaServicioAprox: '', problemaFallaInicial: '', estadoAdmin: 'CREADA',
  esFacturable: true, tieneContrato: false, esGarantia: false,
  cierreAdmin: INITIAL_CIERRE,
  articulos: [],
  horasTrabajadas: '',
  tiempoViaje: '',
  status: 'BORRADOR',
  estadoHistorial: [],
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
      ingenierosService.getAll(true),
    ]).then(async ([ot, c, s, ts, ings]) => {
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
        ordenCompra: ot.ordenCompra || '',
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
      });
      setLoading(false);
    }).catch(() => { alert('Error al cargar la OT'); onClose(); });
  }, [open, otNumber]);

  // Cascade: client -> sistemas + contactos
  useEffect(() => {
    if (!open || loading) return;
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
    } else {
      setSistemasFiltrados([]);
      setContactos([]);
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
      await ordenesTrabajoService.update(otNumber, {
        estadoAdmin: 'FINALIZADO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        cierreAdmin: cierreActualizado,
        status: 'FINALIZADO',
      } as Partial<WorkOrder>);
      setForm(prev => ({
        ...prev,
        estadoAdmin: 'FINALIZADO' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: historialActualizado,
        cierreAdmin: cierreActualizado,
        status: 'FINALIZADO',
      }));
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
    if (form.estadoAdmin !== 'CREADA' && !form.ingenieroId) { alert('Seleccione un ingeniero para estado "Asignada" o superior'); return; }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const contacto = contactos.find(c => c.id === form.contactoId);
    const ingeniero = ingenieros.find(u => u.id === form.ingenieroId);

    if (!cliente) { alert('Cliente no encontrado'); return; }

    let estadoHistorial = otOriginal?.estadoHistorial || [];
    let estadoAdminFecha = otOriginal?.estadoAdminFecha || '';
    let status: 'BORRADOR' | 'FINALIZADO' = form.status;

    if (form.estadoAdmin !== otOriginal?.estadoAdmin) {
      const ahora = new Date().toISOString();
      estadoHistorial = [...estadoHistorial, { estado: form.estadoAdmin, fecha: ahora }];
      estadoAdminFecha = ahora;
      if (form.estadoAdmin === 'FINALIZADO') status = 'FINALIZADO';
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
        ordenCompra: form.ordenCompra || null,
        fechaServicioAprox: form.fechaServicioAprox || null,
        problemaFallaInicial: form.problemaFallaInicial || '',
        estadoAdmin: form.estadoAdmin,
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
      onSaved();
      onClose();
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const openInReportesOT = () => {
    const url = `http://localhost:3000?reportId=${otNumber}`;
    if ((window as any).electronAPI?.openWindow) (window as any).electronAPI.openWindow(url);
    else if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  return {
    loading, saving, form, set, readOnly,
    clientes, sistemasFiltrados, tiposServicio, contactos, modulos, ingenieros,
    otOriginal, handleSave, openInReportesOT,
    handleCierreChange, handleCierreAdminTransition, handleConfirmarCierre, handleReabrirOT,
  };
}
