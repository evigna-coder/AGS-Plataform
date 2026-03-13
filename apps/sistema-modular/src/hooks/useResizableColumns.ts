import { useRef, useState, useCallback } from 'react';

/**
 * Hook for resizable table columns via drag handles.
 *
 * Usage:
 *   const { tableRef, colWidths, onResizeStart } = useResizableColumns();
 *
 *   <table ref={tableRef} className="w-full table-fixed">
 *     {colWidths && (
 *       <colgroup>
 *         {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
 *       </colgroup>
 *     )}
 *     {!colWidths && <colgroup>...default widths...</colgroup>}
 *     <thead>
 *       <tr>
 *         <th className="relative ...">
 *           Label
 *           <div onMouseDown={e => onResizeStart(0, e)}
 *                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40" />
 *         </th>
 *       </tr>
 *     </thead>
 *   </table>
 */
export function useResizableColumns() {
  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<number[] | null>(null);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tableRef.current) return;

    const ths = tableRef.current.querySelectorAll('thead th');
    const currentWidths = colWidths
      || Array.from(ths).map(th => (th as HTMLElement).getBoundingClientRect().width);

    const startX = e.clientX;
    const startWidth = currentWidths[colIndex];

    // Capture widths on first resize
    if (!colWidths) setColWidths(currentWidths);

    const onMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      setColWidths(prev => {
        const base = prev || currentWidths;
        const next = [...base];
        next[colIndex] = newWidth;
        return next;
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  return { tableRef, colWidths, onResizeStart };
}
