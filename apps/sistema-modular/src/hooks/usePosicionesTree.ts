import { useState, useEffect, useCallback } from 'react';
import { posicionesStockService, unidadesService } from '../services/firebaseService';
import type { PosicionStock, UnidadStock } from '@ags/shared';

export interface PosicionNode extends PosicionStock {
  children: PosicionNode[];
  unitCount: number;
}

export function usePosicionesTree(showInactive: boolean) {
  const [allPositions, setAllPositions] = useState<PosicionStock[]>([]);
  const [tree, setTree] = useState<PosicionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [unitsCache, setUnitsCache] = useState<Record<string, UnidadStock[]>>({});
  const [loadingUnits, setLoadingUnits] = useState<Set<string>>(new Set());

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await posicionesStockService.getAll(!showInactive);
      setAllPositions(items);
      setTree(buildTree(items));
    } catch (err) {
      console.error('Error cargando posiciones:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { reload(); }, [reload]);

  const toggleExpand = useCallback(async (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    // Load units on first expand
    if (!unitsCache[id] && !loadingUnits.has(id)) {
      setLoadingUnits(prev => new Set(prev).add(id));
      try {
        const units = await unidadesService.getByUbicacion('posicion', id);
        setUnitsCache(prev => ({ ...prev, [id]: units }));
      } catch (err) {
        console.error('Error cargando unidades:', err);
      } finally {
        setLoadingUnits(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  }, [unitsCache, loadingUnits]);

  return { tree, allPositions, loading, reload, expandedIds, toggleExpand, unitsCache, loadingUnits };
}

function buildTree(items: PosicionStock[]): PosicionNode[] {
  const map = new Map<string, PosicionNode>();
  items.forEach(p => map.set(p.id, { ...p, children: [], unitCount: 0 }));

  const roots: PosicionNode[] = [];
  items.forEach(p => {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children by orden then codigo
  const sortNodes = (nodes: PosicionNode[]) => {
    nodes.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
    nodes.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}
