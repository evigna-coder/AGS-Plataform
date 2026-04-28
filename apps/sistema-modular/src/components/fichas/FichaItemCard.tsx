import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { FichaFotosSection } from './FichaFotosSection';
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
  /** Permite eliminar el item (solo si la ficha no está cerrada). */
  canDelete?: boolean;
  onUpdate: () => void;
}

/** Card por item — agrupa identificación, estado, fotos, derivaciones e historial. */
export function FichaItemCard({ ficha, item, canDelete, onUpdate }: Props) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);

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

  const handleDelete = async () => {
    if (!await confirm(`Eliminar item ${item.subId}?`)) return;
    await fichasService.removeItem(ficha.id, item.id);
    onUpdate();
  };

  const readOnlyFotos = item.estado === 'entregado';

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-teal-700">{item.subId}</span>
            <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${ESTADO_FICHA_COLORS[item.estado]}`}>
              {ESTADO_FICHA_LABELS[item.estado]}
            </span>
            {parent && (
              <span className="text-[10px] text-slate-500 italic">
                desarmado de {parent.subId}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-800 mt-1 truncate">
            {titulo}
            {codigo && <span className="text-slate-500 font-mono"> · {codigo}</span>}
            {serie && <span className="text-slate-400 font-mono"> · S/N {serie}</span>}
          </p>
          {item.descripcionProblema && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
              <span className="font-medium">Problema: </span>{item.descripcionProblema}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <FichaStatusTransition currentEstado={item.estado} onTransition={handleTransition} />
          <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Ocultar' : 'Detalle'}
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500">×</Button>
          )}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <FichaFotosSection
            ficha={ficha}
            item={item}
            readOnly={readOnlyFotos}
            onUpdate={onUpdate}
          />
          <FichaDerivacionSection ficha={ficha} item={item} onUpdate={onUpdate} />
          {item.historial.length > 0 && <FichaHistorialSection historial={item.historial} />}
        </div>
      )}
    </Card>
  );
}
