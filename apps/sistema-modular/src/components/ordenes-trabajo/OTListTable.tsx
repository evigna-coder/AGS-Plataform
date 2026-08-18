import { useState, useEffect, type ReactNode } from 'react';
import type { WorkOrder, Sistema } from '@ags/shared';
import { SortableHeader, type SortDir } from '../ui/SortableHeader';
import { ColAlignIcon } from '../ui/ColAlignIcon';
import type { ColAlign } from '../../hooks/useResizableColumns';
import { OTStatusBadge } from './OTStatusBadge';
import { OTReporteButton } from './OTReporteButton';
import { OTImprimirButton } from './OTImprimirButton';
import type { GroupedOT } from '../../hooks/useOTListData';
import { useEstablecimientoSuffix } from '../../hooks/useEstablecimientoSuffix';
import { fechaLocalYMD, formatFechaAR } from '../../utils/formatFecha';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

// Timezone-safe: createdAt llega como Firestore Timestamp; fechaInicio/fechaFin como
// 'YYYY-MM-DD'. fechaLocalYMD normaliza ambos al día LOCAL (sin que el offset UTC corra
// la fecha) y formatFechaAR lo muestra DD/MM/AAAA.
const formatDate = (value: unknown): string => {
  const ymd = fechaLocalYMD(value);
  return ymd ? formatFechaAR(ymd) : '—';
};

interface CellCtx {
  isItem: boolean;
  sistemaNombre: string;
  /** " (Establecimiento)" si el cliente tiene >1 activo — ver useEstablecimientoSuffix. */
  sufijoEstab?: (clienteId?: string | null, establecimientoId?: string | null) => string;
}

interface DataColumn {
  /** Índice lógico estable (para ocultar/mostrar). 1-based; 0 = checkbox. */
  idx: number;
  label: string;
  /** Campo para ordenar. Ausente = columna no ordenable. */
  field?: string;
  width: number;
  render: (ot: WorkOrder, ctx: CellCtx) => ReactNode;
}

/** Columnas de datos (entre checkbox y acciones). El idx es estable para el menú
 *  de ocultar/mostrar; el orden de render se deriva filtrando las ocultas. */
