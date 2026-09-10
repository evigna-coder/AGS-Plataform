import { Fragment, useEffect, useMemo, useState } from 'react';
import type { AuditLogEntry, AuditAction, UsuarioAGS } from '@ags/shared';
import { ACTION_LABELS, collectionLabel, describirAccion, entityLabelDe, tituloAccion } from '../../utils/auditHumano';
import { AuditoriaDetalle } from '../../components/admin/AuditoriaDetalle';
import { auditService, type AuditFilters } from '../../services/auditService';
import { usuariosService } from '../../services/personalService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { matchesSearch } from '../../utils/searchTerms';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { DateInput } from '../../components/ui/DateInput';

import { EmptyState } from '../../components/ui/EmptyState';
const ACTION_TABS: { value: '' | AuditAction; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'create', label: 'Creaciones' },
  { value: 'update', label: 'Modificaciones' },
  { value: 'delete', label: 'Eliminaciones' },
  { value: 'business_event', label: 'Eventos' },
];

const ACTION_BADGE: Record<AuditAction, string> = {
  create: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  update: 'bg-amber-50 text-amber-700 border border-amber-200',
  delete: 'bg-red-50 text-red-700 border border-red-200',
  business_event: 'bg-violet-50 text-violet-700 border border-violet-200',
};

const FILTER_SCHEMA = {
  search: { type: 'string' as const, default: '' },
  action: { type: 'string' as const, default: '' },
  userId: { type: 'string' as const, default: '' },
  collection: { type: 'string' as const, default: '' },
  desde: { type: 'string' as const, default: '' },
  hasta: { type: 'string' as const, default: '' },
};

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AuditoriaPage() {
  const [filters, setFilter, , reset] = useUrlFilters(FILTER_SCHEMA);
  const [busq, setBusq] = useDebouncedUrlText(filters.search, v => setFilter('search', v));
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { usuariosService.getAll().then(setUsuarios).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const queryFilters: AuditFilters = {
      action: filters.action ? (filters.action as AuditAction) : undefined,
      userId: filters.userId || undefined,
      collection: filters.collection || undefined,
      desde: filters.desde || undefined,
      hasta: filters.hasta || undefined,
    };
    auditService.list(queryFilters)
      .then(setEntries)
      .catch(err => setError(err?.message || 'Error al cargar auditoría'))
      .finally(() => setLoading(false));
  }, [filters.action, filters.userId, filters.collection, filters.desde, filters.hasta]);

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return entries;
    return entries.filter(e =>
      matchesSearch(filters.search, e.userName, entityLabelDe(e), collectionLabel(e.collection), e.eventName, e.documentId, describirAccion(e))
    );
  }, [entries, filters.search]);

  const collections = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => e.collection && set.add(e.collection));
    return Array.from(set).sort();
  }, [entries]);

  const userOptions = useMemo(() => [
    { value: '', label: 'Usuario: Todos' },
    ...usuarios.map(u => ({ value: u.id, label: u.displayName || u.email })),
  ], [usuarios]);

  const collectionOptions = useMemo(() => [
    { value: '', label: 'Módulo: Todos' },
    ...collections.map(c => ({ value: c, label: collectionLabel(c) })),
  ], [collections]);

  const hasFilters = !!(filters.search || filters.action || filters.userId || filters.collection || filters.desde || filters.hasta);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Auditoría" count={filtered.length}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={busq}
            onChange={e => setBusq(e.target.value)}
            placeholder="Buscar usuario, entidad, ID, evento..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
          />
          <div className="flex items-center gap-1.5">
            {ACTION_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter('action', tab.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  filters.action === tab.value
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <div className="min-w-[180px]">
            <SearchableSelect
              value={filters.userId}
              onChange={v => setFilter('userId', v)}
              options={userOptions}
              placeholder="Usuario"
            />
          </div>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filters.collection}
              onChange={v => setFilter('collection', v)}
              options={collectionOptions}
              placeholder="Entidad"
            />
          </div>
          <DateInput size="sm" value={filters.desde} onChange={iso => setFilter('desde', iso)} ariaLabel="Desde" />
          <DateInput size="sm" value={filters.hasta} onChange={iso => setFilter('hasta', iso)} ariaLabel="Hasta" />
          {hasFilters && <Button size="sm" variant="ghost" onClick={() => reset()}>Limpiar</Button>}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-3">
        {error && <Card><p className="text-sm text-red-600 text-center py-4">{error}</p></Card>}
        {loading && entries.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Cargando auditoría…</p>
        ) : filtered.length === 0 ? (
          <EmptyState message="No se encontraron eventos con estos filtros." hint="Probá con otros filtros o ampliá la búsqueda" />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Fecha y hora</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Usuario</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Acción</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Módulo</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Detalle del cambio</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(e => {
                  const expanded = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expanded ? null : e.id)}>
                        <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">{formatTs(e.timestamp)}</td>
                        <td className="px-3 py-2 text-xs text-slate-700 font-medium truncate max-w-[160px]" title={e.userName}>{e.userName || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ACTION_BADGE[e.action]}`}>
                            {ACTION_LABELS[e.action]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <span className="font-medium">{tituloAccion(e)}</span>
                          {entityLabelDe(e) && <span className="ml-1 text-slate-500">— {entityLabelDe(e)}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{collectionLabel(e.collection)}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[280px]" title={describirAccion(e)}>
                          {describirAccion(e) || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="text-[10px] text-slate-400">{expanded ? '▼' : '▶'}</span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-3">
                            <AuditoriaDetalle entry={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
