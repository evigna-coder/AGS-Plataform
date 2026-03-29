import { useOTList, type OTStatusFilter } from '../hooks/useOTList';
import { OTCard } from '../components/ordenes-trabajo/OTCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';

const STATUS_TABS: { value: OTStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'BORRADOR', label: 'En progreso' },
  { value: 'FINALIZADO', label: 'Finalizadas' },
];

export default function OTListPage() {
  const { ots, loading, search, setSearch, statusFilter, setStatusFilter, misOTs, setMisOTs } = useOTList();

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Órdenes de Trabajo" subtitle={loading ? '...' : `${ots.length} órdenes`} />

      {/* Filters */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 pb-3 space-y-2">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === t.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={misOTs}
              onChange={e => setMisOTs(e.target.checked)}
              className="rounded accent-teal-600"
            />
            Mis OTs
          </label>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por OT, cliente, equipo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : ots.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">Sin órdenes de trabajo</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'No hay resultados para tu búsqueda.' : 'No hay OTs disponibles.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ots.map(ot => <OTCard key={ot.otNumber} ot={ot} />)}
          </div>
        )}
      </div>
    </div>
  );
}
