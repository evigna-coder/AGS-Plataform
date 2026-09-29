import { useState } from 'react';
import type { WorkOrder } from '@ags/shared';
import { esOTCerradaTecnicamente } from '@ags/shared';
import { ordenesTrabajoService } from '../../services/otService';
import { notify } from '../../utils/notify';
import { formatFechaAR, fechaLocalYMD } from '../../utils/formatFecha';

/** Estado resumido del envío del reporte, para ordenar la columna. */
export type EnvioEstado = 'enviado' | 'manual' | 'error' | 'sin_envio' | 'no_aplica';

export function envioEstadoDe(ot: Pick<WorkOrder, 'estadoAdmin' | 'status' | 'enviadoPorEmail' | 'envioManual'>): EnvioEstado {
  if (!esOTCerradaTecnicamente(ot)) return 'no_aplica';
  if (ot.envioManual) return 'manual';
  if (ot.enviadoPorEmail?.estado === 'enviado') return 'enviado';
  if (ot.enviadoPorEmail?.estado === 'error') return 'error';
  return 'sin_envio';
}

const fmt = (iso?: string | null) => { const d = fechaLocalYMD(iso); return d ? formatFechaAR(d) : ''; };

const MailIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

/**
 * Envío del reporte al cliente, en la lista de OTs (2026-09-29): el mismo
 * aviso que el portal muestra en Historial, para que administración de
 * soporte controle desde acá que ningún reporte quedó sin salir.
 *  - `enviadoPorEmail` lo escribe reportes-ot en cada intento (éxito o error).
 *  - `envioManual` es la marca "se entregó por otro medio", con prioridad.
 * Solo aplica a OTs cerradas técnicamente: antes no hay reporte que enviar.
 */
export function OTEnvioCell({ ot }: { ot: WorkOrder }) {
  const [busy, setBusy] = useState(false);
  const estado = envioEstadoDe(ot);
  if (estado === 'no_aplica') return <span className="text-slate-300 text-xs">—</span>;

  const marcar = async () => {
    setBusy(true);
    try { await ordenesTrabajoService.marcarEnvioManual(ot.otNumber); }
    catch (e) { notify.error(e instanceof Error ? e.message : 'No se pudo marcar el envío'); }
    finally { setBusy(false); }
  };
  const deshacer = async () => {
    setBusy(true);
    try { await ordenesTrabajoService.quitarEnvioManual(ot.otNumber); }
    catch (e) { notify.error(e instanceof Error ? e.message : 'No se pudo deshacer la marca'); }
    finally { setBusy(false); }
  };

  if (estado === 'manual') {
    const m = ot.envioManual!;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-teal-600" onClick={e => e.stopPropagation()}
        title={`Marcado como enviado por otro medio${m.fecha ? ' el ' + fmt(m.fecha) : ''}${m.marcadoPorNombre ? ' — ' + m.marcadoPorNombre : ''}`}>
        <MailIcon />Enviado (otro medio){m.fecha ? ` ${fmt(m.fecha)}` : ''}
        <button onClick={deshacer} disabled={busy} className="text-slate-400 hover:text-slate-600 disabled:opacity-50" title="Deshacer la marca manual">✕</button>
      </span>
    );
  }
  if (estado === 'enviado') {
    const e = ot.enviadoPorEmail!;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600"
        title={`Enviado al cliente${e.fecha ? ' el ' + fmt(e.fecha) : ''}${e.destinatarios?.length ? ' — ' + e.destinatarios.join(', ') : ''}`}>
        <MailIcon />Enviado{e.fecha ? ` ${fmt(e.fecha)}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {estado === 'error' ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium" title={`Falló el envío al cliente${ot.enviadoPorEmail?.error ? ': ' + ot.enviadoPorEmail.error : ''}`}>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99L13.74 4a2 2 0 00-3.48 0L3.33 16.01A2 2 0 005.07 19z" />
          </svg>
          Falló envío
        </span>
      ) : (
        <span className="text-[10px] text-slate-400" title="No hay registro de envío del reporte por mail">Sin envío</span>
      )}
      <button onClick={marcar} disabled={busy} className="text-[10px] text-teal-600 hover:text-teal-800 underline decoration-dotted disabled:opacity-50"
        title="Marcar como enviado por otro medio (WhatsApp, mail personal, impreso…)">
        marcar enviado
      </button>
    </span>
  );
}
