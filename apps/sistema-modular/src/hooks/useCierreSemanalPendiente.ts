import { useCallback, useEffect, useState } from 'react';
import { subWeeks } from 'date-fns';
import { cierreSemanalService } from '../services/cierreSemanalService';
import { formatDateKey, getMonday } from '../utils/agendaDateUtils';
import { useTabOverlay } from '../contexts/TabOverlayContext';

/** Cada cuánto se vuelve a mirar mientras la pestaña sigue abierta. */
const REVISAR_CADA_MS = 60 * 60 * 1000;

/**
 * ¿Falta el cierre automático de la semana pasada? (2026-09-09)
 *
 * Regla: de miércoles en adelante, la semana anterior (lunes a domingo) tiene
 * que estar congelada. Si no está, la primera PC que abre el control la
 * genera. Lunes y martes no se hace nada: la semana todavía se está cerrando.
 *
 * Se reevalúa (2026-09-18, semana del 7/9 sin cierre): la verificación corría
 * UNA vez al montar, y con las pestañas persistentes una pestaña abierta el
 * lunes quedaba con el "todavía no" para siempre — el miércoles nadie volvía a
 * preguntar. Ahora vuelve a mirar al activar la pestaña, al volver a la
 * ventana y cada hora.
 */
export function useCierreSemanalPendiente() {
  const [semana, setSemana] = useState<{ inicio: string; fin: string } | null>(null);
  const isTabActive = useTabOverlay()?.isTabActive ?? true;

  const revisar = useCallback(async () => {
    const hoy = new Date();
    if (hoy.getDay() < 3 && hoy.getDay() !== 0) return; // lun (1) y mar (2): todavía no
    const lunesAnterior = getMonday(subWeeks(hoy, 1));
    const inicio = formatDateKey(lunesAnterior);
    const fin = new Date(lunesAnterior); fin.setDate(fin.getDate() + 6);
    try {
      const c = await cierreSemanalService.getBySemana(inicio);
      if (!c) setSemana(prev => (prev?.inicio === inicio ? prev : { inicio, fin: formatDateKey(fin) }));
    } catch (err) {
      console.warn('[useCierreSemanalPendiente]', err);
    }
  }, []);

  useEffect(() => {
    if (!isTabActive) return;
    void revisar();
    const int = setInterval(() => void revisar(), REVISAR_CADA_MS);
    const onVis = () => { if (!document.hidden) void revisar(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(int); document.removeEventListener('visibilitychange', onVis); };
  }, [isTabActive, revisar]);

  return { semana, marcarHecho: () => setSemana(null) };
}
