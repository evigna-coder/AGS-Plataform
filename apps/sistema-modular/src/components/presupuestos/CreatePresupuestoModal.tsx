import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { presupuestosService, clientesService, sistemasService, contactosService, leadsService, ordenesTrabajoService, categoriasPresupuestoService, condicionesPagoService, conceptosServicioService } from '../../services/firebaseService';
import type { Cliente, Sistema, ContactoCliente, Presupuesto, PresupuestoItem, CategoriaPresupuesto, CondicionPago, ConceptoServicio, TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, MONEDA_PRESUPUESTO_LABELS, ORIGEN_PRESUPUESTO_LABELS, MONEDA_SIMBOLO } from '@ags/shared';
import { CreatePresupuestoItems } from './CreatePresupuestoItems';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const TIPOS = Object.entries(TIPO_PRESUPUESTO_LABELS) as [TipoPresupuesto, string][];
const MONEDAS = Object.entries(MONEDA_PRESUPUESTO_LABELS) as [MonedaPresupuesto, string][];
const ORIGENES = Object.entries(ORIGEN_PRESUPUESTO_LABELS) as [OrigenPresupuesto, string][];

interface FormState {
  clienteId: string;
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
  clienteId: '', sistemaId: '', contactoId: '',
  tipo: 'servicio', moneda: 'USD',
  origenTipo: '', origenId: '', origenRef: '',
  validezDias: 15, condicionPagoId: '', tipoCambio: '',
  notasTecnicas: '', condicionesComerciales: '',
};

