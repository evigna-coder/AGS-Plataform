import { useState, useEffect, useMemo } from 'react';
import { OTCard } from '../components/ordenes-trabajo/OTCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { otService } from '../services/firebaseService';
import type { WorkOrder } from '@ags/shared';

export default function ReportesPage() {
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    otService.getAll({ status: 'FINALIZADO' })
      .then(setOts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return ots;
    const s = search.toLowerCase();
    return ots.filter(ot =>
      ot.otNumber?.toLowerCase().includes(s) ||
      ot.razonSocial?.toLowerCase().includes(s) ||
      ot.sistema?.toLowerCase().includes(s) ||
      ot.tipoServicio?.toLowerCase().includes(s) ||
      ot.ingenieroAsignadoNombre?.toLowerCase().includes(s)
    );
  }, [ots, search]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Reportes"
        subtitle={loading ? '...' : `${filtered.length} reportes finalizados`}
      />

      {/* Search */}
      <div className="shrink-0 px-4 pb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por OT, cliente, equipo, ingeniero..."
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
              {search ? 'Sin resultados' : 'Sin reportes finalizados'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Probá con otro término de búsqueda.' : 'Los reportes aparecen aquí una vez finalizados.'}
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
