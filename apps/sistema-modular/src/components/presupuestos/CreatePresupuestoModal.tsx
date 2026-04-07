import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCreatePresupuestoForm } from '../../hooks/useCreatePresupuestoForm';
import type { OrigenPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { CreatePresupuestoItems } from './CreatePresupuestoItems';
import { CrearLeadModal } from '../leads/CrearLeadModal';
import { PresupuestoFormHeader } from './PresupuestoFormHeader';
import { PresupuestoFormCliente } from './PresupuestoFormCliente';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  prefill?: {
    clienteId?: string;
    establecimientoId?: string;
    sistemaId?: string;
    moduloId?: string;
    contactoNombre?: string;
    origenTipo?: OrigenPresupuesto;
    origenId?: string;
    origenRef?: string;
  };
}

export const CreatePresupuestoModal: React.FC<Props> = ({ open, onClose, onCreated, prefill }) => {
  const h = useCreatePresupuestoForm(open, onClose, onCreated, prefill);
  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
  const sym = MONEDA_SIMBOLO[h.form.moneda] || '$';
  const totalItems = h.items.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <>
    <Modal open={open} onClose={h.handleClose} title="Nuevo presupuesto" subtitle="Complete todos los datos del presupuesto" maxWidth="2xl">
      <div className="space-y-4">
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Datos del presupuesto</p>

        <PresupuestoFormHeader form={h.form} setForm={h.setForm} condiciones={h.condiciones}
          leadOptions={h.leadOptions} otOptions={h.otOptions}
          onShowCrearLead={() => h.setShowCrearLead(true)} />

        <PresupuestoFormCliente form={h.form} setForm={h.setForm}
          clientes={h.clientes} establecimientos={h.establecimientos}
          sistemasFiltrados={h.sistemasFiltrados} contactos={h.contactos} />

        {/* Divider + Items */}
        <hr className="border-[#E5E5E5]" />
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Items del presupuesto</p>

        <CreatePresupuestoItems
          items={h.items} onAdd={h.addItem} onRemove={h.removeItem}
          categoriasPresupuesto={h.categorias} conceptosServicio={h.conceptos} moneda={h.form.moneda} />

        {/* Notes */}
        <hr className="border-[#E5E5E5]" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Notas tecnicas</label>
            <textarea value={h.form.notasTecnicas} onChange={e => h.setForm({ ...h.form, notasTecnicas: e.target.value })}
              rows={2} className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-xs" placeholder="Observaciones tecnicas..." />
          </div>
          <div>
            <label className={lbl}>Condiciones comerciales</label>
            <textarea value={h.form.condicionesComerciales} onChange={e => h.setForm({ ...h.form, condicionesComerciales: e.target.value })}
              rows={2} className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-xs" placeholder="Forma de pago, plazos..." />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E5E5] bg-[#F0F0F0] rounded-b-xl -mx-5 -mb-4 mt-3">
        <div className="text-xs font-mono text-slate-500">
          {h.items.length > 0 && <span>Items: <strong>{h.items.length}</strong> — Total: <strong className="text-teal-700">{sym} {totalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={h.handleClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={h.handleSave} disabled={h.saving || !h.form.clienteId || h.items.length === 0}>
            {h.saving ? 'Creando...' : 'Crear presupuesto'}
          </Button>
        </div>
      </div>
    </Modal>

    {h.showCrearLead && (
      <CrearLeadModal
        onClose={() => h.setShowCrearLead(false)}
        onCreated={async (leadId) => {
          h.setShowCrearLead(false);
          await h.reloadLeads(leadId);
        }}
        prefill={{
          clienteId: h.form.clienteId || undefined,
          sistemaId: h.form.sistemaId && h.form.sistemaId !== '__ALL_SISTEMAS__' ? h.form.sistemaId : undefined,
        }}
      />
    )}
    </>
  );
};