export const OT_DATA_COLUMNS: DataColumn[] = [
  { idx: 1, label: 'OT', field: 'otNumber', width: 72,
    render: (ot, { isItem }) => isItem
      ? <span className="text-xs text-teal-500 pl-2"><span className="text-slate-300 mr-1">└</span>{ot.otNumber}</span>
      : <span className="font-semibold text-teal-600 text-xs">{ot.otNumber}</span> },
  { idx: 2, label: 'Cliente', field: 'razonSocial', width: 150,
    render: (ot, { isItem, sufijoEstab }) => <span className="text-xs text-slate-700">{isItem ? '' : <>{ot.razonSocial}{sufijoEstab?.(ot.clienteId, ot.establecimientoId) ?? ''}</>}</span> },
  { idx: 3, label: 'Sistema', field: 'sistema', width: 120,
    render: (ot, { isItem, sistemaNombre }) => <span className="text-xs text-slate-600">{isItem ? '' : (sistemaNombre || ot.sistema || '—')}</span> },
  { idx: 4, label: 'Id Equipo', field: 'codigoInternoCliente', width: 110,
    render: (ot, { isItem }) => <span className="text-xs text-slate-600 font-mono">{isItem ? '' : (ot.codigoInternoCliente || '—')}</span> },
  { idx: 5, label: 'Módulo', field: 'moduloModelo', width: 140,
    render: (ot) => <span className="text-xs text-slate-600">{ot.moduloModelo || '—'}{ot.moduloSerie && <span className="text-slate-400 ml-1">({ot.moduloSerie})</span>}</span> },
  { idx: 6, label: 'Servicio', field: 'tipoServicio', width: 120,
    render: (ot) => <span className="text-xs text-slate-600">{ot.tipoServicio}</span> },
  { idx: 7, label: 'Descripción', width: 220,
    render: (ot) => <span className="text-xs text-slate-500">{ot.problemaFallaInicial || <span className="text-slate-300">—</span>}</span> },
  { idx: 8, label: 'Creada', field: 'createdAt', width: 82,
    render: (ot) => <span className="text-xs text-slate-500">{formatDate(ot.createdAt)}</span> },
  // idx 13 (nuevo, estable para ocultar/mostrar) aunque renderice acá — UAT 2026-07-17.
  // Fecha de asignación = la fecha AGENDADA del servicio (fechaServicioAprox, definición
  // de Esteban). `fechaAsignacion` viene adjuntada en useOTListData para el sort/filtro.
  { idx: 13, label: 'Asignada', field: 'fechaAsignacion', width: 82,
    render: (ot) => <span className="text-xs text-slate-500">{formatDate(ot.fechaServicioAprox)}</span> },
  { idx: 9, label: 'F. Serv.', field: 'fechaInicio', width: 82,
    render: (ot) => <span className="text-xs text-slate-500">{formatDate(ot.fechaInicio || ot.fechaServicioAprox)}</span> },
  { idx: 10, label: 'Cambio estado', field: 'estadoAdminFecha', width: 96,
    render: (ot) => <span className="text-xs text-slate-500">{formatDate(ot.estadoAdminFecha)}</span> },
  { idx: 11, label: 'Finalización', field: 'fechaCierre', width: 92,
    // Fecha de cierre administrativo real (solo existe cuando la OT se cerró). fechaFin se
    // setea a "hoy" al crear, por eso mostraba una fecha aunque la OT no esté finalizada.
    render: (ot) => <span className="text-xs text-slate-500">{formatDate(ot.fechaCierre)}</span> },
  { idx: 12, label: 'Estado', field: 'estadoAdmin', width: 96,
    render: (ot) => <OTStatusBadge ot={ot} /> },
];

interface Props {
  grouped: GroupedOT[];
  sistemas: Sistema[];
  selectedOTs: Set<string>;
  allSelected: boolean;
  toggleSelect: (otNum: string) => void;
  toggleSelectAll: () => void;
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
  onRowClick: (ot: WorkOrder, hasItems: boolean) => void;
  onNewItem: (ot: WorkOrder) => void;
  onCopy: (ot: WorkOrder) => void;
  onDelete: (ot: WorkOrder) => void;
  // Resizable-columns hook
  tableRef: React.RefObject<HTMLTableElement>;
  colWidths: number[] | null;
  colAligns: ColAlign[] | null;
  onResizeStart: (i: number, e: React.MouseEvent) => void;
  onAutoFit: (i: number) => void;
  cycleAlign: (i: number) => void;
  getAlignClass: (i: number) => string;
  isHidden: (idx: number) => boolean;
  toggleCol: (idx: number) => void;
  showAllCols: () => void;
}

