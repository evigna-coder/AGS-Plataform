import { useState, useEffect, useMemo, useRef } from 'react';
import { usePatrones } from '../../hooks/usePatrones';
import { procesarLotesVencidos } from '../../utils/patronesDescartesVencidos';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CreatePatronModal } from '../../components/patrones/CreatePatronModal';
import { MigracionPatronesModal } from '../../components/patrones/MigracionPatronesModal';
import { PatronesListPDF } from '../../components/patrones/PatronesListPDF';
import { downloadPdf, todayForFilename } from '../../utils/remitoPdfActions';
import { getCurrentUser } from '../../services/currentUser';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaPatron,
  type Patron,
} from '@ags/shared';
import { computePatronStatus } from '@ags/shared/utils/patronBom';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { ColAlignIcon } from '../../components/ui/ColAlignIcon';
import { PatronRow } from './PatronRow';
import { PatronesBajasTable } from './PatronesBajasTable';

const thClass = 'px-3 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const CAT_OPTIONS = [
  { value: '', label: 'Todas' },
  ...CATS_PATRON.map(([k, v]) => ({ value: k, label: v })),
];

/** Formatea YYYY-MM-DD (date-only) a DD/MM/AAAA sin tropezar con timezone. */
function formatFechaAR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

/** Calcula el estado global de un patrón basado en el lote más crítico. */
function estadoGlobal(patron: Patron): 'vigente' | 'por_vencer' | 'vencido' | 'sin_cert' {
  if (!patron.lotes.length) return 'sin_cert';
  const estados = patron.lotes.map(l => calcularEstadoCertificado(l.fechaVencimiento));
  if (estados.includes('vencido')) return 'vencido';
  if (estados.includes('por_vencer')) return 'por_vencer';
  if (estados.every(e => e === 'sin_certificado')) return 'sin_cert';
  return 'vigente';
}

