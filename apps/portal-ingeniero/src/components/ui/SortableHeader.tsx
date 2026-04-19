export type SortDir = 'asc' | 'desc';

interface SortableHeaderProps {
  label: string;
  field: string;
  currentField: string;
  currentDir: SortDir;
  onSort: (field: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function sortByField<T>(items: T[], field: string, dir: SortDir): T[] {
  return [...items].sort((a, b) => {
    const va = field.split('.').reduce((o: any, k) => o?.[k], a) ?? '';
    const vb = field.split('.').reduce((o: any, k) => o?.[k], b) ?? '';
    let cmp: number;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb));
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function toggleSort(
  field: string,
  currentField: string,
  currentDir: SortDir,
): { field: string; dir: SortDir } {
  if (currentField === field) {
    return { field, dir: currentDir === 'asc' ? 'desc' : 'asc' };
  }
  return { field, dir: 'desc' };
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label, field, currentField, currentDir, onSort, className = '', children,
}) => (
  <th
    className={`cursor-pointer select-none hover:text-slate-600 transition-colors ${className}`}
    onClick={() => onSort(field)}
  >
    <span className="inline-flex items-center gap-0.5">
      {label}
      {currentField === field ? (
        <svg className="w-3 h-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d={currentDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )}
    </span>
    {children}
  </th>
);
