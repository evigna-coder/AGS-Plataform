import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TableCatalogEntry } from '@ags/shared';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useProjectCatalogView } from '../../hooks/useProjectCatalogView';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ImportJsonDialog } from '../../components/protocol-catalog/ImportJsonDialog';
import { ProjectSelector } from '../../components/protocol-catalog/ProjectSelector';
import { ProjectHeaderCard } from '../../components/protocol-catalog/ProjectHeaderCard';
import { ProjectCoveragePanel } from '../../components/protocol-catalog/ProjectCoveragePanel';
import { PublishBatchModal } from '../../components/protocol-catalog/PublishBatchModal';
import { ProtocolPreviewModal } from '../../components/protocol-catalog/ProtocolPreviewModal';
import { CatalogTableList } from '../../components/protocol-catalog/CatalogTableList';
import { CatalogBulkBar } from '../../components/protocol-catalog/CatalogBulkBar';
import { CloneTableModal } from '../../components/protocol-catalog/CloneTableModal';
import { SYS_TYPES } from '../../utils/tableCatalogConstants';
import type { CoverageField } from '../../utils/tableCatalogCoverage';
import { notify } from '../../utils/notify';

const FILTER_SCHEMA = {
  sysType: { type: 'string' as const, default: '' },
  status: { type: 'string' as const, default: '' },
};

