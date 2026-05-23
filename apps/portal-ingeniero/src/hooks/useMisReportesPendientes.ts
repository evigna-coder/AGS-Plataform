import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { reportesPendientesService, type BorradorPendiente } from '../services/firebaseService';

/**
 * Lista los borradores de reporte que el usuario actual creó desde reportes-ot
 * y aún no finalizó. Filtrado por `creadoPor.uid`.
 *
 * Para usuarios con rol `admin`, devuelve TODOS los borradores (no filtra por
 * creador) para que puedan supervisar lo pendiente del equipo. La page
 * usa `viendoTodos` para decidir qué columnas mostrar.
 *
 * Borradores creados antes de que reportes-ot instrumentara `creadoPor` (ver
 * memoria project_reportes_creadoPor) no aparecen — se cierran a mano.
 */
export function useMisReportesPendientes() {
  const { usuario, hasRole } = useAuth();
  const [borradores, setBorradores] = useState<BorradorPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = hasRole('admin');

  useEffect(() => {
    if (!usuario?.id) {
      setBorradores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const onData = (list: BorradorPendiente[]) => {
      setBorradores(list);
      setLoading(false);
    };
    const onErr = (err: Error) => {
      console.error('[useMisReportesPendientes] error:', err);
      setError(err.message);
      setLoading(false);
    };

    const unsub = esAdmin
      ? reportesPendientesService.subscribeTodosBorradores(onData, onErr)
      : reportesPendientesService.subscribeMisBorradores(usuario.id, onData, onErr);
    return unsub;
  }, [usuario?.id, esAdmin]);

  return { borradores, loading, error, viendoTodos: esAdmin };
}
