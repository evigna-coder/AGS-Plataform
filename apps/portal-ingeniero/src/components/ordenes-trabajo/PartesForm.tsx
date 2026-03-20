import type { Part } from '@ags/shared';
import { Button } from '../ui/Button';

interface PartesFormProps {
  parts: Part[];
  readOnly?: boolean;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Part, value: string | number) => void;
  onRemove: (id: string) => void;
}

const inp = 'border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400';

export function PartesForm({ parts, readOnly = false, onAdd, onUpdate, onRemove }: PartesFormProps) {
  return (
    <div className="space-y-3">
      {parts.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin partes/repuestos registrados</p>
      ) : (
        <div className="space-y-2">
          {parts.map(p => (
            <div key={p.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Código</p>
                  <input
                    className={`${inp} w-full`}
                    value={p.codigo}
                    onChange={e => onUpdate(p.id, 'codigo', e.target.value)}
                    disabled={readOnly}
                    placeholder="COD-001"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Cantidad</p>
                  <input
                    type="number"
                    min={1}
                    className={`${inp} w-full`}
                    value={p.cantidad}
                    onChange={e => onUpdate(p.id, 'cantidad', Number(e.target.value))}
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5">Descripción</p>
                <input
                  className={`${inp} w-full`}
                  value={p.descripcion}
                  onChange={e => onUpdate(p.id, 'descripcion', e.target.value)}
                  disabled={readOnly}
                  placeholder="Descripción del repuesto"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400 mb-0.5">Origen</p>
                  <input
                    className={`${inp} w-full`}
                    value={p.origen}
                    onChange={e => onUpdate(p.id, 'origen', e.target.value)}
                    disabled={readOnly}
                    placeholder="AGS / Cliente"
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="mt-4 text-red-400 hover:text-red-600 p-1"
                    aria-label="Eliminar parte"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <Button variant="secondary" size="sm" onClick={onAdd} className="w-full">
          + Agregar parte / repuesto
        </Button>
      )}
    </div>
  );
}
