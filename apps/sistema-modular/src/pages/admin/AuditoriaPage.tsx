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

/** Mapeo de nombre técnico de colección Firestore → nombre humano del módulo. */
const COLLECTION_LABELS: Record<string, string> = {
  clientes: 'Cliente',
  establecimientos: 'Establecimiento',
  reportes: 'Orden de Trabajo',
  ordenes_trabajo: 'Orden de Trabajo',
  presupuestos: 'Presupuesto',
  leads: 'Ticket',
  articulos: 'Artículo',
  posiciones_stock: 'Posición de Stock',
  unidades_stock: 'Unidad de Stock',
  minikits: 'Minikit',
  movimientos_stock: 'Movimiento de Stock',
  remitos: 'Remito',
  fichas_propiedad: 'Ficha',
  vehiculos: 'Vehículo',
  contratos: 'Contrato',
  dispositivos: 'Dispositivo',
  loaners: 'Loaner',
  agenda: 'Agenda',
  qfDocumentos: 'Documento QF',
  tableCatalog: 'Tabla de Protocolo',
  tiposEquipo: 'Tipo de Equipo',
  proveedores: 'Proveedor',
  ingreso_empresas: 'Ingreso de Empresa',
  patrones: 'Patrón',
  instrumentos: 'Instrumento',
  ordenes_compra: 'Orden de Compra',
  facturacion: 'Solicitud de Facturación',
  requerimientos_compra: 'Requerimiento de Compra',
  importaciones: 'Importación',
  pendientes: 'Pendiente',
  asignaciones: 'Asignación',
  mailQueue: 'Email',
  audit_log: 'Registro de Auditoría',
};

function collectionLabel(c: string): string {
  return COLLECTION_LABELS[c] || c;
}

/** Mapeo de eventName de business_event → texto humano. */
const EVENT_LABELS: Record<string, string> = {
  // Clientes
  'cliente.desactivado': 'Dio de baja al cliente',
  'cliente.reactivado': 'Reactivó al cliente',
  // OT
  'ot.estado_cambiado': 'Cambió estado de la OT',
  'ot.cerrada': 'Cerró administrativamente la OT',
  // Presupuestos
  'presupuesto.enviado': 'Envió el presupuesto',
  'presupuesto.aceptado': 'Aceptó el presupuesto',
  'presupuesto.rechazado': 'Rechazó el presupuesto',
  'presupuesto.revision_creada': 'Creó una revisión del presupuesto',
  'presupuesto.factura_solicitada': 'Solicitó factura del presupuesto',
  // Tickets
  'ticket.derivado': 'Derivó el ticket',
  'ticket.reasignado': 'Reasignó el ticket',
  'ticket.accion_completada': 'Completó la acción del ticket',
  'ticket.finalizado': 'Finalizó el ticket',
  'ticket.reabierto': 'Reabrió el ticket',
  // Stock
  'stock.movimiento_creado': 'Registró movimiento de stock',
  'articulo.dado_de_baja': 'Dio de baja al artículo',
};

const ACTION_VERB_BY_TYPE: Record<AuditAction, string> = {
  create: 'Creó',
  update: 'Modificó',
  delete: 'Eliminó',
  business_event: '',
};

function describeActionFull(e: AuditLogEntry): string {
  if (e.action === 'business_event') {
    return EVENT_LABELS[e.eventName || ''] || (e.eventName || 'evento');
  }
  return `${ACTION_VERB_BY_TYPE[e.action]} ${collectionLabel(e.collection).toLowerCase()}`;
}

function actionBadgeLabel(e: AuditLogEntry): string {
  if (e.action === 'business_event') return 'Evento';
  if (e.action === 'create') return 'Creación';
  if (e.action === 'update') return 'Modificación';
  if (e.action === 'delete') return 'Eliminación';
  return e.action;
}

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

/** Diccionario de campos técnicos → nombre humano. Para el resumen del cambio. */
const FIELD_LABELS: Record<string, string> = {
  razonSocial: 'razón social', nombre: 'nombre', activo: 'activo', cuit: 'CUIT',
  estado: 'estado', estadoAdmin: 'estado administrativo', fechaCierre: 'fecha de cierre',
  asignadoA: 'responsable', asignadoNombre: 'responsable', areaActual: 'área',
  prioridad: 'prioridad', proximoContacto: 'próximo contacto', motivoLlamado: 'motivo',
  fechaEnvio: 'fecha de envío', validUntil: 'válido hasta', items: 'items',
  observaciones: 'observaciones', descripcion: 'descripción', telefono: 'teléfono',
  email: 'email', direccion: 'dirección', precio: 'precio', cantidad: 'cantidad',
  fechaCreacion: 'fecha de creación', fechaUltimaActualizacion: 'última actualización',
  versionActual: 'versión actual', historial: 'historial', software: 'software',
};
const SKIP_FIELDS = new Set([
  'updatedAt', 'updatedBy', 'updatedByName', 'createdAt', 'createdBy', 'createdByName',
  'numero', // se muestra ya en entityLabel
]);

function fieldLabel(k: string): string {
  return FIELD_LABELS[k] || k;
}

function describeChanges(e: AuditLogEntry): string {
  if (e.action === 'business_event') {
    if (!e.details) return '';
    const parts: string[] = [];
    for (const [k, v] of Object.entries(e.details)) {
      if (SKIP_FIELDS.has(k)) continue;
      parts.push(`${fieldLabel(k)}: ${stringify(v)}`);
    }
    return parts.join(', ');
  }
  if (!e.changes) return '';
  if (e.action === 'update') {
    const keys = Object.keys(e.changes.after ?? {}).filter(k => !SKIP_FIELDS.has(k));
    if (keys.length === 0) return '—';
    return keys.map(fieldLabel).join(', ');
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
                            {actionBadgeLabel(e)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <span className="font-medium">{describeActionFull(e)}</span>
                          {e.entityLabel && <span className="ml-1 text-slate-500">— {e.entityLabel}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{collectionLabel(e.collection)}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[280px]" title={describeChanges(e)}>
                          {describeChanges(e) || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="text-[10px] text-slate-400">{expanded ? '▼' : '▶'}</span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-3">
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
