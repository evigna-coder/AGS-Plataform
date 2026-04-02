import { useState, useEffect } from 'react';
import { presupuestosService, clientesService, sistemasService, leadsService, ordenesTrabajoService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService } from '../services/firebaseService';
import { establecimientosService, contactosEstablecimientoService } from '../services/establecimientosService';
import { useAuth } from '../contexts/AuthContext';
import type { Cliente, Sistema, Establecimiento, ContactoEstablecimiento, Presupuesto, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto, Posta, Ticket } from '@ags/shared';

export interface PresupuestoFormState {
  clienteId: string;
  establecimientoId: string;
  sistemaId: string;
  contactoId: string;
  tipo: TipoPresupuesto;
  moneda: MonedaPresupuesto;
  origenTipo: OrigenPresupuesto | '';
  origenId: string;
  origenRef: string;
  validezDias: number;
  condicionPagoId: string;
  tipoCambio: string;
  notasTecnicas: string;
  condicionesComerciales: string;
}

export const INITIAL_PRESUPUESTO_FORM: PresupuestoFormState = {
  clienteId: '', establecimientoId: '', sistemaId: '', contactoId: '',
  tipo: 'servicio', moneda: 'USD',
  origenTipo: '', origenId: '', origenRef: '',
  validezDias: 15, condicionPagoId: '', tipoCambio: '',
  notasTecnicas: '', condicionesComerciales: '',
};

interface Prefill {
  clienteId?: string;
  establecimientoId?: string;
  sistemaId?: string;
  moduloId?: string;
  contactoNombre?: string;
  origenTipo?: OrigenPresupuesto;
  origenId?: string;
  origenRef?: string;
}

async function expandItemsForAllSistemas(
  templateItems: PresupuestoItem[], sistemas: Sistema[],
): Promise<PresupuestoItem[]> {
  const expanded: PresupuestoItem[] = [];
  let ts = Date.now();
  for (const sistema of sistemas) {
    for (const tpl of templateItems) {
      expanded.push({
        ...tpl,
        id: `item-${ts++}-${sistema.id}-${tpl.id}`,
        sistemaId: sistema.id,
        sistemaNombre: sistema.nombre,
        sistemaCodigoInterno: sistema.codigoInternoCliente || null,
        moduloId: null, moduloNombre: null, moduloSerie: null, moduloMarca: null,
      });
    }
  }
  return expanded;
}

