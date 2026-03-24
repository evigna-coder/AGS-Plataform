import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { presupuestosService, clientesService, sistemasService, leadsService, ordenesTrabajoService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService } from '../../services/firebaseService';
import { establecimientosService, contactosEstablecimientoService } from '../../services/establecimientosService';
import { useAuth } from '../../contexts/AuthContext';
import type { Cliente, Sistema, Establecimiento, ContactoEstablecimiento, Presupuesto, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto, Posta } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, MONEDA_PRESUPUESTO_LABELS, ORIGEN_PRESUPUESTO_LABELS, MONEDA_SIMBOLO } from '@ags/shared';
import { CreatePresupuestoItems } from './CreatePresupuestoItems';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Pre-fill from a lead */
  prefill?: {
    clienteId?: string;
    sistemaId?: string;
    moduloId?: string;
    origenTipo?: OrigenPresupuesto;
    origenId?: string;
    origenRef?: string;
  };
}

const TIPOS = Object.entries(TIPO_PRESUPUESTO_LABELS) as [TipoPresupuesto, string][];
const MONEDAS = Object.entries(MONEDA_PRESUPUESTO_LABELS) as [MonedaPresupuesto, string][];
const ORIGENES = Object.entries(ORIGEN_PRESUPUESTO_LABELS) as [OrigenPresupuesto, string][];

