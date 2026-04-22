import * as functions from 'firebase-functions/v2/https';

const REGION = 'southamerica-east1';

/**
 * HelloPing — función de ejemplo / sanity check del pipeline de deploy.
 * No tiene lógica de negocio. Sirve para validar que el workspace está bien configurado.
 *
 * Usage:
 *   curl https://southamerica-east1-agssop-e7353.cloudfunctions.net/helloPing
 *   → { ok: true, ts: 1729...,  region: 'southamerica-east1' }
 */
export const helloPing = functions.onRequest({ region: REGION }, (req, res) => {
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    region: REGION,
  });
});

// Phase 9 — Stock ATP Extendido
export {
  updateResumenStockOnUnidad,
  updateResumenStockOnOC,
  updateResumenStockOnRequerimiento,
} from './updateResumenStock';
export { onOTCerrada } from './onOTCerrada';
