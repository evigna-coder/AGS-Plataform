import { useEffect, useMemo, useState } from 'react';
import type { Sistema, ModuloSistema, CategoriaEquipo } from '@ags/shared';
import { modulosService } from '../services/firebaseService';

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export type ModulosBySistema = Record<string, ModuloSistema[]>;

/**
 * Búsqueda en memoria sobre sistemas + módulos.
 * Pre-fetch de módulos en paralelo al cambiar la lista de sistemas.
 * El consumidor decide qué hacer con `matchedViaModulo` (típicamente: forzar expand).
 */
export function useSistemasSearch(
  sistemas: Sistema[],
  categorias: CategoriaEquipo[] = [],
) {
  const [query, setQuery] = useState('');
  const [modulosBySistema, setModulosBySistema] = useState<ModulosBySistema>({});
  const [loadingModulos, setLoadingModulos] = useState(false);

  const sistemaIdsKey = sistemas.map((s) => s.id).sort().join(',');

  useEffect(() => {
    if (sistemas.length === 0) {
      setModulosBySistema({});
      setLoadingModulos(false);
      return;
    }
    let cancelled = false;
    setLoadingModulos(true);
    Promise.all(
      sistemas.map(async (s) => {
        try {
          const ms = await modulosService.getBySistema(s.id);
          return [s.id, ms] as const;
        } catch (err) {
          console.error(`Error cargando módulos de ${s.id}:`, err);
          return [s.id, [] as ModuloSistema[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setModulosBySistema(Object.fromEntries(entries));
      setLoadingModulos(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sistemaIdsKey]);

  const categoriaById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categorias) m.set(c.id, c.nombre);
    return m;
  }, [categorias]);

  const result = useMemo(() => {
    const q = norm(query.trim());
    if (!q) {
      return {
        filtered: sistemas,
        matchedViaModulo: new Set<string>(),
        matchedModuloIds: new Set<string>(),
        active: false,
      };
    }
    const filtered: Sistema[] = [];
    const matchedViaModulo = new Set<string>();
    const matchedModuloIds = new Set<string>();

    for (const s of sistemas) {
      const sistemaHaystack = [
        s.nombre,
        s.codigoInternoCliente,
        s.agsVisibleId,
        s.id,
        s.sector,
        categoriaById.get(s.categoriaId),
      ]
        .map(norm)
        .join(' | ');

      const sistemaMatch = sistemaHaystack.includes(q);

      const sistemaModulos = modulosBySistema[s.id] ?? [];
      const matchingModulos = sistemaModulos.filter((m) => {
        const h = [m.nombre, m.descripcion, m.serie, m.marca, m.firmware]
          .map(norm)
          .join(' | ');
        return h.includes(q);
      });

      if (sistemaMatch || matchingModulos.length > 0) {
        filtered.push(s);
        if (matchingModulos.length > 0) {
          matchedViaModulo.add(s.id);
          for (const m of matchingModulos) matchedModuloIds.add(m.id);
        }
      }
    }
    return { filtered, matchedViaModulo, matchedModuloIds, active: true };
  }, [sistemas, modulosBySistema, query, categoriaById]);

  return {
    query,
    setQuery,
    filtered: result.filtered,
    matchedViaModulo: result.matchedViaModulo,
    matchedModuloIds: result.matchedModuloIds,
    isSearching: result.active,
    modulosBySistema,
    loadingModulos,
  };
}
