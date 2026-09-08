import type { Presupuesto, WorkOrder } from '@ags/shared';
import { ordenesTrabajoService } from '../services/firebaseService';
import { otsDelPresupuesto } from '../hooks/useControlSemanal';

export type PresupuestoRef = Pick<Presupuesto, 'numero' | 'otsVinculadasNumbers' | 'otVinculadaNumber'>;

/**
 * Trae las OTs de un presupuesto con lectura ACOTADA (2026-08-14, extraído
 * 2026-09-08 para compartirlo con la card de certificaciones): las OTs que
 * declaran el presupuesto en `budgets` + las que el presupuesto declara + las
 * hijas de los padres que aparezcan (el vínculo puede estar en el padre y el
 * trabajo en la hija). Nunca la colección `reportes` entera.
 *
 * Devuelve las OTs encontradas y los números resueltos por `otsDelPresupuesto`
 * (sin padres con hijas), ordenados de más nuevo a más viejo.
 */
export async function cargarOTsDelPresupuesto(pres: PresupuestoRef): Promise<{ ots: WorkOrder[]; numeros: string[] }> {
  const numerosPropios = [
    ...(pres.otsVinculadasNumbers ?? []),
    ...(pres.otVinculadaNumber ? [pres.otVinculadaNumber] : []),
  ];
  const porBudget = pres.numero
    ? await ordenesTrabajoService.queryByBudget(pres.numero).catch(() => [])
    : [];
  const porNumero = await Promise.all(
    numerosPropios.map(n => ordenesTrabajoService.getByOtNumber(n).catch(() => null)),
  );
  const encontradas = new Map<string, WorkOrder>();
  for (const ot of [...porBudget, ...porNumero]) if (ot) encontradas.set(ot.otNumber, ot);
  const padres = [...encontradas.keys()].filter(n => !n.includes('.'));
  const hijas = await Promise.all(padres.map(p => ordenesTrabajoService.getHijas(p).catch(() => [])));
  for (const ot of hijas.flat()) encontradas.set(ot.otNumber, ot);
  const ots = [...encontradas.values()];
  const numeros = [...otsDelPresupuesto(pres as Presupuesto, ots)]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return { ots, numeros };
}