interface FormState {
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

const INITIAL_FORM: FormState = {
  clienteId: '', establecimientoId: '', sistemaId: '', contactoId: '',
  tipo: 'servicio', moneda: 'USD',
  origenTipo: '', origenId: '', origenRef: '',
  validezDias: 15, condicionPagoId: '', tipoCambio: '',
  notasTecnicas: '', condicionesComerciales: '',
};

/**
 * When "Todos los sistemas" is selected, replicate each template item
 * for every individual sistema. Modules are informational only (shown in PDF).
 */
async function expandItemsForAllSistemas(
  templateItems: PresupuestoItem[],
  sistemas: Sistema[],
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

export const CreatePresupuestoModal: React.FC<Props> = ({ open, onClose, onCreated, prefill }) => {
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
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  const [leadOptions, setLeadOptions] = useState<{ value: string; label: string }[]>([]);
  const [otOptions, setOtOptions] = useState<{ value: string; label: string }[]>([]);

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

  // Apply prefill once when modal opens with prefill data
  useEffect(() => {
    if (!open || !prefill || prefilled) return;
    setPrefilled(true);
    setForm(prev => ({
      ...prev,
      clienteId: prefill.clienteId || prev.clienteId,
      sistemaId: prefill.sistemaId || prev.sistemaId,
      origenTipo: prefill.origenTipo || prev.origenTipo,
      origenId: prefill.origenId || prev.origenId,
      origenRef: prefill.origenRef || prev.origenRef,
    }));
  }, [open, prefill, prefilled]);

  // Load establecimientos when client changes
  useEffect(() => {
    if (form.clienteId) {
      establecimientosService.getByCliente(form.clienteId).then(setEstablecimientos).catch(() => setEstablecimientos([]));
    } else { setEstablecimientos([]); setContactos([]); setSistemasFiltrados([]); }
  }, [form.clienteId]);

  // Load contacts + filter sistemas when establecimiento changes
  useEffect(() => {
    if (form.establecimientoId) {
      contactosEstablecimientoService.getByEstablecimiento(form.establecimientoId).then(setContactos).catch(() => setContactos([]));
      setSistemasFiltrados(sistemas.filter(s => s.establecimientoId === form.establecimientoId));
    } else if (form.clienteId) {
      setContactos([]);
      // No establecimiento selected → show all sistemas of client
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
    } else { setContactos([]); setSistemasFiltrados([]); }
  }, [form.establecimientoId, form.clienteId, sistemas]);

  useEffect(() => {
    if (form.origenTipo === 'lead' && leadOptions.length === 0)
      leadsService.getAll().then(leads => setLeadOptions(leads.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado').map(l => ({ value: l.id, label: `${l.razonSocial} — ${l.motivoContacto}` }))));
    if (form.origenTipo === 'ot' && otOptions.length === 0)
      ordenesTrabajoService.getAll().then(ots => setOtOptions(ots.slice(0, 50).map(ot => ({ value: ot.otNumber, label: `OT-${ot.otNumber} — ${ot.razonSocial || ''}` }))));
  }, [form.origenTipo]);

  const handleClose = () => { onClose(); setForm(INITIAL_FORM); setItems([]); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Debe seleccionar un cliente'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }
    try {
      setSaving(true);

      // Expand "Todos los sistemas" → replicate items for each individual sistema
      let finalItems = items;
      if (form.sistemaId === '__ALL_SISTEMAS__' && sistemasFiltrados.length > 0) {
        finalItems = await expandItemsForAllSistemas(items, sistemasFiltrados);
      }

      // Assign grupo numbers based on sistemaId
      const sistemaIds = [...new Set(finalItems.map(i => i.sistemaId).filter(Boolean))] as string[];
      const grupoMap = new Map(sistemaIds.map((id, idx) => [id, idx + 1]));
      finalItems = finalItems.map(item => ({
        ...item,
        grupo: item.sistemaId ? grupoMap.get(item.sistemaId) || 0 : 0,
      }));

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
      // Add posta to linked lead
      if (form.origenTipo === 'lead' && form.origenId && usuario) {
        const posta: Posta = {
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          deUsuarioId: usuario.id,
          deUsuarioNombre: usuario.displayName,
          aUsuarioId: usuario.id,
          aUsuarioNombre: usuario.displayName,
          comentario: `Presupuesto creado: ${numero}`,
          estadoAnterior: 'en_presupuesto',
          estadoNuevo: 'en_presupuesto',
        };
        await leadsService.agregarComentario(form.origenId, posta).catch(err =>
          console.error('Error agregando posta al lead:', err)
        );
        await leadsService.linkPresupuesto(form.origenId, presupuestoId).catch(err =>
          console.error('Error vinculando presupuesto al lead:', err)
        );
      }
      handleClose();
      onCreated?.();
    } catch { alert('Error al crear el presupuesto'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
  const sym = MONEDA_SIMBOLO[form.moneda] || '$';
  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo presupuesto" subtitle="Complete todos los datos del presupuesto" maxWidth="2xl">
      <div className="space-y-4">
        {/* Section: Datos del presupuesto */}
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Datos del presupuesto</p>

        {/* Row 1: Todo compacto — Tipo, Moneda, Origen, Validez↓, T.Cambio↓, Condición */}
        <div className="grid grid-cols-[1fr_1fr_1fr_70px_70px_1.5fr] gap-2.5">
          <div>
            <label className={lbl}>Tipo *</label>
            <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoPresupuesto })}>
              {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Moneda</label>
            <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value as MonedaPresupuesto })}>
              {MONEDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Origen</label>
            <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.origenTipo} onChange={e => setForm({ ...form, origenTipo: e.target.value as OrigenPresupuesto | '', origenId: '', origenRef: '' })}>
              <option value="">Sin origen</option>
              {ORIGENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Validez</label>
            <input type="number" min="1" value={form.validezDias} onChange={e => setForm({ ...form, validezDias: Number(e.target.value) || 15 })} className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs text-center" />
          </div>
          <div>
            <label className={lbl}>T. Cambio</label>
            <input type="number" min="0" step="0.01" value={form.tipoCambio} onChange={e => setForm({ ...form, tipoCambio: e.target.value })} className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs text-center" placeholder="1.0" />
          </div>
          <div>
            <label className={lbl}>Condicion de pago</label>
            <SearchableSelect value={form.condicionPagoId} onChange={v => setForm({ ...form, condicionPagoId: v })}
              options={[{ value: '', label: 'Sin condicion' }, ...condiciones.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} dias)` : ''}` }))]}
              placeholder="Seleccionar..." />
          </div>
        </div>

        {/* Row 1b: Origen detail (solo si hay origen seleccionado) */}
        {form.origenTipo === 'lead' && (
          <div className="max-w-xs"><label className={lbl}>Lead</label><SearchableSelect value={form.origenId} onChange={v => setForm({ ...form, origenId: v })} options={leadOptions} placeholder="Seleccionar lead..." /></div>
        )}
        {form.origenTipo === 'ot' && (
          <div className="max-w-xs"><label className={lbl}>OT</label><SearchableSelect value={form.origenId} onChange={v => setForm({ ...form, origenId: v })} options={otOptions} placeholder="Seleccionar OT..." /></div>
        )}
        {form.origenTipo === 'requerimiento_compra' && (
          <div className="max-w-xs"><label className={lbl}>Referencia</label><input className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.origenRef} onChange={e => setForm({ ...form, origenRef: e.target.value })} placeholder="Ej: SC-74001" /></div>
        )}

        {/* Row 2: Cliente + Establecimiento + Sistema + Contacto */}
        <div className="grid grid-cols-4 gap-2.5">
          <div>
            <label className={lbl}>Cliente *</label>
            <SearchableSelect value={form.clienteId} onChange={v => setForm({ ...form, clienteId: v, establecimientoId: '', sistemaId: '', contactoId: '' })}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))} placeholder="Seleccionar cliente..." />
          </div>
          {form.clienteId && establecimientos.length > 0 && (
            <div>
              <label className={lbl}>Establecimiento</label>
              <SearchableSelect value={form.establecimientoId} onChange={v => setForm({ ...form, establecimientoId: v, sistemaId: '', contactoId: '' })}
                options={[{ value: '', label: 'Sin establecimiento' }, ...establecimientos.map(e => ({ value: e.id, label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}` }))]}
                placeholder="Seleccionar..." />
            </div>
          )}
          {form.clienteId && (
            <>
              <div>
                <label className={lbl}>Sistema/Equipo</label>
                <SearchableSelect value={form.sistemaId} onChange={v => setForm({ ...form, sistemaId: v })}
                  options={[
                    { value: '', label: 'Sin sistema' },
                    ...(form.tipo === 'contrato' && sistemasFiltrados.length > 0 ? [{ value: '__ALL_SISTEMAS__', label: 'Todos los sistemas/equipos' }] : []),
                    ...sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}` })),
                  ]}
                  placeholder="Seleccionar..." />
              </div>
              <div>
                <label className={lbl}>Contacto</label>
                <SearchableSelect value={form.contactoId} onChange={v => setForm({ ...form, contactoId: v })}
                  options={[
                    { value: '', label: 'Sin contacto' },
                    ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` })),
                  ]}
                  placeholder="Seleccionar contacto..." />
              </div>
            </>
          )}
        </div>
        {form.sistemaId === '__ALL_SISTEMAS__' && sistemasFiltrados.length > 0 && (
          <p className="text-[11px] text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg">
            Al crear, los items se replicaran para cada uno de los {sistemasFiltrados.length} sistemas/equipos, detallando sus modulos.
          </p>
        )}

        {/* Divider + Section: Items */}
        <hr className="border-[#E5E5E5]" />
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Items del presupuesto</p>

        <CreatePresupuestoItems
          items={items}
          onAdd={item => setItems(prev => [...prev, item])}
          onRemove={id => setItems(prev => prev.filter(i => i.id !== id))}
          categoriasPresupuesto={categorias}
          conceptosServicio={conceptos}
          moneda={form.moneda}
        />

        {/* Divider + Notas */}
        <hr className="border-[#E5E5E5]" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Notas tecnicas</label>
            <textarea value={form.notasTecnicas} onChange={e => setForm({ ...form, notasTecnicas: e.target.value })}
              rows={2} className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-xs" placeholder="Observaciones tecnicas..." />
          </div>
          <div>
            <label className={lbl}>Condiciones comerciales</label>
            <textarea value={form.condicionesComerciales} onChange={e => setForm({ ...form, condicionesComerciales: e.target.value })}
              rows={2} className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-xs" placeholder="Forma de pago, plazos..." />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E5E5] bg-[#F0F0F0] rounded-b-xl -mx-5 -mb-4 mt-3">
        <div className="text-xs font-mono text-slate-500">
          {items.length > 0 && <span>Items: <strong>{items.length}</strong> — Total: <strong className="text-teal-700">{sym} {totalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !form.clienteId || items.length === 0}>
            {saving ? 'Creando...' : 'Crear presupuesto'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
