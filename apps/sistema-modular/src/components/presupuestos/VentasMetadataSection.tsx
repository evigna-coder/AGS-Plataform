import type { VentasMetadata } from '@ags/shared';

interface Props {
  value: VentasMetadata | null | undefined;
  onChange: (patch: Partial<VentasMetadata>) => void;
}

/**
 * Sección de metadatos de entrega e instalación para presupuestos tipo 'ventas'.
 * Campos: fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento.
 * Labels monospace uppercase tracking-wide text-[10px] (Editorial Teal convention).
 */
export const VentasMetadataSection: React.FC<Props> = ({ value, onChange }) => {
  const v = value || {};
  return (
    <div className="border border-teal-200 bg-teal-50/40 rounded-lg p-3 my-3">
      <h4 className="text-[10px] font-mono uppercase tracking-wide text-teal-800 font-semibold mb-2">
        Datos de entrega e instalación
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5 block">
            Fecha estimada de entrega
          </label>
          <input
            type="date"
            value={v.fechaEstimadaEntrega || ''}
            onChange={e => onChange({ fechaEstimadaEntrega: e.target.value || null })}
            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5 block">
            Lugar de instalación
          </label>
          <input
            type="text"
            value={v.lugarInstalacion || ''}
            onChange={e => onChange({ lugarInstalacion: e.target.value || null })}
            placeholder="Dirección libre"
            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!v.requiereEntrenamiento}
          onChange={e => onChange({ requiereEntrenamiento: e.target.checked })}
          className="w-3.5 h-3.5 text-teal-600 rounded"
        />
        <span className="text-xs text-slate-700">Requiere entrenamiento post-instalación</span>
      </label>
    </div>
  );
};
