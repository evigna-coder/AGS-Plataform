import type { OTEstadoAdmin } from '@ags/shared';

type Resultado = {
  loading: boolean;
  puedeFinalizarse: boolean;
  razon: string | null;
  pendientes: number;
};

/**
 * La OT se finaliza con sus propias validaciones de cierre (responsable, horas,
 * partes confirmadas — chequeadas en OTCierreAdminSection antes de finalizar).
 *
 * La facturación es un paso POSTERIOR y manual a nivel presupuesto: una vez que
 * todas las OTs del presupuesto están finalizadas (o anticipado), el admin agrupa
 * las OTs listas (`Presupuesto.otsListasParaFacturar`) y genera el aviso. NO es un
 * pre-requisito para finalizar la OT — la dependencia es al revés. Por eso este
 * hook ya no bloquea por estado de facturación (antes generaba el falso bloqueo del
 * cartel "solicitud sin enviar").
 */
export function useOTFinalizable(
  estadoAdmin: OTEstadoAdmin | undefined,
  _budgets?: string[] | undefined,
): Resultado {
  return {
    loading: false,
    puedeFinalizarse: estadoAdmin === 'CIERRE_ADMINISTRATIVO',
    razon: null,
    pendientes: 0,
  };
}
