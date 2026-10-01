import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTableCatalog } from './useTableCatalog';
import { useTableProjects } from './useTableProjects';
import { useCoverageCatalog } from './useCoverageCatalog';
import { useTabOverlay } from '../contexts/TabOverlayContext';
import { computeCoverage, referenceFor, type CoverageField } from '../utils/tableCatalogCoverage';

const LS_KEY = 'ags:tableCatalog:activeProject';

/** Lee el proyecto guardado: undefined = todas, null = sin proyecto, string = proyecto. */
function readSavedProject(): string | null | undefined {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'null') return null;
    if (v && v !== 'undefined') return v;
  } catch { /* storage bloqueado: arranca en "todas" */ }
  return undefined;
}

/**
 * Estado de la Biblioteca de Tablas: proyecto activo, sus tablas (sin filtrar,
 * para que la cobertura no dependa de los filtros de la lista), cobertura de
 * modelos y servicios, y recarga al volver a la pestaña.
 */
export function useProjectCatalogView(filters: { sysType: string; status: string }) {
  const catalog = useTableCatalog();
  const { projects, createProject, updateProject, deleteProject } = useTableProjects();
  const { modelGroups, servicios } = useCoverageCatalog();
  const [activeProjectId, setActiveProjectId] = useState<string | null | undefined>(readSavedProject);

  const selectProject = useCallback((pid: string | null | undefined) => {
    setActiveProjectId(pid);
    try { localStorage.setItem(LS_KEY, String(pid)); } catch { /* sin persistencia */ }
  }, []);

  const { listTables, refreshTables } = catalog;
  const reload = useCallback(() => listTables({ projectId: activeProjectId }), [listTables, activeProjectId]);
  useEffect(() => { reload(); }, [reload]);

  // La pestaña queda montada al cambiar de pestaña: al volver, traer lo editado en otra.
  const tabActive = useTabOverlay()?.isTabActive ?? true;
  const wasActive = useRef(tabActive);
  useEffect(() => {
    if (tabActive && !wasActive.current) refreshTables({ projectId: activeProjectId });
    wasActive.current = tabActive;
  }, [tabActive, refreshTables, activeProjectId]);

  const project = typeof activeProjectId === 'string' ? projects.find(p => p.id === activeProjectId) ?? null : null;
  // Solo las del proyecto activo (revisión 2026-10-01): "Mover a proyecto" deja
  // la tabla en la lista local con otro projectId, y la cobertura le escribía
  // modelos a tablas que ya eran de otro proyecto.
  const projectTables = useMemo(() => typeof activeProjectId === 'string'
    ? catalog.tables.filter(t => t.projectId === activeProjectId)
    : catalog.tables, [catalog.tables, activeProjectId]);

  const visibleTables = useMemo(() => projectTables.filter(t =>
    (!filters.sysType || t.sysType === filters.sysType) && (!filters.status || t.status === filters.status),
  ), [projectTables, filters.sysType, filters.status]);

  const modelCatalog = useMemo(() => modelGroups.flatMap(g => g.values), [modelGroups]);
  const coverage = useMemo(() => ({
    modelos: computeCoverage(projectTables, 'modelos', modelCatalog),
    tipoServicio: computeCoverage(projectTables, 'tipoServicio', servicios),
  }), [projectTables, modelCatalog, servicios]);

  const refs = useMemo(() => ({
    modelos: project ? referenceFor(projectTables, 'modelos', project.modelos) : [],
    tipoServicio: project ? referenceFor(projectTables, 'tipoServicio', project.tipoServicio) : [],
  }), [project, projectTables]);

  const applyCoverage = useCallback(async (field: CoverageField, updates: { id: string; values: string[] }[], projectValues: string[]) => {
    if (updates.length) await catalog.setListField(field, updates);
    if (project) await updateProject(project.id, { [field]: projectValues });
  }, [catalog, project, updateProject]);

  return {
    ...catalog, projects, createProject, updateProject, deleteProject,
    activeProjectId, selectProject, project, projectTables, visibleTables, reload,
    coverage, refs, applyCoverage, coverageGroups: { modelos: modelGroups, tipoServicio: [{ label: 'Tipos de servicio con protocolo', values: servicios }] },
  };
}
