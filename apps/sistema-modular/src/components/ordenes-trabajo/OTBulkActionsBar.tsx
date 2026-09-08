import type { OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import { Button } from '../ui/Button';

import { Select } from '../ui/Select';
interface Props {
  count: number;
  onChangeEstado: (estado: OTEstadoAdmin) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Barra de acciones bulk visible cuando hay OTs seleccionadas. */
export const OTBulkActionsBar: React.FC<Props> = ({ count, onChangeEstado, onDelete, onClear }) => {
  if (count === 0) return null;
  return (
    <div className="px-5 pb-2 flex items-center gap-3">
      <span className="text-xs text-slate-500 font-medium">{count} seleccionadas</span>
      <Select
        defaultValue=""
        onChange={e => { if (e.target.value) onChangeEstado(e.target.value as OTEstadoAdmin); e.target.value = ''; }}
      >
        <option value="" disabled>Cambiar estado a...</option>
        {OT_ESTADO_ORDER.map(e => <option key={e} value={e}>{OT_ESTADO_LABELS[e]}</option>)}
      </Select>
      <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 border-red-300 hover:bg-red-50">
        Eliminar seleccionadas
      </Button>
      <button onClick={onClear} className="text-xs text-slate-400 hover:underline">Deseleccionar</button>
    </div>
  );
};
