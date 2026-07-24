import { useState, useEffect, useRef } from 'react';
import {
  ordenesTrabajoService, clientesService, establecimientosService, sistemasService,
  tiposServicioService, contactosService, modulosService, presupuestosService,
  contratosService, leadsService,
} from '../services/firebaseService';
import { getResponsablesOT } from '../services/personalService';
import { pendientesService } from '../services/pendientesService';
import { deepCleanForFirestore } from '../services/firebase';
import type { Cliente, Establecimiento, Sistema, TipoServicio, ContactoCliente, ModuloSistema, Ingeniero, WorkOrder, Presupuesto, PresupuestoItem, Contrato, TipoOT, Loaner } from '@ags/shared';
import { establecimientoPerteneceACliente, establecimientoUnicoId } from '@ags/shared';

export interface CreateOTFormState {
  tipoOT: TipoOT;
  clienteId: string;
  establecimientoId: string;
  sistemaId: string;
  moduloId: string;
  tipoServicioId: string;
  contactoId: string;
  ingenieroId: string;
  presupuestoId: string;
  presupuestoNumero: string;
  /** Base de facturación cuando NO hay un presupuesto concreto seleccionado. */
  motivoFacturacion: '' | 'pendiente' | 'sin_cargo' | 'garantia';
  /** Detalle de qué presupuestar (solo aplica a 'pendiente'); se concatena al ticket. */
  detallePresupuestoPendiente: string;
  ordenCompra: string;
  fechaServicioAprox: string;
  problemaFallaInicial: string;
  contratoId: string;
  comentarioFacturacion: string;
  materialesParaServicio: string;
  leadId: string;
}

/** Nombre por defecto del tipo de servicio para OTs de entrega (UAT 2026-07-17). */
export const TIPO_SERVICIO_ENTREGA_DEFAULT = 'Entrega de insumos';
/** Sentinel para cuando el catálogo no tiene ningún tipo que matchee "entrega":
 *  la OT se guarda con el texto TIPO_SERVICIO_ENTREGA_DEFAULT. */
export const TIPO_SERVICIO_ENTREGA_SENTINEL = '__entrega_insumos__';

const INITIAL_FORM: CreateOTFormState = {
  tipoOT: 'servicio',
  clienteId: '', establecimientoId: '', sistemaId: '', moduloId: '',
  tipoServicioId: '', contactoId: '', ingenieroId: '',
  presupuestoId: '', presupuestoNumero: '', motivoFacturacion: '', detallePresupuestoPendiente: '', ordenCompra: '', fechaServicioAprox: '',
  problemaFallaInicial: '', contratoId: '', comentarioFacturacion: '',
  materialesParaServicio: '', leadId: '',
};

export interface OTPrefill {
  clienteId?: string;
  establecimientoId?: string;
  sistemaId?: string;
  moduloId?: string;
  contactoId?: string;
  presupuestoId?: string;
  presupuestoNumero?: string;
  ordenCompra?: string;
  leadId?: string;
  /** Precarga del tipo de servicio (ej. al convertir una previsión de agenda). */
  tipoServicioId?: string;
  /** Precarga del ingeniero asignado. */
  ingenieroId?: string;
  /** Precarga de la fecha de servicio ('YYYY-MM-DD'). */
  fechaServicioAprox?: string;
}

