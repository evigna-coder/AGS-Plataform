import type { TableCatalogEntry, TableProject } from '@ags/shared';
import { Button } from '../ui/Button';
import type { CoverageSummary } from '../../utils/tableCatalogCoverage';

interface Props {
  project: TableProject;
  tables: TableCatalogEntry[];
  modelos: CoverageSummary;
  servicios: CoverageSummary;
  onOpenModelos: () => void;
  onOpenServicios: () => void;
  onPublishAll: () => void;
  onPreview: () => void;
}

/** Chip de resumen de cobertura: verde si todo coincide, ámbar con la cantidad de discrepancias. */
function CoverageChip({ label, summary, onClick }: { label: string; summary: CoverageSummary; onClick: () => void }) {
  const enUso = summary.rows.filter(r => r.coveredBy.length > 0).length;
  const fuera = summary.rows.filter(r => !r.inCatalog).length;
  const sinLista = summary.withList.length === 0;
  const alerta = summary.partialCount > 0 || fuera > 0;
  return (
    <button onClick={onClick}
      className={`group text-left rounded-lg border px-3 py-2 transition-colors min-w-[170px] ${
        alerta ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'
      }`}>
      <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</span>
      <span className="block text-sm font-semibold text-slate-800">
        {sinLista ? 'Todos' : `${enUso} ${enUso === 1 ? label.toLowerCase().replace(/s$/, '') : label.toLowerCase()}`}
      </span>
      <span className={`block text-[11px] ${alerta ? 'text-amber-700 font-medium' : 'text-slate-400'}`}>
        {summary.partialCount > 0 && `${summary.partialCount} con discrepancias`}
        {summary.partialCount > 0 && fuera > 0 && ' · '}
        {fuera > 0 && `${fuera} fuera del catálogo`}
        {!alerta && 'Sin discrepancias · Editar'}
      </span>
    </button>
  );
}

/**
 * Cabecera del proyecto activo en la Biblioteca de Tablas: estado de las tablas,
 * cobertura de modelos y servicios, y las acciones a nivel proyecto.
 */
export function ProjectHeaderCard({ project, tables, modelos, servicios, onOpenModelos, onOpenServicios, onPublishAll, onPreview }: Props) {
  const count = (s: TableCatalogEntry['status']) => tables.filter(t => t.status === s).length;
  const publicadas = count('published');
  const borradores = count('draft');
  const archivadas = count('archived');
  const activas = tables.length - archivadas;
  const pct = activas > 0 ? Math.round((publicadas / activas) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
      <div className="min-w-[220px] flex-1">
        <h3 className="font-serif text-lg text-slate-900 leading-tight">{project.name}</h3>
        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
          {project.footerQF || 'Sin QF de pie'}{project.headerTitle ? ` · ${project.headerTitle}` : ''}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden" title={`${pct}% publicado`}>
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            <strong className="text-emerald-700">{publicadas}</strong> publicadas
            {borradores > 0 && <> · <strong className="text-amber-700">{borradores}</strong> en borrador</>}
            {archivadas > 0 && <> · {archivadas} archivadas</>}
          </span>
        </div>
      </div>

      <CoverageChip label="Modelos" summary={modelos} onClick={onOpenModelos} />
      <CoverageChip label="Servicios" summary={servicios} onClick={onOpenServicios} />

      <div className="flex flex-col gap-1.5">
        <Button size="sm" onClick={onPublishAll} disabled={borradores === 0}>
          {borradores > 0 ? `Publicar ${borradores} pendiente(s)` : 'Todo publicado'}
        </Button>
        <Button size="sm" variant="outline" onClick={onPreview}>Vista previa del protocolo</Button>
      </div>
    </div>
  );
}
