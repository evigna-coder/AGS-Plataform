import { Fragment, useEffect, useMemo, useState } from 'react';
import type { AuditLogEntry, AuditAction, UsuarioAGS } from '@ags/shared';
import { auditService, type AuditFilters } from '../../services/auditService';
import { usuariosService } from '../../services/personalService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const ACTION_TABS: { value: '' | AuditAction; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
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

function describeAction(e: AuditLogEntry): string {
  if (e.action === 'business_event') return e.eventName || 'evento';
  return e.action;
}

function describeChanges(e: AuditLogEntry): string {
  if (e.action === 'business_event') {
    if (!e.details) return '';
    return Object.entries(e.details).map(([k, v]) => `${k}: ${stringify(v)}`).join(', ');
  }
  if (!e.changes) return '';
  if (e.action === 'update') {
    const keys = Object.keys(e.changes.after ?? {});
    if (keys.length === 0) return '—';
    return keys.join(', ');
  }
  return '';
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return '[object]'; }
}

export default function AuditoriaPage() {
  const [filters, setFilter, , reset] = useUrlFilters(FILTER_SCHEMA);
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
    const q = filters.search.toLowerCase();
    return entries.filter(e =>
      (e.userName || '').toLowerCase().includes(q) ||
      (e.entityLabel || '').toLowerCase().includes(q) ||
      (e.collection || '').toLowerCase().includes(q) ||
      (e.eventName || '').toLowerCase().includes(q) ||
      (e.documentId || '').toLowerCase().includes(q)
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
    { value: '', label: 'Entidad: Todas' },
    ...collections.map(c => ({ value: c, label: c })),
  ], [collections]);

  const hasFilters = !!(filters.search || filters.action || filters.userId || filters.collection || filters.desde || filters.hasta);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Auditoría" count={filtered.length}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
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
          <input
            type="date"
            value={filters.desde}
            onChange={e => setFilter('desde', e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700"
            title="Desde"
          />
          <input
            type="date"
            value={filters.hasta}
            onChange={e => setFilter('hasta', e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700"
            title="Hasta"
          />
          {hasFilters && <Button size="sm" variant="ghost" onClick={() => reset()}>Limpiar</Button>}
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-3">
        {error && <Card><p className="text-sm text-red-600 text-center py-4">{error}</p></Card>}
        {loading && entries.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Cargando auditoría…</p>
        ) : filtered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron eventos con estos filtros.</p>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Fecha</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Usuario</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Acción</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap">Entidad</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Detalle</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(e => {
                  const expanded = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(expanded ? null : e.id)}>
                        <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{formatTs(e.timestamp)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[140px]" title={e.userName}>{e.userName || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ACTION_BADGE[e.action]}`}>
                            {describeAction(e)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[200px]" title={`${e.collection} / ${e.documentId}`}>
                          <span className="font-mono text-[10px] text-slate-400">{e.collection}</span>
                          {e.entityLabel && <span className="ml-1.5 text-slate-700 font-medium">{e.entityLabel}</span>}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[280px]" title={describeChanges(e)}>
                          {describeChanges(e)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="text-[10px] text-slate-400">{expanded ? '▼' : '▶'}</span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="px-6 py-3">
                            <div className="text-[11px] text-slate-600 space-y-2">
                              <div><span className="text-slate-400">Document ID:</span> <code className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded">{e.documentId}</code></div>
                              {e.changes && (
                                <div>
                                  <p className="text-slate-400 mb-1">Cambios:</p>
                                  <pre className="text-[10px] bg-white border border-slate-200 rounded p-2 overflow-auto max-h-64">{JSON.stringify(e.changes, null, 2)}</pre>
                                </div>
                              )}
                              {e.details && (
                                <div>
                                  <p className="text-slate-400 mb-1">Detalle del evento:</p>
                                  <pre className="text-[10px] bg-white border border-slate-200 rounded p-2 overflow-auto max-h-64">{JSON.stringify(e.details, null, 2)}</pre>
                                </div>
                              )}
                            </div>
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