export const TableCatalogPage = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [filters, setFilter, , resetFilters] = useUrlFilters(FILTER_SCHEMA);
  const v = useProjectCatalogView(filters);
  const { project, projects, activeProjectId } = v;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<TableCatalogEntry | null>(null);
  const [coverageField, setCoverageField] = useState<CoverageField | null>(null);
  const [publishCandidates, setPublishCandidates] = useState<TableCatalogEntry[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const projectNames = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  // Tabla nueva desde un proyecto: nace con su tipo de sistema más común y el siguiente orden.
  const nuevaHref = useMemo(() => {
    if (!project) return '/table-catalog/nuevo';
    const freq = new Map<string, number>();
    v.projectTables.forEach(t => t.sysType && freq.set(t.sysType, (freq.get(t.sysType) ?? 0) + 1));
    const sysType = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const orden = Math.max(0, ...v.projectTables.map(t => t.orden || 0)) + 1;
    return `/table-catalog/nuevo?${new URLSearchParams({ projectId: project.id, sysType, orden: String(orden) })}`;
  }, [project, v.projectTables]);
  const selected = v.visibleTables.filter(t => selectedIds.has(t.id));

  const handleDelete = async (t: TableCatalogEntry) => {
    if (await confirm(`¿Eliminar permanentemente "${t.name}"?\n\nEsta acción no se puede deshacer.`)) v.deleteTable(t.id);
  };
  const handleArchive = async (t: TableCatalogEntry) => {
    if (await confirm(`¿Archivar "${t.name}"?`)) v.archiveTable(t.id);
  };
  const handleBulkDelete = async () => {
    if (!await confirm(`¿Eliminar ${selectedIds.size} tabla(s)?\n\nEsta acción no se puede deshacer.`)) return;
    [...selectedIds].forEach(id => v.deleteTable(id));
    setSelectedIds(new Set());
  };
  const handleImport = async (imported: TableCatalogEntry[]) => {
    setShowImport(false);
    try {
      // Las tablas importadas a un proyecto nacen con sus modelos y servicios.
      const withProject = project
        ? imported.map(t => ({
            ...t, projectId: project.id,
            modelos: t.modelos?.length ? t.modelos : (project.modelos ?? []),
            tipoServicio: t.tipoServicio?.length ? t.tipoServicio : (project.tipoServicio ?? []),
          }))
        : imported;
      await v.importTables(withProject);
      v.reload();
    } catch { notify.error('Error al importar'); }
  };
  const publish = async (ids: string[]) => {
    try { await v.publishMany(ids); notify.success(`${ids.length} tabla(s) publicadas`); setSelectedIds(new Set()); }
    catch { notify.error('No se pudieron publicar las tablas'); v.reload(); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 px-5 pt-4 pb-3 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Biblioteca de Tablas</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tablas de verificación individuales para protocolos de OT</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImport(true)}>Importar</Button>
            <Link to={nuevaHref} state={project ? { heredar: { modelos: v.refs.modelos, tipoServicio: v.refs.tipoServicio } } : undefined}><Button>+ Nueva tabla</Button></Link>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[320px]">
            <ProjectSelector projects={projects} activeProjectId={activeProjectId}
              onSelect={pid => { setSelectedIds(new Set()); v.selectProject(pid); }}
              onCreate={async name => { v.selectProject(await v.createProject({ name })); }}
              onRename={async (id, name) => { await v.updateProject(id, { name }); }}
              onDelete={async id => { await v.deleteProject(id); }}
              onUpdateSettings={async (id, data) => { await v.updateProject(id, data); }}
              onOpenCoverage={f => setCoverageField(f)} />
          </div>
          <Select value={filters.sysType} onChange={e => setFilter('sysType', e.target.value)} selectSize="sm">
            <option value="">Todo tipo de sistema</option>
            {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={filters.status} onChange={e => setFilter('status', e.target.value)} selectSize="sm">
            <option value="">Todo estado</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
            <option value="archived">Archivada</option>
          </Select>
          {(filters.sysType || filters.status) && <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {project && (
          <ProjectHeaderCard project={project} tables={v.projectTables}
            modelos={v.coverage.modelos} servicios={v.coverage.tipoServicio}
            onOpenModelos={() => setCoverageField('modelos')} onOpenServicios={() => setCoverageField('tipoServicio')}
            onPublishAll={() => setPublishCandidates(v.projectTables.filter(t => t.status === 'draft'))}
            onPreview={() => setShowPreview(true)} />
        )}

        {selectedIds.size > 0 && (
          <CatalogBulkBar count={selectedIds.size} unpublished={selected.filter(t => t.status !== 'published').length}
            projects={projects}
            onPublish={() => setPublishCandidates(selected.filter(t => t.status !== 'published'))}
            onMove={pid => { v.assignProject([...selectedIds], pid); setSelectedIds(new Set()); }}
            onClear={() => setSelectedIds(new Set())} onDelete={handleBulkDelete} />
        )}

        {v.loading ? (
          <div className="flex justify-center py-12"><p className="text-slate-400 text-sm">Cargando...</p></div>
        ) : v.error ? (
          <Card><p className="text-red-600 text-sm">{v.error}</p></Card>
        ) : v.visibleTables.length === 0 ? (
          <EmptyState message={v.projectTables.length ? 'Ninguna tabla coincide con los filtros.' : 'No hay tablas en este proyecto.'} />
        ) : (
          <CatalogTableList tables={v.visibleTables} grouped={!!project}
            selectedIds={selectedIds} setSelectedIds={setSelectedIds}
            refModelos={v.refs.modelos} refServicios={v.refs.tipoServicio}
            projectNames={activeProjectId === undefined ? projectNames : undefined}
            onClone={setCloneTarget}
            onPublish={t => setPublishCandidates([t])}
            onArchive={handleArchive} onDelete={handleDelete} />
        )}
      </div>

      {showImport && <ImportJsonDialog onClose={() => setShowImport(false)} onImport={handleImport} />}
      <ProjectCoveragePanel open={!!coverageField && !!project} onClose={() => setCoverageField(null)}
        project={project} tables={v.projectTables} field={coverageField ?? 'modelos'}
        groups={v.coverageGroups[coverageField ?? 'modelos']}
        onApply={(updates, values) => v.applyCoverage(coverageField ?? 'modelos', updates, values)} />
      <PublishBatchModal open={!!publishCandidates} onClose={() => setPublishCandidates(null)}
        tables={publishCandidates ?? []} subtitle={project?.name} onPublish={publish} />
      <ProtocolPreviewModal open={showPreview} onClose={() => setShowPreview(false)} project={project} tables={v.projectTables} />
      <CloneTableModal target={cloneTarget} projects={projects} defaultProjectId={typeof activeProjectId === 'string' ? activeProjectId : null}
        onClose={() => setCloneTarget(null)}
        onConfirm={async data => {
          try { const id = await v.cloneTable(cloneTarget!.id, data); setCloneTarget(null); navigate(`/table-catalog/${id}/edit`); }
          catch { notify.error('Error al clonar'); }
        }} />
    </div>
  );
};
