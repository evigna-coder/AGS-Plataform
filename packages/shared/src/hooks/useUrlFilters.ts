import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Schema definition for URL-persisted filters.
 * Each key maps to a type and default value.
 *
 * Usage:
 * ```ts
 * const [filters, setFilter, setFilters] = useUrlFilters({
 *   search:    { type: 'string',  default: '' },
 *   estado:    { type: 'string',  default: '' },
 *   showAll:   { type: 'boolean', default: false },
 * });
 *
 * // Read: filters.search, filters.estado, filters.showAll
 * // Set one: setFilter('search', 'bomba')
 * // Set many: setFilters({ search: 'bomba', estado: 'activo' })
 * ```
 */

type FilterType = 'string' | 'boolean';

interface FilterDef<T extends FilterType> {
  type: T;
  default: T extends 'string' ? string : boolean;
}

type FilterSchema = Record<string, FilterDef<FilterType>>;

type InferValues<S extends FilterSchema> = {
  [K in keyof S]: S[K]['type'] extends 'boolean' ? boolean : string;
};

export function useUrlFilters<S extends FilterSchema>(schema: S) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Buffer de escrituras dentro del mismo handler (2026-08-12).
  // `setSearchParams` de react-router v7 le pasa al updater una copia de los
  // params DEL RENDER, no el valor vivo: dos llamadas seguidas (el caso típico
  // es handleSort → sortField + sortDir) parten de la misma base y la segunda
  // pisa a la primera. Síntoma: en los listados, invertir la columna ya activa
  // funcionaba pero cambiar de columna no hacía nada. Acá acumulamos las
  // escrituras en un ref y lo re-sincronizamos cuando la URL cambia de afuera.
  const pendingRef = useRef(searchParams);
  const lastSeenRef = useRef(searchParams);
  if (lastSeenRef.current !== searchParams) {
    lastSeenRef.current = searchParams;
    pendingRef.current = searchParams;
  }

  /** Escribe (o borra, si coincide con el default) una clave sobre `params`. */
  const applyToParams = useCallback((
    params: URLSearchParams,
    key: string,
    value: unknown,
  ) => {
    const def = schema[key];
    if (!def) return;
    const strValue = String(value);
    // Remove param if it matches default (keep URL clean)
    if (
      (def.type === 'string' && strValue === (def.default as string)) ||
      (def.type === 'boolean' && value === def.default)
    ) {
      params.delete(key);
    } else {
      params.set(key, strValue);
    }
  }, [schema]);

  /** Aplica cambios sobre el buffer pendiente y navega. */
  const commit = useCallback((mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(pendingRef.current);
    mutate(next);
    pendingRef.current = next;
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  // Derive current values from URL, falling back to defaults
  const filters = useMemo(() => {
    const result: Record<string, string | boolean> = {};
    for (const [key, def] of Object.entries(schema)) {
      const raw = searchParams.get(key);
      if (def.type === 'boolean') {
        result[key] = raw === 'true' ? true : raw === 'false' ? false : def.default;
      } else {
        result[key] = raw ?? (def.default as string);
      }
    }
    return result as InferValues<S>;
  }, [searchParams, schema]);

  // Set a single filter value
  const setFilter = useCallback(<K extends keyof S & string>(
    key: K,
    value: InferValues<S>[K],
  ) => {
    commit(next => applyToParams(next, key, value));
  }, [applyToParams, commit]);

  // Set multiple filter values at once
  const setFilters = useCallback((updates: Partial<InferValues<S>>) => {
    commit(next => {
      for (const [key, value] of Object.entries(updates)) applyToParams(next, key, value);
    });
  }, [applyToParams, commit]);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    commit(next => {
      for (const key of Object.keys(schema)) next.delete(key);
    });
  }, [commit, schema]);

  return [filters, setFilter, setFilters, resetFilters] as const;
}
