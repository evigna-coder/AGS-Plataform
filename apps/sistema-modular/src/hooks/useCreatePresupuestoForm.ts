import { useState, useEffect } from 'react';
import { presupuestosService, clientesService, sistemasService, leadsService, ordenesTrabajoService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService } from '../services/firebaseService';
import { establecimientosService, contactosEstablecimientoService } from '../services/establecimientosService';
import { pendientesService } from '../services/pendientesService';
import { useAuth } from '../contexts/AuthContext';
import type { Cliente, Sistema, Establecimiento, ContactoEstablecimiento, Presupuesto, PresupuestoItem, PresupuestoCuota, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto, Posta, Ticket, VentasMetadata, PresupuestoCuotaFacturacion, MonedaCuota } from '@ags/shared';
import { validateEsquemaSum, findEmptyCuotas } from '../utils/cuotasFacturacion';

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
  notasAdministrativas: string;
  garantia: string;
  variacionTipoCambio: string;
  condicionesComerciales: string;
  aceptacionPresupuesto: string;
  ventasMetadata: VentasMetadata;
}

export const INITIAL_PRESUPUESTO_FORM: PresupuestoFormState = {
  clienteId: '', establecimientoId: '', sistemaId: '', contactoId: '',
  tipo: 'servicio', moneda: 'USD',
  origenTipo: '', origenId: '', origenRef: '',
  validezDias: 15, condicionPagoId: '', tipoCambio: '',
  notasTecnicas: '', notasAdministrativas: '', garantia: '',
  variacionTipoCambio: '', condicionesComerciales: '', aceptacionPresupuesto: '',
  ventasMetadata: { fechaEstimadaEntrega: null, lugarInstalacion: null, requiereEntrenamiento: false },
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

export function useCreatePresupuestoForm(open: boolean, onClose: () => void, onCreated?: (newId?: string) => void, prefill?: Prefill) {
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
  const [cuotas, setCuotas] = useState<PresupuestoCuota[]>([]);
  // Phase 12: cuota schema (porcentual facturación) — for non-contrato types
  const [esquemaFacturacion, setEsquemaFacturacion] = useState<PresupuestoCuotaFacturacion[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [leadOptions, setLeadOptions] = useState<{ value: string; label: string }[]>([]);
  const [leadsCache, setLeadsCache] = useState<Ticket[]>([]);
  const [otOptions, setOtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showCrearLead, setShowCrearLead] = useState(false);
  const [selectedPendienteIds, setSelectedPendienteIds] = useState<Set<string>>(new Set());

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

  // Apply prefill — runs when modal opens AND again when sistemas load
  // (establecimientoId can only be derived after sistemas are available)
  useEffect(() => {
    if (!open || !prefill) return;
    // First pass: set basic fields
    if (!prefilled) {
      setPrefilled(true);
      setForm(prev => ({
        ...prev,
        clienteId: prefill.clienteId || prev.clienteId,
        establecimientoId: prefill.establecimientoId || prev.establecimientoId,
        sistemaId: prefill.sistemaId || prev.sistemaId,
        origenTipo: prefill.origenTipo || prev.origenTipo,
        origenId: prefill.origenId || prev.origenId,
        origenRef: prefill.origenRef || prev.origenRef,
      }));
    }
    // Second pass: derive establecimientoId from sistema once sistemas load
    if (prefill.sistemaId && sistemas.length > 0) {
      setForm(prev => {
        if (prev.establecimientoId) return prev; // already set
        const sis = sistemas.find(s => s.id === prefill.sistemaId);
        return sis?.establecimientoId ? { ...prev, establecimientoId: sis.establecimientoId } : prev;
      });
    }
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
    setLeadOptions(filtered.map(l => {
      const parts = [
        l.numero,
        l.razonSocial,
        (l.descripcion?.trim() || l.motivoContacto || '').trim(),
      ].filter(Boolean);
      return { value: l.id, label: parts.join(' · ') };
    }));
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

  const handleClose = () => { onClose(); setForm(INITIAL_PRESUPUESTO_FORM); setItems([]); setCuotas([]); setEsquemaFacturacion([]); setLeadsCache([]); setSelectedPendienteIds(new Set()); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Debe seleccionar un cliente'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }

    // Phase 12 BILL-01: validate esquema before saving for non-contrato types
    if (form.tipo !== 'contrato' && esquemaFacturacion.length > 0) {
      // Derive active monedas (mirrors EsquemaFacturacionSection + usePresupuestoEdit logic)
      let monedasActivas: MonedaCuota[];
      if (form.moneda !== 'MIXTA') {
        monedasActivas = [form.moneda as MonedaCuota];
      } else {
        const set = new Set<MonedaCuota>();
        for (const item of items) {
          const m = item.moneda as MonedaCuota | null | undefined;
          if (m) set.add(m);
        }
        monedasActivas = set.size > 0 ? Array.from(set) : ['USD'];
      }

      const emptyCuotas = findEmptyCuotas(esquemaFacturacion);
      if (emptyCuotas.length > 0) {
        const nums = emptyCuotas.map(c => c.numero).join(', ');
        alert(`Cuota(s) N° ${nums} no factura ninguna moneda. Agregá un porcentaje o eliminala.`);
        return;
      }

      const errors = validateEsquemaSum(esquemaFacturacion, monedasActivas);
      if (errors.length > 0) {
        const msgs = errors.map(e => `Cuotas en ${e.moneda} suman ${e.sum.toFixed(2)}%, deben sumar 100.00%`);
        alert(msgs.join('\n'));
        return;
      }
    }

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
        notasAdministrativas: form.notasAdministrativas || undefined,
        garantia: form.garantia || undefined,
        variacionTipoCambio: form.variacionTipoCambio || undefined,
        condicionesComerciales: form.condicionesComerciales || undefined,
        aceptacionPresupuesto: form.aceptacionPresupuesto || undefined,
        ...(cuotas.length > 0 ? { cuotas, cantidadCuotas: cuotas.length } : {}),
        // Phase 12: include esquema for non-contrato types when populated
        ...(form.tipo !== 'contrato' && esquemaFacturacion.length > 0 ? { esquemaFacturacion } : {}),
        ...(form.tipo === 'ventas' ? { ventasMetadata: form.ventasMetadata } : {}),
      };
      const { id: presupuestoId, numero } = await presupuestosService.create(data);

      // Auto-complete pendientes marcadas
      if (selectedPendienteIds.size > 0) {
        const ids = Array.from(selectedPendienteIds);
        await Promise.all(
          ids.map(id =>
            pendientesService
              .completar(id, {
                resolucionDocType: 'presupuesto',
                resolucionDocId: presupuestoId,
                resolucionDocLabel: numero,
              })
              .catch(err => console.error(`Error completando pendiente ${id}:`, err)),
          ),
        );
      }

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
      onCreated?.(presupuestoId);
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
    saving, form, setForm, items, cuotas, setCuotas,
    // Phase 12: esquema facturación porcentual for non-contrato types
    esquemaFacturacion, setEsquemaFacturacion,
    handleClose, handleSave, addItem, removeItem,
    clientes, establecimientos, sistemasFiltrados, contactos,
    categorias, condiciones, conceptos, leadOptions, otOptions,
    showCrearLead, setShowCrearLead, reloadLeads,
    selectedPendienteIds, setSelectedPendienteIds,
  };
}
