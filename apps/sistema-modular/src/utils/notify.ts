/**
 * Avisos no bloqueantes (2026-09-07). Reemplazo del `alert()` nativo: un
 * toast propio, con el estilo del sistema, que no corta el flujo ni abre el
 * diálogo crudo de Windows.
 *
 * API imperativa a propósito: se llama desde hooks, servicios y handlers sin
 * contexto de React. El host (`NotifyHost`) se registra al montar; si no hay
 * host (tests, pantallas fuera del layout) cae al alert nativo para no
 * perder el mensaje.
 *
 *   notify.success('Guardado');
 *   notify.error(err);                  // Error | string
 *   notify.warning('Seleccioná un cliente');
 */
export type NotifyKind = 'success' | 'error' | 'warning' | 'info';

export interface NotifyItem {
  id: number;
  kind: NotifyKind;
  message: string;
  /** ms en pantalla. Los errores duran más: hay que poder leerlos. */
  duration: number;
}

const DURATION: Record<NotifyKind, number> = { success: 3500, info: 4500, warning: 6000, error: 8000 };

type Host = (item: NotifyItem) => void;
let host: Host | null = null;
let nextId = 1;

/** Lo usa `NotifyHost` al montar/desmontar. No llamar desde otro lado. */
export function registerNotifyHost(fn: Host | null): void {
  host = fn;
}

function texto(message: unknown): string {
  if (message instanceof Error) return message.message || 'Ocurrió un error';
  return String(message ?? '').trim();
}

function push(kind: NotifyKind, message: unknown): void {
  const text = texto(message);
  if (!text) return;
  if (host) host({ id: nextId++, kind, message: text, duration: DURATION[kind] });
  else if (typeof window !== 'undefined') window.alert(text);
}

export const notify = {
  success: (message: unknown) => push('success', message),
  error: (message: unknown) => push('error', message),
  warning: (message: unknown) => push('warning', message),
  info: (message: unknown) => push('info', message),
};
