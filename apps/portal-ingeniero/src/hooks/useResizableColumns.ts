import { useRef, useState, useCallback } from 'react';

export type ColAlign = 'left' | 'center' | 'right';

/**
 * Hook for resizable table columns via drag handles + per-column alignment.
 * Pass a `storageKey` to persist column widths & alignments across sessions in localStorage.
 *
 * Usage:
 *   const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, resetWidths }
 *     = useResizableColumns('my-list');
 *
 * In each <th>, add resize handle:
 *   <div
 *     onMouseDown={e => onResizeStart(colIndex, e)}
 *     onDoubleClick={() => onAutoFit(colIndex)}
 *     className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40"
 *   />
 *
 * For alignment toggle, use <ColAlignIcon> component (see components/ui/ColAlignIcon.tsx).
 */
export function useResizableColumns(storageKey?: string) {
  const tableRef = useRef<HTMLTableElement>(null);

  // Restore widths from localStorage if key provided
  const [colWidths, setColWidths] = useState<number[] | null>(() => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(`col-widths:${storageKey}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Restore alignments from localStorage
  const [colAligns, setColAligns] = useState<ColAlign[] | null>(() => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(`col-aligns:${storageKey}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Save to localStorage whenever widths change
  const persistWidths = useCallback((widths: number[]) => {
    if (storageKey) {
      try { localStorage.setItem(`col-widths:${storageKey}`, JSON.stringify(widths)); } catch {}
    }
  }, [storageKey]);

  /** Helper: read current pixel widths from the DOM */
  const readCurrentWidths = useCallback((): number[] => {
    if (!tableRef.current) return [];
    const ths = tableRef.current.querySelectorAll('thead th');
    return Array.from(ths).map(th => (th as HTMLElement).getBoundingClientRect().width);
  }, []);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tableRef.current) return;

    const currentWidths = colWidths || readCurrentWidths();

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
      // Persist final widths
      setColWidths(prev => { if (prev) persistWidths(prev); return prev; });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths, readCurrentWidths, persistWidths]);

  /** Double-click: auto-fit column to its longest content */
  const onAutoFit = useCallback((colIndex: number) => {
    if (!tableRef.current) return;

    const currentWidths = colWidths || readCurrentWidths();
    if (currentWidths.length === 0) return;

    // Measure max content width in this column (header + body rows)
    const rows = tableRef.current.querySelectorAll('tr');
    let maxContentWidth = 0;
    const padding = 24; // px-3 = 12px each side

    rows.forEach(row => {
      const cell = row.children[colIndex] as HTMLElement | undefined;
      if (!cell) return;

      // Temporarily remove width constraint to measure natural content width
      const oldWidth = cell.style.width;
      const oldOverflow = cell.style.overflow;
      const oldWhiteSpace = cell.style.whiteSpace;
      cell.style.width = 'auto';
      cell.style.overflow = 'visible';
      cell.style.whiteSpace = 'nowrap';

      const contentWidth = cell.scrollWidth;
      maxContentWidth = Math.max(maxContentWidth, contentWidth);

      // Restore
      cell.style.width = oldWidth;
      cell.style.overflow = oldOverflow;
      cell.style.whiteSpace = oldWhiteSpace;
    });

    const newWidth = Math.max(40, maxContentWidth + padding);
    const diff = newWidth - currentWidths[colIndex];

    // Distribute the difference to the adjacent column
    const nextIndex = colIndex + 1;
    const newWidths = [...currentWidths];
    newWidths[colIndex] = newWidth;
    if (nextIndex < newWidths.length) {
      newWidths[nextIndex] = Math.max(40, newWidths[nextIndex] - diff);
    }

    setColWidths(newWidths);
    persistWidths(newWidths);
  }, [colWidths, readCurrentWidths, persistWidths]);

  /** Cycle column alignment: left → center → right → left */
  const cycleAlign = useCallback((colIndex: number) => {
    if (!tableRef.current) return;
    const colCount = tableRef.current.querySelectorAll('thead th').length;
    const current = colAligns || new Array<ColAlign>(colCount).fill('left');
    const order: ColAlign[] = ['left', 'center', 'right'];
    const idx = order.indexOf(current[colIndex] || 'left');
    const next = [...current];
    next[colIndex] = order[(idx + 1) % 3];
    setColAligns(next);
    if (storageKey) {
      try { localStorage.setItem(`col-aligns:${storageKey}`, JSON.stringify(next)); } catch {}
    }
  }, [colAligns, storageKey]);

  /** Set a column's alignment explicitly */
  const setAlign = useCallback((colIndex: number, align: ColAlign) => {
    if (!tableRef.current) return;
    const colCount = tableRef.current.querySelectorAll('thead th').length;
    const current = colAligns || new Array<ColAlign>(colCount).fill('left');
    const next = [...current];
    while (next.length < colCount) next.push('left');
    next[colIndex] = align;
    setColAligns(next);
    if (storageKey) {
      try { localStorage.setItem(`col-aligns:${storageKey}`, JSON.stringify(next)); } catch {}
    }
  }, [colAligns, storageKey]);

  /** Get the CSS text-align class for a column */
  const getAlignClass = useCallback((colIndex: number): string => {
    const align = colAligns?.[colIndex] || 'left';
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  }, [colAligns]);

  // ── Hidden columns ──
  const [hiddenCols, setHiddenCols] = useState<number[]>(() => {
    if (!storageKey) return [];
    try {
      const saved = localStorage.getItem(`col-hidden:${storageKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const persistHidden = useCallback((list: number[]) => {
    if (!storageKey) return;
    try {
      if (list.length === 0) localStorage.removeItem(`col-hidden:${storageKey}`);
      else localStorage.setItem(`col-hidden:${storageKey}`, JSON.stringify(list));
    } catch {}
  }, [storageKey]);

  const hideCol = useCallback((colIndex: number) => {
    setHiddenCols(prev => {
      if (prev.includes(colIndex)) return prev;
      const next = [...prev, colIndex].sort((a, b) => a - b);
      persistHidden(next);
      return next;
    });
  }, [persistHidden]);

  const showAllCols = useCallback(() => {
    setHiddenCols([]);
    persistHidden([]);
  }, [persistHidden]);

  const isHidden = useCallback((colIndex: number) => hiddenCols.includes(colIndex), [hiddenCols]);

  // Reset to default widths/alignments/visibility and clear storage
  const resetWidths = useCallback(() => {
    setColWidths(null);
    setColAligns(null);
    setHiddenCols([]);
    if (storageKey) {
      try {
        localStorage.removeItem(`col-widths:${storageKey}`);
        localStorage.removeItem(`col-aligns:${storageKey}`);
        localStorage.removeItem(`col-hidden:${storageKey}`);
      } catch {}
    }
  }, [storageKey]);

  return {
    tableRef, colWidths, colAligns,
    onResizeStart, onAutoFit, cycleAlign, setAlign, getAlignClass, resetWidths,
    hiddenCols, hideCol, showAllCols, isHidden,
  };
}
