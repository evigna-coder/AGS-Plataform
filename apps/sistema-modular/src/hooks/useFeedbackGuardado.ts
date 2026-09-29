import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoGuardado = 'idle' | 'guardando' | 'listo';

/** Cuánto se muestra el tilde verde antes de cerrar (ms). */
export const LISTO_MS = 700;

/**
 * Feedback de guardado para botones (2026-09-29): "Guardar" → spinner con
 * "Guardando…" → tilde verde "Listo" un instante → recién ahí se cierra el
 * modal. Antes el modal se cerraba de golpe y el único aviso era el toast.
 *
 *   const fb = useFeedbackGuardado();
 *   const guardar = () => fb.correr(async () => { await service.update(...); }, () => { onSaved(); onClose(); });
 *   <Button estado={fb.estado} onClick={guardar}>Guardar</Button>
 *
 * Si la promesa falla, vuelve a `idle` y relanza (el caller muestra el error).
 */
export function useFeedbackGuardado() {
  const [estado, setEstado] = useState<EstadoGuardado>('idle');
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const correr = useCallback(async (accion: () => Promise<void>, alTerminar?: () => void) => {
    setEstado('guardando');
    try {
      await accion();
    } catch (err) {
      if (vivo.current) setEstado('idle');
      throw err;
    }
    if (!vivo.current) { alTerminar?.(); return; }
    setEstado('listo');
    await new Promise(r => window.setTimeout(r, LISTO_MS));
    if (vivo.current) setEstado('idle');
    alTerminar?.();
  }, []);

  return { estado, correr, guardando: estado === 'guardando' };
}
