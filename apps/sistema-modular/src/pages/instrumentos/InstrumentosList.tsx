import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreateInstrumentoModal } from '../../components/instrumentos/CreateInstrumentoModal';
import {
  CATEGORIA_INSTRUMENTO_LABELS,
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaInstrumento,
  type CategoriaPatron,
  type EstadoCertificado,
  type InstrumentoPatron,
} from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const ESTADO_BADGE: Record<EstadoCertificado, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

const ALL_CAT_LABELS: Record<string, string> = { ...CATEGORIA_INSTRUMENTO_LABELS, ...CATEGORIA_PATRON_LABELS };
const CATS_INSTRUMENTO = Object.entries(CATEGORIA_INSTRUMENTO_LABELS) as [CategoriaInstrumento, string][];
const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'instrumento', label: 'Instrumento' },
  { value: 'patron', label: 'Patrón' },
];

const ESTADO_CERT_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'sin_certificado', label: 'Sin certificado' },
];

const FILTER_SCHEMA = {
  tipo: { type: 'string' as const, default: '' },
  categoria: { type: 'string' as const, default: '' },
  estadoCert: { type: 'string' as const, default: '' },
  showInactive: { type: 'boolean' as const, default: false },
};

export const InstrumentosList = () => {

  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('instrumentos-list');
  const { instrumentos, loading, error, listInstrumentos, deactivateInstrumento } = useInstrumentos();
  const [showCreate, setShowCreate] = useState(false);

  const [filters, setFilter, setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const reload = () => {
    listInstrumentos({
      tipo: (filters.tipo as 'instrumento' | 'patron') || undefined,
      categoria: (filters.categoria as CategoriaInstrumento | CategoriaPatron) || undefined,
      activoOnly: !filters.showInactive,
    });
  };

  useEffect(() => { reload(); }, [filters.tipo, filters.categoria, filters.showInactive]);

  const catOptions = useMemo(() => {
    const cats = filters.tipo === 'patron' ? CATS_PATRON : filters.tipo === 'instrumento' ? CATS_INSTRUMENTO : [...CATS_INSTRUMENTO, ...CATS_PATRON];
    return [{ value: '', label: 'Todas' }, ...cats.map(([k, v]) => ({ value: k, label: v }))];
  }, [filters.tipo]);

  const filtered = useMemo(() => {
    let result = instrumentos;
    if (filters.estadoCert) result = result.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === filters.estadoCert);
    return sortByField(result, sortField, sortDir);
  }, [instrumentos, filters.estadoCert, sortField, sortDir]);

  const vencidos = instrumentos.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === 'vencido');
  const porVencer = instrumentos.filter(i => calcularEstadoCertificado(i.certificadoVencimiento) === 'por_vencer');

  const handleDeactivate = async (inst: InstrumentoPatron) => {
    if (!await confirm(`¿Desactivar "${inst.nombre}"?`)) return;
    try {
      await deactivateInstrumento(inst.id);
      reload();
    } catch {
      alert('Error al desactivar el instrumento');
    }
  };

  const isInitialLoad = loading && instrumentos.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Instrumentos y Patrones"
        subtitle="Gestionar instrumentos, patrones y certificados de calibración"
        count={isInitialLoad ? undefined : filtered.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo instrumento</Button>
        }
      >
        <div className="space-y-2">
          {(vencidos.length > 0 || porVencer.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {vencidos.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <span className="text-red-700 text-[11px] font-medium">{vencidos.length} cert. vencido(s)</span>
                </div>
              )}
              {porVencer.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span className="text-amber-700 text-[11px] font-medium">{porVencer.length} cert. por vencer (30d)</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[130px]">
              <SearchableSelect value={filters.tipo}
                onChange={(v) => setFilters({ tipo: v, categoria: '' })}
                options={TIPO_OPTIONS} placeholder="Tipo" />
            </div>
            <div className="min-w-[160px]">
              <SearchableSelect value={filters.categoria}
                onChange={(v) => setFilter('categoria', v)}
                options={catOptions} placeholder="Categoría" />
            </div>
            <div className="min-w-[150px]">
              <SearchableSelect value={filters.estadoCert}
                onChange={(v) => setFilter('estadoCert', v)}
                options={ESTADO_CERT_OPTIONS} placeholder="Estado cert." />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.showInactive}
                onChange={e => setFilter('showInactive', e.target.checked)}
                className="rounded border-slate-300" />
              Inactivos
            </label>
            <Button variant="ghost" size="sm"
              onClick={resetFilters}>
              Limpiar
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando instrumentos...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay instrumentos que coincidan con los filtros</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Identificación" field="nombre" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Tipo" field="tipo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Marca / Modelo" field="marca" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}><ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} />Serie<div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(4)} relative`}><ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} />Categorías<div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}><ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} />Certificado<div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <SortableHeader label="Vencim." field="certificadoVencimiento" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(6)} relative`}>
                    <ColAlignIcon align={colAligns?.[6] || 'left'} onClick={() => cycleAlign(6)} />
                    <div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(7)} relative`}><ColAlignIcon align={colAligns?.[7] || 'left'} onClick={() => cycleAlign(7)} />Estado<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(8, e)} onDoubleClick={() => onAutoFit(8)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inst => {
                  const estado = calcularEstadoCertificado(inst.certificadoVencimiento);
                  const badge = ESTADO_BADGE[estado];
                  return (
                    <tr key={inst.id} className={`hover:bg-slate-50 transition-colors ${!inst.activo ? 'opacity-50' : ''}`}>
                      <td className={`px-3 py-2 text-xs font-semibold text-teal-600 truncate ${getAlignClass(0)}`} title={inst.nombre}>{inst.nombre}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 capitalize whitespace-nowrap ${getAlignClass(1)}`}>{inst.tipo}</td>
                      <td className={`px-3 py-2 text-xs text-slate-600 truncate ${getAlignClass(2)}`} title={[inst.marca, inst.modelo].filter(Boolean).join(' / ')}>
                        {[inst.marca, inst.modelo].filter(Boolean).join(' / ') || <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-600 font-mono whitespace-nowrap ${getAlignClass(3)}`}>{inst.serie || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(4)}`}>
                        <div className="flex gap-1 flex-wrap">
                          {inst.categorias.map(c => (
                            <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                              {ALL_CAT_LABELS[c] || c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-xs whitespace-nowrap ${getAlignClass(5)}`}>
                        {inst.certificadoUrl ? (
                          <a href={inst.certificadoUrl} target="_blank" rel="noopener noreferrer"
                            className="text-teal-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>
                            {inst.certificadoNombre || 'Ver PDF'}
                          </a>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs text-slate-600 whitespace-nowrap ${getAlignClass(6)}`}>{inst.certificadoVencimiento || <span className="text-slate-300">—</span>}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${getAlignClass(7)}`}>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/instrumentos/${inst.id}/editar`}
                            className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
                            Editar
                          </Link>
                          {inst.activo && (
                            <button onClick={() => handleDeactivate(inst)}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
                              Desactivar
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
      </div>

      <CreateInstrumentoModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </div>
  );
};