export function useCreatePresupuestoForm(open: boolean, onClose: () => void, onCreated?: () => void, prefill?: Prefill) {
  const { usuario } = useAuth();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [contactos, setContactos] = useState<ContactoEstablecimiento[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoServicio[]>([]);
  const [form, setForm] = useState<PresupuestoFormState>(INITIAL_PRESUPUESTO_FORM);
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [leadOptions, setLeadOptions] = useState<{ value: string; label: string }[]>([]);
  const [leadsCache, setLeadsCache] = useState<Ticket[]>([]);
  const [otOptions, setOtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showCrearLead, setShowCrearLead] = useState(false);

  useEffect(() => {
    if (!open) { setPrefilled(false); return; }
    Promise.all([
      clientesService.getAll(true), sistemasService.getAll(),
      categoriasPresupuestoService.getAll(), condicionesPagoService.getAll(),
      conceptosServicioService.getAll(),
    ]).then(([c, s, cats, conds, concs]) => {
      setClientes(c); setSistemas(s); setCategorias(cats); setCondiciones(conds); setConceptos(concs);
    });
  }, [open]);

  // Apply prefill
  useEffect(() => {
    if (!open || !prefill || prefilled) return;
    setPrefilled(true);
    // Derive establecimientoId from sistema if not provided
    let estId = prefill.establecimientoId || '';
    if (!estId && prefill.sistemaId && sistemas.length > 0) {
      const sis = sistemas.find(s => s.id === prefill.sistemaId);
      if (sis) estId = sis.establecimientoId;
    }
    setForm(prev => ({
      ...prev,
      clienteId: prefill.clienteId || prev.clienteId,
      establecimientoId: estId || prev.establecimientoId,
      sistemaId: prefill.sistemaId || prev.sistemaId,
      origenTipo: prefill.origenTipo || prev.origenTipo,
      origenId: prefill.origenId || prev.origenId,
      origenRef: prefill.origenRef || prev.origenRef,
    }));
  }, [open, prefill, prefilled, sistemas]);

  // Load establecimientos
  useEffect(() => {
    if (form.clienteId) {
      establecimientosService.getByCliente(form.clienteId).then(setEstablecimientos).catch(() => setEstablecimientos([]));
    } else { setEstablecimientos([]); setContactos([]); setSistemasFiltrados([]); }
  }, [form.clienteId]);

  // Load contacts + filter sistemas
  useEffect(() => {
    if (form.establecimientoId) {
      contactosEstablecimientoService.getByEstablecimiento(form.establecimientoId).then(setContactos).catch(() => setContactos([]));
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId === form.establecimientoId));
    } else if (form.clienteId) {
      setContactos([]);
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
    } else { setContactos([]); setSistemasFiltrados([]); }
  }, [form.establecimientoId, form.clienteId, sistemas]);

  // Auto-match contacto by name from prefill
  useEffect(() => {
    if (!prefill?.contactoNombre || contactos.length === 0 || form.contactoId) return;
    const nombre = prefill.contactoNombre.toLowerCase();
    const match = contactos.find(c => c.nombre.toLowerCase() === nombre);
    if (match) setForm(prev => ({ ...prev, contactoId: match.id }));
  }, [contactos, prefill?.contactoNombre]);

  // Load lead/OT options (cache full leads for auto-fill)
  useEffect(() => {
    if (form.origenTipo === 'lead' && leadsCache.length === 0)
      leadsService.getAll().then(leads => {
        const activos = leads.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado');
        setLeadsCache(activos);
      });
    if (form.origenTipo === 'ot' && otOptions.length === 0)
      ordenesTrabajoService.getAll().then(ots => setOtOptions(ots.slice(0, 50).map(ot => ({ value: ot.otNumber, label: `OT-${ot.otNumber} — ${ot.razonSocial || ''}` }))));
  }, [form.origenTipo]);

  // Build lead options filtered by selected cliente
  useEffect(() => {
    const filtered = form.clienteId
      ? leadsCache.filter(l => l.clienteId === form.clienteId)
      : leadsCache;
    setLeadOptions(filtered.map(l => ({ value: l.id, label: `${l.razonSocial} — ${l.motivoContacto}` })));
  }, [leadsCache, form.clienteId]);

  // Auto-fill cliente/sistema from selected lead
  useEffect(() => {
    if (form.origenTipo !== 'lead' || !form.origenId || leadsCache.length === 0) return;
    const lead = leadsCache.find(l => l.id === form.origenId);
    if (!lead) return;
    setForm(prev => {
      const changes: Partial<PresupuestoFormState> = { origenRef: lead.razonSocial };
      if (lead.clienteId && !prev.clienteId) changes.clienteId = lead.clienteId;
      if (lead.sistemaId && !prev.sistemaId) changes.sistemaId = lead.sistemaId;
      return { ...prev, ...changes };
    });
  }, [form.origenId, leadsCache]);

  const handleClose = () => { onClose(); setForm(INITIAL_PRESUPUESTO_FORM); setItems([]); setLeadsCache([]); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Debe seleccionar un cliente'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }
    try {
      setSaving(true);
      let finalItems = items;
      if (form.sistemaId === '__ALL_SISTEMAS__' && sistemasFiltrados.length > 0) {
        finalItems = await expandItemsForAllSistemas(items, sistemasFiltrados);
      }
      const sistemaIds = [...new Set(finalItems.map(i => i.sistemaId).filter(Boolean))] as string[];
      const grupoMap = new Map(sistemaIds.map((id, idx) => [id, idx + 1]));
      finalItems = finalItems.map(item => ({ ...item, grupo: item.sistemaId ? grupoMap.get(item.sistemaId) || 0 : 0 }));

      const subtotal = finalItems.reduce((s, i) => s + (i.subtotal || 0), 0);
      const data: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> = {
        numero: '', tipo: form.tipo, moneda: form.moneda,
        clienteId: form.clienteId,
        establecimientoId: form.establecimientoId || null,
        sistemaId: form.sistemaId === '__ALL_SISTEMAS__' ? null : (form.sistemaId || null),
        contactoId: form.contactoId || null,
        origenTipo: (form.origenTipo as OrigenPresupuesto) || null,
        origenId: form.origenId || null, origenRef: form.origenRef || null,
        estado: 'borrador', items: finalItems, subtotal, total: subtotal,
        ordenesCompraIds: [], adjuntos: [], validezDias: form.validezDias,
        condicionPagoId: form.condicionPagoId || undefined,
        tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : undefined,
        notasTecnicas: form.notasTecnicas || undefined,
        condicionesComerciales: form.condicionesComerciales || undefined,
      };
      const { id: presupuestoId, numero } = await presupuestosService.create(data);
      if (form.origenTipo === 'lead' && form.origenId && usuario) {
        const posta: Posta = {
          id: crypto.randomUUID(), fecha: new Date().toISOString(),
          deUsuarioId: usuario.id, deUsuarioNombre: usuario.displayName,
          aUsuarioId: usuario.id, aUsuarioNombre: usuario.displayName,
          comentario: `Presupuesto creado: ${numero}`,
          estadoAnterior: 'presupuesto_pendiente', estadoNuevo: 'presupuesto_pendiente',
        };
        await leadsService.agregarComentario(form.origenId, posta).catch(err => console.error('Error agregando posta al lead:', err));
        await leadsService.linkPresupuesto(form.origenId, presupuestoId).catch(err => console.error('Error vinculando presupuesto al lead:', err));
      }
      handleClose();
      onCreated?.();
    } catch { alert('Error al crear el presupuesto'); }
    finally { setSaving(false); }
  };

  const addItem = (item: PresupuestoItem) => setItems(prev => [...prev, item]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const reloadLeads = async (leadId?: string) => {
    const leads = await leadsService.getAll();
    const activos = leads.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado');
    setLeadsCache(activos);
    if (leadId) setForm(prev => ({ ...prev, origenId: leadId }));
  };

  return {
    saving, form, setForm, items, handleClose, handleSave, addItem, removeItem,
    clientes, establecimientos, sistemasFiltrados, contactos,
    categorias, condiciones, conceptos, leadOptions, otOptions,
    showCrearLead, setShowCrearLead, reloadLeads,
  };
}
