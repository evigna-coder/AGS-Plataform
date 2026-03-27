import { SearchableSelect } from '../ui/SearchableSelect';
import type { TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto, CondicionPago } from '@ags/shared';
import { TIPO_PRESUPUESTO_LABELS, MONEDA_PRESUPUESTO_LABELS, ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';
import type { PresupuestoFormState } from '../../hooks/useCreatePresupuestoForm';

const TIPOS = Object.entries(TIPO_PRESUPUESTO_LABELS) as [TipoPresupuesto, string][];
const MONEDAS = Object.entries(MONEDA_PRESUPUESTO_LABELS) as [MonedaPresupuesto, string][];
const ORIGENES = Object.entries(ORIGEN_PRESUPUESTO_LABELS) as [OrigenPresupuesto, string][];

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";

interface Props {
  form: PresupuestoFormState;
  setForm: React.Dispatch<React.SetStateAction<PresupuestoFormState>>;
  condiciones: CondicionPago[];
  leadOptions: { value: string; label: string }[];
  otOptions: { value: string; label: string }[];
  onShowCrearLead: () => void;
}

export const PresupuestoFormHeader: React.FC<Props> = ({ form, setForm, condiciones, leadOptions, otOptions, onShowCrearLead }) => (
  <>
    <div className="grid grid-cols-[1fr_1fr_1fr_70px_70px_1.5fr] gap-2.5">
      <div>
        <label className={lbl}>Tipo *</label>
        <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.tipo} onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value as TipoPresupuesto }))}>
          {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Moneda</label>
        <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.moneda} onChange={e => setForm(prev => ({ ...prev, moneda: e.target.value as MonedaPresupuesto }))}>
          {MONEDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Origen</label>
        <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.origenTipo} onChange={e => setForm(prev => ({ ...prev, origenTipo: e.target.value as OrigenPresupuesto | '', origenId: '', origenRef: '' }))}>
          <option value="">Sin origen</option>
          {ORIGENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Validez</label>
        <input type="number" min="1" value={form.validezDias} onChange={e => setForm(prev => ({ ...prev, validezDias: Number(e.target.value) || 15 }))} className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs text-center" />
      </div>
      <div>
        <label className={lbl}>T. Cambio</label>
        <input type="number" min="0" step="0.01" value={form.tipoCambio} onChange={e => setForm(prev => ({ ...prev, tipoCambio: e.target.value }))} className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs text-center" placeholder="1.0" />
      </div>
      <div>
        <label className={lbl}>Condicion de pago</label>
        <SearchableSelect value={form.condicionPagoId} onChange={v => setForm(prev => ({ ...prev, condicionPagoId: v }))}
          options={[{ value: '', label: 'Sin condicion' }, ...condiciones.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias} dias)` : ''}` }))]}
          placeholder="Seleccionar..." />
      </div>
    </div>

    {/* Origen detail */}
    {form.origenTipo === 'lead' && (
      <div className="flex items-end gap-2">
        <div className="flex-1 max-w-xs">
          <label className={lbl}>Lead</label>
          <SearchableSelect value={form.origenId} onChange={v => setForm(prev => ({ ...prev, origenId: v }))} options={leadOptions} placeholder="Seleccionar lead..." />
        </div>
        <button type="button" onClick={onShowCrearLead}
          className="px-2.5 py-1.5 text-xs font-medium text-teal-600 border border-teal-300 rounded-md hover:bg-teal-50 whitespace-nowrap">
          + Crear Lead
        </button>
      </div>
    )}
    {form.origenTipo === 'ot' && (
      <div className="max-w-xs"><label className={lbl}>OT</label><SearchableSelect value={form.origenId} onChange={v => setForm(prev => ({ ...prev, origenId: v }))} options={otOptions} placeholder="Seleccionar OT..." /></div>
    )}
    {form.origenTipo === 'requerimiento_compra' && (
      <div className="max-w-xs"><label className={lbl}>Referencia</label><input className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.origenRef} onChange={e => setForm(prev => ({ ...prev, origenRef: e.target.value }))} placeholder="Ej: SC-74001" /></div>
    )}
  </>
);
