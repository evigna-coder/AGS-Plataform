import { SearchableSelect } from '../ui/SearchableSelect';

/** Drop-zone de un ingeniero en el modal de asignar (colapsada sin items). */
export const IngenieroDropZone = ({ nombre, count, isOver, clienteId, clienteOpts, onClienteChange,
  onDrop, onDragOver, onDragLeave, items, onRemove, onTogglePerm, onCantidad, expanded, onNameClick, onOpenDetalle, inline }: {
  nombre: string; count: number; isOver: boolean;
  clienteId: string; clienteOpts: { value: string; label: string }[];
  onClienteChange: (val: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  items: { id: string; codigo: string; label: string; tipo: string; permanente: boolean; cantidad: number; cantidadMax?: number }[];
  onRemove: (id: string) => void;
  onTogglePerm: (id: string, val: boolean) => void;
  /** Patrones: elegir cuántas unidades del lote se lleva. */
  onCantidad: (id: string, val: number) => void;
  /** Vista rápida inline desplegada. */
  expanded: boolean;
  onNameClick: () => void;
  onOpenDetalle: () => void;
  inline: React.ReactNode;
}) => (
  <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
    className={`rounded-md border transition-all ${
      isOver
        ? 'border-dashed border-amber-400 bg-amber-50 shadow-lg ring-2 ring-amber-200 scale-[1.01]'
        : count > 0
          ? 'border-amber-200 bg-amber-50'
          : 'border-amber-200 bg-amber-50 hover:border-amber-300'
    }`}>
    {/* Header — click en el nombre = vista rápida inline */}
    <div className={`flex items-center justify-between gap-2 px-4 ${count > 0 || expanded ? 'py-3' : 'py-7'}`}>
      <button onClick={onNameClick} title="Ver qué tiene asignado (vista rápida)"
        className={`flex items-center gap-1.5 text-sm font-semibold truncate text-left min-w-0 ${count > 0 ? 'text-amber-900 hover:text-amber-700' : 'text-slate-600 hover:text-amber-700'}`}>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="truncate">{nombre}</span>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {expanded && (
          <button onClick={onOpenDetalle}
            className="text-[10px] font-medium text-teal-700 hover:underline">
            Detalle ↗
          </button>
        )}
        {count > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-amber-500 text-white text-[10px] font-bold">
            {count}
          </span>
        ) : (
          !expanded && <span className="text-[10px] text-slate-300 italic">soltar aquí</span>
        )}
      </div>
    </div>

    {/* Vista rápida inline del inventario asignado */}
    {expanded && (
      <div className="px-3 pb-3">
        <p className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-wide mb-1">Tiene asignado</p>
        {inline}
      </div>
    )}

    {/* Expanded content when has items */}
    {count > 0 && (
      <div className="px-3 pb-3 space-y-2">
        {/* Per-IST client selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium shrink-0">Cliente:</span>
          <div className="flex-1">
            <SearchableSelect value={clienteId} onChange={onClienteChange}
              options={clienteOpts} placeholder="Sin cliente" />
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-0.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded px-2 py-1 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-teal-700 font-semibold text-[10px]">{item.codigo}</span>
                <span className="text-slate-700 truncate">{item.label}</span>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{item.tipo}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {(item.cantidadMax ?? 1) > 1 && (
                  <label className="flex items-center gap-0.5" title={`Unidades del lote (máx. ${item.cantidadMax})`}>
                    <input type="number" min={1} max={item.cantidadMax} value={item.cantidad}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 1;
                        onCantidad(item.id, Math.max(1, Math.min(v, item.cantidadMax ?? v)));
                      }}
                      onFocus={e => e.currentTarget.select()}
                      className="w-11 border border-slate-200 rounded px-1 py-0.5 text-[10px] text-center" />
                    <span className="text-[9px] text-slate-400">/{item.cantidadMax}</span>
                  </label>
                )}
                <label className="flex items-center gap-0.5 cursor-pointer" title="Permanente">
                  <input type="checkbox" checked={item.permanente}
                    onChange={e => onTogglePerm(item.id, e.target.checked)}
                    className="w-2.5 h-2.5 accent-teal-600" />
                  <span className="text-[9px] text-slate-400">Perm</span>
                </label>
                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-[10px] ml-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
