import { Link } from 'react-router-dom';
import { SortableHeader, type SortDir } from '../../components/ui/SortableHeader';
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

const TH = 'px-4 py-2 text-[11px] font-medium text-slate-400 tracking-wider';

interface Props {
  items: MovimientoStock[];
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
  onSelect: (m: MovimientoStock) => void;
  fromState: { from: string };
}

/**
 * Tabla de movimientos de stock (extraída de MovimientosPage por presupuesto de líneas).
 * Columnas OC / Despacho denormalizadas desde el movimiento; filas clickeables abren el
 * drawer de detalle. La tabla scrollea en x — `whitespace-nowrap` en columnas angostas.
 */
export function MovimientosTable({ items, sortField, sortDir, onSort, onSelect, fromState }: Props) {
  return (
    <div className="bg-white overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="text-left border-b border-slate-200 bg-slate-50">
            <SortableHeader label="Fecha" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Codigo" field="articuloCodigo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Descripcion" field="articuloDescripcion" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="OC" field="ordenCompraNumero" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Despacho" field="despachoImportacionNumero" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Cant." field="cantidad" currentField={sortField} currentDir={sortDir} onSort={onSort} className={`${TH} text-center`} />
            <SortableHeader label="Origen" field="origenNombre" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Destino" field="destinoNombre" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Motivo" field="motivo" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <SortableHeader label="Usuario" field="creadoPor" currentField={sortField} currentDir={sortDir} onSort={onSort} className={TH} />
            <th className={TH}>Ref.</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr
              key={m.id}
              onClick={() => onSelect(m)}
              className="border-b border-slate-100 hover:bg-teal-50/50 cursor-pointer"
            >
              <td className="px-4 py-2 whitespace-nowrap text-slate-600">{formatDate(m.createdAt)}</td>
              <td className="px-4 py-2">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[m.tipo]}`}>
                  {TIPO_LABELS[m.tipo]}
                </span>
              </td>
              <td className="px-4 py-2 font-mono text-slate-700">{m.articuloCodigo}</td>
              <td className="px-4 py-2 text-slate-700 max-w-[200px] truncate">{m.articuloDescripcion}</td>
              <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{m.ordenCompraNumero ?? '—'}</td>
              <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{m.despachoImportacionNumero ?? '—'}</td>
              <td className="px-4 py-2 text-center tabular-nums font-medium">{m.cantidad}</td>
              <td className="px-4 py-2 text-slate-600">{m.origenTipo} — {m.origenNombre}</td>
              <td className="px-4 py-2 text-slate-600">{m.destinoTipo} — {m.destinoNombre}</td>
              <td className="px-4 py-2 text-slate-500 max-w-[150px] truncate">{m.motivo ?? '—'}</td>
              <td className="px-4 py-2 text-slate-500">{m.creadoPor}</td>
              <td className="px-4 py-2 space-x-2">
                {m.remitoId && (
                  <Link to={`/stock/remitos/${m.remitoId}`} state={fromState} onClick={e => e.stopPropagation()} className="text-teal-600 hover:underline text-[10px] font-medium">
                    Remito
                  </Link>
                )}
                {m.otNumber && (
                  <Link to={`/ordenes-trabajo/${m.otNumber}`} state={fromState} onClick={e => e.stopPropagation()} className="text-teal-600 hover:underline text-[10px] font-medium">
                    OT
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