/** `onCreated` recibe el número de la OT creada (los callers que no lo necesitan lo ignoran). */
export function useCreateOTForm(open: boolean, onClose: () => void, onCreated: (otNumber?: string) => void, prefill?: OTPrefill) {
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

  // ── OT sobre módulo AGS (loaner) ──────────────────────────────────────────
  // Reemplaza el selector de equipo/sistema por la cascada categoría → loaner.
  // El cliente se autocompleta a AGS Analítica (editable) y sistemaId queda null.
  const [otSobreLoaner, setOtSobreLoanerState] = useState(false);
  const [loanerSeleccionado, setLoanerSeleccionado] = useState<Loaner | null>(null);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const setOtSobreLoaner = (v: boolean) => {
    setOtSobreLoanerState(v);
    if (!v) setLoanerSeleccionado(null);
  };

  const selectLoaner = (loaner: Loaner | null) => {
    setLoanerSeleccionado(loaner);
    if (loaner) {
      // Sin sistema del cliente; cliente auto = AGS Analítica si existe (editable).
      setForm(prev => {
        const ags = clientes.find(c => /ags\s*anal[ií]tica/i.test(c.razonSocial));
        return {
          ...prev,
          sistemaId: '', moduloId: '',
          ...(ags ? { clienteId: ags.id } : {}),
        };
      });
    }
  };

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
          sistemasService.getAll(), tiposServicioService.getAll(), getResponsablesOT(),
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
    if (prefill.establecimientoId) updates.establecimientoId = prefill.establecimientoId;
    if (prefill.sistemaId) updates.sistemaId = prefill.sistemaId;
    if (prefill.moduloId) updates.moduloId = prefill.moduloId;
    if (prefill.contactoId) updates.contactoId = prefill.contactoId;
    if (prefill.presupuestoId) updates.presupuestoId = prefill.presupuestoId;
    if (prefill.presupuestoNumero) updates.presupuestoNumero = prefill.presupuestoNumero;
    if (prefill.ordenCompra) updates.ordenCompra = prefill.ordenCompra;
    if (prefill.leadId) updates.leadId = prefill.leadId;
    if (prefill.tipoServicioId) updates.tipoServicioId = prefill.tipoServicioId;
    if (prefill.ingenieroId) updates.ingenieroId = prefill.ingenieroId;
    if (prefill.fechaServicioAprox) updates.fechaServicioAprox = prefill.fechaServicioAprox;
    setForm(prev => ({ ...prev, ...updates }));
  }, [open, prefill, prefilled, clientes]);

  // OT de entrega → precargar tipo de servicio "Entrega de insumos" (UAT 2026-07-17).
  // Guarda el valor que autopusimos NOSOTROS para poder limpiarlo al volver a
  // 'servicio' sin pisar una elección manual del usuario.
  const autoTipoServicioRef = useRef('');
  useEffect(() => {
    if (!open) return;
    if (form.tipoOT === 'entrega') {
      // Preferir el tipo "Entrega de insumos" exacto (decisión Esteban 17/7);
      // recién si no existe, cualquier tipo que contenga "entrega".
      const match = tiposServicio.find(t => t.nombre.toLowerCase().includes('entrega de insumos'))
        ?? tiposServicio.find(t => t.nombre.toLowerCase().includes('entrega'));
      const target = match ? match.id : TIPO_SERVICIO_ENTREGA_SENTINEL;
      // Solo precargar si está vacío o si el valor actual es el que autopusimos
      // (esto último cubre el upgrade sentinel → tipo real cuando carga el catálogo).
      if (!form.tipoServicioId || form.tipoServicioId === autoTipoServicioRef.current) {
        autoTipoServicioRef.current = target;
        if (form.tipoServicioId !== target) set('tipoServicioId', target);
      }
    } else {
      // Volvió a 'servicio': limpiar el default solo si era el autopuesto.
      if (autoTipoServicioRef.current && form.tipoServicioId === autoTipoServicioRef.current) {
        set('tipoServicioId', '');
      }
      autoTipoServicioRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tipoOT, tiposServicio]);

  // Track which clienteId the cascade last ran for, to avoid resetting on
  // establecimientos reload for the SAME client
  const lastCascadeClientId = useRef('');

  // Cascade: client -> establecimientos + contactos + presupuestos + contratos
  useEffect(() => {
    if (form.clienteId) {
      const filtrados = establecimientos.filter(e => establecimientoPerteneceACliente(e, form.clienteId));
      setEstablecimientosFiltrados(filtrados);
      contactosService.getByCliente(form.clienteId).then(c => { console.log('[OT] contactos cargados:', c.length); setContactos(c); }).catch(err => { console.error('[OT] Error contactos:', err); setContactos([]); });
      presupuestosService.getAll({ clienteId: form.clienteId }).then(pres => {
        setPresupuestosCliente(pres.filter(p => p.estado !== 'anulado'));
      }).catch(() => setPresupuestosCliente([]));
      contratosService.getActiveForCliente(form.clienteId).then(setContratosCliente).catch(() => setContratosCliente([]));

      // Regla del proyecto: cliente con un único establecimiento → autoseleccionarlo.
      const unico = establecimientoUnicoId(filtrados);
      const clienteChanged = lastCascadeClientId.current && lastCascadeClientId.current !== form.clienteId;
      if (clienteChanged) {
        // El reset deja establecimientoId en el único (o '' si hay varios).
        set('establecimientoId', unico); set('sistemaId', ''); set('moduloId', '');
        set('contactoId', ''); set('presupuestoId', ''); set('presupuestoNumero', '');
        set('ordenCompra', ''); set('contratoId', '');
      } else if (unico && !form.establecimientoId) {
        // Primera selección de cliente (o recarga): precargar el único establecimiento
        // si todavía no hay uno elegido (no pisa un prefill).
        set('establecimientoId', unico);
      }
    } else {
      setEstablecimientosFiltrados([]); setContactos([]); setPresupuestosCliente([]);
      setContratosCliente([]);
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

  /**
   * Selección del campo "Presupuesto" de la OT. Acepta el id de un presupuesto concreto,
   * '' (sin presupuesto) o un sentinel de base de facturación (__pendiente__ / __sin_cargo__
   * / __garantia__). Los sentinels limpian el presupuesto concreto y setean motivoFacturacion.
   */
  const handlePresupuestoBaseChange = (v: string) => {
    if (v === '__pendiente__' || v === '__sin_cargo__' || v === '__garantia__') {
      const motivo = v.slice(2, -2) as 'pendiente' | 'sin_cargo' | 'garantia';
      setForm(prev => ({
        ...prev, motivoFacturacion: motivo, presupuestoId: '', presupuestoNumero: '', ordenCompra: '',
        detallePresupuestoPendiente: motivo === 'pendiente' ? prev.detallePresupuestoPendiente : '',
      }));
    } else {
      setForm(prev => ({ ...prev, motivoFacturacion: '', detallePresupuestoPendiente: '' }));
      handlePresupuestoChange(v);
    }
  };

  const handleClose = () => {
    onClose();
    setForm(INITIAL_FORM);
    setModulos([]); setContactos([]); setPresupuestosCliente([]);
    setContratosCliente([]); setLoadError('');
    setOtSobreLoanerState(false); setLoanerSeleccionado(null);
  };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.tipoServicioId) { alert('Seleccione un tipo de servicio'); return; }
    if (presupuestoRequerido && !form.presupuestoId && !form.motivoFacturacion) {
      alert('Debe seleccionar un presupuesto, o indicar la base de facturación (presupuesto pendiente, sin cargo o en garantía)');
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
    // Buscar primero en filtered list; fallback a global porque sistemas legacy
    // (con clienteId directo, sin establecimientoId) son excluidos por el cascade
    // pero el sistemaId persistido en el form sigue siendo válido.
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId)
      ?? sistemas.find(s => s.id === form.sistemaId);
    const modulo = modulos.find(m => m.id === form.moduloId);
    const tipoServ = tiposServicio.find(t => t.id === form.tipoServicioId);
    // Sentinel de entrega: el catálogo no tiene un tipo "entrega", se guarda el texto default.
    const tipoServicioNombre = tipoServ?.nombre
      ?? (form.tipoServicioId === TIPO_SERVICIO_ENTREGA_SENTINEL ? TIPO_SERVICIO_ENTREGA_DEFAULT : '');
    const contacto = contactos.find(c => c.id === form.contactoId);
    const ingeniero = ingenieros.find(u => (u.usuarioId || u.id) === form.ingenieroId);

    if (!cliente || !tipoServicioNombre) { alert('Datos incompletos'); return; }
    // OT sobre módulo AGS: requiere loaner elegido en lugar de sistema.
    if (otSobreLoaner && !loanerSeleccionado) {
      alert('Seleccione el módulo AGS (loaner) para la OT');
      return;
    }
    // En OT de entrega el equipo es opcional. En OT sobre loaner el equipo se
    // reemplaza por el módulo AGS. En OT de servicio sigue siendo obligatorio.
    if (form.tipoOT !== 'entrega' && !loanerSeleccionado) {
      if (!form.sistemaId) { alert('Seleccione un equipo'); return; }
      if (!sistema) {
        alert('El equipo seleccionado no se encontró en el catálogo. Recargá la página y volvé a seleccionarlo.');
        return;
      }
    }

    setSaving(true);
    try {
      const otNum = await ordenesTrabajoService.getNextOtNumber();
      const otData = {
        otNumber: otNum,
        tipoOT: form.tipoOT,
        status: 'BORRADOR' as const,
        estadoAdmin: (ingeniero ? 'ASIGNADA' : 'CREADA') as 'ASIGNADA' | 'CREADA',
        estadoAdminFecha: new Date().toISOString(),
        estadoHistorial: [
          { estado: 'CREADA' as const, fecha: new Date().toISOString() },
          ...(ingeniero ? [{ estado: 'ASIGNADA' as const, fecha: new Date().toISOString() }] : []),
        ] as WorkOrder['estadoHistorial'],
        budgets: form.presupuestoNumero ? [form.presupuestoNumero] : [],
        ordenCompra: form.ordenCompra || '',
        tipoServicio: tipoServicioNombre,
        // Base de facturación: sin cargo / garantía → la OT no va a facturación.
        esFacturable: !(form.motivoFacturacion === 'sin_cargo' || form.motivoFacturacion === 'garantia'),
        tieneContrato: hasContrato,
        esGarantia: form.motivoFacturacion === 'garantia',
        esSinCargo: form.motivoFacturacion === 'sin_cargo',
        presupuestoPendiente: form.motivoFacturacion === 'pendiente',
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? '',
        direccion: establecimiento?.direccion ?? '',
        localidad: establecimiento?.localidad ?? '',
        provincia: establecimiento?.provincia ?? '',
        establecimientoId: form.establecimientoId || undefined,
        // OT sobre loaner: sin sistema del cliente — los datos del módulo AGS
        // viajan en los campos de módulo para que el técnico los vea.
        sistema: loanerSeleccionado ? `Loaner ${loanerSeleccionado.codigo}` : (sistema?.nombre ?? ''),
        moduloModelo: loanerSeleccionado ? (loanerSeleccionado.moduloCodigo ?? '') : (modulo?.nombre ?? ''),
        moduloDescripcion: loanerSeleccionado
          ? (loanerSeleccionado.moduloDescripcion ?? loanerSeleccionado.descripcion ?? '')
          : (modulo?.descripcion ?? ''),
        moduloSerie: loanerSeleccionado ? (loanerSeleccionado.serie ?? '') : (modulo?.serie ?? ''),
        codigoInternoCliente: sistema?.codigoInternoCliente ?? '',
        loanerId: loanerSeleccionado?.id ?? null,
        loanerCodigo: loanerSeleccionado?.codigo ?? null,
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
          // Auto-vincular a esta OT los items que aún no tengan OT asignada, para
          // que aparezcan en /entregas. No se pisa un otNumeroVinculada ya seteado
          // (manual o por una OT previa) — un presupuesto puede partirse en N OTs.
          const itemsVinculados = (presActual?.items ?? []).map((it: PresupuestoItem) =>
            it.otNumeroVinculada ? it : { ...it, otNumeroVinculada: otNum },
          );
          // Solo avanzar a 'en_ejecucion' si el presupuesto YA fue enviado/aceptado.
          // Si todavía está en borrador (OT adelantada antes de mandarlo), NO se toca el
          // estado: queda como pendiente de envío y el recordatorio de abajo lo flaggea.
          // Pasar a en_ejecución sin haberlo enviado era incoherente.
          const estadoActual = presActual?.estado;
          const yaAvanzado = !!presActual?.fechaEnvio
            || estadoActual === 'enviado' || estadoActual === 'aceptado' || estadoActual === 'en_ejecucion';
          await presupuestosService.update(form.presupuestoId, deepCleanForFirestore({
            otVinculadaNumber: otNum,
            otsVinculadasNumbers: nextList,
            ...(yaAvanzado ? { estado: 'en_ejecucion' } : {}),
            items: itemsVinculados,
          }) as any);

          // Si el presupuesto se adelantó (OT creada antes de enviarlo), recordar enviarlo.
          // No-op si ya fue enviado. Best-effort.
          await presupuestosService.crearRecordatorioEnvio(form.presupuestoId).catch(err =>
            console.error('Error creando recordatorio de envío de presupuesto:', err),
          );

          // Flujo de tickets: si la OT cubre ítems que NO están en stock (a importar),
          // el ticket pasa de coordinación a "Compras" para disparar la compra de la parte.
          const tieneItemsAImportar = (presActual?.items ?? []).some((it: PresupuestoItem) =>
            it.disponibilidad === 'a_importar' || (it as { itemRequiereImportacion?: boolean }).itemRequiereImportacion,
          );
          const ticketId = form.leadId
            || (presActual?.origenTipo === 'lead' ? presActual?.origenId : null);
          if (tieneItemsAImportar && ticketId) {
            await leadsService.moverAArea(ticketId, 'compras').catch(err =>
              console.error('Error moviendo ticket a Compras:', err),
            );
          }
        } catch (err) {
          console.error('Error vinculando presupuesto:', err);
        }
      }

      // Base "presupuesto pendiente": OT creada sin presupuesto aún → ticket a Adm. Soporte
      // (Miguel Barrios) para que prepare y envíe el presupuesto. Best-effort.
      if (form.motivoFacturacion === 'pendiente') {
        await ordenesTrabajoService.crearTicketPresupuestoPendiente({
          otNumber: otNum,
          clienteId: form.clienteId,
          clienteNombre: cliente.razonSocial,
          detalle: form.detallePresupuestoPendiente.trim() || undefined,
        }).catch(err => console.error('Error creando ticket de presupuesto pendiente:', err));
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
      onCreated(otNum);
    } catch (err) {
      console.error('Error creando OT:', err);
      alert(err instanceof Error ? err.message : 'Error al crear la orden de trabajo');
    }
    finally { setSaving(false); }
  };

  return {
    saving, loadError, form, set, handleClose, handleSave, handlePresupuestoChange, handlePresupuestoBaseChange,
    clientes, establecimientosFiltrados, sistemasFiltrados, tiposServicio,
    contactos, modulos, ingenieros, presupuestosCliente,
    contratosCliente, hasContrato, presupuestoRequerido,
    showCrearLead, setShowCrearLead,
    selectedPendienteIds, setSelectedPendienteIds,
    otSobreLoaner, setOtSobreLoaner, loanerSeleccionado, selectLoaner,
  };
}
