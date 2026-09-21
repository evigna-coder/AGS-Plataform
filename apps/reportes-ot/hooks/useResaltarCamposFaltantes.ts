import { useEffect } from 'react';

const CLASE = 'campo-faltante';

/**
 * Pinta en rojo los campos obligatorios que faltan (2026-09-21). Los inputs
 * ya llevan `data-required-field="clave"` (lo usa el scroll al primer campo);
 * acá se les agrega la clase `campo-faltante` (estilo en public/index.css) y
 * se saca cuando la clave deja de estar en el set. Como el asistente del
 * celular monta y desmonta los pasos, un MutationObserver vuelve a aplicar la
 * marca cuando un campo reaparece.
 */
export function useResaltarCamposFaltantes(claves: Set<string>) {
  useEffect(() => {
    const aplicar = () => {
      document.querySelectorAll<HTMLElement>('[data-required-field]').forEach(el => {
        const clave = el.dataset.requiredField ?? '';
        el.classList.toggle(CLASE, claves.has(clave));
      });
    };
    aplicar();
    if (claves.size === 0) return;
    const obs = new MutationObserver(muts => {
      if (muts.some(m => m.addedNodes.length > 0)) aplicar();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [claves]);
}
