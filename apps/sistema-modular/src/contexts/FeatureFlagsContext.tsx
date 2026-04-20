import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeFeatureFlags, type FeatureFlagsModules } from '../services/featureFlagsService';

/**
 * Context que expone el estado live de `/featureFlags/modules` de Firestore.
 *
 * - Valor inicial = `null` → "cargando" (el primer snapshot aún no llegó).
 * - Tras el primer snapshot = `{ modules: {...} }` (objeto vacío si el doc no existe).
 *
 * Este context lo consume:
 *   - `useNavigation()` (sidebar reactivo) en components/layout/navigation.ts
 *   - `ModulosAdminPage` (UI admin de toggles) en pages/admin/ModulosAdminPage.tsx
 */

const FeatureFlagsContext = createContext<FeatureFlagsModules | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlagsModules | null>(null);

  useEffect(() => {
    const unsub = subscribeFeatureFlags(next => setFlags(next));
    return () => unsub();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook: devuelve el estado live de featureFlags.
 *   - `null` mientras carga el primer snapshot.
 *   - `{ modules: {...} }` después (objeto posiblemente vacío si el doc no existe).
 *
 * Los consumers deben manejar el caso `null` como "todavía no sé, usar default del env".
 */
export function useFeatureFlags(): FeatureFlagsModules | null {
  return useContext(FeatureFlagsContext);
}
