import type { EnviadoPorEmail } from '../../services/firebaseService';

function fmtFecha(dateStr?: string | null) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Indicador del estado de envío del reporte al cliente por mail.
 * Fuente: campo `enviadoPorEmail` que escribe reportes-ot en CADA intento (éxito o fallo).
 * Permite verificar desde el sistema si el mail al cliente salió, sin abrir reportes-ot.
 */
export function EnvioEmailBadge({ envio }: { envio?: EnviadoPorEmail | null }) {
  if (!envio || !envio.estado) {
    return (
      <span className="text-[10px] text-slate-400" title="No hay registro de envío del reporte por mail">
        Sin envío
      </span>
    );
  }

  if (envio.estado === 'enviado') {
    const dest = (envio.destinatarios || []).join(', ');
    const fecha = fmtFecha(envio.fecha);
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-emerald-600"
        title={`Enviado al cliente${fecha ? ' el ' + fecha : ''}${dest ? ' — ' + dest : ''}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Enviado{fecha ? ` ${fecha}` : ''}
      </span>
    );
  }

  // estado === 'error'
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-red-500"
      title={`Falló el envío al cliente${envio.error ? ': ' + envio.error : ''}`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99L13.74 4a2 2 0 00-3.48 0L3.33 16.01A2 2 0 005.07 19z" />
      </svg>
      Falló envío
    </span>
  );
}
