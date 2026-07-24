export type OTTabId = 'ots' | 'previsiones';

const TABS: { id: OTTabId; label: string; title: string }[] = [
  { id: 'ots', label: 'Órdenes de trabajo', title: 'OTs abiertas' },
  { id: 'previsiones', label: 'Previsiones', title: 'Servicios anuales reservados en la agenda del año que viene (todavía sin OT)' },
];

interface Props {
  tab: OTTabId;
  onChange: (tab: OTTabId) => void;
}

/** Solapas del módulo Órdenes de Trabajo. La pestaña vive en la URL (`?tab=`). */
export const OTTabs: React.FC<Props> = ({ tab, onChange }) => (
  <div className="flex border-b border-slate-200 -mb-3">
    {TABS.map(t => (
      <button
        key={t.id}
        type="button"
        title={t.title}
        onClick={() => onChange(t.id)}
        className={`px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider border-b-2 transition-colors ${
          tab === t.id
            ? 'border-teal-600 text-teal-700'
            : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);
