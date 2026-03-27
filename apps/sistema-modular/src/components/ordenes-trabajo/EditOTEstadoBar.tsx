import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import type { EditOTFormState } from '../../hooks/useEditOTForm';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
};

interface Props {
  form: EditOTFormState;
  set: (key: string, value: any) => void;
  readOnly: boolean;
}

export const EditOTEstadoBar: React.FC<Props> = ({ form, set, readOnly }) => {
  const estadoColor = ESTADO_COLORS[form.estadoAdmin] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColor}`}>
        {OT_ESTADO_LABELS[form.estadoAdmin] ?? form.estadoAdmin}
      </span>
      {!readOnly && (
        <select
          value={form.estadoAdmin}
          onChange={e => set('estadoAdmin', e.target.value)}
          className="border rounded-lg px-2 py-0.5 text-xs text-slate-600 border-slate-300"
        >
          {OT_ESTADO_ORDER.map(e => (
            <option key={e} value={e}>{OT_ESTADO_LABELS[e]}</option>
          ))}
        </select>
      )}
      <div className="flex-1" />
      <div className="flex flex-wrap gap-x-3">
        {([
          ['esFacturable', form.esFacturable, 'Facturable'],
          ['tieneContrato', form.tieneContrato, 'Contrato'],
          ['esGarantia', form.esGarantia, 'Garantía'],
        ] as const).map(([field, checked, text]) => (
          <label key={field} className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={checked}
              onChange={e => set(field, e.target.checked)}
              disabled={readOnly} className="w-3 h-3" />
            <span className="text-[10px] text-slate-600">{text}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
