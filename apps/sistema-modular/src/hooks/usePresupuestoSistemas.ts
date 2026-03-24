import { useMemo, useCallback } from 'react';
import type { PresupuestoItem, Sistema } from '@ags/shared';

export interface GrupoSistema {
  grupo: number;
  sistemaId: string | null;
  sistemaNombre: string;
  items: PresupuestoItem[];
}

export function usePresupuestoSistemas(items: PresupuestoItem[], clienteSistemas: Sistema[]) {
  const linkedSistemaIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach(item => { if (item.sistemaId) ids.add(item.sistemaId); });
    return Array.from(ids);
  }, [items]);

  const sistemaGrupoMap = useMemo(() => {
    const map = new Map<string, number>();
    linkedSistemaIds.forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [linkedSistemaIds]);

  const getGrupo = useCallback((sistemaId: string | null | undefined): number => {
    if (!sistemaId) return 0;
    return sistemaGrupoMap.get(sistemaId) || 0;
  }, [sistemaGrupoMap]);

  const itemsByGrupo = useMemo((): GrupoSistema[] => {
    const sistemaMap = new Map(clienteSistemas.map(s => [s.id, s]));
    const groups = new Map<number, GrupoSistema>();

    for (const item of items) {
      const grupo = item.sistemaId ? (sistemaGrupoMap.get(item.sistemaId) || 0) : 0;
      if (!groups.has(grupo)) {
        const sistema = item.sistemaId ? sistemaMap.get(item.sistemaId) : null;
        groups.set(grupo, {
          grupo,
          sistemaId: item.sistemaId || null,
          sistemaNombre: sistema?.nombre || item.sistemaNombre || 'Servicios generales',
          items: [],
        });
      }
      groups.get(grupo)!.items.push(item);
    }

    return Array.from(groups.values()).sort((a, b) => a.grupo - b.grupo);
  }, [items, sistemaGrupoMap, clienteSistemas]);

  const reassignGrupos = useCallback((currentItems: PresupuestoItem[]): PresupuestoItem[] => {
    const sistemaIds = [...new Set(currentItems.map(i => i.sistemaId).filter(Boolean))] as string[];
    const grupoMap = new Map(sistemaIds.map((id, idx) => [id, idx + 1]));
    return currentItems.map(item => ({
      ...item,
      grupo: item.sistemaId ? grupoMap.get(item.sistemaId) || 0 : 0,
    }));
  }, []);

  return { linkedSistemaIds, sistemaGrupoMap, getGrupo, itemsByGrupo, reassignGrupos };
}
