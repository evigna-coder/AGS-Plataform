import { useEffect, useRef } from 'react';
import { useControlSemanal } from '../../hooks/useControlSemanal';
import { useCierreSemanal } from '../../hooks/useCierreSemanal';

interface Props {
  /** Lunes y domingo de la semana a congelar (la ANTERIOR a la actual). */
  semanaInicio: string;
  semanaFin: string;
  onListo: () => void;
}

/**
 * Generación automática del cierre de los miércoles (2026-09-09).
 *
 * No hay nada corriendo del lado del servidor, así que lo hace la primera PC
 * que abre el control semanal un miércoles o después: carga la semana
 * anterior con el mismo hook de la pantalla y, cuando está lista, la
 * congela. Si otra PC llegó primero, `guardar` respeta el cierre existente.
 * Renderiza nada: es un efecto con datos.
 */
export function CierreSemanalAutoGenerador({ semanaInicio, semanaFin, onListo }: Props) {
  const c = useControlSemanal(semanaInicio, semanaFin);
  const { congelar } = useCierreSemanal();
  const hecho = useRef(false);

  useEffect(() => {
    if (c.loading || c.error || hecho.current) return;
    hecho.current = true;
    void congelar(semanaInicio, semanaFin, {
      agendaRows: c.agendaRows, otsArrastre: c.otsArrastre, entregasPendientes: c.entregasPendientes,
      establecimientoPorOT: c.establecimientoPorOT, presupuestoPorNumero: c.presupuestoPorNumero,
      presupuestoRows: c.presupuestoRows, facturacionRows: c.facturacionRows,
      agendaKpis: c.agendaKpis, presupuestoKpis: c.presupuestoKpis, facturacionKpis: c.facturacionKpis,
    }, { silencioso: false }).finally(onListo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.loading, c.error]);

  return null;
}
