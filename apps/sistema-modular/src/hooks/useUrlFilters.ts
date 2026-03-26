import { useCallback, useMemo } from 'react';
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
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const def = schema[key];
      const strValue = String(value);
      // Remove param if it matches default (keep URL clean)
      if (
        (def.type === 'string' && strValue === (def.default as string)) ||
        (def.type === 'boolean' && value === def.default)
      ) {
        next.delete(key);
      } else {
        next.set(key, strValue);
      }
      return next;
    }, { replace: true });
  }, [schema, setSearchParams]);

  // Set multiple filter values at once
  const setFilters = useCallback((updates: Partial<InferValues<S>>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        const def = schema[key];
        if (!def) continue;
        const strValue = String(value);
        if (
          (def.type === 'string' && strValue === (def.default as string)) ||
          (def.type === 'boolean' && value === def.default)
        ) {
          next.delete(key);
        } else {
          next.set(key, strValue);
        }
      }
      return next;
    }, { replace: true });
  }, [schema, setSearchParams]);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const key of Object.keys(schema)) {
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [schema, setSearchParams]);

  return [filters, setFilter, setFilters, resetFilters] as const;
}
