import { useState, useCallback, useEffect } from 'react';
import { tableProjectsService } from '../services/firebaseService';
import type { TableProject } from '@ags/shared';

export function useTableProjects() {
  const [projects, setProjects] = useState<TableProject[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await tableProjectsService.getAll());
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, []);

  const createProject = useCallback(async (data: { name: string; description?: string | null; sysType?: string | null }) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Optimistic: agregar al estado local inmediatamente
    const optimistic: TableProject = {
      id,
      name: data.name,
      description: data.description ?? null,
      sysType: data.sysType ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
    };
    setProjects(prev => [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)));
    // Firebase en background
    tableProjectsService.create(data).catch(err => {
      console.error('Error creando proyecto:', err);
      setProjects(prev => prev.filter(p => p.id !== id));
    });
    return id;
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<{ name: string; description: string | null; headerTitle: string | null; footerQF: string | null }>) => {
    // Optimistic: actualizar en el estado local
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p)
      .sort((a, b) => a.name.localeCompare(b.name)));
    // Firebase en background
    tableProjectsService.update(id, data).catch(err => {
      console.error('Error actualizando proyecto:', err);
      loadProjects(); // rollback: re-fetch
    });
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    // Optimistic: quitar del estado local
    const backup = projects;
    setProjects(prev => prev.filter(p => p.id !== id));
    // Firebase en background
    tableProjectsService.delete(id).catch(err => {
      console.error('Error eliminando proyecto:', err);
      setProjects(backup); // rollback
    });
  }, [projects, loadProjects]);

  return { projects, loading, loadProjects, createProject, updateProject, deleteProject };
}
