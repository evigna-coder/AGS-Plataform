import { useMemo } from 'react';
import type { UnidadStock } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

/** Una unidad de stock propia elegida para mandar al proveedor. */
export interface UnidadSalida {
  unidadId: string;
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  serie?: string | null;
  cantidad: number;
  /** Qué le van a hacer — sale impreso en la descripción de la línea. */
  motivo: string;
}

interface Props {
  unidades: UnidadStock[];
  seleccionadas: UnidadSalida[];
  onAdd: (unidadId: string) => void;
  onUpdate: (unidadId: string, patch: Partial<UnidadSalida>) => void;
  onRemove: (unidadId: string) => void;
}

const inp = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400';

/**
 * Partes PROPIAS de stock que se mandan al proveedor a que les hagan un trabajo
 * y vuelven (2026-08-07). A diferencia de las fichas (equipos de cliente) y los
 * loaners, acá la unidad sale del depósito: queda en tránsito en el proveedor,
 * pendiente de retorno, sin dejar de ser patrimonio de AGS.
 */
export function RemitoStockPicker({ unidades, seleccionadas, onAdd, onUpdate, onRemove }: Props) {
  const opciones = useMemo(() => {
    const usadas = new Set(seleccionadas.map(s => s.unidadId));
    return unidades
      .filter(u => !usadas.has(u.id))
      .map(u => ({
        value: u.id,
        label: `${u.articuloCodigo} — ${u.articuloDescripcion}${u.nroSerie ? ` · S/N ${u.nroSerie}` : ''}${u.nroLote ? ` · Lote ${u.nroLote}` : ''} (${u.ubicacion?.referenciaNombre || 'sin ubicación'})`,
        linkedCode: u.articuloCodigo ?? undefined,
      }));
  }, [unidades, seleccionadas]);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1">
          Partes de stock (AGS){' '}
          <span className="text-slate-300 normal-case font-sans">— salen del depósito y quedan pendientes de retorno</span>
        </label>
        <SearchableSelect
          value=""
          onChange={v => { if (v) onAdd(v); }}
          options={opciones}
          placeholder="Buscar artículo en stock..."
        />
      </div>

      {seleccionadas.length > 0 && (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {seleccionadas.map(s => (
            <div key={s.unidadId} className="p-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-teal-800">{s.articuloCodigo || 'S/C'}</p>
                <p className="text-xs text-slate-600 truncate">
                  {s.articuloDescripcion}{s.serie ? ` · S/N ${s.serie}` : ''}
                </p>
                <input
                  value={s.motivo}
                  onChange={e => onUpdate(s.unidadId, { motivo: e.target.value })}
                  placeholder="Trabajo a realizar (ej. reparación de placa)"
                  className={`${inp} mt-1`}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.unidadId)}
                className="text-[11px] text-slate-400 hover:text-red-600 px-1"
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
