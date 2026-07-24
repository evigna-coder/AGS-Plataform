import { Link } from 'react-router-dom';
import { SortableHeader, type SortDir } from '../../components/ui/SortableHeader';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import type { MovimientoStock, TipoMovimiento } from '@ags/shared';

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};
const TIPO_COLORS: Record<TipoMovimiento, string> = {
  ingreso: 'bg-green-100 text-green-700', egreso: 'bg-red-100 text-red-700',
  transferencia: 'bg-blue-100 text-blue-700', consumo: 'bg-amber-100 text-amber-700',
  devolucion: 'bg-purple-100 text-purple-700', ajuste: 'bg-slate-100 text-slate-600',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const TH = 'relative px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider';
// Anchos por defecto (%) de las 12 columnas; una vez que el usuario redimensiona, el hook
// persiste px por columna (key 'movimientos-list').
const DEFAULT_WIDTHS = ['9%', '6%', '8%', '14%', '7%', '9%', '5%', '11%', '11%', '9%', '7%', '8%'];

interface Props {
  items: MovimientoStock[];
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
  onSelect: (m: MovimientoStock) => void;
  fromState: { from: string };
}

/**
 * Tabla de movimientos de stock. Columnas redimensionables (`useResizableColumns`): arrastrá el
 * borde derecho de cada cabecera para ensanchar, doble-click auto-ajusta al contenido. `table-fixed`
 * → el contenido largo se trunca dentro del ancho de la columna (todas quedan visibles, sin scroll).
 */
export function MovimientosTable({ items, sortField, sortDir, onSort, onSelect, fromState }: Props) {
  const { tableRef, colWidths, onResizeStart, onAutoFit } = useResizableColumns('movimientos-list');
  const resizer = (i: number) => (
    <div onMouseDown={e => onResizeStart(i, e)} onDoubleClick={() => onAutoFit(i)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
  );

  return (
    <div className="bg-white">
      <table ref={tableRef} className="w-full text-xs border-collapse table-fixed">
        <colgroup>
          {(colWidths ?? DEFAULT_WIDTHS).map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="text-left border-b border-slate-200 bg-slate-50">
            <SortableHeader label="Fecha" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(0)}</SortableHeader>
            <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(1)}</SortableHeader>
            <SortableHeader label="Codigo" field="articuloCodigo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(2)}</SortableHeader>
            <SortableHeader label="Descripcion" field="articuloDescripcion" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(3)}</SortableHeader>
            <SortableHeader label="OC" field="ordenCompraNumero" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(4)}</SortableHeader>
            <SortableHeader label="Despacho" field="despachoImportacionNumero" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(5)}</SortableHeader>
            <SortableHeader label="Cant." field="cantidad" currentField={sortField} currentDir={sortDir} onSort={onSort} className={`${TH} text-center`}>{resizer(6)}</SortableHeader>
            <SortableHeader label="Origen" field="origenNombre" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(7)}</SortableHeader>
            <SortableHeader label="Destino" field="destinoNombre" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(8)}</SortableHeader>
            <SortableHeader label="Motivo" field="motivo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(9)}</SortableHeader>
            <SortableHeader label="Usuario" field="creadoPor" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH}>{resizer(10)}</SortableHeader>
            <th className={TH}>Ref.{resizer(11)}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr
              key={m.id}
              onClick={() => onSelect(m)}
              className="border-b border-slate-100 hover:bg-teal-50/50 cursor-pointer"
            >
              <td className="px-4 py-2 truncate text-slate-600">{formatDate(m.createdAt)}</td>
              <td className="px-4 py-2 overflow-hidden">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[m.tipo]}`}>
                  {TIPO_LABELS[m.tipo]}
                </span>
              </td>
              <td className="px-4 py-2 font-mono text-slate-700 truncate">{m.articuloCodigo}</td>
              <td className="px-4 py-2 text-slate-700 truncate">{m.articuloDescripcion}</td>
              <td className="px-4 py-2 font-mono text-slate-600 truncate">{m.ordenCompraNumero ?? '—'}</td>
              <td className="px-4 py-2 font-mono text-slate-600 truncate">{m.despachoImportacionNumero ?? '—'}</td>
              <td className="px-4 py-2 text-center tabular-nums font-medium">{m.cantidad}</td>
              <td className="px-4 py-2 text-slate-600 truncate">{m.origenNombre || '—'}</td>
              <td className="px-4 py-2 text-slate-600 truncate">{m.destinoNombre || '—'}</td>
              <td className="px-4 py-2 text-slate-500 truncate">{m.motivo ?? '—'}</td>
              <td className="px-4 py-2 text-slate-500 truncate">{m.creadoPor}</td>
              <td className="px-4 py-2 space-x-2 overflow-hidden whitespace-nowrap">
                {m.remitoId && (
                  <Link to={`/stock/remitos/${m.remitoId}`} state={fromState} onClick={e => e.stopPropagation()} className="text-teal-600 hover:underline text-[10px] font-medium">
                    Remito
                  </Link>
                )}
                {m.otNumber && (
                  <Link to={`/ordenes-trabajo/${m.otNumber}`} state={fromState} onClick={e => e.stopPropagation()} className="text-teal-600 hover:underline text-[10px] font-medium font-mono">
                    OT {m.otNumber}
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
