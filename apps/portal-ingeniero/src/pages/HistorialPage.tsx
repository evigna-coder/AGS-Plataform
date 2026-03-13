import { useState, useEffect, useMemo } from 'react';
import { OTCard } from '../components/ordenes-trabajo/OTCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { otService } from '../services/firebaseService';
import type { WorkOrder } from '@ags/shared';

type StatusFilter = 'all' | 'BORRADOR' | 'FINALIZADO';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'BORRADOR', label: 'En progreso' },
  { value: 'FINALIZADO', label: 'Finalizadas' },
];

export default function HistorialPage() {
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    otService.getAll()
      .then(setOts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = ots;
    if (statusFilter !== 'all') list = list.filter(ot => ot.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(ot =>
        ot.otNumber?.toLowerCase().includes(s) ||
        ot.razonSocial?.toLowerCase().includes(s) ||
        ot.sistema?.toLowerCase().includes(s) ||
        ot.tipoServicio?.toLowerCase().includes(s) ||
        ot.ingenieroAsignadoNombre?.toLowerCase().includes(s) ||
        ot.moduloModelo?.toLowerCase().includes(s) ||
        ot.moduloSerie?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [ots, search, statusFilter]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Historial"
        subtitle={loading ? '...' : `${filtered.length} órdenes de trabajo`}
      />

      {/* Filters */}
      <div className="shrink-0 px-4 pb-3 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                statusFilter === t.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por OT, cliente, equipo, modelo, serie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">
              {search || statusFilter !== 'all' ? 'Sin resultados' : 'Sin órdenes de trabajo'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Probá con otro término de búsqueda.' : 'Las OTs aparecen aquí cuando se crean.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(ot => <OTCard key={ot.otNumber} ot={ot} />)}
          </div>
        )}
      </div>
    </div>
  );
}
