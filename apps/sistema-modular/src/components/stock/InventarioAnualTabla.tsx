import type { FilaInventario } from '../../utils/inventarioAnual';
import { SortableHeader, type SortDir } from '../ui/SortableHeader';

interface Props {
  filas: FilaInventario[];
  /** Vista de excluidos: muestra el motivo en vez del valor. */
  excluidos?: boolean;
  /** Selección múltiple (vista vendibles): ids marcados y toggles. */
  seleccion?: Set<string>;
  onToggle?: (articuloId: string) => void;
  onToggleTodos?: (marcar: boolean) => void;
  /** Vista excluidos: vuelve a poner un artículo (quitado a mano, o confirmarlo vendible si fue por código/condición). */
  onRestaurar?: (fila: FilaInventario) => void;
  /** Vista vendibles: deshace la confirmación de vendible. */
  onDesconfirmar?: (articuloId: string) => void;
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
}

const th = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400 whitespace-nowrap';
const usd = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CONDICION_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', vendible: 'Vendible', reacondicionado: 'Reacondicionado', scrap: 'Scrap', bien_de_uso: 'Bien de uso',
};

/** Tabla del inventario anual: una fila por artículo con precio EXW promedio y valor en USD. */
export function InventarioAnualTabla({ filas, excluidos = false, seleccion, onToggle, onToggleTodos, onRestaurar, onDesconfirmar, sortField, sortDir, onSort }: Props) {
  const H = ({ label, field, right }: { label: string; field: string; right?: boolean }) => (
    <SortableHeader label={label} field={field} currentField={sortField} currentDir={sortDir} onSort={onSort}
      className={`${th} ${right ? 'text-right' : ''}`} />
  );
  const conSeleccion = !excluidos && !!seleccion && !!onToggle;
  const todosMarcados = conSeleccion && filas.length > 0 && filas.every(f => seleccion!.has(f.articuloId));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto h-full">
      <table className="tabla-compacta w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            {conSeleccion && (
              <th className="px-2 py-2 w-8 text-center">
                <input type="checkbox" checked={todosMarcados} onChange={e => onToggleTodos?.(e.target.checked)}
                  className="h-3.5 w-3.5 accent-teal-600 cursor-pointer" title="Seleccionar todo lo visible" />
              </th>
            )}
            <H label="Código" field="codigo" />
            <H label="Descripción" field="descripcion" />
            <H label="Marca" field="marca" />
            <H label="Ubicaciones" field="ubicacionesTexto" />
            <H label="Cantidad" field="cantidad" right />
            <H label="Precio EXW" field="precioExw" right />
            {excluidos ? (
              <>
                <H label="Condiciones" field="condicionesTexto" />
                <H label="Motivo" field="excluida" />
                <th className={th}></th>
              </>
            ) : (
              <>
                <H label="Valor USD" field="valor" right />
                <H label="Origen del precio" field="tandasConPrecio" />
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.articuloId} onClick={conSeleccion ? () => onToggle!(f.articuloId) : undefined}
              className={`border-b border-slate-100 ${conSeleccion ? 'cursor-pointer' : ''} ${seleccion?.has(f.articuloId) ? 'bg-teal-50/60' : f.precioExw == null && !excluidos ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
              {conSeleccion && (
                <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={seleccion!.has(f.articuloId)} onChange={() => onToggle!(f.articuloId)} className="h-3.5 w-3.5 accent-teal-600 cursor-pointer" />
                </td>
              )}
              <td className="px-3 py-1.5 text-xs font-mono text-slate-700 whitespace-nowrap">
                {f.codigo}
                {f.sufijoNoVendible && !f.vendibleConfirmado && <span className="ml-1 text-[9px] font-mono text-amber-600" title="El código termina en B o C">B/C</span>}
                {f.vendibleConfirmado && !excluidos && (
                  <span className="ml-1 text-[9px] font-mono text-teal-700" title="Confirmado vendible por el usuario (queda guardado en el artículo)">
                    confirmado
                    {onDesconfirmar && <button onClick={e => { e.stopPropagation(); onDesconfirmar(f.articuloId); }} className="ml-1 text-slate-400 hover:text-red-600" title="Deshacer la confirmación">×</button>}
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 text-xs text-slate-700 truncate max-w-[280px]" title={f.descripcion}>{f.descripcion}</td>
              <td className="px-3 py-1.5 text-[11px] text-slate-500 whitespace-nowrap">{f.marca || '—'}</td>
              <td className="px-3 py-1.5 text-[11px] text-slate-500 truncate max-w-[240px]" title={f.ubicaciones.join('\n')}>{f.ubicaciones.join(' · ')}</td>
              <td className="px-3 py-1.5 text-xs text-slate-700 text-right tabular-nums">{f.cantidad}</td>
              <td className="px-3 py-1.5 text-xs text-right tabular-nums">
                {f.precioExw == null
                  ? <span className="text-amber-600 font-medium">sin precio</span>
                  : <span className="text-slate-700">{usd(f.precioExw)}</span>}
              </td>
              {excluidos ? (
                <>
                  <td className="px-3 py-1.5 text-[11px] text-slate-600">{f.condiciones.map(c => CONDICION_LABEL[c] ?? c).join(', ') || '—'}</td>
                  <td className="px-3 py-1.5 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${f.excluida === 'sufijo' ? 'bg-amber-50 text-amber-700 border-amber-200' : f.excluida === 'manual' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {f.excluida === 'sufijo' ? 'código B/C' : f.excluida === 'manual' ? 'quitado a mano' : 'condición'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {onRestaurar && (
                      <button onClick={() => onRestaurar(f)} className="text-[11px] font-medium text-teal-700 hover:underline"
                        title={f.excluida === 'manual' ? 'Volver a incluirlo en el inventario' : 'Confirmar que es vendible: queda guardado en el artículo'}>
                        {f.excluida === 'manual' ? 'Restaurar' : 'Es vendible'}
                      </button>
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium text-slate-900">{f.valor == null ? '—' : usd(f.valor)}</td>
                  <td className="px-3 py-1.5 text-[11px] text-slate-500 whitespace-nowrap">
                    {f.precioExw == null
                      ? (f.tandasSinPrecio > 0 ? `${f.tandasSinPrecio} tanda${f.tandasSinPrecio === 1 ? '' : 's'} sin costo o sin factor` : '—')
                      : `${f.tandasConPrecio} tanda${f.tandasConPrecio === 1 ? '' : 's'} costeada${f.tandasConPrecio === 1 ? '' : 's'}${f.tandasSinPrecio > 0 ? ` · ${f.tandasSinPrecio} sin precio` : ''}`}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
