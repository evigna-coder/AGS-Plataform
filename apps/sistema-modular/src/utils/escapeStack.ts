/**
 * Stack global de handlers de ESC.
 *
 * Cuando hay múltiples capas que quieren cerrarse con ESC (drawer + lightbox de
 * foto, modal + confirm dialog, etc.) cada una debe responder solo si está EN LA
 * CIMA del stack. Sin este patrón, varios handlers escuchando `window keydown`
 * disparan a la vez y cierran todo.
 *
 * Uso:
 *   useEffect(() => {
 *     if (!open) return;
 *     return pushEscape(() => onClose());
 *   }, [open]);
 */

type Handler = () => void;
const stack: Handler[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = stack[stack.length - 1];
    if (!top) return;
    e.preventDefault();
    e.stopPropagation();
    // Solo el handler más reciente reacciona; el resto queda intacto.
    top();
  }, true);
}

/**
 * Registra un handler de ESC en la cima del stack.
 * Devuelve una función de cleanup para llamar desde useEffect.
 */
export function pushEscape(handler: Handler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}
