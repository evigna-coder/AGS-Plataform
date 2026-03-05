import { useState, useEffect, useCallback } from 'react';
import type { PostaWorkflow, PostaHandoff, PostaCategoria, PostaTipoEntidad, PostaEstado } from '@ags/shared';
import { postasService } from '../services/firebaseService';

export interface PostaFilters {
  estado?: PostaEstado;
  categoria?: PostaCategoria;
  tipoEntidad?: PostaTipoEntidad;
  responsableId?: string;
}

export function usePostas(filters: PostaFilters) {
  const [postas, setPostas] = useState<PostaWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await postasService.getAll({
        estado: filters.estado,
        categoria: filters.categoria,
        tipoEntidad: filters.tipoEntidad,
        responsableId: filters.responsableId,
      });
      setPostas(data);
    } finally {
      setLoading(false);
    }
  }, [filters.estado, filters.categoria, filters.tipoEntidad, filters.responsableId]);

  useEffect(() => { load(); }, [load]);

  const createPosta = useCallback(async (data: Omit<PostaWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await postasService.create(data);
    await load();
    return id;
  }, [load]);

  const completePosta = useCallback(async (id: string, comentario?: string) => {
    await postasService.complete(id, comentario);
    await load();
  }, [load]);

  const cancelPosta = useCallback(async (id: string, comentario?: string) => {
    await postasService.cancel(id, comentario);
    await load();
  }, [load]);

  const derivarPosta = useCallback(async (
    id: string, handoff: PostaHandoff, nuevoResponsableId: string, nuevoResponsableNombre: string, nuevaAccion: string,
  ) => {
    await postasService.addHandoff(id, handoff);
    await postasService.update(id, {
      responsableId: nuevoResponsableId,
      responsableNombre: nuevoResponsableNombre,
      accionRequerida: nuevaAccion,
      estado: 'pendiente',
    });
    await load();
  }, [load]);

  return { postas, loading, reload: load, createPosta, completePosta, cancelPosta, derivarPosta };
}
