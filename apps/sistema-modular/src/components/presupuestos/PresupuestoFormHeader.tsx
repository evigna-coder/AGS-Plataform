import { SearchableSelect } from '../ui/SearchableSelect';
import { BnaTipoCambioHint } from './BnaTipoCambioHint';
import type { TipoPresupuesto, MonedaPresupuesto, OrigenPresupuesto, CondicionPago, MonedaCuota } from '@ags/shared';
import { MonedasMixtaPicker } from './MonedasMixtaPicker';
import { TIPO_PRESUPUESTO_LABELS, TIPOS_PRESUPUESTO_ACTIVOS, MONEDA_PRESUPUESTO_LABELS, ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';
import type { PresupuestoFormState } from '../../hooks/useCreatePresupuestoForm';

// Creación: solo tipos activos (mixto es legado, no seleccionable).
const TIPOS = TIPOS_PRESUPUESTO_ACTIVOS.map(t => [t, TIPO_PRESUPUESTO_LABELS[t]]) as [TipoPresupuesto, string][];
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
        {/* Numeración P1–P5: 'partes' es el único tipo ambiguo — P2 (partes para un
            servicio) vs P3 (venta de insumos). El resto se deriva solo. */}
        {form.tipo === 'partes' && (
          <select
            className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1 text-[11px] mt-1 text-slate-600"
            value={form.destinoPartes}
            onChange={e => setForm(prev => ({ ...prev, destinoPartes: e.target.value as 'servicio' | 'venta' }))}
            title="Define la categoría del número: P2 (partes en servicio) o P3 (venta de insumos)"
          >
            <option value="servicio">Para servicio (P2)</option>
            <option value="venta">Venta de insumos (P3)</option>
          </select>
        )}
      </div>
      <div>
        <label className={lbl}>Moneda</label>
        <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs" value={form.moneda} onChange={e => setForm(prev => ({ ...prev, moneda: e.target.value as MonedaPresupuesto }))}>
          {MONEDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {/* Contrato mixto (2026-09-04): qué monedas entran. Cada ítem lleva una
            porción en cada una, en la misma línea. */}
        {form.tipo === 'contrato' && form.moneda === 'MIXTA' && (
          <MonedasMixtaPicker value={form.monedasMixta} onChange={(v: MonedaCuota[]) => setForm(prev => ({ ...prev, monedasMixta: v }))} />
        )}
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
        <input type="number" min="0" step="any" value={form.tipoCambio} onChange={e => setForm(prev => ({ ...prev, tipoCambio: e.target.value }))} className="w-full border border-[#E5E5E5] rounded-md px-2 py-1.5 text-xs text-center" placeholder="1.0" />
        <BnaTipoCambioHint
          current={Number(form.tipoCambio) || undefined}
          onApply={v => setForm(prev => ({ ...prev, tipoCambio: String(v) }))}
          autoFillIfEmpty
        />
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
