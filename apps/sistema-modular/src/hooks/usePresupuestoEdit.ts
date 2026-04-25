import { useState, useEffect, useCallback, useRef } from 'react';
import { presupuestosService, clientesService, sistemasService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService, usuariosService, contactosService, leadsService } from '../services/firebaseService';
import { modulosService } from '../services/equiposService';
import type { Presupuesto, Cliente, Sistema, Establecimiento, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, AdjuntoPresupuesto, UsuarioAGS, ContactoCliente, ContactoEstablecimiento, LeadEstado, PresupuestoSeccionesVisibles, VentasMetadata } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_DEFAULT } from '@ags/shared';

/** Mapping: when a presupuesto originates from a lead, sync lead estado on presupuesto state changes */
const PRESUPUESTO_TO_LEAD_ESTADO: Partial<Record<Presupuesto['estado'], LeadEstado>> = {
  borrador: 'presupuesto_pendiente',
  enviado: 'presupuesto_enviado',
  aceptado: 'en_coordinacion',
  finalizado: 'finalizado',
};

export interface PresupuestoFormState {
  numero: string;
  estado: Presupuesto['estado'];
  tipo: TipoPresupuesto;
  moneda: MonedaPresupuesto;
  origenTipo: string | null;
  origenId: string | null;
  origenRef: string | null;
  clienteId: string;
  establecimientoId: string | null;
  sistemaId: string | null;
  contactoId: string | null;
  items: PresupuestoItem[];
  tipoCambio: number | undefined;
  condicionPagoId: string | undefined;
  notasTecnicas: string;
  notasAdministrativas: string;
  garantia: string;
  variacionTipoCambio: string;
  condicionesComerciales: string;
  aceptacionPresupuesto: string;
  seccionesVisibles: PresupuestoSeccionesVisibles;
  validezDias: number;
  validUntil: string;
  fechaEnvio: string;
  adjuntos: AdjuntoPresupuesto[];
  proximoContacto: string;
  responsableId: string;
  responsableNombre: string;
  createdAt: string;
  // Revisiones
  version: number | undefined;
  presupuestoOrigenId: string | null;
  motivoAnulacion: string | null;
  anuladoPorId: string | null;
  // Cuotas
  cuotas: import('@ags/shared').PresupuestoCuota[] | null;
  cantidadCuotas: number | null;
  // OC
  ordenCompraNumero: string | null;
  // OT vinculadas (bidireccional)
  otVinculadaNumber: string | null;
  otsVinculadasNumbers: string[] | null;
  // Contrato
  contratoFechaInicio: string | null;
  contratoFechaFin: string | null;
  cantidadCuotasPorMoneda: Record<string, number> | null;
  // Ventas (Phase 10)
  ventasMetadata: VentasMetadata | null;
  // Facturación OT-céntrica (Tier-1)
  otsListasParaFacturar: string[] | undefined;
}

export interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

const INITIAL_FORM: PresupuestoFormState = {
  numero: '', estado: 'borrador', tipo: 'servicio', moneda: 'USD',
  origenTipo: null, origenId: null, origenRef: null,
  clienteId: '', establecimientoId: null, sistemaId: null, contactoId: null,
  items: [], tipoCambio: undefined, condicionPagoId: undefined,
  notasTecnicas: '', notasAdministrativas: '', garantia: '',
  variacionTipoCambio: '', condicionesComerciales: '', aceptacionPresupuesto: '',
  seccionesVisibles: { ...PRESUPUESTO_SECCIONES_DEFAULT },
  validezDias: 15, validUntil: '', fechaEnvio: '',
  adjuntos: [], proximoContacto: '', responsableId: '', responsableNombre: '',
  createdAt: '',
  version: undefined, presupuestoOrigenId: null, motivoAnulacion: null, anuladoPorId: null,
  cuotas: null, cantidadCuotas: null,
  ordenCompraNumero: null,
  otVinculadaNumber: null, otsVinculadasNumbers: null,
  contratoFechaInicio: null, contratoFechaFin: null, cantidadCuotasPorMoneda: null,
  ventasMetadata: null,
  otsListasParaFacturar: undefined,
};

