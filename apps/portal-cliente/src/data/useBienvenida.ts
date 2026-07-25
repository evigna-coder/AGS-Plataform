import { useEffect, useState } from 'react';
import type { BienvenidaData } from './types';
import { MOCK_BIENVENIDA } from './mock';

interface State {
  data: BienvenidaData | null;
  loading: boolean;
}

/**
 * Fuente de datos de la Bienvenida.
 * TODO(datos): reemplazar el mock por lecturas Firestore scopeadas por `clienteId`
 * (sistemas + fichas + workorders + agenda) detrás de un servicio.
 */
export function useBienvenida(): State {
  const [state, setState] = useState<State>({ data: null, loading: true });

  useEffect(() => {
    // Simula la carga asíncrona que tendrá el fetch real.
    const t = setTimeout(() => setState({ data: MOCK_BIENVENIDA, loading: false }), 150);
    return () => clearTimeout(t);
  }, []);

  return state;
}
