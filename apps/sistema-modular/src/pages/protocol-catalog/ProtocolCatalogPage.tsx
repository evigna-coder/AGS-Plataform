import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { useTableProjects } from '../../hooks/useTableProjects';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ImportJsonDialog } from '../../components/protocol-catalog/ImportJsonDialog';
import { ProjectSelector } from '../../components/protocol-catalog/ProjectSelector';
import type { TableCatalogEntry } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const SYS_TYPES = ['HPLC', 'GC', 'MSD', 'HSS', 'UV', 'OSMOMETRO', 'POLARIMETRO', 'OTRO'];
const LS_KEY = 'ags:tableCatalog:activeProject';

const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-600',
};
const TABLE_TYPE_LABELS: Record<string, string> = {
  validation: 'Validación', informational: 'Informacional', instruments: 'Instrumentos',
  checklist: 'Checklist', text: 'Texto', signatures: 'Firmas', cover: 'Carátula',
};

/** Lee el projectId guardado: "undefined" | "null" | "uuid-string" */
function readSavedProject(): string | null | undefined {
  const v = localStorage.getItem(LS_KEY);
  if (v === 'null') return null;
  if (v && v !== 'undefined') return v;
  return undefined;
}

export const TableCatalogPage = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { tables, loading, error, listTables, archiveTable, publishTable, cloneTable, importTables, deleteTable, assignProject } = useTableCatalog();
  const { projects, createProject, updateProject, deleteProject } = useTableProjects();

  const [activeProjectId, setActiveProjectId] = useState<string | null | undefined>(readSavedProject);
  const [filterSysType, setFilterSysType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cloneTarget, setCloneTarget] = useState<TableCatalogEntry | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneSysType, setCloneSysType] = useState('');
  const [cloneProjectId, setCloneProjectId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('orden');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const sortedTables = useMemo(() => sortByField(tables, sortField, sortDir), [tables, sortField, sortDir]);

  const selectProject = useCallback((pid: string | null | undefined) => {
    setActiveProjectId(pid);
    localStorage.setItem(LS_KEY, String(pid));
  }, []);

  const handleCreateProject = useCallback(async (name: string) => {
    const id = await createProject({ name });
    selectProject(id);
  }, [createProject, selectProject]);

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    await updateProject(id, { name });
  }, [updateProject]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await deleteProject(id);
  }, [deleteProject]);

  const reload = () => {
    setSelectedIds(new Set());
    listTables({
      sysType: filterSysType || undefined,
      status: filterStatus || undefined,
      projectId: activeProjectId,
    });
  };

  useEffect(() => { reload(); }, [filterSysType, filterStatus, activeProjectId]);

  // --- Selección ---
  const toggleOne = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = tables.length > 0 && selectedIds.size === tables.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(tables.map(t => t.id)));

  // --- Acciones individuales ---
  const handleClone = (entry: TableCatalogEntry) => {
    setCloneTarget(entry);
    setCloneName(`${entry.name} (copia)`);
    setCloneSysType(entry.sysType);
    setCloneProjectId(entry.projectId ?? activeProjectId ?? null);
  };
  const confirmClone = async () => {
    if (!cloneTarget) return;
    try {
      const newId = await cloneTable(cloneTarget.id, { name: cloneName, sysType: cloneSysType, projectId: cloneProjectId });
      setCloneTarget(null);
      navigate(`/table-catalog/${newId}/edit`);
    } catch { alert('Error al clonar'); }
  };
  const handleArchive = async (entry: TableCatalogEntry) => {
    if (!await confirm(`¿Archivar "${entry.name}"?`)) return;
    archiveTable(entry.id);
  };
  const handlePublish = async (entry: TableCatalogEntry) => {
    if (!await confirm(`¿Publicar "${entry.name}"?`)) return;
    publishTable(entry.id);
  };
  const handleDelete = async (entry: TableCatalogEntry) => {
    if (!await confirm(`¿Eliminar permanentemente "${entry.name}"?\n\nEsta acción no se puede deshacer.`)) return;
    deleteTable(entry.id);
  };

  // --- Lote ---
  const handleBulkDelete = async () => {
    if (!await confirm(`¿Eliminar ${selectedIds.size} tabla(s)?\n\nEsta acción no se puede deshacer.`)) return;
    [...selectedIds].forEach(id => deleteTable(id));
    setSelectedIds(new Set());
  };

  const handleBulkMove = (targetProjectId: string | null) => {
    assignProject([...selectedIds], targetProjectId);
    setSelectedIds(new Set());
  };

  const handleImport = async (imported: TableCatalogEntry[]) => {
    setShowImport(false);
    try {
      const withProject = activeProjectId && activeProjectId !== 'undefined'
        ? imported.map(t => ({ ...t, projectId: activeProjectId }))
        : imported;
      await importTables(withProject);
      reload(); // import necesita reload porque las tablas no están en estado local
    } catch { alert('Error al importar'); }
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
            <Link to="/table-catalog/nuevo"><Button>+ Nueva tabla</Button></Link>
          </div>
        </div>

        {/* Selector de proyecto */}
        <ProjectSelector
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={selectProject}
          onCreate={handleCreateProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
          onUpdateSettings={async (id, data) => { await updateProject(id, data); }}
        />

        {/* Filtros */}
        <Card>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema</label>
              <select value={filterSysType} onChange={e => setFilterSysType(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Todos</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFilterSysType(''); setFilterStatus(''); }}>Limpiar</Button>
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {/* Acciones en lote */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
            <span className="text-sm font-bold text-teal-800">{selectedIds.size} seleccionada(s)</span>
            <div className="flex gap-3 items-center">
              {projects.length > 0 && (
                <select defaultValue="" onChange={e => { if (e.target.value) handleBulkMove(e.target.value === '__none__' ? null : e.target.value); e.target.value = ''; }}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5">
                  <option value="" disabled>Mover a proyecto...</option>
                  <option value="__none__">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-600 hover:text-slate-900 font-medium">Deseleccionar</button>
              <button onClick={handleBulkDelete}
                className="text-xs bg-red-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                {`Eliminar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : error ? (
          <Card><p className="text-red-600 text-sm">{error}</p></Card>
        ) : tables.length === 0 ? (
          <Card><div className="text-center py-12"><p className="text-slate-400">No hay tablas en este proyecto.</p></div></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                    </th>
                    {([
                      ['#', 'orden'],
                      ['Nombre', 'name'],
                      ['SysType', 'sysType'],
                      ['Modelos', 'modelos'],
                      ['Tipo', 'tableType'],
                      ['Cols', 'columns.length'],
                      ['Filas', 'templateRows.length'],
                      ['Default', 'isDefault'],
                      ['Estado', 'status'],
                    ] as [string, string][]).map(([label, field]) => (
                      <SortableHeader key={field} label={label} field={field} currentField={sortField} currentDir={sortDir} onSort={handleSort} className="px-3 py-2 text-center font-medium text-slate-400 tracking-wider text-xs" />
                    ))}
                    <th className="px-3 py-2 text-center font-medium text-slate-400 tracking-wider text-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTables.map(t => {
                    const sel = selectedIds.has(t.id);
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 ${sel ? 'bg-blue-50/60' : ''}`}>
                        <td className="px-4 py-3"><input type="checkbox" checked={sel} onChange={() => toggleOne(t.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs text-center font-mono">{t.orden || '—'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{t.name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{t.sysType || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate" title={t.modelos?.join(', ') || 'Todos'}>
                          {t.modelos?.length ? t.modelos.join(', ') : <span className="text-slate-300">Todos</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{TABLE_TYPE_LABELS[t.tableType] ?? t.tableType}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{t.columns.length}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{t.templateRows.length}</td>
                        <td className="px-4 py-3 text-center">{t.isDefault ? <span className="text-green-600 font-bold text-xs">✓</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <Link to={`/table-catalog/${t.id}/edit`}><button className="text-blue-600 hover:underline font-medium text-xs">Editar</button></Link>
                            <button onClick={() => handleClone(t)} className="text-slate-600 hover:underline font-medium text-xs">Clonar</button>
                            {t.status !== 'published' && <button onClick={() => handlePublish(t)} className="text-green-600 hover:underline font-medium text-xs">Publicar</button>}
                            {t.status !== 'archived' && <button onClick={() => handleArchive(t)} className="text-amber-600 hover:underline font-medium text-xs">Archivar</button>}
                            <button onClick={() => handleDelete(t)} className="text-red-600 hover:underline font-medium text-xs">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {showImport && <ImportJsonDialog onClose={() => setShowImport(false)} onImport={handleImport} />}

        <Modal
          open={!!cloneTarget}
          onClose={() => setCloneTarget(null)}
          title="Duplicar tabla"
          subtitle={cloneTarget?.name}
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setCloneTarget(null)}>Cancelar</Button>
              <Button onClick={confirmClone}>Duplicar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
              <Input value={cloneName} onChange={e => setCloneName(e.target.value)} inputSize="sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema</label>
              <select value={cloneSysType} onChange={e => setCloneSysType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                {SYS_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
                <select value={cloneProjectId ?? ''} onChange={e => setCloneProjectId(e.target.value || null)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};
