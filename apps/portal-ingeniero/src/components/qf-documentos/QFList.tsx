import { useState } from 'react';
import type { QFDocumento, QFEstado } from '@ags/shared';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColAlignIcon } from '../ui/ColAlignIcon';
import { sortByField, toggleSort, type SortDir } from '../ui/SortableHeader';

interface Props {
  docs: QFDocumento[];
  onNuevaVersion: (d: QFDocumento) => void;
  onHistorial: (d: QFDocumento) => void;
  onEditar: (d: QFDocumento) => void;
}

const ESTADO_BADGE: Record<QFEstado, string> = {
  vigente: 'bg-teal-50 text-teal-700 border border-teal-200',
  obsoleto: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const thBase = 'px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 relative select-none';

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
  active ? (
    <svg className="w-3 h-3 text-teal-500 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-300 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

export default function QFList({ docs, onNuevaVersion, onHistorial, onEditar }: Props) {
  const [sortField, setSortField] = useState<string>('fechaUltimaActualizacion');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } =
    useResizableColumns('pi-qf-documentos');

  const sorted = sortByField(docs, sortField, sortDir);

  return (
    <>
      {/* Mobile cards (< md) */}
      <div className="md:hidden space-y-2">
        {sorted.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-teal-700">{d.numeroCompleto}.{d.versionActual}</p>
                <p className="text-sm text-slate-800 truncate">{d.nombre}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
              </span>
            </div>
            {d.descripcion && <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{d.descripcion}</p>}
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
              <span>{formatFecha(d.fechaUltimaActualizacion)}</span>
              <span className="truncate ml-2">{d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onNuevaVersion(d)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50">Nueva versión</button>
              <button onClick={() => onHistorial(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100">Historial</button>
              <button onClick={() => onEditar(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 ml-auto">Editar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet / small notebook (md–lg) */}
      <div className="hidden md:block lg:hidden space-y-2">
        {sorted.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-semibold text-teal-700">{d.numeroCompleto}.{d.versionActual}</p>
                <p className="text-sm font-medium text-slate-800 truncate">{d.nombre}</p>
                {d.descripcion && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{d.descripcion}</p>}
              </div>
              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
              <span>{formatFecha(d.fechaUltimaActualizacion)}</span>
              <span className="truncate ml-2 max-w-[60%]">{d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onNuevaVersion(d)} className="text-[11px] font-medium text-teal-600 hover:text-teal-800 px-2 py-1 rounded hover:bg-teal-50">Nueva versión</button>
              <button onClick={() => onHistorial(d)} className="text-[11px] font-medium text-slate-600 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100">Historial</button>
              <button onClick={() => onEditar(d)} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 ml-auto">Editar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table (lg+): resizable + sortable + alignable */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
        <table ref={tableRef} className="w-full table-fixed min-w-[920px]">
          {colWidths ? (
            <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
          ) : (
            <colgroup>
              <col style={{ width: '13%' }} />{/* Número */}
              <col style={{ width: '30%' }} />{/* Nombre */}
              <col style={{ width: '10%' }} />{/* Estado */}
              <col style={{ width: '11%' }} />{/* Actualizado */}
              <col style={{ width: '18%' }} />{/* Usuario */}
              <col style={{ width: '18%' }} />{/* Acciones */}
            </colgroup>
          )}
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr>
              <th className={`${thBase} ${getAlignClass(0)}`}>
                <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('numeroCompleto')}>
                  Número<SortIcon active={sortField === 'numeroCompleto'} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
              <th className={`${thBase} ${getAlignClass(1)}`}>
                <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('nombre')}>
                  Nombre<SortIcon active={sortField === 'nombre'} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
              <th className={`${thBase} ${getAlignClass(2)}`}>
                <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('estado')}>
                  Estado<SortIcon active={sortField === 'estado'} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
              <th className={`${thBase} ${getAlignClass(3)}`}>
                <ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('fechaUltimaActualizacion')}>
                  Actualizado<SortIcon active={sortField === 'fechaUltimaActualizacion'} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
              <th className={`${thBase} ${getAlignClass(4)}`}>
                <ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />
                <span className="cursor-pointer hover:text-slate-600" onClick={() => handleSort('ultimoUsuarioNombre')}>
                  Usuario<SortIcon active={sortField === 'ultimoUsuarioNombre'} dir={sortDir} />
                </span>
                <div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              </th>
              <th className={`${thBase} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className={`px-3 py-2 font-mono text-xs font-semibold text-teal-700 truncate ${getAlignClass(0)}`} title={`${d.numeroCompleto}.${d.versionActual}`}>
                  {d.numeroCompleto}.{d.versionActual}
                </td>
                <td className={`px-3 py-2 text-xs text-slate-800 min-w-0 ${getAlignClass(1)}`}>
                  <div className="font-medium truncate" title={d.nombre}>{d.nombre}</div>
                  {d.descripcion && <div className="text-[10px] text-slate-400 truncate" title={d.descripcion}>{d.descripcion}</div>}
                </td>
                <td className={`px-3 py-2 ${getAlignClass(2)}`}>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[d.estado]}`}>
                    {d.estado === 'vigente' ? 'Vigente' : 'Obsoleto'}
                  </span>
                </td>
                <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(3)}`}>{formatFecha(d.fechaUltimaActualizacion)}</td>
                <td className={`px-3 py-2 text-xs text-slate-500 truncate ${getAlignClass(4)}`} title={d.ultimoUsuarioEmail}>
                  {d.ultimoUsuarioNombre || d.ultimoUsuarioEmail}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  <button onClick={() => onNuevaVersion(d)} className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 mr-1">Nueva versión</button>
                  <button onClick={() => onHistorial(d)} className="text-[10px] font-medium text-slate-600 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 mr-1">Historial</button>
                  <button onClick={() => onEditar(d)} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
