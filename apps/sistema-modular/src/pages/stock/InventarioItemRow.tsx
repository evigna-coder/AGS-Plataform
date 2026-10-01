import { Link } from 'react-router-dom';
import type { TipoItemAsignacion } from '@ags/shared';
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

/** Nombre y color por tipo (2026-10-01): se reconoce de un vistazo qué es cada renglón. */
export const TIPO_ITEM: Record<TipoItemAsignacion, { label: string; chip: string; orden: number }> = {
  minikit:     { label: 'Minikit',     chip: 'bg-violet-50 text-violet-700 border-violet-200', orden: 0 },
  articulo:    { label: 'Artículo',    chip: 'bg-slate-100 text-slate-600 border-slate-200',  orden: 1 },
  instrumento: { label: 'Instrumento', chip: 'bg-amber-50 text-amber-700 border-amber-200',   orden: 2 },
  patron:      { label: 'Patrón',      chip: 'bg-sky-50 text-sky-700 border-sky-200',         orden: 3 },
  columna:     { label: 'Columna',     chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', orden: 4 },
  dispositivo: { label: 'Dispositivo', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', orden: 5 },
  loaner:      { label: 'Loaner',      chip: 'bg-rose-50 text-rose-700 border-rose-200',      orden: 6 },
  vehiculo:    { label: 'Vehículo',    chip: 'bg-orange-50 text-orange-700 border-orange-200', orden: 7 },
};

const diasDesde = (iso: string | null | undefined): number | null => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

/**
 * Renglón del inventario de un ingeniero (rediseño 2026-10-01): arriba qué es
 * (código, nombre completo sin cortar, serie); abajo el contexto (tipo,
 * cliente, OT, cuánto hace que lo tiene, asignación). "Devolver" es la acción
 * principal; el resto queda más liviano para que la fila no sea una pared de
 * botones iguales.
 */
export const InventarioItemRow = ({ item, serie, saving, selected, onToggleSelect, onDevolver, onConsumir, onReasignarCliente, onTransferir }: Props) => {
  const codigo = codigoItemAsignacion(item);
  const desc = descripcionItemAsignacion(item);
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
  const canAct = remaining > 0;
  const tipo = TIPO_ITEM[item.tipo] ?? TIPO_ITEM.articulo;
  const dias = diasDesde(item.fechaAsignacion);

  return (
    <div className={`group flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
      selected ? 'bg-teal-50 border-teal-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
      {onToggleSelect && canAct ? (
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
          className="mt-1 w-3.5 h-3.5 accent-teal-600 shrink-0" />
      ) : <span className="w-3.5 shrink-0" />}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-teal-700 font-semibold">{codigo}</span>
          <span className="text-xs text-slate-800 leading-snug">{desc}</span>
          {/* La serie NO se trunca ni se abrevia: es el dato con el que se
              identifica la pieza al devolverla (2026-08-14). */}
          {serie && (
            <span className="font-mono text-[10px] text-slate-700 bg-slate-50 border border-slate-300 px-1 py-px rounded"
              title={`N° de serie ${serie}`}>S/N {serie}</span>
          )}
          {item.cantidad > 1 && (
            <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
              × {remaining}{remaining !== item.cantidad ? ` de ${item.cantidad}` : ''}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
          <span className={`px-1.5 py-px rounded border font-medium ${tipo.chip}`}>{tipo.label}</span>
          {item.permanente && <span className="px-1.5 py-px rounded border border-purple-200 bg-purple-50 text-purple-700 font-medium">Permanente</span>}
          {item.clienteNombre && <span className="truncate max-w-[260px]" title={item.clienteNombre}>para <span className="text-slate-700">{item.clienteNombre}</span></span>}
          {item.otNumber && <span>OT <span className="font-mono text-slate-700">{item.otNumber}</span></span>}
          {dias != null && (
            <span className={dias > 60 ? 'text-amber-700' : ''} title={`Asignado el ${new Date(item.fechaAsignacion).toLocaleDateString('es-AR')}`}>
              {dias === 0 ? 'desde hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`}
            </span>
          )}
          <Link to={`/stock/asignaciones/${item.asignacionId}`} className="text-teal-600 hover:underline font-mono">
            {item.asignacionNumero}
          </Link>
        </div>
      </div>

      {canAct && (
        <div className="flex gap-1 shrink-0 items-center self-center">
          <button onClick={() => onDevolver(item)} disabled={saving}
            className="px-2.5 py-1 text-[10px] font-semibold rounded border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-40 transition-colors">
            Devolver
          </button>
          {!item.permanente && <ActionBtn label="Consumir" onClick={() => onConsumir(item)} disabled={saving} />}
          <ActionBtn label="Cliente" onClick={onReasignarCliente} disabled={saving} />
          <ActionBtn label="Transferir" onClick={onTransferir} disabled={saving} />
          {item.tipo === 'minikit' && item.minikitId && (
            // Fix I5 (auditoría de stock): la reposición real se hace desde el
            // detalle del minikit, cuyo modal aplica el efecto vía movimientosAplicar.
            <Link to={`/stock/minikits/${item.minikitId}`}
              className="px-2 py-1 text-[10px] font-medium rounded text-violet-700 hover:bg-violet-50 transition-colors">
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
    className="px-2 py-1 text-[10px] font-medium rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors">
    {label}
  </button>
);
