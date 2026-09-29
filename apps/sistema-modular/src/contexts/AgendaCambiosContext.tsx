import { createContext, useContext, type ReactNode } from 'react';

/**
 * Entradas de agenda que acaban de cambiar en vivo (2026-09-29): la grilla
 * tiene tres capas memoizadas (grid → fila → celda), así que el set viaja por
 * contexto y cada celda pregunta por la suya en vez de arrastrar la prop.
 */
const Ctx = createContext<Set<string>>(new Set());

export function AgendaCambiosProvider({ cambiadas, children }: { cambiadas: Set<string>; children: ReactNode }) {
  return <Ctx.Provider value={cambiadas}>{children}</Ctx.Provider>;
}

export function useEntryCambiada(entryId?: string): boolean {
  const set = useContext(Ctx);
  return !!entryId && set.has(entryId);
}