/** Map a Presupuesto document snapshot to the local form state shape. */
function mapToFormState(p: Presupuesto): PresupuestoFormState {
  return {
    numero: p.numero, estado: p.estado,
    tipo: p.tipo || 'servicio', moneda: p.moneda || 'USD',
    origenTipo: p.origenTipo || null, origenId: p.origenId || null, origenRef: p.origenRef || null,
    clienteId: p.clienteId, establecimientoId: p.establecimientoId || null,
    sistemaId: p.sistemaId || null, contactoId: p.contactoId || null,
    items: p.items || [], tipoCambio: p.tipoCambio, condicionPagoId: p.condicionPagoId,
    notasTecnicas: p.notasTecnicas || '', notasAdministrativas: p.notasAdministrativas || '',
    garantia: p.garantia || '', variacionTipoCambio: p.variacionTipoCambio || '',
    condicionesComerciales: p.condicionesComerciales || '',
    aceptacionPresupuesto: p.aceptacionPresupuesto || '',
    seccionesVisibles: p.seccionesVisibles || { ...PRESUPUESTO_SECCIONES_DEFAULT },
    validezDias: p.validezDias ?? 15,
    validUntil: p.validUntil ? p.validUntil.split('T')[0] : '',
    fechaEnvio: p.fechaEnvio ? p.fechaEnvio.split('T')[0] : '',
    adjuntos: p.adjuntos || [], proximoContacto: p.proximoContacto || '',
    responsableId: p.responsableId || '', responsableNombre: p.responsableNombre || '',
    createdAt: p.createdAt || '', version: p.version,
    presupuestoOrigenId: p.presupuestoOrigenId || null,
    motivoAnulacion: p.motivoAnulacion || null, anuladoPorId: p.anuladoPorId || null,
    cuotas: p.cuotas || null, cantidadCuotas: p.cantidadCuotas || null,
    ordenCompraNumero: p.ordenCompraNumero || null,
    otVinculadaNumber: p.otVinculadaNumber || null,
    otsVinculadasNumbers: p.otsVinculadasNumbers || null,
    contratoFechaInicio: p.contratoFechaInicio ? p.contratoFechaInicio.split('T')[0] : null,
    contratoFechaFin: p.contratoFechaFin ? p.contratoFechaFin.split('T')[0] : null,
    cantidadCuotasPorMoneda: p.cantidadCuotasPorMoneda || null,
    ventasMetadata: p.ventasMetadata || null,
    otsListasParaFacturar: p.otsListasParaFacturar ?? undefined,
  };
}

