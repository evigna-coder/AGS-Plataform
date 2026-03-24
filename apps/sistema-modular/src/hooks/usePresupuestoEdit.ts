import { useState, useEffect, useCallback, useRef } from 'react';
import { presupuestosService, clientesService, sistemasService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService, usuariosService, contactosService, leadsService } from '../services/firebaseService';
import { modulosService } from '../services/equiposService';
import type { Presupuesto, Cliente, Sistema, Establecimiento, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, AdjuntoPresupuesto, UsuarioAGS, ContactoCliente, ContactoEstablecimiento, LeadEstado, PresupuestoSeccionesVisibles } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_DEFAULT } from '@ags/shared';

/** Mapping: when a presupuesto originates from a lead, sync lead estado on presupuesto state changes */
const PRESUPUESTO_TO_LEAD_ESTADO: Partial<Record<Presupuesto['estado'], LeadEstado>> = {
  borrador: 'en_presupuesto',
  enviado: 'presupuesto_enviado',
  en_seguimiento: 'presupuesto_enviado',
  pendiente_oc: 'esperando_oc',
  aceptado: 'esperando_oc',
  autorizado: 'en_coordinacion',
  pendiente_certificacion: 'en_proceso',
  rechazado: 'no_concretado',
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
};

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

  const load = useCallback(async () => {
    if (!presupuestoId) return;
    try {
      setLoading(true);
      const [presupuestoData, categoriasData, condicionesData, conceptosData, usrs] = await Promise.all([
        presupuestosService.getById(presupuestoId),
        categoriasPresupuestoService.getAll(),
        condicionesPagoService.getAll(),
        conceptosServicioService.getAll(),
        usuariosService.getAll(),
      ]);
      if (!presupuestoData) return;

      setFormState({
        numero: presupuestoData.numero,
        estado: presupuestoData.estado,
        tipo: presupuestoData.tipo || 'servicio',
        moneda: presupuestoData.moneda || 'USD',
        origenTipo: presupuestoData.origenTipo || null,
        origenId: presupuestoData.origenId || null,
        origenRef: presupuestoData.origenRef || null,
        clienteId: presupuestoData.clienteId,
        establecimientoId: presupuestoData.establecimientoId || null,
        sistemaId: presupuestoData.sistemaId || null,
        contactoId: presupuestoData.contactoId || null,
        items: presupuestoData.items || [],
        tipoCambio: presupuestoData.tipoCambio,
        condicionPagoId: presupuestoData.condicionPagoId,
        notasTecnicas: presupuestoData.notasTecnicas || '',
        notasAdministrativas: presupuestoData.notasAdministrativas || '',
        garantia: presupuestoData.garantia || '',
        variacionTipoCambio: presupuestoData.variacionTipoCambio || '',
        condicionesComerciales: presupuestoData.condicionesComerciales || '',
        aceptacionPresupuesto: presupuestoData.aceptacionPresupuesto || '',
        seccionesVisibles: presupuestoData.seccionesVisibles || { ...PRESUPUESTO_SECCIONES_DEFAULT },
        validezDias: presupuestoData.validezDias ?? 15,
        validUntil: presupuestoData.validUntil ? presupuestoData.validUntil.split('T')[0] : '',
        fechaEnvio: presupuestoData.fechaEnvio ? presupuestoData.fechaEnvio.split('T')[0] : '',
        adjuntos: presupuestoData.adjuntos || [],
        proximoContacto: presupuestoData.proximoContacto || '',
        responsableId: presupuestoData.responsableId || '',
        responsableNombre: presupuestoData.responsableNombre || '',
        createdAt: presupuestoData.createdAt || '',
      });

      if (presupuestoData.clienteId) {
        const [clienteData, contactosData, sistemasData] = await Promise.all([
          clientesService.getById(presupuestoData.clienteId),
          contactosService.getByCliente(presupuestoData.clienteId).catch(() => []),
          sistemasService.getAll({ clienteId: presupuestoData.clienteId }).catch(() => [] as Sistema[]),
        ]);
        setCliente(clienteData);
        setContactos(contactosData);
        setClienteSistemas(sistemasData);
      }
      if (presupuestoData.establecimientoId) {
        try {
          const { establecimientosService } = await import('../services/firebaseService');
          const estabData = await establecimientosService.getById(presupuestoData.establecimientoId);
          setEstablecimiento(estabData);
        } catch { /* establecimiento optional */ }
      }
      if (presupuestoData.sistemaId && !presupuestoData.sistemaId.startsWith('__')) {
        const sistemaData = await sistemasService.getById(presupuestoData.sistemaId);
        setSistema(sistemaData);
      }
      setCategoriasPresupuesto(categoriasData);
      setCondicionesPago(condicionesData);
      setConceptosServicio(conceptosData);
      setUsuarios(usrs);
      dirty.current = false;
    } catch (error) {
      console.error('Error cargando presupuesto:', error);
    } finally {
      setLoading(false);
    }
  }, [presupuestoId]);

  useEffect(() => { load(); }, [load]);

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
        proximoContacto: form.proximoContacto || null,
        responsableId: form.responsableId || null,
        responsableNombre: form.responsableNombre || null,
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
    updateItem, addItem, removeItem,
    addAdjunto, removeAdjunto,
    handleEstadoChange,
  };
}
