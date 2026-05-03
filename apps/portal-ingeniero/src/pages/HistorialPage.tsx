import { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import HistorialFilterBar from '../components/historial/HistorialFilterBar';
import HistorialOTCard from '../components/historial/HistorialOTCard';
import HistorialTable from '../components/historial/HistorialTable';
import { otService, clientesService, tiposServicioService, type WorkOrderWithPdf } from '../services/firebaseService';
import { REPORTES_OT_URL } from '../utils/constants';
import { sortByField, toggleSort, type SortDir } from '../components/ui/SortableHeader';
import { useUrlFilters } from '../hooks/useUrlFilters';

const FILTER_SCHEMA = {
  search: { type: 'string', default: '' },
  cliente: { type: 'string', default: '' },
  equipo: { type: 'string', default: '' },
  tipoServicio: { type: 'string', default: '' },
  fechaDesde: { type: 'string', default: '' },
  fechaHasta: { type: 'string', default: '' },
  // Ventana server-side por updatedAt. '0' = sin cut, traer todo.
  lookback: { type: 'string', default: '30' },
} as const;

const LOOKBACK_OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
  { value: '0', label: 'Todas' },
];

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return dateStr; }
}

const openPDF = (ot: WorkOrderWithPdf) => {
  if (ot.pdfUrl) window.open(ot.pdfUrl, '_blank');
  else window.open(`${REPORTES_OT_URL}?reportId=${encodeURIComponent(ot.otNumber)}`, '_blank');
};

const openProtocol = (ot: WorkOrderWithPdf) => {
  if (ot.protocolPdfUrl) window.open(ot.protocolPdfUrl, '_blank');
};

export default function HistorialPage() {
  const [ots, setOts] = useState<WorkOrderWithPdf[]>([]);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [tiposServicio, setTiposServicio] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState<string>('fechaInicio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    setLoading(true);
    // Sin server-side status filter — "finalizada" abarca dos sources of truth:
    //   (a) status === 'FINALIZADO' (reportes-ot al firmar) y
    //   (b) estadoAdmin ∈ {CIERRE_TECNICO, CIERRE_ADMINISTRATIVO, FINALIZADO} (workflow admin)
    // Los OTs pueden tener uno u otro seteado. Filtramos client-side abajo.
    // El rango (lookback) se aplica también client-side: muchos docs viejos tienen
    // updatedAt como string ISO o sin setear, lo que rompe el cut por Timestamp.
    unsubRef.current = otService.subscribe(
      undefined,
      (data) => { setOts(data); setLoading(false); },
      (err) => { console.error('Historial subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, []);

  const finalizadas = useMemo(() => ots.filter(ot =>
    ot.status === 'FINALIZADO' ||
    ot.estadoAdmin === 'CIERRE_TECNICO' ||
    ot.estadoAdmin === 'CIERRE_ADMINISTRATIVO' ||
    ot.estadoAdmin === 'FINALIZADO',
  ), [ots]);

  useEffect(() => {
    clientesService.getAll().then(setClientes).catch(err => console.warn('Clientes load failed:', err));
    tiposServicioService.getAll().then(setTiposServicio).catch(err => console.warn('Tipos servicio load failed:', err));
  }, []);

  const clienteRazonById = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach(c => m.set(c.id, c.razonSocial.toLowerCase()));
    return m;
  }, [clientes]);

  const lookbackCutoff = useMemo(() => {
    const days = parseInt(filters.lookback, 10);
    if (!days || days <= 0) return null;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [filters.lookback]);

  const filtered = useMemo(() => {
    let list = finalizadas;
    if (lookbackCutoff) {
      list = list.filter(ot => {
        const d = ot.fechaInicio || ot.fechaFin || ot.fechaServicioAprox || ot.updatedAt || ot.createdAt;
        return !!d && d >= lookbackCutoff;
      });
    }
    if (filters.cliente) {
      const razon = clienteRazonById.get(filters.cliente);
      list = list.filter(ot => {
        if (ot.clienteId === filters.cliente) return true;
        if (razon && ot.razonSocial?.toLowerCase().includes(razon)) return true;
        return false;
      });
    }
    if (filters.tipoServicio) {
      list = list.filter(ot => ot.tipoServicio === filters.tipoServicio);
    }
    if (filters.equipo.trim()) {
      const e = filters.equipo.toLowerCase();
      list = list.filter(ot =>
        ot.moduloModelo?.toLowerCase().includes(e) ||
        ot.moduloSerie?.toLowerCase().includes(e) ||
        ot.sistema?.toLowerCase().includes(e) ||
        ot.codigoInternoCliente?.toLowerCase().includes(e),
      );
    }
    if (filters.fechaDesde) {
      list = list.filter(ot => (ot.fechaInicio || ot.fechaFin || ot.fechaServicioAprox || '') >= filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      list = list.filter(ot => (ot.fechaInicio || ot.fechaFin || ot.fechaServicioAprox || '') <= filters.fechaHasta + 'T23:59:59');
    }
    if (filters.search.trim()) {
      const s = filters.search.toLowerCase();
      list = list.filter(ot =>
        ot.otNumber?.toLowerCase().includes(s) ||
        ot.razonSocial?.toLowerCase().includes(s) ||
        ot.sistema?.toLowerCase().includes(s) ||
        ot.tipoServicio?.toLowerCase().includes(s) ||
        ot.ingenieroAsignadoNombre?.toLowerCase().includes(s) ||
        ot.moduloModelo?.toLowerCase().includes(s) ||
        ot.moduloSerie?.toLowerCase().includes(s) ||
        ot.codigoInternoCliente?.toLowerCase().includes(s),
      );
    }
    return sortByField(list, sortField, sortDir);
  }, [finalizadas, filters, clienteRazonById, sortField, sortDir, lookbackCutoff]);

  const hasActiveFilters = filters.search || filters.cliente || filters.equipo || filters.tipoServicio || filters.fechaDesde || filters.fechaHasta;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Historial"
        subtitle={loading ? '...' : `${filtered.length} órdenes finalizadas`}
      />

      <HistorialFilterBar
        search={filters.search}
        cliente={filters.cliente}
        equipo={filters.equipo}
        tipoServicio={filters.tipoServicio}
        fechaDesde={filters.fechaDesde}
        fechaHasta={filters.fechaHasta}
        lookback={filters.lookback}
        lookbackOptions={LOOKBACK_OPTIONS}
        clientes={clientes}
        tiposServicio={tiposServicio}
        onChange={{
          search: v => setFilter('search', v),
          cliente: v => setFilter('cliente', v),
          equipo: v => setFilter('equipo', v),
          tipoServicio: v => setFilter('tipoServicio', v),
          fechaDesde: v => setFilter('fechaDesde', v),
          fechaHasta: v => setFilter('fechaHasta', v),
          lookback: v => setFilter('lookback', v),
        }}
        onReset={resetFilters}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-slate-600">
              {hasActiveFilters ? 'Sin resultados' : 'Sin OTs finalizadas en este rango'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters
                ? 'Probá con otros filtros.'
                : filters.lookback !== '0'
                  ? 'Ampliá el rango arriba para buscar OTs más antiguas.'
                  : 'Acá se listan las OTs con cierre técnico.'}
            </p>
          </div>
        ) : (
          <>
            <HistorialTable
              rows={filtered}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              onOpenPdf={openPDF}
              onOpenProtocol={openProtocol}
              fmt={fmt}
            />
            <div className="md:hidden space-y-2">
              {filtered.map(ot => <HistorialOTCard key={ot.otNumber} ot={ot} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
