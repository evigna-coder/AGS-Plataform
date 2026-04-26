import { useState, useEffect, useRef } from 'react';
import {
  ordenesTrabajoService, clientesService, establecimientosService, sistemasService,
  tiposServicioService, contactosService, modulosService, presupuestosService,
  contratosService,
} from '../services/firebaseService';
import { ingenierosService } from '../services/personalService';
import { pendientesService } from '../services/pendientesService';
import type { Cliente, Establecimiento, Sistema, TipoServicio, ContactoCliente, ModuloSistema, Ingeniero, WorkOrder, Presupuesto, Contrato } from '@ags/shared';

export interface CreateOTFormState {
  clienteId: string;
  establecimientoId: string;
  sistemaId: string;
  moduloId: string;
  tipoServicioId: string;
  contactoId: string;
  ingenieroId: string;
  presupuestoId: string;
  presupuestoNumero: string;
  ordenCompra: string;
  fechaServicioAprox: string;
  problemaFallaInicial: string;
  contratoId: string;
  comentarioFacturacion: string;
  materialesParaServicio: string;
  leadId: string;
}

const INITIAL_FORM: CreateOTFormState = {
  clienteId: '', establecimientoId: '', sistemaId: '', moduloId: '',
  tipoServicioId: '', contactoId: '', ingenieroId: '',
  presupuestoId: '', presupuestoNumero: '', ordenCompra: '', fechaServicioAprox: '',
  problemaFallaInicial: '', contratoId: '', comentarioFacturacion: '',
  materialesParaServicio: '', leadId: '',
};

export interface OTPrefill {
  clienteId?: string;
  sistemaId?: string;
  moduloId?: string;
  contactoId?: string;
  presupuestoId?: string;
  presupuestoNumero?: string;
  ordenCompra?: string;
  leadId?: string;
}

