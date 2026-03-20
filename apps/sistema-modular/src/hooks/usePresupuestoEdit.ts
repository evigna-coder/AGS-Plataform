import { useState, useEffect, useCallback, useRef } from 'react';
import { presupuestosService, clientesService, sistemasService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService, usuariosService, contactosService, leadsService } from '../services/firebaseService';
import type { Presupuesto, Cliente, Sistema, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, AdjuntoPresupuesto, UsuarioAGS, ContactoCliente, LeadEstado } from '@ags/shared';

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
  sistemaId: string | null;
  contactoId: string | null;
  items: PresupuestoItem[];
  tipoCambio: number | undefined;
  condicionPagoId: string | undefined;
  notasTecnicas: string;
  condicionesComerciales: string;
  validezDias: number;
  validUntil: string;
  fechaEnvio: string;
  adjuntos: AdjuntoPresupuesto[];
  proximoContacto: string;
  responsableId: string;
  responsableNombre: string;
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
  clienteId: '', sistemaId: null, contactoId: null,
  items: [], tipoCambio: undefined, condicionPagoId: undefined,
  notasTecnicas: '', condicionesComerciales: '',
  validezDias: 15, validUntil: '', fechaEnvio: '',
  adjuntos: [], proximoContacto: '', responsableId: '', responsableNombre: '',
};

export function usePresupuestoEdit(presupuestoId: string | null) {
  const [form, setFormState] = useState<PresupuestoFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Related data
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [categoriasPresupuesto, setCategoriasPresupuesto] = useState<CategoriaPresupuesto[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([]);
  const [conceptosServicio, setConceptosServicio] = useState<ConceptoServicio[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);

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
        sistemaId: presupuestoData.sistemaId || null,
        contactoId: presupuestoData.contactoId || null,
        items: presupuestoData.items || [],
        tipoCambio: presupuestoData.tipoCambio,
        condicionPagoId: presupuestoData.condicionPagoId,
        notasTecnicas: presupuestoData.notasTecnicas || '',
        condicionesComerciales: presupuestoData.condicionesComerciales || '',
        validezDias: presupuestoData.validezDias ?? 15,
        validUntil: presupuestoData.validUntil ? presupuestoData.validUntil.split('T')[0] : '',
        fechaEnvio: presupuestoData.fechaEnvio ? presupuestoData.fechaEnvio.split('T')[0] : '',
        adjuntos: presupuestoData.adjuntos || [],
        proximoContacto: presupuestoData.proximoContacto || '',
        responsableId: presupuestoData.responsableId || '',
        responsableNombre: presupuestoData.responsableNombre || '',
      });

      if (presupuestoData.clienteId) {
        const [clienteData, contactosData] = await Promise.all([
          clientesService.getById(presupuestoData.clienteId),
          contactosService.getByCliente(presupuestoData.clienteId).catch(() => []),
        ]);
        setCliente(clienteData);
        setContactos(contactosData);
      }
      if (presupuestoData.sistemaId) {
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
      await presupuestosService.update(presupuestoId, {
        estado: form.estado, tipo: form.tipo, moneda: form.moneda, items: form.items,
        subtotal: totals.subtotal, total: totals.total,
        tipoCambio: form.tipoCambio || undefined,
        condicionPagoId: form.condicionPagoId || undefined,
        notasTecnicas: form.notasTecnicas || undefined,
        condicionesComerciales: form.condicionesComerciales || undefined,
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

  return {
    form, setField, loading, saving, dirty,
    cliente, sistema, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    calculateTotals, calculateItemTaxes,
    save, load,
    updateItem, addItem, removeItem,
    addAdjunto, removeAdjunto,
    handleEstadoChange,
  };
}
