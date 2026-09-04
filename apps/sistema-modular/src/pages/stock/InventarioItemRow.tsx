import { Link } from 'react-router-dom';
import { descripcionItemAsignacion, codigoItemAsignacion } from '../../utils/itemAsignacionLabel';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';

interface Props {
  item: InventarioItem;
  /** N° de serie de la pieza — sin esto dos unidades del mismo artículo son
   *  indistinguibles al momento de devolver (2026-08-14). */
  serie?: string | null;
  saving: boolean;
  /** Selección múltiple para devolver en lote (2026-08-11). */
  selected?: boolean;
  onToggleSelect?: () => void;
  onDevolver: (item: InventarioItem) => void;
  onConsumir: (item: InventarioItem) => void;
  onReasignarCliente: () => void;
  onTransferir: () => void;
}

export const InventarioItemRow = ({ item, serie, saving, selected, onToggleSelect, onDevolver, onConsumir, onReasignarCliente, onTransferir }: Props) => {
  const codigo = codigoItemAsignacion(item);
  const desc = descripcionItemAsignacion(item);
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
  const canAct = remaining > 0;

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${selected ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onToggleSelect && canAct && (
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            className="w-3.5 h-3.5 accent-teal-600 shrink-0" />
        )}
        <span className="font-mono text-[11px] text-teal-700 font-semibold shrink-0">{codigo}</span>
        <span className="text-xs text-slate-700 truncate">{desc}</span>
        {/* La serie NO se trunca ni se abrevia: es el dato con el que se
            identifica la pieza al devolverla (2026-08-14). */}
        {serie && (
          <span className="font-mono text-[10px] text-slate-700 bg-white border border-slate-300 px-1 py-0.5 rounded shrink-0"
            title={`N° de serie ${serie}`}>
            S/N {serie}
          </span>
        )}
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded shrink-0">{item.tipo}</span>
        {item.permanente && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded shrink-0">Perm</span>}
        {item.clienteNombre && <span className="text-[10px] text-slate-400 shrink-0">→ {item.clienteNombre}</span>}
        <Link to={`/stock/asignaciones/${item.asignacionId}`} className="text-teal-500 hover:underline font-mono text-[10px] shrink-0 ml-auto">
          {item.asignacionNumero}
        </Link>
      </div>
      {canAct && (
        <div className="flex gap-1 shrink-0 ml-3 items-center">
          <ActionBtn label="Devolver" onClick={() => onDevolver(item)} disabled={saving} />
          {!item.permanente && <ActionBtn label="Consumir" onClick={() => onConsumir(item)} disabled={saving} />}
          <ActionBtn label="Cliente" onClick={onReasignarCliente} disabled={saving} />
          <ActionBtn label="Transferir" onClick={onTransferir} disabled={saving} />
          {item.tipo === 'minikit' && item.minikitId && (
            // Fix I5 (auditoría de stock): la reposición inline creaba un
            // MovimientoStock sin mover existencias (y sin poder identificar
            // artículo/unidad). La reposición real se hace desde el detalle del
            // minikit, cuyo modal aplica el efecto vía movimientosAplicar.
            <Link to={`/stock/minikits/${item.minikitId}`}
              className="px-2 py-0.5 text-[10px] font-medium rounded border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">
              Reponer
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

const ActionBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) => (
  <button onClick={onClick} disabled={disabled}
    className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors">
    {label}
  </button>
);
