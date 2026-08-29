import { useMemo } from 'react';
import type { CalificacionProveedor, EstadoCalificacion } from '@ags/shared';
import { ORIGEN_CALIFICACION_COLORS, ORIGEN_CALIFICACION_LABELS } from '@ags/shared';
import { SortableHeader, type SortDir } from '../../components/ui/SortableHeader';
import { eventoCalificacion } from '../../utils/calificaciones';
import { CalificacionRow } from './CalificacionRow';

export type CicloTab = 'pendiente' | 'calificada' | 'omitida' | '';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

interface Props {
  items: CalificacionProveedor[];
  tab: CicloTab;
  promedios: Record<string, { promedio: number; count: number; estado: EstadoCalificacion }>;
  sortField: string;
  sortDir: SortDir;
  onSort: (f: string) => void;
  onCalificar: (c: CalificacionProveedor) => void;
  onOmitir: (c: CalificacionProveedor) => void;
  onEditar: (c: CalificacionProveedor) => void;
  onEliminar: (id: string) => void;
}

/**
 * Grupos por EVENTO (2026-08-28): un embarque genera una calificación por actor
 * (vendedor / agente / despachante) que sueltas parecen sin relación — se
 * agrupan bajo un encabezado con la OC. El grupo se ancla en la posición de su
 * primera fila según el orden vigente; el resto de los orígenes queda igual.
 */
type Fila =
  | { tipo: 'suelta'; c: CalificacionProveedor }
  | { tipo: 'grupo'; key: string; rows: CalificacionProveedor[] };

function agruparPorEvento(items: CalificacionProveedor[]): Fila[] {
  const filas: Fila[] = [];
  const idxPorGrupo = new Map<string, number>();
  for (const c of items) {
    const gkey = (c.origen === 'importacion_embarque' && c.origenId) ? `emb:${c.origenId}` : null;
    if (!gkey) { filas.push({ tipo: 'suelta', c }); continue; }
    const idx = idxPorGrupo.get(gkey);
    if (idx == null) {
      idxPorGrupo.set(gkey, filas.length);
      filas.push({ tipo: 'grupo', key: gkey, rows: [c] });
    } else {
      (filas[idx] as Extract<Fila, { tipo: 'grupo' }>).rows.push(c);
    }
  }
  return filas;
}

/** Tabla del listado de calificaciones — columnas según la pestaña de ciclo. */
export function CalificacionesTable({ items, tab, promedios, sortField, sortDir, onSort, onCalificar, onOmitir, onEditar, onEliminar }: Props) {
  const esPend = tab === 'pendiente';
  const esOmit = tab === 'omitida';
  const conPuntaje = tab === 'calificada' || tab === '';
  const numCols = 5 + (esPend ? 1 : 0) + (esOmit ? 1 : 0) + (tab === '' ? 1 : 0) + (conPuntaje ? 3 : 0) + (!esPend ? 1 : 0);

  const filas = useMemo(() => agruparPorEvento(items), [items]);

  const rowProps = { tab, onCalificar, onOmitir, onEditar, onEliminar };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
          <tr>
            <SortableHeader label="Fecha" field="fechaRecepcion" currentField={sortField} currentDir={sortDir} onSort={onSort} className={thClass} />
            <SortableHeader label="Proveedor" field="proveedorNombre" currentField={sortField} currentDir={sortDir} onSort={onSort} className={thClass} />
            <th className={thClass}>Origen</th>
            <th className={thClass}>Detalle</th>
            {esPend && <th className={`${thClass} text-center`}>Antigüedad</th>}
            {esOmit && <th className={thClass}>Motivo</th>}
            {tab === '' && <th className={thClass}>Ciclo</th>}
            {conPuntaje && (
              <>
                <SortableHeader label="Puntaje" field="puntajeTotal" currentField={sortField} currentDir={sortDir} onSort={onSort} className={`${thClass} text-center`} />
                <th className={`${thClass} text-center`}>Prom. Prov.</th>
                <th className={thClass}>Estado</th>
              </>
            )}
            {!esPend && <th className={thClass}>Resp.</th>}
            <th className={`${thClass} w-24`} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map(f => {
            if (f.tipo === 'suelta' || f.rows.length === 1) {
              const c = f.tipo === 'suelta' ? f.c : f.rows[0];
              return <CalificacionRow key={c.id} c={c} prom={promedios[c.proveedorId]} {...rowProps} />;
            }
            const primera = f.rows[0];
            return [
              <tr key={f.key} className="bg-slate-50/80">
                <td className="px-3 py-1.5 text-slate-500 font-mono text-xs whitespace-nowrap">{primera.fechaRecepcion}</td>
                <td colSpan={numCols - 1} className="px-3 py-1.5 whitespace-nowrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ORIGEN_CALIFICACION_COLORS.importacion_embarque}`}>
                    {ORIGEN_CALIFICACION_LABELS.importacion_embarque}
                  </span>
                  <span className="ml-2 text-xs font-medium text-slate-700">{eventoCalificacion(primera)}</span>
                  <span className="ml-2 text-[10px] text-slate-400">{f.rows.length} proveedores</span>
                </td>
              </tr>,
              ...f.rows.map(c => (
                <CalificacionRow key={c.id} c={c} prom={promedios[c.proveedorId]} enGrupo {...rowProps} />
              )),
            ];
          })}
          {items.length === 0 && (
            <tr><td colSpan={numCols} className="text-center py-8 text-slate-400">
              {esPend ? 'No hay calificaciones pendientes' : 'No hay calificaciones registradas'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
