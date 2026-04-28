import { useState } from 'react';
import { FichaDerivacionSection } from './FichaDerivacionSection';
import { FichaHistorialSection } from './FichaHistorialSection';
import { FichaStatusTransition } from './FichaStatusTransition';
import { useConfirm } from '../ui/ConfirmDialog';
import { fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, ItemFicha, EstadoFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  item: ItemFicha;
  canDelete?: boolean;
  defaultExpanded?: boolean;
  onUpdate: () => void;
}

/**
 * Card compacto por item — header siempre visible, click en chevron para expandir
 * el detalle (derivaciones + historial). Las fotos viven a nivel ficha (no acá).
 */
export function FichaItemCard({ ficha, item, canDelete, defaultExpanded = false, onUpdate }: Props) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const titulo = item.articuloDescripcion || item.descripcionLibre || 'Item sin descripción';
  const codigo = item.articuloCodigo;
  const serie = item.serie;
  const parent = item.parentItemId
    ? ficha.items.find(i => i.id === item.parentItemId)
    : null;

  const handleTransition = async (nuevoEstado: EstadoFicha, nota: string) => {
    await fichasService.transitionItem(ficha.id, item.id, nuevoEstado, nota);
    onUpdate();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!await confirm(`Eliminar item ${item.subId}?`)) return;
    await fichasService.removeItem(ficha.id, item.id);
    onUpdate();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header — clickeable para expandir/colapsar */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 flex items-start gap-2.5"
      >
        <svg
          className={`w-3 h-3 text-slate-400 mt-1.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-teal-700">{item.subId}</span>
            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[item.estado]}`}>
              {ESTADO_FICHA_LABELS[item.estado]}
            </span>
            {parent && (
              <span className="text-[10px] text-slate-500 italic">
                de {parent.subId}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-800 mt-0.5 truncate">
            {titulo}
            {codigo && <span className="text-slate-500 font-mono"> · {codigo}</span>}
            {serie && <span className="text-slate-400 font-mono"> · S/N {serie}</span>}
          </p>
          {!expanded && item.descripcionProblema && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {item.descripcionProblema}
            </p>
          )}
        </div>
        {canDelete && (
          <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-lg leading-none px-1 shrink-0">×</button>
        )}
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-slate-100 bg-slate-50/50">
          {item.descripcionProblema && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono">Problema reportado</p>
              <p className="text-xs text-slate-700 mt-0.5">{item.descripcionProblema}</p>
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <FichaStatusTransition currentEstado={item.estado} onTransition={handleTransition} />
          </div>
          <FichaDerivacionSection ficha={ficha} item={item} onUpdate={onUpdate} />
          {item.historial.length > 0 && (
            <FichaHistorialSection historial={item.historial} />
          )}
        </div>
      )}
    </div>
  );
}
