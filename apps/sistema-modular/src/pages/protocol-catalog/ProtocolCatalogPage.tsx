import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { useTableProjects } from '../../hooks/useTableProjects';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { ColMenu, type ColMenuHandle } from '../../components/ui/ColMenu';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ImportJsonDialog } from '../../components/protocol-catalog/ImportJsonDialog';
import { ProjectSelector } from '../../components/protocol-catalog/ProjectSelector';
import { BulkAddModelosModal } from '../../components/protocol-catalog/BulkAddModelosModal';
import type { TableCatalogEntry, TableProject } from '@ags/shared';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const thBase = 'px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400 relative select-none';

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
  active ? (
    <svg className="w-3 h-3 text-teal-500 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-300 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );

const SYS_TYPES = ['HPLC', 'GC', 'MSD', 'HSS', 'UV', 'OSMOMETRO', 'POLARIMETRO', 'HTA', 'OTRO'];
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
  const { tables, loading, error, listTables, archiveTable, publishTable, cloneTable, importTables, deleteTable, assignProject, bulkAddModelosToProject } = useTableCatalog();
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
  const [bulkModelosTarget, setBulkModelosTarget] = useState<TableProject | null>(null);
  const [sortField, setSortField] = useState<string>('orden');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field); setSortDir(s.dir);
  };
  const sortedTables = useMemo(() => sortByField(tables, sortField, sortDir), [tables, sortField, sortDir]);

  // Resizable / alignable / hideable columns. Index 0 = checkbox (no resize),
  // 1..9 = data columns, último = acciones (no resize).
  const {
    tableRef, colAligns,
    onResizeStart, onAutoFit, setAlign, getAlignClass,
    isHidden, hideCol, showAllCols, hiddenCols,
  } = useResizableColumns('table-catalog');

  const colMenuRefs = useRef(new Map<number, ColMenuHandle>());
  const openColMenuAt = useCallback((i: number, e: React.MouseEvent) => {
    e.preventDefault();
    colMenuRefs.current.get(i)?.openAt(e.clientX, e.clientY);
  }, []);
  const setColMenuRef = useCallback((i: number) => (handle: ColMenuHandle | null) => {
    if (handle) colMenuRefs.current.set(i, handle);
    else colMenuRefs.current.delete(i);
  }, []);

  const renderTh = (i: number, sortKey: string, label: string) => {
    if (isHidden(i)) return null;
    const active = sortField === sortKey;
    return (
      <th
        className={`${thBase} cursor-pointer hover:text-slate-600 ${getAlignClass(i)}`}
        onClick={() => handleSort(sortKey)}
        onContextMenu={(e) => openColMenuAt(i, e)}
      >
        <ColMenu
          ref={setColMenuRef(i)}
          align={colAligns?.[i] ?? 'left'}
          onAlign={(a) => setAlign(i, a)}
          onHide={() => hideCol(i)}
        />
        {label}<SortIcon active={active} dir={sortDir} />
        <div
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(i, e); }}
          onDoubleClick={() => onAutoFit(i)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400/40"
        />
      </th>
    );
  };

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
          onBulkAddModelos={(p) => setBulkModelosTarget(p)}
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
            {hiddenCols.length > 0 && (
              <button
                onClick={showAllCols}
                className="text-[10px] text-slate-500 hover:text-teal-700 mb-2 underline block"
              >
                Mostrar {hiddenCols.length} columna{hiddenCols.length > 1 ? 's' : ''} oculta{hiddenCols.length > 1 ? 's' : ''}
              </button>
            )}
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                    </th>
                    {renderTh(1, 'orden', '#')}
                    {renderTh(2, 'name', 'Nombre')}
                    {renderTh(3, 'sysType', 'SysType')}
                    {renderTh(4, 'modelos', 'Modelos')}
                    {renderTh(5, 'tableType', 'Tipo')}
                    {renderTh(6, 'columns.length', 'Cols')}
                    {renderTh(7, 'templateRows.length', 'Filas')}
                    {renderTh(8, 'isDefault', 'Default')}
                    {renderTh(9, 'status', 'Estado')}
                    <th className={`${thBase} text-right text-slate-400`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTables.map(t => {
                    const sel = selectedIds.has(t.id);
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 ${sel ? 'bg-blue-50/60' : ''}`}>
                        <td className="px-4 py-3"><input type="checkbox" checked={sel} onChange={() => toggleOne(t.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" /></td>
                        {!isHidden(1) && <td className={`px-4 py-3 text-slate-400 text-xs font-mono ${getAlignClass(1)}`}>{t.orden || '—'}</td>}
                        {!isHidden(2) && <td className={`px-4 py-3 font-bold text-slate-900 ${getAlignClass(2)}`}>{t.name}</td>}
                        {!isHidden(3) && <td className={`px-4 py-3 text-slate-600 font-mono text-xs ${getAlignClass(3)}`}>{t.sysType || '—'}</td>}
                        {!isHidden(4) && (
                          <td className={`px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate ${getAlignClass(4)}`} title={t.modelos?.join(', ') || 'Todos'}>
                            {t.modelos?.length ? t.modelos.join(', ') : <span className="text-slate-300">Todos</span>}
                          </td>
                        )}
                        {!isHidden(5) && <td className={`px-4 py-3 text-slate-500 text-xs ${getAlignClass(5)}`}>{TABLE_TYPE_LABELS[t.tableType] ?? t.tableType}</td>}
                        {!isHidden(6) && <td className={`px-4 py-3 text-slate-600 ${getAlignClass(6)}`}>{t.columns.length}</td>}
                        {!isHidden(7) && <td className={`px-4 py-3 text-slate-600 ${getAlignClass(7)}`}>{t.templateRows.length}</td>}
                        {!isHidden(8) && <td className={`px-4 py-3 ${getAlignClass(8)}`}>{t.isDefault ? <span className="text-green-600 font-bold text-xs">✓</span> : <span className="text-slate-300 text-xs">—</span>}</td>}
                        {!isHidden(9) && (
                          <td className={`px-4 py-3 ${getAlignClass(9)}`}>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex gap-3">
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

        <BulkAddModelosModal
          open={!!bulkModelosTarget}
          project={bulkModelosTarget}
          onClose={() => { setBulkModelosTarget(null); reload(); }}
          onConfirm={async (modelos) => {
            if (!bulkModelosTarget) return { updated: 0, total: 0 };
            return await bulkAddModelosToProject(bulkModelosTarget.id, modelos);
          }}
        />

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
