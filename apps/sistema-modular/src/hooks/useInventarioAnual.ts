import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Articulo, PosicionStock, UnidadStock } from '@ags/shared';
import { articulosService, posicionesStockService, unidadesService } from '../services/stockService';
import { marcasService } from '../services/catalogService';
import { armarInventario, type FiltrosInventario, type ResultadoInventario } from '../utils/inventarioAnual';

/**
 * Datos del inventario anual (2026-09-29): una lectura de unidades activas,
 * artículos, posiciones y marcas al abrir (o al apretar Recalcular); los
 * filtros se aplican en memoria, así cambiar de posición no vuelve a Firestore.
 */
export function useInventarioAnual(filtros: FiltrosInventario) {
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [marcas, setMarcas] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError(null);
    Promise.all([
      unidadesService.getAll({ activoOnly: true }),
      articulosService.getAll({ activoOnly: false }),
      posicionesStockService.getAll(false),
      marcasService.getAll(false).catch(() => []),
    ]).then(([u, a, p, m]) => {
      if (!vivo) return;
      setUnidades(u);
      setArticulos(a);
      setPosiciones(p);
      setMarcas(new Map(m.map(x => [x.id, x.nombre])));
      setLoading(false);
    }).catch(err => {
      console.error('[useInventarioAnual]', err);
      if (vivo) { setError(err instanceof Error ? err.message : 'No se pudo leer el stock'); setLoading(false); }
    });
    return () => { vivo = false; };
  }, [version]);

  const resultado = useMemo<ResultadoInventario | null>(() => {
    if (loading) return null;
    return armarInventario(unidades, articulos, posiciones, marcas, filtros);
  }, [unidades, articulos, posiciones, marcas, filtros, loading]);

  return { resultado, posiciones, loading, error, recargar };
}