export function useCreateOTForm(open: boolean, onClose: () => void, onCreated: () => void, prefill?: OTPrefill) {
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [establecimientosFiltrados, setEstablecimientosFiltrados] = useState<Establecimiento[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [presupuestosCliente, setPresupuestosCliente] = useState<Presupuesto[]>([]);
  const [contratosCliente, setContratosCliente] = useState<Contrato[]>([]);
  const [showCrearLead, setShowCrearLead] = useState(false);
  const [selectedPendienteIds, setSelectedPendienteIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<CreateOTFormState>(INITIAL_FORM);
  const [prefilled, setPrefilled] = useState(false);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const hasContrato = form.contratoId !== '';
  const presupuestoRequerido = !hasContrato;

  // Load catalogs
  useEffect(() => {
    if (!open) return;
    setLoadError('');
    const loadCatalogos = async () => {
      try {
        const [c, est, s, ts, ings] = await Promise.all([
          clientesService.getAll(true), establecimientosService.getAll(),
          sistemasService.getAll(), tiposServicioService.getAll(), ingenierosService.getAll(true),
        ]);
        setClientes(c); setEstablecimientos(est); setSistemas(s); setTiposServicio(ts);
        setIngenieros(ings);
      } catch (err) {
        console.error('Error cargando catálogos para OT:', err);
        setLoadError('Error al cargar datos. Verifique la conexión e intente nuevamente.');
      }
    };
    loadCatalogos();
  }, [open]);

  // Apply prefill after catalogs load
  useEffect(() => {
    if (!open || !prefill || prefilled || clientes.length === 0) return;
    setPrefilled(true);
    const updates: Partial<CreateOTFormState> = {};
    if (prefill.clienteId) updates.clienteId = prefill.clienteId;
    if (prefill.sistemaId) updates.sistemaId = prefill.sistemaId;
    if (prefill.moduloId) updates.moduloId = prefill.moduloId;
    if (prefill.contactoId) updates.contactoId = prefill.contactoId;
    if (prefill.presupuestoId) updates.presupuestoId = prefill.presupuestoId;
    if (prefill.presupuestoNumero) updates.presupuestoNumero = prefill.presupuestoNumero;
    if (prefill.ordenCompra) updates.ordenCompra = prefill.ordenCompra;
    if (prefill.leadId) updates.leadId = prefill.leadId;
    setForm(prev => ({ ...prev, ...updates }));
  }, [open, prefill, prefilled, clientes]);

  // Track which clienteId the cascade last ran for, to avoid resetting on
  // establecimientos reload for the SAME client
  const lastCascadeClientId = useRef('');

  // Cascade: client -> establecimientos + contactos + presupuestos + contratos
  useEffect(() => {
    if (form.clienteId) {
      setEstablecimientosFiltrados(establecimientos.filter(e => e.clienteCuit === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(c => { console.log('[OT] contactos cargados:', c.length); setContactos(c); }).catch(err => { console.error('[OT] Error contactos:', err); setContactos([]); });
      presupuestosService.getAll({ clienteId: form.clienteId }).then(pres => {
        setPresupuestosCliente(pres.filter(p => p.estado !== 'anulado'));
      }).catch(() => setPresupuestosCliente([]));
      contratosService.getActiveForCliente(form.clienteId).then(setContratosCliente).catch(() => setContratosCliente([]));
    } else {
      setEstablecimientosFiltrados([]); setContactos([]); setPresupuestosCliente([]);
      setContratosCliente([]);
    }
    // Only reset dependent fields when the CLIENT actually changed, not when
    // establecimientos reloaded for the same client
    if (lastCascadeClientId.current && lastCascadeClientId.current !== form.clienteId) {
      set('establecimientoId', ''); set('sistemaId', ''); set('moduloId', '');
      set('contactoId', ''); set('presupuestoId', ''); set('presupuestoNumero', '');
      set('ordenCompra', ''); set('contratoId', '');
    }
    lastCascadeClientId.current = form.clienteId;
  }, [form.clienteId, establecimientos]);

  // Cascade: establecimiento -> sistemas
  const lastCascadeEstId = useRef('');
  useEffect(() => {
    if (form.establecimientoId) {
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId === form.establecimientoId));
    } else if (form.clienteId) {
      const estIds = new Set(establecimientosFiltrados.map(e => e.id));
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId && estIds.has(s.establecimientoId)));
    } else {
      setSistemasFiltrados([]);
    }
    if (lastCascadeEstId.current && lastCascadeEstId.current !== form.establecimientoId) {
      set('sistemaId', ''); set('moduloId', '');
    }
    lastCascadeEstId.current = form.establecimientoId;
  }, [form.establecimientoId, form.clienteId, sistemas, establecimientosFiltrados]);

  // Cascade: sistema -> modulos
  const lastCascadeSisId = useRef('');
  useEffect(() => {
    if (form.sistemaId) {
      modulosService.getBySistema(form.sistemaId).then(setModulos).catch(() => setModulos([]));
    } else { setModulos([]); }
    if (lastCascadeSisId.current && lastCascadeSisId.current !== form.sistemaId) {
      set('moduloId', '');
    }
    lastCascadeSisId.current = form.sistemaId;
  }, [form.sistemaId]);

  const handlePresupuestoChange = (presupuestoId: string) => {
    set('presupuestoId', presupuestoId);
    const pres = presupuestosCliente.find(p => p.id === presupuestoId);
    if (pres) {
      set('presupuestoNumero', pres.numero);
      if (pres.ordenesCompraIds?.length > 0) set('ordenCompra', pres.ordenesCompraIds[0]);
    } else {
      set('presupuestoNumero', '');
    }
  };

  const handleClose = () => {
    onClose();
    setForm(INITIAL_FORM);
    setModulos([]); setContactos([]); setPresupuestosCliente([]);
    setContratosCliente([]); setLoadError('');
  };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.tipoServicioId) { alert('Seleccione un tipo de servicio'); return; }
    if (presupuestoRequerido && !form.presupuestoId) {
      alert('Debe seleccionar un presupuesto (cliente sin contrato activo)');
      return;
    }

    // Contract validation
    if (form.contratoId) {
      const tipoServ = tiposServicio.find(t => t.id === form.tipoServicioId);
      const validation = await contratosService.validateOTCreation(form.contratoId, tipoServ?.nombre);
      if (!validation.allowed) {
        alert(`No se puede crear OT: ${validation.reason}`);
        return;
      }
    }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const establecimiento = establecimientosFiltrados.find(e => e.id === form.establecimientoId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const tipoServ = tiposServicio.find(t => t.id === form.tipoServicioId);
    const contacto = contactos.find(c => c.id === form.contactoId);
    const ingeniero = ingenieros.find(u => (u.usuarioId || u.id) === form.ingenieroId);

    if (!cliente || !tipoServ) { alert('Datos incompletos'); return; }

    setSaving(true);
    try {
      const otNum = await ordenesTrabajoService.getNextOtNumber();
      const otData = {
        otNumber: otNum,
        status: 'BORRADOR' as const,
        estadoAdmin: (ingeniero ? 'ASIGNADA' : 'CREADA') as 'ASIGNADA' | 'CREADA',
        estadoAdminFecha: new Date().toISOString(),
        estadoHistorial: [
          { estado: 'CREADA' as const, fecha: new Date().toISOString() },
          ...(ingeniero ? [{ estado: 'ASIGNADA' as const, fecha: new Date().toISOString() }] : []),
        ] as WorkOrder['estadoHistorial'],
        budgets: form.presupuestoNumero ? [form.presupuestoNumero] : [],
        ordenCompra: form.ordenCompra || '',
        tipoServicio: tipoServ.nombre,
        esFacturable: true,
        tieneContrato: hasContrato,
        esGarantia: false,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? '',
        direccion: establecimiento?.direccion ?? '',
        localidad: establecimiento?.localidad ?? '',
        provincia: establecimiento?.provincia ?? '',
        establecimientoId: form.establecimientoId || undefined,
        sistema: sistema?.nombre ?? '',
        moduloModelo: modulo?.nombre ?? '',
        moduloDescripcion: modulo?.descripcion ?? '',
        moduloSerie: modulo?.serie ?? '',
        codigoInternoCliente: sistema?.codigoInternoCliente ?? '',
        fechaInicio: '', fechaFin: '',
        fechaServicioAprox: form.fechaServicioAprox || '',
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: '', accionesTomar: '', articulos: [],
        emailPrincipal: contacto?.email ?? '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId,
        sistemaId: form.sistemaId || undefined,
        moduloId: form.moduloId || undefined,
        ingenieroAsignadoId: ingeniero?.usuarioId ?? ingeniero?.id ?? null,
        ingenieroAsignadoNombre: ingeniero?.nombre ?? null,
        problemaFallaInicial: form.problemaFallaInicial || '',
        contratoId: form.contratoId || null,
        comentarioFacturacion: form.comentarioFacturacion || null,
        materialesParaServicio: form.materialesParaServicio || '',
        leadId: form.leadId || undefined,
        // Bidirectional link to presupuesto origen (audit/traceability)
        presupuestoOrigenId: form.presupuestoId || null,
      };
      await ordenesTrabajoService.create(otData);
      // El parent auto-crea el child .01 copiando su data. Override solo las
      // fechas — el parent queda con fechas vacías (es contenedor), el child
      // arranca con fechas de hoy. Antes era un segundo create() que pisaba
      // todo y desincronizaba el counter.
      const today = new Date().toISOString().split('T')[0];
      await ordenesTrabajoService.update(`${otNum}.01`, {
        fechaInicio: today,
        fechaFin: today,
      });

      // Increment contract visits
      if (form.contratoId) {
        await contratosService.incrementVisitas(form.contratoId).catch(err =>
          console.error('Error incrementando visitas contrato:', err)
        );
      }

      // Link presupuesto and set en_ejecucion. Append to otsVinculadasNumbers
      // (contrato presupuestos can spawn many OTs) while keeping the singular
      // otVinculadaNumber field reflecting the most recent one for compat.
      if (form.presupuestoId) {
        try {
          const presActual = await presupuestosService.getById(form.presupuestoId);
          const prev = presActual?.otsVinculadasNumbers ?? [];
          const nextList = prev.includes(otNum) ? prev : [...prev, otNum];
          await presupuestosService.update(form.presupuestoId, {
            otVinculadaNumber: otNum,
            otsVinculadasNumbers: nextList,
            estado: 'en_ejecucion',
          } as any);
        } catch (err) {
          console.error('Error vinculando presupuesto:', err);
        }
      }

      // Auto-complete pendientes marcadas
      if (selectedPendienteIds.size > 0) {
        const ids = Array.from(selectedPendienteIds);
        await Promise.all(
          ids.map(id =>
            pendientesService
              .completar(id, {
                resolucionDocType: 'ot',
                resolucionDocId: otNum,
                resolucionDocLabel: `OT-${otNum}`,
              })
              .catch(err => console.error(`Error completando pendiente ${id}:`, err)),
          ),
        );
      }

      handleClose();
      onCreated();
    } catch (err) {
      console.error('Error creando OT:', err);
      alert(err instanceof Error ? err.message : 'Error al crear la orden de trabajo');
    }
    finally { setSaving(false); }
  };

  return {
    saving, loadError, form, set, handleClose, handleSave, handlePresupuestoChange,
    clientes, establecimientosFiltrados, sistemasFiltrados, tiposServicio,
    contactos, modulos, ingenieros, presupuestosCliente,
    contratosCliente, hasContrato, presupuestoRequerido,
    showCrearLead, setShowCrearLead,
    selectedPendienteIds, setSelectedPendienteIds,
  };
}
