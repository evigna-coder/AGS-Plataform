import type { Presupuesto, WorkOrder } from '@ags/shared';

/**
 * (Extraído de useControlSemanal 2026-09-08: función pura, sin Firebase, para poder
 * usarla y testearla desde utils/analitica.)
 *
 * Universo de OTs de un ppto: vinculadas ∪ OTs cuyo budgets[] contiene el número
 * (mismo criterio que CierreFacturacionWizard). Excluye OTs padre con hijas:
 * son contenedores no-accionables que nunca reciben cierre administrativo.
 */
export function otsDelPresupuesto(pres: Presupuesto, allOTs: WorkOrder[]): Set<string> {
  const nums = new Set<string>([
    ...(pres.otsVinculadasNumbers ?? []),
    ...(pres.otVinculadaNumber ? [pres.otVinculadaNumber] : []),
  ]);
  for (const ot of allOTs) {
    if ((ot.budgets || []).includes(pres.numero)) nums.add(ot.otNumber);
  }

  // El vínculo lo manda la OT (2026-08-20). `otsVinculadasNumbers` vive en el
  // presupuesto y se estampa al crear la OT, pero sacar el presupuesto de la OT
  // NO lo limpia: el ppto seguía figurando en el control de esa semana aunque ya
  // no tuviera nada que ver con la orden (caso Eriochem, ppto 005047 corregido a
  // otra semana).
  //
  // Solo se descarta cuando la OT EXISTE y su `budgets` contradice el vínculo.
  // Si la OT no está en la lista no se toca: no hay con qué verificar, y perder
  // un vínculo real es peor que arrastrar uno viejo.
  const otPorNumero = new Map(allOTs.map(o => [o.otNumber, o]));
  for (const num of [...nums]) {
    const ot = otPorNumero.get(num);
    if (!ot) continue;
    if (!(ot.budgets || []).includes(pres.numero)) nums.delete(num);
  }
  const padresConHijas = new Set(
    allOTs.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]));
  for (const num of [...nums]) {
    if (!num.includes('.') && padresConHijas.has(num)) {
      nums.delete(num);
      // Heredar el vínculo a las hijas (2026-08-06): si el ppto se vinculó al
      // PADRE (ej. editándolo después de crear la OT), las hijas no tienen el
      // budget propio — borrar el padre sin heredar perdía la relación y el
      // ppto figuraba "sin OT" (caso 29960/29960.01, P1-005046-01).
      for (const o of allOTs) {
        if (o.otNumber.startsWith(`${num}.`)) nums.add(o.otNumber);
      }
    }
  }
  return nums;
}
