import { useState, useEffect, useMemo, useRef } from 'react';
import type { Cliente, Pendiente, PendienteEstado, PendienteTipo } from '@ags/shared';
import {
  PENDIENTE_TIPO_LABELS,
  PENDIENTE_TIPO_COLORS,
  PENDIENTE_ESTADO_LABELS,
  PENDIENTE_ESTADO_COLORS,
} from '@ags/shared';
import { clientesService } from '../../services/firebaseService';
import { pendientesService, type PendienteFilters } from '../../services/pendientesService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebounce } from '../../hooks/useDebounce';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CreatePendienteModal } from '../../components/pendientes/CreatePendienteModal';
import { DescartarPendienteModal } from '../../components/pendientes/DescartarPendienteModal';

const thClass =
  'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const tdClass = 'px-3 py-2 text-xs text-slate-600';

// Estado tabs
const ESTADO_TABS: Array<{ value: PendienteEstado | ''; label: string }> = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
  { value: 'descartada', label: 'Descartadas' },
  { value: '', label: 'Todas' },
];

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const PendientesList = () => {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPendiente, setEditPendiente] = useState<Pendiente | null>(null);
  const [descartarPendiente, setDescartarPendiente] = useState<Pendiente | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const FILTER_SCHEMA = useMemo(
    () => ({
      search: { type: 'string' as const, default: '' },
      cliente: { type: 'string' as const, default: '' },
      tipo: { type: 'string' as const, default: '' },
      estado: { type: 'string' as const, default: 'pendiente' as string },
    }),
    [],
  );
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  // Load clientes (para filtro)
  useEffect(() => {
    clientesService
      .getAll(true)
      .then(setClientes)
      .catch(() => {});
  }, []);

  // Real-time subscription — filtros server-side por estado/tipo/cliente
  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    const serviceFilters: PendienteFilters = {
      clienteId: filters.cliente || undefined,
      tipo: (filters.tipo || undefined) as PendienteTipo | undefined,
      estado: (filters.estado || undefined) as PendienteEstado | undefined,
      includeDescartadas: filters.estado === 'descartada' || filters.estado === '',
    };
    unsubRef.current = pendientesService.subscribe(
      serviceFilters,
      data => {
        setPendientes(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => {
      unsubRef.current?.();
    };
  }, [filters.cliente, filters.tipo, filters.estado]);

  // Client-side search sobre descripción / cliente / equipo
  const filtrados = useMemo(() => {
    if (!debouncedSearch.trim()) return pendientes;
    const q = debouncedSearch.toLowerCase();
    return pendientes.filter(
      p =>
        p.descripcion.toLowerCase().includes(q) ||
        p.clienteNombre.toLowerCase().includes(q) ||
        (p.equipoNombre || '').toLowerCase().includes(q) ||
        (p.equipoAgsId || '').toLowerCase().includes(q),
    );
  }, [pendientes, debouncedSearch]);

  const handleReabrir = async (p: Pendiente) => {
    await pendientesService.reabrir(p.id);
  };

  const hasFilters =
    filters.cliente || filters.tipo || filters.search || filters.estado !== 'pendiente';

  const activeTabStyle =
    'bg-teal-600 text-white border-teal-600';
  const inactiveTabStyle =
    'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pendientes"
        count={filtrados.length}
        subtitle="Recordatorios que se muestran al crear presupuestos u órdenes de trabajo"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + Nueva Pendiente
          </Button>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs de estado */}
          <div className="flex items-center gap-1">
            {ESTADO_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter('estado', tab.value)}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                  filters.estado === tab.value ? activeTabStyle : inactiveTabStyle
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200" />

          <input
            type="text"
            placeholder="Buscar en descripción, cliente, equipo..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />

          <div className="w-48">
            <SearchableSelect
              size="sm"
              value={filters.cliente}
              onChange={v => setFilter('cliente', v)}
              options={[
                { value: '', label: 'Cliente: Todos' },
                ...clientes.map(c => ({ value: c.id, label: c.razonSocial })),
              ]}
              placeholder="Cliente"
            />
          </div>

          <select
            value={filters.tipo}
            onChange={e => setFilter('tipo', e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">Tipo: Todos</option>
            {(Object.entries(PENDIENTE_TIPO_LABELS) as [PendienteTipo, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] text-teal-600 hover:text-teal-700 font-medium"
            >
              Limpiar
            </button>
          )}
        </div>
      </PageHeader>

      <Card>
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">No hay pendientes</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-teal-600 hover:underline mt-2 inline-block text-xs"
            >
              Crear primera pendiente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className={thClass}>Cliente</th>
                  <th className={thClass}>Equipo</th>
                  <th className={thClass}>Tipo</th>
                  <th className={`${thClass} w-full`}>Descripción</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Origen</th>
                  <th className={thClass}>Creado</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const isPending = p.estado === 'pendiente';
                  const isCompleted = p.estado === 'completada';
                  const isDescartada = p.estado === 'descartada';
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className={`${tdClass} font-medium text-slate-800 max-w-[180px] truncate`}>
                        {p.clienteNombre}
                      </td>
                      <td className={`${tdClass} max-w-[160px] truncate`}>
                        {p.equipoNombre ? (
                          <span>
                            {p.equipoNombre}
                            {p.equipoAgsId && (
                              <span className="font-mono text-[10px] text-slate-400 ml-1">
                                ({p.equipoAgsId})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${PENDIENTE_TIPO_COLORS[p.tipo]}`}
                        >
                          {PENDIENTE_TIPO_LABELS[p.tipo]}
                        </span>
                      </td>
                      <td className={`${tdClass} max-w-[400px]`}>
                        <p className="line-clamp-2" title={p.descripcion}>
                          {p.descripcion}
                        </p>
                        {isCompleted && p.resolucionDocLabel && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            ✓ Incluida en {p.resolucionDocLabel}
                          </p>
                        )}
                        {isDescartada && p.descartadaMotivo && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            Motivo: {p.descartadaMotivo}
                          </p>
                        )}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${PENDIENTE_ESTADO_COLORS[p.estado]}`}
                        >
                          {PENDIENTE_ESTADO_LABELS[p.estado]}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {p.origenTicketId ? (
                          <span className="text-[11px] font-mono text-slate-500">
                            Ticket
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <span className="text-slate-500">{fmtDate(p.createdAt)}</span>
                        {p.createdByName && (
                          <p className="text-[10px] text-slate-400">{p.createdByName}</p>
                        )}
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1">
                          {isPending && (
                            <>
                              <button
                                onClick={() => setEditPendiente(p)}
                                className="text-[10px] font-medium text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setDescartarPendiente(p)}
                                className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
                              >
                                Descartar
                              </button>
                            </>
                          )}
                          {(isCompleted || isDescartada) && (
                            <button
                              onClick={() => handleReabrir(p)}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreatePendienteModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => setShowCreate(false)}
      />

      <CreatePendienteModal
        open={!!editPendiente}
        pendiente={editPendiente}
        onClose={() => setEditPendiente(null)}
        onSaved={() => setEditPendiente(null)}
      />

      <DescartarPendienteModal
        open={!!descartarPendiente}
        pendiente={descartarPendiente}
        onClose={() => setDescartarPendiente(null)}
        onDescartada={() => setDescartarPendiente(null)}
      />
    </div>
  );
};
