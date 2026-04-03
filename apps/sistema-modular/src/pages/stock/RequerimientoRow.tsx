import type { RequerimientoCompra, UrgenciaRequerimiento } from '@ags/shared';
import { ESTADO_REQUERIMIENTO_COLORS, ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';
import type { EditingCell } from '../../hooks/useRequerimientoInlineEdit';
import { SortableHeader } from '../../components/ui/SortableHeader';

const ORIGEN_COLORS: Record<string, string> = {
  manual: 'bg-slate-100 text-slate-600',
  presupuesto: 'bg-teal-50 text-teal-700',
  stock_minimo: 'bg-amber-50 text-amber-700',
  ingeniero: 'bg-blue-50 text-blue-700',
};
export const URGENCIA_COLORS: Record<UrgenciaRequerimiento, string> = {
  baja: 'bg-slate-100 text-slate-500',
  media: 'bg-blue-50 text-blue-700',
  alta: 'bg-amber-50 text-amber-700',
  critica: 'bg-red-100 text-red-700',
};
export const URGENCIA_LABELS: Record<UrgenciaRequerimiento, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica',
};

export interface RequerimientoRowProps {
  r: RequerimientoCompra;
  selected: boolean;
  onToggle: () => void;
  editingCell: EditingCell | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (req: RequerimientoCompra, field: 'cantidad' | 'urgencia' | 'proveedorSugeridoId') => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  onAprobar: (id: string) => void;
  onDelete: (id: string) => void;
  formatDate: (d?: string | null) => string;
}

export const RequerimientoRow = ({
  r, selected, onToggle, editingCell, editValue, setEditValue,
  startEdit, cancelEdit, saveEdit, onAprobar, onDelete, formatDate,
}: RequerimientoRowProps) => {
  const isPendiente = r.estado === 'pendiente';
  const isEditingCantidad = editingCell?.id === r.id && editingCell.field === 'cantidad';
  const isEditingUrgencia = editingCell?.id === r.id && editingCell.field === 'urgencia';
  const isEditingProveedor = editingCell?.id === r.id && editingCell.field === 'proveedorSugeridoId';

  return (
    <tr className={`hover:bg-slate-50 ${selected ? 'bg-teal-50' : ''}`}>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-4 py-2">
        <span className="font-mono text-xs font-semibold text-teal-600">{r.numero}</span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-900">{r.articuloDescripcion}</td>
      <td className="px-3 py-2 text-xs text-right whitespace-nowrap" onClick={() => isPendiente && startEdit(r, 'cantidad')}>
        {isEditingCantidad ? (
          <input type="number" min={1} value={editValue} onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            autoFocus className="border-b border-teal-400 focus:outline-none bg-transparent text-xs w-16 text-right" />
        ) : (
          <span className={isPendiente ? 'cursor-pointer hover:text-teal-700' : ''}>{r.cantidad} {r.unidadMedida}</span>
        )}
      </td>
      <td className="px-4 py-2">
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ORIGEN_COLORS[r.origen] ?? ''}`}>
          {ORIGEN_REQUERIMIENTO_LABELS[r.origen]}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_REQUERIMIENTO_COLORS[r.estado]}`}>
          {ESTADO_REQUERIMIENTO_LABELS[r.estado]}
        </span>
      </td>
      <td className="px-4 py-2" onClick={() => isPendiente && startEdit(r, 'urgencia')}>
        {isEditingUrgencia ? (
          <select value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} autoFocus
            className="border-b border-teal-400 focus:outline-none bg-transparent text-xs">
            {(['baja', 'media', 'alta', 'critica'] as UrgenciaRequerimiento[]).map(u => (
              <option key={u} value={u}>{URGENCIA_LABELS[u]}</option>
            ))}
          </select>
        ) : r.urgencia ? (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isPendiente ? 'cursor-pointer' : ''} ${URGENCIA_COLORS[r.urgencia]}`}>
            {URGENCIA_LABELS[r.urgencia]}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[140px]" onClick={() => isPendiente && startEdit(r, 'proveedorSugeridoId')}>
        {isEditingProveedor ? (
          <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            autoFocus placeholder="Nombre proveedor" className="border-b border-teal-400 focus:outline-none bg-transparent text-xs w-full" />
        ) : (
          <span className={isPendiente ? 'cursor-pointer hover:text-teal-700' : ''}>
            {r.proveedorSugeridoNombre ?? <span className="text-slate-300">—</span>}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-slate-900">{r.solicitadoPor}</td>
      <td className="px-4 py-2 text-xs text-slate-600">{formatDate(r.fechaSolicitud)}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {r.estado === 'pendiente' && (
            <button onClick={() => onAprobar(r.id)} className="text-xs text-green-600 hover:underline font-medium">Aprobar</button>
          )}
          <button className="text-xs text-teal-600 hover:underline font-medium">Ver</button>
          {r.estado === 'pendiente' && (
            <button onClick={() => onDelete(r.id)} className="text-xs text-red-500 hover:underline font-medium">Eliminar</button>
          )}
        </div>
      </td>
    </tr>
  );
};

export { SortableHeader };
