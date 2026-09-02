import { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../ui/SortableHeader';
import { PresentacionesBadge } from './PresentacionesBadge';
import { UnidadesSubTable } from './UnidadesSubTable';
import { promedioCostoFactor } from '@ags/shared';
import type { UnidadStock, Presentacion } from '@ags/shared';

export interface AggRow {
  articuloId: string;
  codigo: string;
  descripcion: string;
  hasSerie: boolean;
  hasLote: boolean;
  disponible: number;
  reservado: number;
  asignado: number;
  total: number;
  units: UnidadStock[];
  /** Presentaciones (N° de parte) del artículo — para el badge. Resuelto en UnidadesList. */
  presentaciones?: Presentacion[];
}

const thClass = 'px-3 py-2 text-[11px] font-medium text-slate-400 tracking-wider text-center';

interface Props {
  rows: AggRow[];
  onAjustar: (u: UnidadStock) => void;
  onMover?: (u: UnidadStock) => void;
  onLiberar?: (u: UnidadStock) => void;
  /** Liberar TODAS las unidades de un grupo unificado del desglose (una confirmación). */
  onLiberarGrupo?: (units: UnidadStock[]) => void;
  /** Abre el artículo en modal. Antes el código era un link a la página de detalle. */
  onArticulo?: (articuloId: string) => void;
  /** Abre la galería de fotos de la mercadería (2026-09-02). */
  onVerFotos?: (units: UnidadStock[]) => void;
}

export const UnidadesAggregatedTable = ({ rows, onAjustar, onMover, onLiberar, onLiberarGrupo, onArticulo, onVerFotos }: Props) => {
  const [sortField, setSortField] = useState<string>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const sorted = useMemo(() => sortByField(rows, sortField, sortDir), [rows, sortField, sortDir]);

  if (rows.length === 0) return (
    <Card><div className="text-center py-12"><p className="text-slate-400">No hay unidades cargadas</p></div></Card>
  );

  return (
    <div className="bg-white overflow-auto h-full">
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="w-8" />
            <SortableHeader label="Código" field="codigo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-left'} />
            <SortableHeader label="Descripción" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-left'} />
            <SortableHeader label="Disponible" field="disponible" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-right'} />
            <SortableHeader label="Reservado" field="reservado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-right'} />
            <SortableHeader label="Asignado" field="asignado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-right'} />
            <SortableHeader label="Total" field="total" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass + ' text-right'} />
            <th className={thClass + ' text-right'}>Costo / factor prom.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(row => {
            const isOpen = expanded.has(row.articuloId);
            return (
              <FragmentRow key={row.articuloId} row={row} isOpen={isOpen} onToggle={() => toggle(row.articuloId)} onAjustar={onAjustar} onMover={onMover} onLiberar={onLiberar} onLiberarGrupo={onLiberarGrupo} onArticulo={onArticulo} onVerFotos={onVerFotos} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Promedio ponderado del artículo (2026-08-27): UN número por fila de artículo
 * — a cuánto está entrando en promedio y con qué factor. El detalle por
 * unidad/tanda sigue en el desglose; el detalle por embarque, en Importaciones.
 */
const PromedioCell = ({ units }: { units: UnidadStock[] }) => {
  const p = promedioCostoFactor(units);
  if (!p) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex flex-col items-end leading-tight"
      title={`Promedio ponderado sobre ${p.unidades} unidad(es) en stock${p.algunEstimado ? ' — incluye costeos estimados sin confirmar' : ''}`}>
      {p.costo != null && (
        <span className="font-mono text-xs text-slate-700 tabular-nums">{p.moneda} {p.costo.toFixed(2)}</span>
      )}
      {p.factor != null && (
        <span className={`font-mono text-[10px] tabular-nums ${p.algunEstimado ? 'text-amber-600' : 'text-teal-600'}`}>
          factor {p.factor.toFixed(3)}{p.algunEstimado ? ' (est.)' : ''}
        </span>
      )}
    </span>
  );
};

const FragmentRow = ({ row, isOpen, onToggle, onAjustar, onMover, onLiberar, onLiberarGrupo, onArticulo, onVerFotos }: { row: AggRow; isOpen: boolean; onToggle: () => void; onAjustar: (u: UnidadStock) => void; onMover?: (u: UnidadStock) => void; onLiberar?: (u: UnidadStock) => void; onLiberarGrupo?: (units: UnidadStock[]) => void; onArticulo?: (articuloId: string) => void; onVerFotos?: (units: UnidadStock[]) => void }) => (
  <>
    <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={onToggle}>
      <td className="px-2 text-center text-slate-400">
        <svg className={`w-3.5 h-3.5 inline transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </td>
      <td className="px-3 py-2 text-[10px] font-mono text-slate-500 whitespace-nowrap">
        <button type="button" onClick={e => { e.stopPropagation(); onArticulo?.(row.articuloId); }}
          className="text-teal-600 hover:underline font-semibold">{row.codigo}</button>
        {row.hasSerie && <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] bg-teal-50 text-teal-700">S/N</span>}
        {row.hasLote && <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-indigo-50 text-indigo-700">Lote</span>}
        {row.presentaciones && row.presentaciones.length > 0 && (
          <span className="ml-1 inline-flex align-middle"><PresentacionesBadge presentaciones={row.presentaciones} /></span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[220px]">{row.descripcion}</td>
      <td className="px-3 py-2 text-sm font-semibold text-teal-700 text-right">{row.disponible}</td>
      <td className="px-3 py-2 text-sm font-semibold text-amber-600 text-right">{row.reservado}</td>
      <td className="px-3 py-2 text-sm font-medium text-slate-500 text-right">{row.asignado}</td>
      <td className="px-3 py-2 text-sm font-bold text-slate-800 text-right">{row.total}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap"><PromedioCell units={row.units} /></td>
    </tr>
    {isOpen && (
      <tr className="bg-slate-50/60">
        <td />
        <td colSpan={7} className="px-3 py-2">
          <UnidadesSubTable units={row.units} onAjustar={onAjustar} onMover={onMover} onLiberar={onLiberar} onLiberarGrupo={onLiberarGrupo} onVerFotos={onVerFotos} />
        </td>
      </tr>
    )}
  </>
);
