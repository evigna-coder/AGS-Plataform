import { useEffect, useState } from 'react';
import { subWeeks } from 'date-fns';
import { cierreSemanalService } from '../services/cierreSemanalService';
import { formatDateKey, getMonday } from '../utils/agendaDateUtils';

/**
 * ¿Falta el cierre automático de la semana pasada? (2026-09-09)
 *
 * Regla: de miércoles en adelante, la semana anterior (lunes a domingo) tiene
 * que estar congelada. Si no está, la primera PC que abre el control la
 * genera. Lunes y martes no se hace nada: la semana todavía se está cerrando.
 */
export function useCierreSemanalPendiente() {
  const [semana, setSemana] = useState<{ inicio: string; fin: string } | null>(null);
  useEffect(() => {
    const hoy = new Date();
    if (hoy.getDay() < 3 && hoy.getDay() !== 0) return; // lun (1) y mar (2): todavía no
    const lunesAnterior = getMonday(subWeeks(hoy, 1));
    const inicio = formatDateKey(lunesAnterior);
    const fin = new Date(lunesAnterior); fin.setDate(fin.getDate() + 6);
    let alive = true;
    cierreSemanalService.getBySemana(inicio)
      .then(c => { if (alive && !c) setSemana({ inicio, fin: formatDateKey(fin) }); })
      .catch(err => console.warn('[useCierreSemanalPendiente]', err));
    return () => { alive = false; };
  }, []);
  return { semana, marcarHecho: () => setSemana(null) };
}
