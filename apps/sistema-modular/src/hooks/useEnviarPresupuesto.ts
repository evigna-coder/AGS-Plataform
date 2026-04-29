import { useState } from 'react';
import { useGoogleOAuth } from './useGoogleOAuth';
import { useEnviarAnexos } from './useEnviarAnexos';
import { sendGmail } from '../services/gmailService';
import { presupuestosService } from '../services/firebaseService';
import { generateAnexoConsumiblesPDF } from '../components/presupuestos/pdf';
import type { GeneratePDFParams } from '../components/presupuestos/pdf';
import type { PresupuestoEstado } from '@ags/shared';

/**
 * Stage machine for the mail-send flow (FMT-02 token-first order).
 * Each stage maps 1:1 to a visible status message in the consuming modal.
 *
 * Phase 04 / Plan 04-05: stage `preparing_anexos` se interpone ENTRE `generating_pdf`
 * y `sending` SI el operador pidió incluir anexos. Token ya validado (Stage 1) y PDF
 * principal ya generado (Stage 2): si Stage 2.5 falla, NO se mandó nada y el ppto
 * NO transiciona — token-first order preservado.
 */
export type EnviarStatus =
  | 'idle'
  | 'authorizing'
  | 'generating_pdf'
  | 'preparing_anexos'
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
  /** Plan 04-05 — si true y hay anexos pre-cargados, se generan y adjuntan al sendGmail. */
  includeAnexos?: boolean;
}

/**
 * Encapsulates the token-first send flow:
 *   1. requestToken (wrapped in 10s race to defeat popup-blocker hangs — FINDING-H / R3)
 *   2. generatePDF
 *   2.5. (opt) prepare anexos (Plan 04-05) — delega pre-carga a useEnviarAnexos
 *   3. sendGmail
 *   4. markEnviado (only when current estado is 'borrador' — avoids overwriting fechaEnvio)
 *
 * El sub-hook `useEnviarAnexos` se encarga del pre-load de catálogos. El state
 * machine de envío vive en este hook (state `preparing_anexos` + adjuntar N PDFs).
 */
export function useEnviarPresupuesto(params: UseEnviarParams) {
  const { requestToken } = useGoogleOAuth();
  const [status, setStatus] = useState<EnviarStatus>('idle');
  const [error, setError] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Plan 04-05 — sub-hook que pre-carga catálogos y construye anexos.
  const {
    anexos,
    warnings: anexoWarnings,
    loading: anexosLoading,
    loadAnexos,
  } = useEnviarAnexos(params.pdfParams);

  const send = async (opts: SendOpts): Promise<void> => {
    setSending(true);
    setError('');

    // STAGE 1: OAuth token — WRAPPED IN 10s TIMEOUT (FINDING-H / R3)
    let accessToken: string;
    try {
      setStatus('authorizing');
      accessToken = await Promise.race([
        requestToken(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TOKEN_TIMEOUT')), 10000),
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

    // STAGE 2: Generate PDF principal
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

    // STAGE 2.5: Generate anexos PDFs (Plan 04-05) — solo si el operador lo pidió
    // y hay anexos pre-cargados. Si falla, ABORTAMOS antes del sendGmail (token-first
    // order: el ppto no transiciona si la prep falla, el operador puede reintentar).
    let anexoAttachments: { filename: string; mimeType: string; base64Data: string }[] = [];
    if (opts.includeAnexos && anexos.length > 0) {
      try {
        setStatus('preparing_anexos');
        const blobs = await Promise.all(
          anexos.map(async (a) => {
            const blob = await generateAnexoConsumiblesPDF(a.data);
            const base64 = await blobToBase64(blob);
            return { filename: a.filename, mimeType: 'application/pdf', base64Data: base64 };
          }),
        );
        anexoAttachments = blobs;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setError(`No se pudieron generar los anexos: ${msg}. El estado NO cambió — podés reintentar.`);
        setStatus('error');
        setSending(false);
        return;
      }
    }

    // STAGE 3: Send Gmail con principal + N anexos.
    try {
      setStatus('sending');
      await sendGmail({
        accessToken,
        to: opts.to,
        cc: opts.cc && opts.cc.length > 0 ? opts.cc : undefined,
        subject: opts.subject,
        htmlBody: opts.htmlBody,
        attachments: [
          {
            filename: `${params.presupuestoNumero}.pdf`,
            mimeType: 'application/pdf',
            base64Data: pdfBase64,
          },
          ...anexoAttachments,
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`El mail no se pudo enviar: ${msg}. El estado NO cambió — podés reintentar.`);
      setStatus('error');
      setSending(false);
      return;
    }

    // STAGE 4: Mark as enviado (atomic) — only transition from 'borrador'.
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
            'El presupuesto sigue en "borrador" — cambialo manualmente.',
        );
        setStatus('error');
        setSending(false);
        return;
      }
    }

    // STAGE 5: Success — brief pause so the user sees the green "sent" flash.
    setStatus('sent');
    setTimeout(() => {
      params.onSuccess();
    }, 1500);
    setSending(false);
  };

  return {
    send,
    status,
    error,
    sending,
    // Plan 04-05 — API extendida para gestión de anexos (delegada a useEnviarAnexos)
    anexos,
    anexoWarnings,
    anexosLoading,
    loadAnexos,
  };
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
