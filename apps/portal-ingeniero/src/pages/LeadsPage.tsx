import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import CrearLeadModal from '../components/leads/CrearLeadModal';
import DerivarLeadModal from '../components/leads/DerivarLeadModal';
import FinalizarLeadModal from '../components/leads/FinalizarLeadModal';
import { useLeadList } from '../hooks/useLeadList';
import type { Lead, LeadEstado } from '@ags/shared';
import {
  LEAD_ESTADO_LABELS, LEAD_ESTADO_COLORS,
  LEAD_AREA_LABELS, LEAD_AREA_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
} from '@ags/shared';

const ESTADO_TABS: { value: LeadEstado | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'pendiente_info', label: 'Pend. info' },
  { value: 'en_presupuesto', label: 'Presupuesto' },
  { value: 'en_coordinacion', label: 'Coordinación' },
  { value: 'en_proceso', label: 'En proceso' },
];

export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, loading, search, setSearch, estadoFilter, setEstadoFilter, misLeads, setMisLeads, refresh } = useLeadList();
  const [showCrear, setShowCrear] = useState(false);
  const [derivarLead, setDerivarLead] = useState<Lead | null>(null);
  const [finalizarLead, setFinalizarLead] = useState<Lead | null>(null);

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return d; }
  };

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
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : leads.length === 0 ? (
          <EmptyState message="No se encontraron leads" />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Razón Social</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Contacto</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripción</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Motivo</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Área</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Asignado</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Fecha</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map(lead => {
                  const isClosed = lead.estado === 'finalizado' || lead.estado === 'no_concretado';
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 text-left truncate max-w-[160px] block"
                          title={lead.razonSocial}
                        >
                          {lead.razonSocial}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[120px]" title={lead.contacto}>
                        {lead.contacto}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-400 truncate max-w-[160px] italic" title={lead.descripcion || lead.motivoContacto || ''}>
                        {(lead.descripcion || lead.motivoContacto)?.slice(0, 50) || '—'}
                        {(lead.descripcion || lead.motivoContacto || '').length > 50 ? '...' : ''}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                          {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {lead.areaActual ? (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_AREA_COLORS[lead.areaActual]}`}>
                            {LEAD_AREA_LABELS[lead.areaActual]}
                          </span>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_ESTADO_COLORS[lead.estado]}`}>
                          {LEAD_ESTADO_LABELS[lead.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[100px] whitespace-nowrap" title={lead.asignadoNombre || ''}>
                        {lead.asignadoNombre || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {!isClosed && (
                            <>
                              <button
                                onClick={() => setDerivarLead(lead)}
                                className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50"
                              >
                                Derivar
                              </button>
                              <button
                                onClick={() => setFinalizarLead(lead)}
                                className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
                              >
                                Finalizar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50"
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CrearLeadModal
        open={showCrear}
        onClose={() => setShowCrear(false)}
        onCreated={refresh}
      />

      {derivarLead && (
        <DerivarLeadModal
          lead={derivarLead}
          onClose={() => setDerivarLead(null)}
          onSuccess={() => { setDerivarLead(null); refresh(); }}
        />
      )}

      {finalizarLead && (
        <FinalizarLeadModal
          lead={finalizarLead}
          onClose={() => setFinalizarLead(null)}
          onSuccess={() => { setFinalizarLead(null); refresh(); }}
        />
      )}
    </div>
  );
}
