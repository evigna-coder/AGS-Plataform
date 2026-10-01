import { useEffect, useState } from 'react';
import { importacionesService, ordenesCompraService, requerimientosService, unidadesService } from '../services/firebaseService';
import { buscarDondeViene, type LineaDondeViene } from '../utils/dondeViene';

/**
 * "¿Dónde viene?" de un artículo (2026-09-30): lee importaciones y OCs
 * (colecciones chicas, enteras) más requerimientos y unidades SOLO del
 * artículo, y arma las líneas sin sumar. Se recalcula al cambiar el artículo.
 */
export function useDondeViene(articuloId: string | null) {
  const [lineas, setLineas] = useState<LineaDondeViene[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!articuloId) { setLineas([]); setError(null); return; }
    let vivo = true;
    setLoading(true);
    setError(null);
    Promise.all([
      importacionesService.getAll(),
      ordenesCompraService.getAll(),
      requerimientosService.getAll({ articuloId }),
      unidadesService.getAll({ articuloId, activoOnly: true }),
    ]).then(([importaciones, ocs, requerimientos, unidades]) => {
      if (!vivo) return;
      setLineas(buscarDondeViene(articuloId, { importaciones, ocs, requerimientos, unidades }));
      setLoading(false);
    }).catch(err => {
      console.error('[useDondeViene]', err);
      if (vivo) { setError(err instanceof Error ? err.message : 'No se pudo consultar'); setLoading(false); }
    });
    return () => { vivo = false; };
  }, [articuloId]);

  return { lineas, loading, error };
}
