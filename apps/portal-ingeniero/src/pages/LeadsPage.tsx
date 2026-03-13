import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import LeadCard from '../components/leads/LeadCard';
import CrearLeadModal from '../components/leads/CrearLeadModal';
import { useLeadList } from '../hooks/useLeadList';
import type { LeadEstado } from '@ags/shared';

const ESTADO_TABS: { value: LeadEstado | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'pendiente_info', label: 'Pend. info' },
  { value: 'en_presupuesto', label: 'Presupuesto' },
  { value: 'en_coordinacion', label: 'Coordinación' },
  { value: 'en_proceso', label: 'En proceso' },
];

export default function LeadsPage() {
  const { leads, loading, search, setSearch, estadoFilter, setEstadoFilter, misLeads, setMisLeads, refresh } = useLeadList();
  const [showCrear, setShowCrear] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Leads" subtitle={loading ? '...' : `${leads.length} leads`} actions={
        <Button size="sm" onClick={() => setShowCrear(true)}>+ Nuevo</Button>
      } />

      {/* Filters */}
      <div className="px-4 pb-3 shrink-0 space-y-2">
        <input
          type="text"
          placeholder="Buscar por razón social, contacto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-2 overflow-x-auto">
          {ESTADO_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setEstadoFilter(tab.value as LeadEstado | '')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                estadoFilter === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <label className="shrink-0 flex items-center gap-1 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={misLeads}
              onChange={e => setMisLeads(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span className="text-[11px] font-medium text-slate-500">Mis leads</span>
          </label>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : leads.length === 0 ? (
          <EmptyState message="No se encontraron leads" />
        ) : (
          <div className="space-y-2">
            {leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
          </div>
        )}
      </div>

      <CrearLeadModal
        open={showCrear}
        onClose={() => setShowCrear(false)}
        onCreated={refresh}
      />
    </div>
  );
}
