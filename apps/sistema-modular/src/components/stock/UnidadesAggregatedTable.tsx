import { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../ui/SortableHeader';
import { PresentacionesBadge } from './PresentacionesBadge';
import { costoUnitarioVigente, factorImportacionVigente } from '@ags/shared';
import type { UnidadStock, CondicionUnidad, EstadoUnidad, Presentacion } from '@ags/shared';

const CONDICION_LABELS: Record<CondicionUnidad, string> = { nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap' };
const CONDICION_COLORS: Record<CondicionUnidad, string> = { nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700', reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-teal-100 text-teal-700', scrap: 'bg-red-100 text-red-700' };
const ESTADO_LABELS: Record<EstadoUnidad, string> = { disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_transito: 'En transito', consumido: 'Consumido', vendido: 'Vendido', entregado: 'Entregado', baja: 'Baja' };
const ESTADO_COLORS: Record<EstadoUnidad, string> = { disponible: 'bg-green-100 text-green-700', reservado: 'bg-amber-100 text-amber-700', asignado: 'bg-blue-100 text-blue-700', en_transito: 'bg-purple-100 text-purple-700', consumido: 'bg-slate-100 text-slate-500', vendido: 'bg-slate-100 text-slate-500', entregado: 'bg-teal-100 text-teal-700', baja: 'bg-red-100 text-red-700' };
const UBICACION_LABELS: Record<string, string> = { posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito', remito: 'Remito' };

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
  /** Abre el artículo en modal. Antes el código era un link a la página de detalle. */
  onArticulo?: (articuloId: string) => void;
}

export const UnidadesAggregatedTable = ({ rows, onAjustar, onMover, onLiberar, onArticulo }: Props) => {
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(row => {
            const isOpen = expanded.has(row.articuloId);
            return (
              <FragmentRow key={row.articuloId} row={row} isOpen={isOpen} onToggle={() => toggle(row.articuloId)} onAjustar={onAjustar} onMover={onMover} onLiberar={onLiberar} onArticulo={onArticulo} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Costo y factor de importación de una unidad (2026-08-24).
 *
 * El factor estaba solo en la página del artículo: para saber a cuánto entró
 * una pieza había que salir de la consulta de stock. Se distingue el estimado
 * del confirmado — tomar un estimado por definitivo termina en un precio mal
 * puesto.
 */
const CostoFactorCell = ({ u }: { u: UnidadStock }) => {
  const costo = costoUnitarioVigente(u);
  const factor = factorImportacionVigente(u);
  if (costo == null && factor == null) return <span className="text-slate-300">—</span>;
  const confirmado = !!u.costeoConfirmadoAt;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      {costo != null && (
        <span className="font-mono text-slate-700 tabular-nums">{u.monedaCosto ?? 'USD'} {costo.toFixed(2)}</span>
      )}
      {factor != null && (
        <span className={`font-mono text-[10px] tabular-nums ${confirmado ? 'text-teal-600' : 'text-amber-600'}`}
          title={confirmado
            ? `Costeo confirmado el ${u.costeoConfirmadoAt!.slice(0, 10)}${u.factorImportacion != null ? ` · estimado original ${u.factorImportacion.toFixed(3)}` : ''}`
            : 'Costeo estimado — todavía sin confirmar contra las facturas reales'}>
          factor {factor.toFixed(3)}{confirmado ? '' : ' (est.)'}
        </span>
      )}
    </span>
  );
};

const FragmentRow = ({ row, isOpen, onToggle, onAjustar, onMover, onLiberar, onArticulo }: { row: AggRow; isOpen: boolean; onToggle: () => void; onAjustar: (u: UnidadStock) => void; onMover?: (u: UnidadStock) => void; onLiberar?: (u: UnidadStock) => void; onArticulo?: (articuloId: string) => void }) => (
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
    </tr>
    {isOpen && (
      <tr className="bg-slate-50/60">
        <td />
        <td colSpan={6} className="px-3 py-2">
          <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F0F0F0] text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-1.5 px-2 w-12 text-right">Cant.</th>
                  <th className="py-1.5 px-2 text-left">Nº serie</th>
                  <th className="py-1.5 px-2 text-left">Nº lote</th>
                  <th className="py-1.5 px-2 text-center">Condición</th>
                  <th className="py-1.5 px-2 text-center">Estado</th>
                  <th className="py-1.5 px-2 text-left">Ubicación</th>
                  <th className="py-1.5 px-2 text-right w-28">Costo / factor</th>
                  <th className="py-1.5 px-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.units.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.activo ? 'opacity-50' : ''}`}>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{u.cantidad ?? 1}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-700">{u.nroSerie || '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-600">{u.nroLote || '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONDICION_COLORS[u.condicion]}`}>{CONDICION_LABELS[u.condicion]}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[u.estado]}`}>{ESTADO_LABELS[u.estado]}</span>
                      {u.estado === 'reservado' && u.reservadoParaPresupuestoNumero && (
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{u.reservadoParaPresupuestoNumero}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {UBICACION_LABELS[u.ubicacion.tipo] ?? u.ubicacion.tipo}
                      {u.ubicacion.referenciaNombre && <span className="text-slate-400"> — {u.ubicacion.referenciaNombre}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap"><CostoFactorCell u={u} /></td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      {onMover && (u.estado === 'disponible') && (
                        <button onClick={() => onMover(u)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">Mover</button>
                      )}
                      {onLiberar && u.estado === 'reservado' && (
                        <button onClick={() => onLiberar(u)} className="text-[10px] font-medium text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-50">Liberar</button>
                      )}
                      <button onClick={() => onAjustar(u)} className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100">Ajustar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    )}
  </>
);
