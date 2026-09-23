import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { OTResumenModal } from '../components/ordenes-trabajo/OTResumenModal';

interface OTResumenApi {
  /** Abre el resumen compacto de la OT (el mismo que usan los tickets). */
  abrir: (otNumber: string) => void;
}

const Ctx = createContext<OTResumenApi>({ abrir: () => {} });

/**
 * Resumen compacto de OT disponible desde cualquier pantalla (2026-09-23).
 * Los accesos a la OT desde agenda e historial abrían la página completa;
 * ahora abren el mismo modal que los tickets, con "Abrir OT completa" para
 * quien necesita trabajarla. Mis OT sigue yendo directo: es la cola de trabajo.
 */
export function OTResumenProvider({ children }: { children: ReactNode }) {
  const [otNumber, setOtNumber] = useState<string | null>(null);
  const abrir = useCallback((n: string) => setOtNumber(n), []);
  const api = useMemo(() => ({ abrir }), [abrir]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <OTResumenModal open={!!otNumber} otNumber={otNumber} onClose={() => setOtNumber(null)} />
    </Ctx.Provider>
  );
}

export function useOTResumen(): OTResumenApi {
  return useContext(Ctx);
}
