import type { ColAlign } from '../../hooks/useResizableColumns';

interface ColAlignIconProps {
  align: ColAlign;
  onClick: () => void;
}

const paths: Record<ColAlign, string> = {
  left:   'M3 6h18M3 12h12M3 18h16',
  center: 'M3 6h18M6 12h12M4 18h16',
  right:  'M3 6h18M9 12h12M5 18h16',
};

const labels: Record<ColAlign, string> = {
  left: 'Alinear izquierda',
  center: 'Centrar',
  right: 'Alinear derecha',
};

export const ColAlignIcon: React.FC<ColAlignIconProps> = ({ align, onClick }) => (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); onClick(); }}
    title={labels[align]}
    className="absolute left-0.5 top-0.5 p-0.5 rounded hover:bg-slate-200/60 text-slate-400 hover:text-teal-600 transition-colors"
  >
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[align]} />
    </svg>
  </button>
);