/** Vencimiento próximo: el más cercano (vigente/por_vencer); si no hay, el más reciente vencido. */
function proximoVencimiento(patron: Patron): string | null {
  const fechas = patron.lotes.map(l => l.fechaVencimiento).filter((f): f is string => !!f);
  if (fechas.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const futuras = fechas.filter(f => f >= today).sort();
  if (futuras.length > 0) return futuras[0];
  return fechas.sort().reverse()[0];
}

/** Suma cantidades de todos los lotes del patrón. */
function totalCantidad(patron: Patron): number {
  return patron.lotes.reduce((sum, l) => sum + (typeof l.cantidad === 'number' ? l.cantidad : 0), 0);
}

const FILTER_SCHEMA = {
  categoria: { type: 'string' as const, default: '' },
  showInactive: { type: 'boolean' as const, default: false },
  // BOM-06: solo patrones con algún lote bloqueado o agotado (saldo BOM ≤ mínimo).
  bloqueados: { type: 'boolean' as const, default: false },
  // 'activos' = lotes vigentes | 'bajas' = historial de lotes dados de baja
  vista: { type: 'string' as const, default: 'activos' },
};

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_cert: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

export const PatronesList = () => {
  const confirm = useConfirm();
  const { tableRef, colWidths, colAligns, onResizeStart, onAutoFit, cycleAlign, getAlignClass } = useResizableColumns('patrones-list-v2');
  const { patrones, loading, error, listPatrones, deactivatePatron } = usePatrones();
  const [showCreate, setShowCreate] = useState(false);
  const [showMigracion, setShowMigracion] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilter, _setFilters, resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const [sortField, setSortField] = useState('codigoArticulo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };

  const reload = () => {
    listPatrones({
      categoria: (filters.categoria as CategoriaPatron) || undefined,
      activoOnly: !filters.showInactive,
    });
  };

  useEffect(() => { reload(); }, [filters.categoria, filters.showInactive]);

  // Baja automática de lotes vencidos + ticket de descarte. Una vez por mount;
  // si dio de baja algo, recarga para que desaparezcan del listado activo.
  const sweepRan = useRef(false);
  useEffect(() => {
    if (sweepRan.current) return;
    sweepRan.current = true;
    void procesarLotesVencidos()
      .then(n => { if (n > 0) reload(); })
      .catch(err => console.error('Sweep de lotes vencidos falló:', err));
  }, []);

  const filtered = useMemo(() => {
    const base = filters.bloqueados
      ? patrones.filter(p => {
          const s = computePatronStatus(p);
          return s === 'bloqueado' || s === 'agotado';
        })
      : patrones;
    return sortByField(base, sortField, sortDir);
  }, [patrones, sortField, sortDir, filters.bloqueados]);

  const vencidos = patrones.filter(p => estadoGlobal(p) === 'vencido');
  const porVencer = patrones.filter(p => estadoGlobal(p) === 'por_vencer');
  const totalBajas = useMemo(() => patrones.reduce((n, p) => n + (p.lotesBaja?.length ?? 0), 0), [patrones]);
  const vistaBajas = filters.vista === 'bajas';

  const handleDeactivate = async (p: Patron) => {
    if (!await confirm(`¿Desactivar "${p.descripcion}"?`)) return;
    try {
      await deactivatePatron(p.id);
      reload();
    } catch {
      alert('Error al desactivar el patrón');
    }
  };

  const handleExportPdf = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      const filtrosLabel = [
        filters.categoria && `Categoría: ${CATEGORIA_PATRON_LABELS[filters.categoria as CategoriaPatron] || filters.categoria}`,
        filters.showInactive && 'Incluye inactivos',
      ].filter(Boolean).join(' · ');
      const user = getCurrentUser();
      await downloadPdf(
        <PatronesListPDF
          items={filtered}
          generadoPor={user?.displayName ?? null}
          filtros={filtrosLabel || undefined}
        />,
        `Listado de patrones - ${todayForFilename()}`,
      );
    } catch (err) {
      console.error('Error exportando PDF:', err);
      alert('No se pudo generar el PDF');
    } finally {
      setExporting(false);
    }
  };

  const isInitialLoad = loading && patrones.length === 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Patrones"
        subtitle="Estándares y materiales de referencia con lotes y certificados"
        count={isInitialLoad ? undefined : vistaBajas ? totalBajas : filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleExportPdf()}
              disabled={exporting || filtered.length === 0 || vistaBajas}>
              {exporting ? 'Generando…' : 'Exportar PDF'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowMigracion(true)} title="Migrar patrones antiguos desde la colección instrumentos">
              Migrar desde instrumentos
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo patrón</Button>
          </div>
        }
      >
        <div className="space-y-2">
          {(vencidos.length > 0 || porVencer.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {vencidos.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <span className="text-red-700 text-[11px] font-medium">{vencidos.length} patron(es) con lote(s) vencido(s)</span>
                </div>
              )}
              {porVencer.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span className="text-amber-700 text-[11px] font-medium">{porVencer.length} por vencer (30d)</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {([['activos', 'Lotes activos'], ['bajas', `Historial de bajas${totalBajas ? ` (${totalBajas})` : ''}`]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setFilter('vista', v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    filters.vista === v ? 'bg-teal-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="min-w-[160px]">
              <SearchableSelect value={filters.categoria}
                onChange={(v) => setFilter('categoria', v)}
                options={CAT_OPTIONS} placeholder="Categoría" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.showInactive}
                onChange={e => setFilter('showInactive', e.target.checked)}
                className="rounded border-slate-300" />
              Inactivos
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer"
              title="Solo patrones con algún componente BOM por debajo del stock mínimo">
              <input type="checkbox" checked={filters.bloqueados}
                onChange={e => setFilter('bloqueados', e.target.checked)}
                className="rounded border-slate-300"
                data-testid="filter-bloqueados" />
              Bloqueados
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
          <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando patrones...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : vistaBajas ? (
          <PatronesBajasTable patrones={patrones} formatFechaAR={formatFechaAR} />
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay patrones cargados</p>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table ref={tableRef} className="w-full table-fixed">
              {colWidths ? (
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
              )}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Código artículo" field="codigoArticulo" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(0)} relative`}>
                    <ColAlignIcon align={colAligns?.[0] || 'left'} onClick={() => cycleAlign(0)} />
                    <div onMouseDown={e => onResizeStart(0, e)} onDoubleClick={() => onAutoFit(0)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Descripción" field="descripcion" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(1)} relative`}>
                    <ColAlignIcon align={colAligns?.[1] || 'left'} onClick={() => cycleAlign(1)} />
                    <div onMouseDown={e => onResizeStart(1, e)} onDoubleClick={() => onAutoFit(1)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <SortableHeader label="Marca" field="marca" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={`${thClass} ${getAlignClass(2)} relative`}>
                    <ColAlignIcon align={colAligns?.[2] || 'left'} onClick={() => cycleAlign(2)} />
                    <div onMouseDown={e => onResizeStart(2, e)} onDoubleClick={() => onAutoFit(2)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" />
                  </SortableHeader>
                  <th className={`${thClass} ${getAlignClass(3)} relative`}>Categorías<ColAlignIcon align={colAligns?.[3] || 'left'} onClick={() => cycleAlign(3)} /><div onMouseDown={e => onResizeStart(3, e)} onDoubleClick={() => onAutoFit(3)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(4)} relative`}>Lotes<ColAlignIcon align={colAligns?.[4] || 'left'} onClick={() => cycleAlign(4)} /><div onMouseDown={e => onResizeStart(4, e)} onDoubleClick={() => onAutoFit(4)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(5)} relative`}>Vencimiento<ColAlignIcon align={colAligns?.[5] || 'left'} onClick={() => cycleAlign(5)} /><div onMouseDown={e => onResizeStart(5, e)} onDoubleClick={() => onAutoFit(5)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} ${getAlignClass(6)} relative`}>Cantidad<ColAlignIcon align={colAligns?.[6] || 'right'} onClick={() => cycleAlign(6)} /><div onMouseDown={e => onResizeStart(6, e)} onDoubleClick={() => onAutoFit(6)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                  <th className={`${thClass} text-center relative`}>Acciones<div onMouseDown={e => onResizeStart(7, e)} onDoubleClick={() => onAutoFit(7)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const estado = estadoGlobal(p);
                  const badge = ESTADO_BADGE[estado];
                  const venc = proximoVencimiento(p);
                  const cantidad = totalCantidad(p);
                  const tieneCantidad = p.lotes.some(l => typeof l.cantidad === 'number');
                  return (
                    <PatronRow
                      key={p.id}
                      patron={p}
                      estado={estado}
                      estadoBadge={badge}
                      proximoVencimiento={venc}
                      cantidad={cantidad}
                      tieneCantidad={tieneCantidad}
                      formatFechaAR={formatFechaAR}
                      getAlignClass={getAlignClass}
                      colAligns={colAligns}
                      onDeactivate={handleDeactivate}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreatePatronModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
      <MigracionPatronesModal open={showMigracion} onClose={() => setShowMigracion(false)} onCompleted={reload} />
    </div>
  );
};
