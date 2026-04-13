import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { contratosService, clientesService } from '../../services/firebaseService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDebounce } from '../../hooks/useDebounce';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import type { Contrato, Cliente, EstadoContrato } from '@ags/shared';
import { ESTADO_CONTRATO_LABELS, ESTADO_CONTRATO_COLORS, TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { CreateContratoModal } from '../../components/contratos/CreateContratoModal';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const ContratosList = () => {
  const navigate = useNavigate();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('contratos-list');
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
            <table ref={tableRef} className="w-full text-xs table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
              )}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <SortableHeader label="Numero" field="numero" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Cliente" field="clienteNombre" currentField={filters.sortField} currentDir={filters.sortDir as SortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(2)} relative`}><ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />Vigencia<div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Tipo limite<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(4)} relative`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Visitas<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Servicios<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(6)} relative`}><ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />Estado<div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(7)} relative`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Presupuesto<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const visitasRestantes = c.tipoLimite === 'visitas' && c.maxVisitas !== null ? c.maxVisitas - c.visitasUsadas : null;
                  return (
                    <tr key={c.id} onClick={() => navigate(`/contratos/${c.id}`)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className={`px-3 py-2 font-mono font-medium text-teal-700 ${getAlignClass(0)}`}>{c.numero}</td>
                      <td className={`px-3 py-2 text-slate-700 max-w-[200px] truncate ${getAlignClass(1)}`}>{c.clienteNombre}</td>
                      <td className={`px-3 py-2 text-slate-500 whitespace-nowrap ${getAlignClass(2)}`}>{fmtDate(c.fechaInicio)} — {fmtDate(c.fechaFin)}</td>
                      <td className={`px-3 py-2 text-slate-500 ${getAlignClass(3)}`}>{TIPO_LIMITE_CONTRATO_LABELS[c.tipoLimite]}</td>
                      <td className={`px-3 py-2 ${getAlignClass(4)}`}>
                        {visitasRestantes !== null ? (
                          <span className={`font-mono font-medium ${visitasRestantes <= 2 ? 'text-red-600' : visitasRestantes <= 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {c.visitasUsadas}/{c.maxVisitas}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-[11px] text-slate-500 ${getAlignClass(5)}`}>{c.serviciosIncluidos.map(s => s.tipoServicioNombre).join(', ')}</td>
                      <td className={`px-3 py-2 ${getAlignClass(6)}`}>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_CONTRATO_COLORS[c.estado]}`}>
                          {ESTADO_CONTRATO_LABELS[c.estado]}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-[11px] font-mono text-slate-500 ${getAlignClass(7)}`}>{c.presupuestoNumero || '—'}</td>
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
