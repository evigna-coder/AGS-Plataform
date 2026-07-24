import type { Presentacion } from '@ags/shared';

interface Props {
  presentaciones: Presentacion[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<Presentacion>) => void;
  onRemove: (idx: number) => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const inputCls = 'w-full border border-[#E5E5E5] rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';
const section = 'text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest';

/**
 * Presentaciones de compra/venta del artículo: otros N° de parte del MISMO artículo (mismo pool de
 * stock en unidad base), cada uno con su factor. Ver plan presentaciones-de-compra. El código base
 * del artículo es la unidad base (factor 1 implícito); acá se cargan las presentaciones adicionales.
 */
export const PresentacionesSection: React.FC<Props> = ({ presentaciones, onAdd, onUpdate, onRemove }) => (
  <div className="space-y-2">
    <p className={section}>Presentaciones (N° de parte)</p>
    <p className="text-[10px] text-slate-400">
      Otros N° de parte del mismo artículo. <span className="font-mono">Factor</span> = unidades base por 1 de esa presentación
      (ej. kit ×10, caja ×100). Mismo pool de stock.
    </p>

    {presentaciones.length > 0 && (
      <div className="space-y-1.5">
        {presentaciones.map((p, idx) => (
          <div key={idx} className="grid grid-cols-[1.2fr_1.6fr_0.7fr_auto] gap-2 items-end">
            <div>
              {idx === 0 && <label className={lbl}>N° de parte</label>}
              <input value={p.codigoParte} onChange={e => onUpdate(idx, { codigoParte: e.target.value })}
                placeholder="5190-2209" className={`${inputCls} font-mono`} />
            </div>
            <div>
              {idx === 0 && <label className={lbl}>Descripción</label>}
              <input value={p.descripcion ?? ''} onChange={e => onUpdate(idx, { descripcion: e.target.value })}
                placeholder="Kit ×10" className={inputCls} />
            </div>
            <div>
              {idx === 0 && <label className={lbl}>Factor</label>}
              <input type="number" min={1} value={String(p.factor ?? '')}
                onFocus={e => e.currentTarget.select()}
                onChange={e => onUpdate(idx, { factor: Number(e.target.value) || 0 })}
                className={`${inputCls} text-right tabular-nums`} />
            </div>
            <button type="button" onClick={() => onRemove(idx)}
              className="text-slate-300 hover:text-red-500 text-base leading-none px-1 pb-1" title="Quitar">×</button>
          </div>
        ))}
      </div>
    )}

    <button type="button" onClick={onAdd}
      className="text-[11px] font-medium text-teal-600 hover:text-teal-800">
      + Agregar presentación
    </button>
  </div>
);
