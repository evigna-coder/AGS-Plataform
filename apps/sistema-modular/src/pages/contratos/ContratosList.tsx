import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { contratosService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebounce } from '../../hooks/useDebounce';
import type { Contrato, Cliente, EstadoContrato } from '@ags/shared';
import { ESTADO_CONTRATO_LABELS, ESTADO_CONTRATO_COLORS, TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateContratoModal } from '../../components/contratos/CreateContratoModal';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const ContratosList = () => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const FILTER_SCHEMA = useMemo(() => ({
    search:    { type: 'string' as const, default: '' },
    cliente:   { type: 'string' as const, default: '' },
    estado:    { type: 'string' as const, default: '' },
    sortField: { type: 'string' as const, default: 'createdAt' },
    sortDir:   { type: 'string' as const, default: 'desc' },
  }), []);
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const debouncedSearch = useDebounce(filters.search, 300);

  const handleSort = (f: string) => {
    const s = toggleSort(f, filters.sortField, filters.sortDir as SortDir);
    setFilter('sortField', s.field); setFilter('sortDir', s.dir);
  };

  useEffect(() => {
    clientesService.getAll(true).then(setClientes).catch(() => {});
    setLoading(true);
    unsubRef.current = contratosService.subscribe(undefined, (data) => { setContratos(data); setLoading(false); }, () => setLoading(false));
    return () => { unsubRef.current?.(); };
  }, []);

  const filtrados = useMemo(() => {
    let result = contratos.filter(c => {
      if (filters.cliente && c.clienteId !== filters.cliente) return false;
      if (filters.estado && c.estado !== filters.estado) return false;
      return true;
    });
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(c => c.numero.toLowerCase().includes(q) || c.clienteNombre.toLowerCase().includes(q));
    }
    return sortByField(result, filters.sortField, filters.sortDir as SortDir);
  }, [contratos, filters, debouncedSearch]);

  const activos = contratos.filter(c => c.estado === 'activo');
  const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
  const hasFilters = filters.cliente || filters.estado || filters.search;

  return (
    <div className="space-y-4">
      <PageHeader title="Contratos" count={filtrados.length} subtitle={`${activos.length} activo(s)`}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Contrato</Button>}>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Buscar por numero, cliente..." value={filters.search} onChange={e => setFilter('search', e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-56" />
          <div className="w-48">
            <SearchableSelect size="sm" value={filters.cliente} onChange={v => setFilter('cliente', v)}
              options={[{ value: '', label: 'Cliente: Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]} placeholder="Cliente" />
          </div>
          <select value={filters.estado} onChange={e => setFilter('estado', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
            <option value="">Estado: Todos</option>
            {(Object.entries(ESTADO_CONTRATO_LABELS) as [EstadoContrato, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {hasFilters && <button onClick={resetFilters} className="text-[11px] text-teal-600 hover:text-teal-700 font-medium">Limpiar</button>}
        </div>
      </PageHeader>

      <Card>
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No hay contratos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <SortableHeader label="Numero" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Vigencia</th>
                  <th className={thClass}>Tipo limite</th>
                  <th className={thClass}>Visitas</th>
                  <th className={thClass}>Servicios</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const visitasRestantes = c.tipoLimite === 'visitas' && c.maxVisitas !== null ? c.maxVisitas - c.visitasUsadas : null;
                  return (
                    <tr key={c.id} onClick={() => navigate(`/contratos/${c.id}`)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-3 py-2 text-center font-mono font-medium text-teal-700">{c.numero}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{c.clienteNombre}</td>
                      <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{fmtDate(c.fechaInicio)} — {fmtDate(c.fechaFin)}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{TIPO_LIMITE_CONTRATO_LABELS[c.tipoLimite]}</td>
                      <td className="px-3 py-2 text-center">
                        {visitasRestantes !== null ? (
                          <span className={`font-mono font-medium ${visitasRestantes <= 2 ? 'text-red-600' : visitasRestantes <= 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {c.visitasUsadas}/{c.maxVisitas}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-500">{c.serviciosIncluidos.map(s => s.tipoServicioNombre).join(', ')}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_CONTRATO_COLORS[c.estado]}`}>
                          {ESTADO_CONTRATO_LABELS[c.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] font-mono text-slate-500">{c.presupuestoNumero || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateContratoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
    </div>
  );
};