export const OTListTable: React.FC<Props> = ({
  grouped, sistemas, selectedOTs, allSelected, toggleSelect, toggleSelectAll,
  sortField, sortDir, onSort, onRowClick, onNewItem, onCopy, onDelete,
  tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass, isHidden,
  toggleCol, showAllCols,
}) => {
  const sufijoEstab = useEstablecimientoSuffix();
  // Columnas de datos visibles (las ocultas se filtran por idx lógico).
  const visibleCols = OT_DATA_COLUMNS.filter(c => !isHidden(c.idx));
  const hasHidden = OT_DATA_COLUMNS.some(c => isHidden(c.idx));

  // Menú contextual de columna (click derecho en el encabezado).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; idx: number; label: string } | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [ctxMenu]);
  const openCtxMenu = (e: React.MouseEvent, idx: number, label: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, idx, label });
  };

  // Anchos por posición renderizada: [checkbox, ...visibles, acciones].
  const defaultWidths = [32, ...visibleCols.map(c => c.width), 150];
  const colWidth = (renderedIdx: number) => colWidths?.[renderedIdx] ?? defaultWidths[renderedIdx];

  return (
    <>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
      <table ref={tableRef} className="tabla-compacta w-full table-fixed">
        <colgroup>
          {defaultWidths.map((_, i) => <col key={i} style={{ width: colWidth(i) }} />)}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={allSelected}
                onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-teal-600" />
            </th>
            {visibleCols.map((col, vi) => {
              const ri = vi + 1; // posición renderizada (checkbox = 0)
              const resizeHandle = (
                <div onMouseDown={e => onResizeStart(ri, e)} onDoubleClick={() => onAutoFit(ri)}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
              );
              const alignIcon = <ColAlignIcon align={colAligns?.[ri] || 'left'} onClick={() => cycleAlign(ri)} />;
              if (col.field) {
                return (
                  <SortableHeader key={col.idx} label={col.label} field={col.field}
                    currentField={sortField} currentDir={sortDir} onSort={onSort}
                    onContextMenu={e => openCtxMenu(e, col.idx, col.label)}
                    className={`${thClass} relative ${getAlignClass(ri)}`}>
                    {alignIcon}
                    {resizeHandle}
                  </SortableHeader>
                );
              }
              return (
                <th key={col.idx} className={`${thClass} relative ${getAlignClass(ri)}`}
                  onContextMenu={e => openCtxMenu(e, col.idx, col.label)}>
                  {alignIcon}
                  {col.label}
                  {resizeHandle}
                </th>
              );
            })}
            <th className={`${thClass} text-center`}>Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grouped.map(({ ot, isItem, hasItems }) => {
            const sistema = sistemas.find(s => s.id === ot.sistemaId);
            const isParent = !ot.otNumber.includes('.');
            const parentWithItems = isParent && hasItems;
            const ctx: CellCtx = { isItem, sistemaNombre: sistema?.nombre || '', sufijoEstab };
            return (
              <tr key={ot.otNumber}
                className={`hover:bg-slate-50 transition-colors ${isItem ? 'bg-slate-50/50' : ''} ${parentWithItems ? '' : 'cursor-pointer'}`}
                onClick={() => onRowClick(ot, hasItems)}>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedOTs.has(ot.otNumber)}
                    onChange={() => toggleSelect(ot.otNumber)} className="w-3.5 h-3.5 accent-teal-600" />
                </td>
                {visibleCols.map((col, vi) => (
                  <td key={col.idx}
                    className={`px-2 py-2 truncate whitespace-nowrap ${getAlignClass(vi + 1)}`}>
                    {col.render(ot, ctx)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <OTReporteButton ot={ot} />
                    <OTImprimirButton otNumber={ot.otNumber} />
                    {!isItem && (
                      <button onClick={() => onNewItem(ot)}
                        className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1 py-0.5 rounded hover:bg-teal-50"
                        title="Crear nuevo item">
                        +Item
                      </button>
                    )}
                    {!isItem && (
                      <button onClick={() => onCopy(ot)}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100"
                        title="Copiar OT: abre la creación con todos los datos de esta OT precargados (número nuevo)">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                        </svg>
                      </button>
                    )}
                    {/* Item → se cancela (queda rastro); padre → se elimina. */}
                    <button onClick={() => onDelete(ot)}
                      className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50"
                      title={ot.otNumber.includes('.') ? 'Cancelar item (pide motivo)' : 'Eliminar'}>
                      {ot.otNumber.includes('.') ? 'Cancelar' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {ctxMenu && (
      <div
        className="fixed z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        style={{ top: ctxMenu.y, left: ctxMenu.x }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={() => { toggleCol(ctxMenu.idx); setCtxMenu(null); }}
          className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          Ocultar columna «{ctxMenu.label}»
        </button>
        {hasHidden && (
          <button
            onClick={() => { showAllCols(); setCtxMenu(null); }}
            className="block w-full text-left px-3 py-1.5 text-[11px] text-teal-600 hover:bg-slate-50 border-t border-slate-100"
          >
            Mostrar todas las columnas
          </button>
        )}
      </div>
    )}
    </>
  );
};
