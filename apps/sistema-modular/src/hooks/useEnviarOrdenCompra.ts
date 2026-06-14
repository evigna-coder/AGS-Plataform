import { useState } from 'react';
import { useGoogleOAuth } from './useGoogleOAuth';
import { sendGmail } from '../services/gmailService';
import { ordenesCompraService } from '../services/firebaseService';
import { proveedoresService } from '../services/personalService';
import { generateOrdenCompraPDF } from '../components/stock/pdf/generateOrdenCompraPDF';
import type { OrdenCompra } from '@ags/shared';

export type EnviarOCStatus =
  | 'idle' | 'authorizing' | 'generating_pdf' | 'sending' | 'updating_firestore' | 'sent' | 'error';

interface SendOpts { to: string[]; cc?: string[]; subject: string; htmlBody: string; }

/**
 * Envío de una OC al proveedor: mismo patrón token-first que useEnviarPresupuesto,
 * client-side vía Gmail API (no depende de mailQueue/Cloud Function). Sin anexos.
 */
export function useEnviarOrdenCompra(oc: OrdenCompra, onSuccess: () => void) {
  const { requestToken } = useGoogleOAuth();
  const [status, setStatus] = useState<EnviarOCStatus>('idle');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (opts: SendOpts): Promise<void> => {
    setSending(true);
    setError('');

    // STAGE 1: OAuth token (10s race contra popup-blocker hangs)
    let accessToken: string;
    try {
      setStatus('authorizing');
      accessToken = await Promise.race([
        requestToken(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TOKEN_TIMEOUT')), 10000)),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg === 'TOKEN_TIMEOUT'
        ? 'OAuth tardó más de lo esperado. Verificá que los pop-ups no estén bloqueados.'
        : `No se pudo autorizar Gmail: ${msg}. Podés reintentar.`);
      setStatus('error'); setSending(false); return;
    }

    // STAGE 2: Generar PDF
    let pdfBase64: string;
    try {
      setStatus('generating_pdf');
      const prov = await proveedoresService.getById(oc.proveedorId).catch(() => null);
      const blob = await generateOrdenCompraPDF(oc, prov);
      pdfBase64 = await blobToBase64(blob);
    } catch (err) {
      setError(`No se pudo generar el PDF: ${err instanceof Error ? err.message : 'Error'}. Podés reintentar.`);
      setStatus('error'); setSending(false); return;
    }

    // STAGE 3: Enviar Gmail
    try {
      setStatus('sending');
      await sendGmail({
        accessToken,
        to: opts.to,
        cc: opts.cc && opts.cc.length > 0 ? opts.cc : undefined,
        subject: opts.subject,
        htmlBody: opts.htmlBody,
        attachments: [{ filename: `${oc.numero}.pdf`, mimeType: 'application/pdf', base64Data: pdfBase64 }],
      });
    } catch (err) {
      setError(`El mail no se pudo enviar: ${err instanceof Error ? err.message : 'Error'}. El estado NO cambió — podés reintentar.`);
      setStatus('error'); setSending(false); return;
    }

    // STAGE 4: marcar enviada al proveedor (transición best-effort)
    try {
      setStatus('updating_firestore');
      await ordenesCompraService.markEnviada(oc.id);
    } catch (err) {
      setError(`Mail enviado OK, pero hubo un error actualizando el estado: ${err instanceof Error ? err.message : 'Error'}. Cambialo manualmente.`);
      setStatus('error'); setSending(false); return;
    }

    setStatus('sent');
    setTimeout(() => onSuccess(), 1500);
    setSending(false);
  };

  return { send, status, error, sending };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