export function usePresupuestoEdit(presupuestoId: string | null) {
  const [form, setFormState] = useState<PresupuestoFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Related data
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [establecimiento, setEstablecimiento] = useState<Establecimiento | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [contactos, setContactos] = useState<(ContactoCliente | ContactoEstablecimiento)[]>([]);
  const [categoriasPresupuesto, setCategoriasPresupuesto] = useState<CategoriaPresupuesto[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([]);
  const [conceptosServicio, setConceptosServicio] = useState<ConceptoServicio[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [clienteSistemas, setClienteSistemas] = useState<Sistema[]>([]);

  const dirty = useRef(false);
  const initialLoadDone = useRef(false);

  // Real-time subscription for presupuesto + one-shot reference data
  useEffect(() => {
    if (!presupuestoId) return;
    setLoading(true);
    initialLoadDone.current = false;

    // One-shot: load catalogs + usuarios
    const refDataPromise = Promise.all([
      categoriasPresupuestoService.getAll(),
      condicionesPagoService.getAll(),
      conceptosServicioService.getAll(),
      usuariosService.getAll(),
    ]).then(([cats, conds, concepts, usrs]) => {
      setCategoriasPresupuesto(cats);
      setCondicionesPago(conds);
      setConceptosServicio(concepts);
      setUsuarios(usrs);
    }).catch(err => console.error('Error cargando datos de referencia:', err));

    // Helper: load related entities (cliente, establecimiento, sistema) once
    const loadRelated = async (p: Presupuesto) => {
      if (p.clienteId) {
        const [c, ct, ss] = await Promise.all([
          clientesService.getById(p.clienteId),
          contactosService.getByCliente(p.clienteId).catch(() => []),
          sistemasService.getAll({ clienteId: p.clienteId }).catch(() => [] as Sistema[]),
        ]);
        setCliente(c); setContactos(ct); setClienteSistemas(ss);
      }
      if (p.establecimientoId) {
        try {
          const { establecimientosService } = await import('../services/firebaseService');
          setEstablecimiento(await establecimientosService.getById(p.establecimientoId));
        } catch { /* optional */ }
      }
      if (p.sistemaId && !p.sistemaId.startsWith('__')) {
        setSistema(await sistemasService.getById(p.sistemaId));
      }
    };

    // Real-time: subscribe to presupuesto document
    const unsub = presupuestosService.subscribeById(
      presupuestoId,
      async (presupuestoData) => {
        if (!presupuestoData) {
          // Document does not exist (invalid id or deleted mid-session).
          // Release the loading state so consumers can react.
          if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            setLoading(false);
          }
          return;
        }
        const isFirst = !initialLoadDone.current;
        // Skip snapshot when user has unsaved local edits (unless first load)
        if (!isFirst && dirty.current) return;

        setFormState(mapToFormState(presupuestoData));
        dirty.current = false;

        if (isFirst) {
          initialLoadDone.current = true;
          await Promise.all([refDataPromise, loadRelated(presupuestoData)]);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error en suscripcion de presupuesto:', err);
        setLoading(false);
      },
    );

    return () => { unsub(); };
  }, [presupuestoId]);

  // Manual reload (for consumers that call load() explicitly)
  const load = useCallback(async () => {
    if (!presupuestoId) return;
    dirty.current = false;
    initialLoadDone.current = false;
    // The subscription will fire again and repopulate form state
  }, [presupuestoId]);

  const setField = useCallback(<K extends keyof PresupuestoFormState>(field: K, value: PresupuestoFormState[K]) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  const calculateItemTaxes = useCallback((item: PresupuestoItem) => {
    const cat = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
    if (!cat) return { iva: 0, ganancias: 0, iibb: 0, totalImpuestos: 0 };
    const sub = item.subtotal || 0;
    let iva = 0, ganancias = 0, iibb = 0;
    if (cat.incluyeIva && cat.porcentajeIva) {
      iva = cat.ivaReduccion && cat.porcentajeIvaReduccion
        ? sub * (cat.porcentajeIvaReduccion / 100)
        : sub * (cat.porcentajeIva / 100);
    }
    if (cat.incluyeGanancias && cat.porcentajeGanancias) ganancias = (sub + iva) * (cat.porcentajeGanancias / 100);
    if (cat.incluyeIIBB && cat.porcentajeIIBB) iibb = (sub + iva) * (cat.porcentajeIIBB / 100);
    return { iva, ganancias, iibb, totalImpuestos: iva + ganancias + iibb };
  }, [categoriasPresupuesto]);

  const calculateTotals = useCallback((): PresupuestoTotals => {
    const subtotal = form.items.reduce((s, i) => s + (i.subtotal || 0), 0);
    let totalIva = 0, totalGanancias = 0, totalIIBB = 0;
    form.items.forEach(i => { const t = calculateItemTaxes(i); totalIva += t.iva; totalGanancias += t.ganancias; totalIIBB += t.iibb; });
    const totalImpuestos = totalIva + totalGanancias + totalIIBB;
    return { subtotal, iva: totalIva, ganancias: totalGanancias, iibb: totalIIBB, totalImpuestos, total: subtotal + totalImpuestos };
  }, [form.items, calculateItemTaxes]);

  const save = useCallback(async () => {
    if (!presupuestoId) return;
    try {
      setSaving(true);
      const totals = calculateTotals();
      let fechaEnvioToSave = form.fechaEnvio;
      if (form.estado === 'enviado' && !form.fechaEnvio) {
        fechaEnvioToSave = new Date().toISOString().split('T')[0];
        setFormState(prev => ({ ...prev, fechaEnvio: fechaEnvioToSave }));
      }
      // Reassign grupo numbers based on sistemaId before saving
      const sistemaIds = [...new Set(form.items.map(i => i.sistemaId).filter(Boolean))] as string[];
      const grupoMap = new Map(sistemaIds.map((id, idx) => [id, idx + 1]));
      const itemsWithGrupos = form.items.map(item => ({
        ...item,
        grupo: item.sistemaId ? grupoMap.get(item.sistemaId) || 0 : 0,
      }));

      await presupuestosService.update(presupuestoId, {
        estado: form.estado, tipo: form.tipo, moneda: form.moneda, items: itemsWithGrupos,
        subtotal: totals.subtotal, total: totals.total,
        tipoCambio: form.tipoCambio || undefined,
        condicionPagoId: form.condicionPagoId || undefined,
        notasTecnicas: form.notasTecnicas || null,
        notasAdministrativas: form.notasAdministrativas || null,
        garantia: form.garantia || null,
        variacionTipoCambio: form.variacionTipoCambio || null,
        condicionesComerciales: form.condicionesComerciales || null,
        aceptacionPresupuesto: form.aceptacionPresupuesto || null,
        seccionesVisibles: form.seccionesVisibles,
        validezDias: form.validezDias,
        validUntil: form.validUntil || undefined,
        fechaEnvio: fechaEnvioToSave || undefined,
        adjuntos: form.adjuntos,
        ordenCompraNumero: form.ordenCompraNumero,
        proximoContacto: form.proximoContacto || null,
        responsableId: form.responsableId || null,
        responsableNombre: form.responsableNombre || null,
        // Contrato (Fase 2 — new additive fields)
        contratoFechaInicio: form.contratoFechaInicio,
        contratoFechaFin: form.contratoFechaFin,
        cantidadCuotasPorMoneda: form.cantidadCuotasPorMoneda,
        // Ventas (Phase 10)
        ventasMetadata: form.ventasMetadata || null,
      });
      // Sync lead estado
      if (form.origenTipo === 'lead' && form.origenId) {
        const mappedLeadEstado = PRESUPUESTO_TO_LEAD_ESTADO[form.estado];
        if (mappedLeadEstado) {
          leadsService.update(form.origenId, { estado: mappedLeadEstado }).catch(err =>
            console.error('Error sincronizando estado del lead:', err)
          );
        }
      }
      dirty.current = false;
    } catch (error) {
      console.error('Error guardando presupuesto:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  }, [presupuestoId, form, calculateTotals]);

  const updateItem = useCallback((itemId: string, field: keyof PresupuestoItem, value: any) => {
    dirty.current = true;
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: value };
        if (field === 'cantidad' || field === 'precioUnitario' || field === 'descuento') {
          const base = updated.cantidad * updated.precioUnitario;
          updated.subtotal = updated.descuento ? base * (1 - updated.descuento / 100) : base;
        }
        return updated;
      }),
    }));
  }, []);

  const addItem = useCallback((item: PresupuestoItem) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, items: [...prev.items, item] }));
  }, []);

  /** Bulk-add items (used when adding an entire Sistema + plantilla in contrato mode). */
  const addItems = useCallback((newItems: PresupuestoItem[]) => {
    if (newItems.length === 0) return;
    dirty.current = true;
    setFormState(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
  }, []);

  /** Remove all items of a given sistema grupo (used to unlink a sistema from contrato). */
  const removeItemsByGrupo = useCallback((grupo: number) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, items: prev.items.filter(i => (i.grupo || 0) !== grupo) }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
  }, []);

  const addAdjunto = useCallback((adjunto: AdjuntoPresupuesto) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, adjuntos: [...prev.adjuntos, adjunto] }));
  }, []);

  const removeAdjunto = useCallback((adjId: string) => {
    dirty.current = true;
    setFormState(prev => ({ ...prev, adjuntos: prev.adjuntos.filter(a => a.id !== adjId) }));
  }, []);

  const handleEstadoChange = useCallback((newEstado: Presupuesto['estado']) => {
    dirty.current = true;
    setFormState(prev => {
      const updated = { ...prev, estado: newEstado };
      if (newEstado === 'enviado' && !prev.fechaEnvio) {
        updated.fechaEnvio = new Date().toISOString().split('T')[0];
      }
      return updated;
    });
    // Sync lead estado immediately
    if (form.origenTipo === 'lead' && form.origenId) {
      const mappedLeadEstado = PRESUPUESTO_TO_LEAD_ESTADO[newEstado];
      if (mappedLeadEstado) {
        leadsService.update(form.origenId, { estado: mappedLeadEstado }).catch(err =>
          console.error('Error sincronizando estado del lead:', err)
        );
      }
    }
  }, [form.origenTipo, form.origenId]);

  const loadModulosBySistema = useCallback(async (sistemaId: string) => {
    return modulosService.getBySistema(sistemaId);
  }, []);

  return {
    form, setField, loading, saving, dirty,
    cliente, establecimiento, sistema, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    clienteSistemas, loadModulosBySistema,
    calculateTotals, calculateItemTaxes,
    save, load,
    updateItem, addItem, addItems, removeItem, removeItemsByGrupo,
    addAdjunto, removeAdjunto,
    handleEstadoChange,
  };
}
