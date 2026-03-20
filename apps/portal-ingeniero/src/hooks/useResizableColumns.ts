import { useRef, useState, useCallback } from 'react';

/**
 * Hook for resizable table columns via drag handles.
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
    const nextIndex = colIndex + 1;
    const nextWidth = nextIndex < currentWidths.length ? currentWidths[nextIndex] : 0;
    const minCol = 40;

    if (!colWidths) setColWidths(currentWidths);

    const onMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      const maxGrow = nextWidth - minCol;
      const maxShrink = startWidth - minCol;
      const clampedDiff = Math.max(-maxShrink, Math.min(maxGrow, diff));
      setColWidths(prev => {
        const base = prev || currentWidths;
        const next = [...base];
        next[colIndex] = startWidth + clampedDiff;
        if (nextIndex < next.length) {
          next[nextIndex] = nextWidth - clampedDiff;
        }
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
