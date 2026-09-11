import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { reportesPendientesService, type BorradorPendiente } from '../services/firebaseService';
import { useIngenieroDocId } from './useIngenieroDocId';

/**
 * Lista los borradores de reporte que el usuario actual creó desde reportes-ot
 * y aún no finalizó, más las OTs en borrador asignadas a él (aunque otra
 * persona haya empezado el reporte — 2026-09-11).
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
  // La OT puede guardar el uid o el id del catálogo de ingenieros (igual que Mis OT).
  const { ingenieroDocId, loaded: ingLoaded } = useIngenieroDocId(usuario?.id, usuario?.email);

  useEffect(() => {
    if (!usuario?.id || !ingLoaded) {
      if (!usuario?.id) { setBorradores([]); setLoading(false); }
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

    const ids = [usuario.id, ingenieroDocId].filter((x): x is string => !!x);
    const unsub = esAdmin
      ? reportesPendientesService.subscribeTodosBorradores(onData, onErr)
      : reportesPendientesService.subscribeMisBorradores(ids, onData, onErr);
    return unsub;
  }, [usuario?.id, esAdmin, ingenieroDocId, ingLoaded]);

  return { borradores, loading, error, viendoTodos: esAdmin };
}
