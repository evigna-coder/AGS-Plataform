import { useState } from 'react';
import { useGoogleOAuth } from './useGoogleOAuth';
import { sendGmail } from '../services/gmailService';
import { presupuestosService } from '../services/firebaseService';
import type { PresupuestoEstado } from '@ags/shared';
import type { GeneratePDFParams } from '../components/presupuestos/pdf';

/**
 * Stage machine for the mail-send flow (FMT-02 token-first order).
 * Each stage maps 1:1 to a visible status message in the consuming modal.
 */
export type EnviarStatus =
  | 'idle'
  | 'authorizing'
  | 'generating_pdf'
  | 'sending'
  | 'updating_firestore'
  | 'sent'
  | 'error';

interface UseEnviarParams {
  presupuestoId: string;
  presupuestoEstado: PresupuestoEstado;
  presupuestoNumero: string;
  pdfParams: GeneratePDFParams;
  origenTipo?: string | null;
  origenId?: string | null;
  onSuccess: () => void;
}

interface SendOpts {
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
}

/**
 * Encapsulates the token-first send flow:
 *   1. requestToken (wrapped in 10s race to defeat popup-blocker hangs — FINDING-H / R3)
 *   2. generatePDF
 *   3. sendGmail
 *   4. markEnviado (only when current estado is 'borrador' — avoids overwriting fechaEnvio on re-sends)
 *
 * Each stage sets a specific `status` + surfaces a specific error string. The caller renders
 * the modal shell; this hook owns the state machine.
 */
export function useEnviarPresupuesto(params: UseEnviarParams) {
  const { requestToken } = useGoogleOAuth();
  const [status, setStatus] = useState<EnviarStatus>('idle');
  const [error, setError] = useState<string>('');
  const [sending, setSending] = useState(false);

  const send = async (opts: SendOpts): Promise<void> => {
    setSending(true);
    setError('');

    // STAGE 1: OAuth token — WRAPPED IN 10s TIMEOUT (FINDING-H / R3)
    // useGoogleOAuth.requestToken has no internal timeout. If the browser blocks the popup,
    // Google Identity Services never fires the callback → the promise hangs forever → UI spinner
    // is stuck. Promise.race with a TOKEN_TIMEOUT sentinel surfaces a specific message.
    let accessToken: string;
    try {
      setStatus('authorizing');
      accessToken = await Promise.race([
        requestToken(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TOKEN_TIMEOUT')), 10000)
        ),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg === 'TOKEN_TIMEOUT') {
        setError('OAuth tardó más de lo esperado. Verificá que los pop-ups no estén bloqueados.');
      } else {
        setError(`No se pudo autorizar Gmail: ${msg}. Podés reintentar.`);
      }
      setStatus('error');
      setSending(false);
      return;
    }

    // STAGE 2: Generate PDF
    let pdfBase64: string;
    try {
      setStatus('generating_pdf');
      const { generatePresupuestoPDF } = await import('../components/presupuestos/pdf');
      const pdfBlob = await generatePresupuestoPDF(params.pdfParams);
      pdfBase64 = await blobToBase64(pdfBlob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo generar el PDF: ${msg}. Podés reintentar.`);
      setStatus('error');
      setSending(false);
      return;
    }

    // STAGE 3: Send Gmail.
    // N2: sendGmail actually returns Promise<{id, threadId}> (not void). We ignore the return
    // value here — the messageId is available for future audit/reconciliation work but unused today.
    try {
      setStatus('sending');
      await sendGmail({
        accessToken,
        to: opts.to,
        cc: opts.cc && opts.cc.length > 0 ? opts.cc : undefined,
        subject: opts.subject,
        htmlBody: opts.htmlBody,
        attachments: [{
          filename: `${params.presupuestoNumero}.pdf`,
          mimeType: 'application/pdf',
          base64Data: pdfBase64,
        }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`El mail no se pudo enviar: ${msg}. El estado NO cambió — podés reintentar.`);
      setStatus('error');
      setSending(false);
      return;
    }

    // STAGE 4: Mark as enviado (atomic) — only transition from 'borrador'.
    // Re-sends on already-enviado/aceptado presupuestos deliver the mail but do NOT overwrite
    // fechaEnvio or change estado.
    // N1: propagate numero in hint so the lead posta entry reads "Presupuesto PRE-XXXX.NN → Enviado".
    if (params.presupuestoEstado === 'borrador') {
      try {
        setStatus('updating_firestore');
        await presupuestosService.markEnviado(params.presupuestoId, {
          origenTipo: params.origenTipo ?? undefined,
          origenId: params.origenId ?? undefined,
          numero: params.presupuestoNumero,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setError(
          `Mail enviado OK, pero hubo un error actualizando el estado: ${msg}. ` +
          'El presupuesto sigue en "borrador" — cambialo manualmente.'
        );
        setStatus('error');
        setSending(false);
        return;
      }
    }

    // STAGE 5: Success — brief pause so the user sees the green "sent" flash before the modal closes.
    setStatus('sent');
    setTimeout(() => {
      params.onSuccess();
    }, 1500);
    setSending(false);
  };

  return { send, status, error, sending };
}

/** Convert a Blob to a raw base64 string (no data-URL prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
