import React from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { Presupuesto, TipoPresupuesto, MonedaPresupuesto, ContactoCliente, ContactoEstablecimiento, CondicionPago, UsuarioAGS } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';
import type { PresupuestoFormState } from '../../hooks/usePresupuestoEdit';

const estadoOptions = Object.entries(ESTADO_PRESUPUESTO_LABELS)
  .filter(([value]) => value !== 'anulado')
  .map(([value, label]) => ({ value, label }));

const tipoOptions = Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }));

const monedaOptions = [
  { value: 'USD', label: 'USD (U$S)' },
  { value: 'ARS', label: 'ARS ($)' },
  { value: 'EUR', label: 'EUR (€)' },
];

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';

interface Props {
  form: PresupuestoFormState;
  setField: (key: keyof PresupuestoFormState, value: any) => void;
  contactos: (ContactoCliente | ContactoEstablecimiento)[];
  condicionesPago: CondicionPago[];
  usuarios: UsuarioAGS[];
  onEstadoChange: (estado: Presupuesto['estado']) => void;
}

export const PresupuestoMetadataStrip: React.FC<Props> = ({
  form, setField, contactos, condicionesPago, usuarios, onEstadoChange,
}) => {
  return (
    <div className="bg-slate-50 -mx-5 px-5 py-3 mb-4 border-b border-slate-100 space-y-2">
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className={lbl}>Estado</label>
          {form.estado === 'anulado' ? (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS['anulado']} block w-fit mt-1`}>Anulado</span>
          ) : (
            <SearchableSelect value={form.estado} onChange={(v) => onEstadoChange(v as Presupuesto['estado'])} options={estadoOptions} size="sm" />
          )}
        </div>
        <div>
          <label className={lbl}>Tipo</label>
          <SearchableSelect value={form.tipo} onChange={(v) => setField('tipo', v as TipoPresupuesto)} options={tipoOptions} size="sm" />
        </div>
        <div>
          <label className={lbl}>Moneda</label>
          <SearchableSelect value={form.moneda} onChange={(v) => setField('moneda', v as MonedaPresupuesto)} options={monedaOptions} size="sm" />
        </div>
        <div>
          <label className={lbl}>Validez (días)</label>
          <input type="number" min="1" value={form.validezDias}
            onChange={e => setField('validezDias', Number(e.target.value) || 15)}
            className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
        </div>
        <div>
          <label className={lbl}>Tipo cambio</label>
          <input type="number" min="0" step="0.01" value={form.tipoCambio || ''}
            onChange={e => setField('tipoCambio', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="—" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className={lbl}>Contacto</label>
          {contactos.length > 0 ? (
            <SearchableSelect value={form.contactoId || ''} onChange={(v) => setField('contactoId', v || null)}
              options={[{ value: '', label: 'Sin contacto' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${'cargo' in c && c.cargo ? ` — ${c.cargo}` : ''}` }))]}
              size="sm" />
          ) : (
            <span className="text-xs text-slate-400 block py-1">—</span>
          )}
        </div>
        <div>
          <label className={lbl}>Condición pago</label>
          <SearchableSelect value={form.condicionPagoId || ''} onChange={(v) => setField('condicionPagoId', v || undefined)}
            options={[{ value: '', label: 'Sin condición' }, ...condicionesPago.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias}d)` : ''}` }))]}
            size="sm" />
        </div>
        <div>
          <label className={lbl}>Responsable</label>
          <SearchableSelect value={form.responsableId} onChange={(v) => {
            const usr = usuarios.find(u => u.id === v);
            setField('responsableId', v);
            setField('responsableNombre', usr?.displayName || '');
          }}
            options={[{ value: '', label: 'Sin asignar' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
            size="sm" />
        </div>
        <div>
          <label className={lbl}>Prox. contacto</label>
          <input type="date" value={form.proximoContacto} onChange={e => setField('proximoContacto', e.target.value)}
            className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
        </div>
        {form.origenTipo && (
          <div>
            <label className={lbl}>Origen</label>
            <span className="text-xs text-slate-600 block py-1">
              {ORIGEN_PRESUPUESTO_LABELS[form.origenTipo as keyof typeof ORIGEN_PRESUPUESTO_LABELS] || form.origenTipo}
              {form.origenRef ? ` — ${form.origenRef}` : ''}
            </span>
          </div>
        )}
      </div>
      {form.tipo === 'contrato' && (
        <div className="grid grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div className="col-span-5 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700/70">Vigencia del contrato</span>
          </div>
          <div>
            <label className={lbl}>Desde</label>
            <input type="date" value={form.contratoFechaInicio || ''}
              onChange={e => setField('contratoFechaInicio', e.target.value || null)}
              className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <div>
            <label className={lbl}>Hasta</label>
            <input type="date" value={form.contratoFechaFin || ''}
              onChange={e => setField('contratoFechaFin', e.target.value || null)}
              className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
        </div>
      )}
    </div>
  );
};
