import { useState, useEffect } from 'react';
import { posicionesStockService, unidadesService } from '../../../services/firebaseService';
import type { PosicionStock, EstadoUnidad } from '@ags/shared';

// Estados que cuentan como stock real (mismos que ViewArticuloModal): los terminales
// (entregado/consumido/vendido/baja) ya salieron y no suman.
const ESTADOS_EN_STOCK: EstadoUnidad[] = ['disponible', 'reservado', 'asignado', 'en_transito'];

export interface DepositoOption {
  value: string;
  label: string;
}

/**
 * Filtro por depósito para el catálogo de artículos.
 * - `depositos`: lista de posiciones tipo depósito (para el selector), cargada una vez.
 * - `stockPorArticulo`: Map<articuloId, cantidad en stock> de las unidades ubicadas en el
 *   depósito elegido. Se carga LAZY: solo cuando `depositoId` tiene valor. Vacío si no hay
 *   depósito seleccionado. Cuenta sólo unidades en stock real (excluye estados terminales).
 */
export function useDepositoFilter(depositoId: string) {
  const [depositos, setDepositos] = useState<DepositoOption[]>([]);
  const [stockPorArticulo, setStockPorArticulo] = useState<Map<string, number>>(new Map());
  const [loadingDeposito, setLoadingDeposito] = useState(false);

  // Depósitos para el selector (una vez).
  useEffect(() => {
    posicionesStockService.getAll()
      .then((pos: PosicionStock[]) => {
        setDepositos(
          pos
            .filter(p => p.tipo === 'deposito')
            .map(p => ({ value: p.id, label: p.nombre || p.codigo }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(err => console.error('[useDepositoFilter] error cargando depósitos:', err));
  }, []);

  // Unidades del depósito elegido → Map articuloId → cantidad en stock.
  useEffect(() => {
    if (!depositoId) { setStockPorArticulo(new Map()); return; }
    let alive = true;
    setLoadingDeposito(true);
    unidadesService.getAll({ activoOnly: true })
      .then(unidades => {
        if (!alive) return;
        const map = new Map<string, number>();
        for (const u of unidades) {
          if (u.ubicacion?.referenciaId !== depositoId) continue;
          if (!ESTADOS_EN_STOCK.includes(u.estado)) continue;
          map.set(u.articuloId, (map.get(u.articuloId) ?? 0) + (u.cantidad ?? 1));
        }
        setStockPorArticulo(map);
      })
      .catch(err => console.error('[useDepositoFilter] error cargando unidades:', err))
      .finally(() => { if (alive) setLoadingDeposito(false); });
    return () => { alive = false; };
  }, [depositoId]);

  return { depositos, stockPorArticulo, loadingDeposito };
}
