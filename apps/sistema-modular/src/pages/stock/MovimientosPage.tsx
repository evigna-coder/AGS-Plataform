import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { movimientosService } from '../../services/firebaseService';
import { useDebounce } from '../../hooks/useDebounce';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { matchesSearch } from '../../utils/searchTerms';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateMovimientoLoteModal } from '../../components/stock/CreateMovimientoLoteModal';
import { StockIntakeModal } from '../../components/stock/StockIntakeModal';
import { MovimientoDetailDrawer } from '../../components/stock/MovimientoDetailDrawer';
import { MovimientosFilters } from './MovimientosFilters';
import { MovimientosTable } from './MovimientosTable';
import type { MovimientoStock } from '@ags/shared';

const formatDay = (d: Date) =>
  d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// input type=date → 'YYYY-MM-DD'. Parseamos a hora LOCAL (no UTC) para que el rango
// coincida con lo que ve el usuario en AR: inicio del día y fin del día.
const parseInicioDia = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const parseFinDia = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

export const MovimientosPage = () => {
  const { pathname } = useLocation();
  const fromState = { from: pathname };

  const FILTER_SCHEMA = useMemo(() => ({
    search: { type: 'string' as const, default: '' },
    tipo: { type: 'string' as const, default: '' },
    fechaDesde: { type: 'string' as const, default: '' },
    fechaHasta: { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'createdAt' },
    sortDir:   { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , ] = useUrlFilters(FILTER_SCHEMA);
  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  // Local search state for responsive typing — syncs to URL debounced
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);
  useEffect(() => { setFilter('search', debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (filters.search !== localSearch && filters.search === '') setLocalSearch(''); }, [filters.search]);
  const [showCreate, setShowCreate] = useState(false);
  const [showIngreso, setShowIngreso] = useState(false);
  const [selected, setSelected] = useState<MovimientoStock | null>(null);

  // Primer día del mes actual a las 00:00 (browser real → new Date() OK).
  const inicioMes = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  }, []);
  // Cuando hay término de búsqueda cargamos TODO el historial; sin búsqueda, sólo el mes.
  const hayBusqueda = debouncedSearch.trim().length > 0;

  // Prioridad de suscripción (server-side `desde`, sin índice compuesto con `tipo`):
  //  1) búsqueda → todo el historial ({}), para poder encontrar cualquier OC/serie vieja.
  //  2) sin búsqueda pero con `fechaDesde` → desde esa fecha.
  //  3) ni búsqueda ni fecha → default mes actual.
  // `fechaHasta` (y `fechaDesde` cuando no manda la suscripción) se aplican client-side
  // en `filtered`, así el rango es exacto sin pedir índices nuevos.
  const desdeSub = useMemo<Date | null>(() => {
    if (hayBusqueda) return null;
    return parseInicioDia(filters.fechaDesde) ?? inicioMes;
  }, [hayBusqueda, filters.fechaDesde, inicioMes]);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    setLoading(true);
    // El filtro por tipo se aplica client-side (ver `filtered`): en modo `desde` no se
    // combina con where('tipo') server-side para no requerir índice compuesto, y así
    // cambiar de tipo tampoco fuerza re-suscribir.
    const queryFilters = desdeSub ? { desde: desdeSub } : {};
    unsubRef.current = movimientosService.subscribe(
      queryFilters,
      (items) => { setItems(items); setLoading(false); },
      (err) => { console.error('Error cargando movimientos:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [desdeSub]);

  const load = useCallback(() => {}, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filters.tipo) {
      list = list.filter(m => m.tipo === filters.tipo);
    }
    if (debouncedSearch) {
      list = list.filter(m => matchesSearch(
        debouncedSearch,
        m.articuloCodigo, m.articuloDescripcion,
        m.ordenCompraNumero, m.despachoImportacionNumero, m.nroSerie, m.nroLote,
      ));
    }
    // Rango de fecha SIEMPRE client-side, para que sea exacto aunque la suscripción haya
    // traído de más (modo búsqueda = todo el historial) o de menos no aplica (siempre trae ≥ desde).
    const desdeClient = parseInicioDia(filters.fechaDesde);
    const hastaClient = parseFinDia(filters.fechaHasta);
    if (desdeClient || hastaClient) {
      const desdeMs = desdeClient?.getTime() ?? -Infinity;
      const hastaMs = hastaClient?.getTime() ?? Infinity;
      list = list.filter(m => {
        const t = new Date(m.createdAt).getTime();
        return t >= desdeMs && t <= hastaMs;
      });
    }
    return sortByField(list, filters.sortField, filters.sortDir as SortDir);
  }, [items, filters.tipo, debouncedSearch, filters.fechaDesde, filters.fechaHasta, filters.sortField, filters.sortDir]);

  // Texto de contexto: refleja el modo activo (búsqueda / rango / mes por defecto).
  const hint = useMemo(() => {
    if (hayBusqueda) return 'Buscando en todo el historial.';
    const desde = parseInicioDia(filters.fechaDesde);
    const hasta = parseFinDia(filters.fechaHasta);
    if (desde || hasta) {
      const desdeTxt = desde ? formatDay(desde) : 'inicio';
      const hastaTxt = hasta ? formatDay(hasta) : 'hoy';
      return `Rango ${desdeTxt} — ${hastaTxt}.`;
    }
    return `Mostrando movimientos desde el ${formatDay(inicioMes)} — buscá o usá el rango para ver el resto del historial.`;
  }, [hayBusqueda, filters.fechaDesde, filters.fechaHasta, inicioMes]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Movimientos de Stock"
        subtitle="Historial de movimientos de inventario"
        count={filtered.length}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>+ Registrar movimiento</Button>
            <Button size="sm" onClick={() => setShowIngreso(true)}>+ Ingresar stock</Button>
          </div>
        }
      >
        <MovimientosFilters
          tipo={filters.tipo}
          onTipoChange={v => setFilter('tipo', v)}
          localSearch={localSearch}
          onSearchChange={setLocalSearch}
          fechaDesde={filters.fechaDesde}
          onFechaDesdeChange={v => setFilter('fechaDesde', v)}
          fechaHasta={filters.fechaHasta}
          onFechaHastaChange={v => setFilter('fechaHasta', v)}
        />
      </PageHeader>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-4">
        <div className="py-2 text-[11px] text-slate-500">{hint}</div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Cargando movimientos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No se encontraron movimientos</p>
            </div>
          </Card>
        ) : (
          <MovimientosTable
            items={filtered}
            sortField={filters.sortField}
            sortDir={filters.sortDir as SortDir}
            onSort={handleSort}
            onSelect={setSelected}
            fromState={fromState}
          />
        )}
      </div>

      <CreateMovimientoLoteModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
        onRequestIngreso={() => { setShowCreate(false); setShowIngreso(true); }}
      />
      <StockIntakeModal open={showIngreso} onClose={() => setShowIngreso(false)} onCreated={() => setShowIngreso(false)} />
      <MovimientoDetailDrawer open={selected !== null} movimiento={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
