import type { EnviadoPorEmail, EnvioManual } from '../../services/firebaseService';

function fmtFecha(dateStr?: string | null) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
}

const MailIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

/**
 * Indicador del estado de envío del reporte al cliente por mail.
 * Fuente: campo `enviadoPorEmail` que escribe reportes-ot en CADA intento (éxito o fallo).
 * Prioridad al override `envioManual` (marcado a mano desde el portal cuando el envío
 * automático falló pero el reporte se entregó por otro medio).
 *
 * Si se pasan `onMark`/`onUnmark`, el badge ofrece la acción de marcar/deshacer:
 *  - estado distinto de 'enviado' y sin marca manual → botón "marcar enviado"
 *  - con marca manual → botón "deshacer"
 *  - 'enviado' por el sistema → sin acción (ya salió solo)
 */
export function EnvioEmailBadge({
  envio,
  envioManual,
  onMark,
  onUnmark,
  busy,
}: {
  envio?: EnviadoPorEmail | null;
  envioManual?: EnvioManual | null;
  onMark?: () => void;
  onUnmark?: () => void;
  busy?: boolean;
}) {
  // 1) Override manual: prevalece sobre el estado real del envío automático.
  if (envioManual) {
    const fecha = fmtFecha(envioManual.fecha);
    const quien = envioManual.marcadoPorNombre || '';
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1 text-[10px] text-teal-600"
          title={`Marcado como enviado por otro medio${fecha ? ' el ' + fecha : ''}${quien ? ' — ' + quien : ''}`}
        >
          <MailIcon />
          Enviado (otro medio){fecha ? ` ${fecha}` : ''}
        </span>
        {onUnmark && (
          <button
            onClick={onUnmark}
            disabled={busy}
            className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
            title="Deshacer la marca manual"
          >
            ✕
          </button>
        )}
      </span>
    );
  }

  // 2) Enviado por el sistema (sin acción: ya salió solo).
  if (envio?.estado === 'enviado') {
    const dest = (envio.destinatarios || []).join(', ');
    const fecha = fmtFecha(envio.fecha);
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-emerald-600"
        title={`Enviado al cliente${fecha ? ' el ' + fecha : ''}${dest ? ' — ' + dest : ''}`}
      >
        <MailIcon />
        Enviado{fecha ? ` ${fecha}` : ''}
      </span>
    );
  }

  // 3) Falló el envío automático, o no hay registro. Ofrece marcar manual.
  const fallo = envio?.estado === 'error';
  return (
    <span className="inline-flex items-center gap-1">
      {fallo ? (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-red-500"
          title={`Falló el envío al cliente${envio?.error ? ': ' + envio.error : ''}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99L13.74 4a2 2 0 00-3.48 0L3.33 16.01A2 2 0 005.07 19z" />
          </svg>
          Falló envío
        </span>
      ) : (
        <span className="text-[10px] text-slate-400" title="No hay registro de envío del reporte por mail">
          Sin envío
        </span>
      )}
      {onMark && (
        <button
          onClick={onMark}
          disabled={busy}
          className="text-[10px] text-teal-600 hover:text-teal-800 underline decoration-dotted disabled:opacity-50"
          title="Marcar como enviado por otro medio (WhatsApp, mail personal, impreso…)"
        >
          marcar enviado
        </button>
      )}
    </span>
  );
}