export const CreatePresupuestoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoServicio[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [items, setItems] = useState<PresupuestoItem[]>([]);

  const [leadOptions, setLeadOptions] = useState<{ value: string; label: string }[]>([]);
  const [otOptions, setOtOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      clientesService.getAll(true), sistemasService.getAll(),
      categoriasPresupuestoService.getAll(), condicionesPagoService.getAll(),
      conceptosServicioService.getAll(),
    ]).then(([c, s, cats, conds, concs]) => {
      setClientes(c); setSistemas(s); setCategorias(cats); setCondiciones(conds); setConceptos(concs);
    });
  }, [open]);

  useEffect(() => {
    if (form.clienteId) {
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
    } else { setContactos([]); setSistemasFiltrados([]); }
  }, [form.clienteId, sistemas]);

  useEffect(() => {
    if (form.origenTipo === 'lead' && leadOptions.length === 0)
      leadsService.getAll().then(leads => setLeadOptions(leads.filter(l => l.estado !== 'finalizado' && l.estado !== 'no_concretado').map(l => ({ value: l.id, label: `${l.razonSocial} — ${l.motivoContacto}` }))));
    if (form.origenTipo === 'ot' && otOptions.length === 0)
      ordenesTrabajoService.getAll().then(ots => setOtOptions(ots.slice(0, 50).map(ot => ({ value: ot.id || ot.otNumber, label: `OT-${ot.otNumber} — ${ot.clienteNombre || ''}` }))));
  }, [form.origenTipo]);

  const handleClose = () => { onClose(); setForm(INITIAL_FORM); setItems([]); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Debe seleccionar un cliente'); return; }
    if (items.length === 0) { alert('Agregue al menos un item'); return; }
    try {
      setSaving(true);
      const subtotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
      const data: Omit<Presupuesto, 'id' | 'createdAt' | 'updatedAt'> = {
        numero: '', tipo: form.tipo, moneda: form.moneda,
        clienteId: form.clienteId, sistemaId: form.sistemaId || null, contactoId: form.contactoId || null,
        origenTipo: (form.origenTipo as OrigenPresupuesto) || null,
        origenId: form.origenId || null, origenRef: form.origenRef || null,
        estado: 'borrador', items, subtotal, total: subtotal,
        ordenesCompraIds: [], adjuntos: [], validezDias: form.validezDias,
        condicionPagoId: form.condicionPagoId || null,
        tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : null,
        notasTecnicas: form.notasTecnicas || null,
        condicionesComerciales: form.condicionesComerciales || null,
      };
      await presupuestosService.create(data);
      handleClose();
      onCreated?.();
    } catch { alert('Error al crear el presupuesto'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const sym = MONEDA_SIMBOLO[form.moneda] || '$';
  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo presupuesto" subtitle="Complete todos los datos del presupuesto" maxWidth="xl">
      <div className="space-y-5">
        {/* Tipo, moneda, cliente, origen */}
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Tipo y moneda</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Tipo *</label>
                  <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoPresupuesto })}>
                    {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Moneda</label>
                  <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value as MonedaPresupuesto })}>
                    {MONEDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Cliente</h3>
              <div className="space-y-2">
                <div>
                  <label className={lbl}>Cliente *</label>
                  <SearchableSelect value={form.clienteId} onChange={v => setForm({ ...form, clienteId: v, sistemaId: '', contactoId: '' })}
                    options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))} placeholder="Seleccionar cliente..." />
                </div>
                {form.clienteId && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Sistema</label>
                      <SearchableSelect value={form.sistemaId} onChange={v => setForm({ ...form, sistemaId: v })}
                        options={[{ value: '', label: 'Sin sistema' }, ...sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))]}
                        placeholder="Seleccionar..." />
                    </div>
                    {contactos.length > 0 && (
                      <div>
                        <label className={lbl}>Contacto</label>
                        <SearchableSelect value={form.contactoId} onChange={v => setForm({ ...form, contactoId: v })}
                          options={[{ value: '', label: 'Sin contacto' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` - ${c.cargo}` : ''}` }))]}
                          placeholder="Seleccionar..." />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Origen (opcional)</h3>
              <div className="space-y-2">
                <div>
                  <label className={lbl}>Se origina de</label>
                  <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={form.origenTipo} onChange={e => setForm({ ...form, origenTipo: e.target.value as OrigenPresupuesto | '', origenId: '', origenRef: '' })}>
                    <option value="">Sin origen</option>
                    {ORIGENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {form.origenTipo === 'lead' && (
                  <div><label className={lbl}>Lead</label><SearchableSelect value={form.origenId} onChange={v => setForm({ ...form, origenId: v })} options={leadOptions} placeholder="Seleccionar lead..." /></div>
                )}
                {form.origenTipo === 'ot' && (
                  <div><label className={lbl}>OT</label><SearchableSelect value={form.origenId} onChange={v => setForm({ ...form, origenId: v })} options={otOptions} placeholder="Seleccionar OT..." /></div>
                )}
                {form.origenTipo === 'requerimiento_compra' && (
                  <div><label className={lbl}>Referencia</label><input className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={form.origenRef} onChange={e => setForm({ ...form, origenRef: e.target.value })} placeholder="Ej: SC-74001" /></div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Condiciones</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Validez (dias)</label><input type="number" min="1" value={form.validezDias} onChange={e => setForm({ ...form, validezDias: Number(e.target.value) || 15 })} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" /></div>
                  <div><label className={lbl}>Tipo de cambio</label><input type="number" min="0" step="0.01" value={form.tipoCambio} onChange={e => setForm({ ...form, tipoCambio: e.target.value })} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" placeholder="Ej: 1.0" /></div>
                </div>
                <div>
                  <label className={lbl}>Condicion de pago</label>
                  <SearchableSelect value={form.condicionPagoId} onChange={v => setForm({ ...form, condicionPagoId: v })}
                    options={[{ value: '', label: 'Sin condicion' }, ...condiciones.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} dias)` : ''}` }))]}
                    placeholder="Seleccionar..." />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <CreatePresupuestoItems
          items={items}
          onAdd={item => setItems(prev => [...prev, item])}
          onRemove={id => setItems(prev => prev.filter(i => i.id !== id))}
          categoriasPresupuesto={categorias}
          conceptosServicio={conceptos}
          moneda={form.moneda}
        />

        {/* Notas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Notas tecnicas</label>
            <textarea value={form.notasTecnicas} onChange={e => setForm({ ...form, notasTecnicas: e.target.value })}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Observaciones tecnicas..." />
          </div>
          <div>
            <label className={lbl}>Condiciones comerciales</label>
            <textarea value={form.condicionesComerciales} onChange={e => setForm({ ...form, condicionesComerciales: e.target.value })}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Forma de pago, plazos..." />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        <div className="text-xs text-slate-500">
          {items.length > 0 && <span>Items: <strong>{items.length}</strong> — Total: <strong className="text-indigo-700">{sym} {totalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>}
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
