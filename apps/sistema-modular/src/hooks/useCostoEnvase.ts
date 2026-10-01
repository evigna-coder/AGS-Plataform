import { useEffect, useMemo, useState } from 'react';
import type { PresentacionUsada, UnidadStock } from '@ags/shared';
import { unidadesService } from '../services/firebaseService';
import { costoParaEnvase, type CostoEnvase } from '../utils/envasePresupuesto';

/**
 * Costo de referencia del envase que se está cotizando (2026-10-01). Baja las
 * unidades del artículo una vez; cambiar de envase solo recalcula.
 */
export function useCostoEnvase(articuloId: string | null | undefined, presentacion: PresentacionUsada | null | undefined): CostoEnvase | null {
  const [unidades, setUnidades] = useState<UnidadStock[] | null>(null);
  useEffect(() => {
    setUnidades(null);
    if (!articuloId) return;
    let vivo = true;
    unidadesService.getByArticulo(articuloId)
      .then(us => { if (vivo) setUnidades(us); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [articuloId]);
  const codigo = presentacion?.codigoParte ?? null;
  const factor = presentacion?.factor ?? 1;
  return useMemo(
    () => (unidades ? costoParaEnvase(unidades, codigo ? { codigoParte: codigo, factor } : null) : null),
    [unidades, codigo, factor],
  );
}
