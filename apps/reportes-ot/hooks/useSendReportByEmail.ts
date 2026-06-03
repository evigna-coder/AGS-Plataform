import { useCallback, useState } from 'react';
import { sendGmail, approxMimeSize, GMAIL_SIZE_LIMIT_BYTES } from '../services/gmailService';
import { useGoogleOAuth } from './useGoogleOAuth';
import { buildSubject, buildHtmlBody, resolveRecipients } from '../utils/buildEmailContent';
import type { DeliveryFn, GeneratedPDFs } from './usePDFGeneration';
import type { FirebaseService } from '../services/firebaseService';
import type { ReportFormState } from './useReportForm';
import type { ContactoOption } from '../types/entities';
import type { AlertOptions, ConfirmOptions } from './useModal';

const BCC_INTERNO = 'reportes@agsanalitica.com';

export type EmailSendStatus =
  | 'idle'
  | 'authorizing'
  | 'preparing'
  | 'checking_size'
  | 'sending'
  | 'sent'
  | 'error';

interface UseSendReportByEmailDeps {
  formState: ReportFormState;
  contactosDB: ContactoOption[];
  firebase: FirebaseService;
  otNumber: string;
  handleFinalSubmit: (delivery: DeliveryFn) => Promise<void>;
  showAlert: (opts: AlertOptions) => void;
  showConfirm: (opts: ConfirmOptions) => Promise<boolean>;
}

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Hook que expone una acción `sendByEmail()`. Internamente:
 *  1. Resuelve destinatarios desde formState + contactosDB.
 *  2. Ejecuta `handleFinalSubmit` (guarda + genera PDFs + sube a Storage) con
 *     un delivery callback que hace el envío en lugar de la descarga.
 *  3. Si los adjuntos exceden 24 MB, ofrece al técnico caer a descarga manual.
 *  4. Persiste `enviadoPorEmail` (estado 'enviado' | 'error') en el doc del reporte
 *     en CADA intento — éxito o fallo — para dejar traza verificable desde el sistema.
 *  5. Solo muestra "Reporte enviado" si el mail realmente salió (bandera `delivered`).
 *
 * Ya que el reporte queda en FINALIZADO antes del envío (token-first guardado),
 * si el mail falla el reporte NO se revierte — el técnico puede reintentar
 * descargando o reabriendo el flow.
 */
export function useSendReportByEmail(deps: UseSendReportByEmailDeps) {
  const { formState, contactosDB, firebase, otNumber, handleFinalSubmit, showAlert, showConfirm } = deps;
  const { requestToken } = useGoogleOAuth();
  const [status, setStatus] = useState<EmailSendStatus>('idle');
  const [error, setError] = useState<string>('');

  const sendByEmail = useCallback(async () => {
    setError('');

    const to = resolveRecipients(
      formState.emailPrincipal,
      formState.destinatariosExtras,
      formState.destinatariosManuales,
      contactosDB,
    );

    if (to.length === 0) {
      showAlert({
        title: 'Sin destinatarios',
        message: 'No hay direcciones de mail cargadas. Completá el email del contacto principal o agregá un destinatario adicional antes de enviar.',
        type: 'warning',
      });
      return;
    }

    // Pedimos el token ANTES de finalizar el reporte. El popup de Google debe
    // abrirse en respuesta directa al click del usuario; si lo dejamos para
    // después del save+PDF+upload, el browser bloquea el popup por user-gesture
    // consumido. Bonus: si el user cancela la autorización, el reporte no se
    // marca FINALIZADO ni se sube PDF — fail fast antes de tocar Firestore.
    setStatus('authorizing');
    let accessToken: string;
    try {
      accessToken = await requestToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = `No se pudo autorizar Gmail: ${msg}`;
      setError(friendly);
      setStatus('error');
      showAlert({ title: 'Autorización cancelada', message: friendly, type: 'error' });
      return;
    }

    const variant = formState.protocolSelections && formState.protocolSelections.length > 0
      ? 'reporte-con-anexos'
      : 'reporte-solo';

    const subject = buildSubject({
      otNumber,
      razonSocial: formState.razonSocial,
      sistema: formState.sistema,
      moduloModelo: formState.moduloModelo,
      moduloSerie: formState.moduloSerie,
      fechaInicio: formState.fechaInicio,
      fechaFin: formState.fechaFin,
      tecnicoNombre: formState.aclaracionEspecialista,
    });

    const htmlBody = buildHtmlBody({
      otNumber,
      razonSocial: formState.razonSocial,
      sistema: formState.sistema,
      moduloModelo: formState.moduloModelo,
      moduloDescripcion: formState.moduloDescripcion,
      moduloSerie: formState.moduloSerie,
      codigoInternoCliente: formState.codigoInternoCliente,
      fechaInicio: formState.fechaInicio,
      fechaFin: formState.fechaFin,
      tecnicoNombre: formState.aclaracionEspecialista,
      tipoServicio: formState.tipoServicio,
      incluyeInstrumentos: (formState.instrumentosSeleccionados?.length ?? 0) > 0,
      incluyePatrones: (formState.patronesSeleccionados?.length ?? 0) > 0,
      incluyeCertificadosIngenieros: (formState.certificadosIngenieroSeleccionados?.length ?? 0) > 0,
    }, variant);

    // Bandera local: se prende SOLO cuando el mail realmente salió. Es la fuente
    // de verdad para mostrar "enviado" — no asumimos éxito porque handleFinalSubmit
    // haya retornado (podría haber fallado el PDF antes de llegar a la entrega).
    let delivered = false;

    // Registra el intento de envío en el doc del reporte (campo enviadoPorEmail),
    // tanto en éxito como en fallo, para dejar traza verificable desde el sistema.
    // No-bloqueante: si la escritura falla, no rompe el flujo (pero se loguea).
    const persistEnvioRecord = async (
      estado: 'enviado' | 'error',
      extra: { adjuntoTamanoMB?: number; error?: string } = {},
    ) => {
      try {
        await firebase.saveReport(otNumber, {
          enviadoPorEmail: {
            estado,
            fecha: new Date().toISOString(),
            destinatarios: to,
            bcc: [BCC_INTERNO],
            variante: variant,
            adjuntoTamanoMB: extra.adjuntoTamanoMB ?? null,
            error: extra.error ?? null,
          },
        });
      } catch (metaErr) {
        console.warn('[useSendReportByEmail] No se pudo guardar registro enviadoPorEmail:', metaErr);
      }
    };

    const emailDelivery: DeliveryFn = async (result: GeneratedPDFs, { setStep }) => {
      setStep('Preparando adjuntos…');
      setStatus('preparing');

      const reportBase64 = await blobToBase64(result.reportBlob);
      const attachments: { filename: string; mimeType: string; base64Data: string }[] = [
        { filename: result.reportFilename, mimeType: 'application/pdf', base64Data: reportBase64 },
      ];
      if (result.protocolBlob && result.protocolFilename) {
        const protoBase64 = await blobToBase64(result.protocolBlob);
        attachments.push({
          filename: result.protocolFilename,
          mimeType: 'application/pdf',
          base64Data: protoBase64,
        });
      }

      setStep('Verificando tamaño…');
      setStatus('checking_size');
      const totalSize = approxMimeSize(attachments, htmlBody);
      const sizeMB = (totalSize / 1024 / 1024).toFixed(1);

      if (totalSize > GMAIL_SIZE_LIMIT_BYTES) {
        setStatus('error');
        await persistEnvioRecord('error', {
          adjuntoTamanoMB: Number(sizeMB),
          error: `Adjuntos ${sizeMB} MB superan el límite de Gmail (24 MB)`,
        });
        const wantsDownload = await showConfirm({
          title: 'Adjuntos demasiado pesados',
          message:
            `Los archivos pesan ${sizeMB} MB y superan el límite de Gmail (24 MB).\n\n` +
            '¿Querés descargarlos ahora para enviarlos manualmente?',
          confirmText: 'Descargar',
          cancelText: 'Cancelar',
          confirmType: 'warning',
          onConfirm: () => {},
        });
        if (wantsDownload) {
          setStep('Descargando archivo(s)…');
          downloadBlob(result.reportBlob, result.reportFilename);
          if (result.protocolBlob && result.protocolFilename) {
            await new Promise(resolve => setTimeout(resolve, 300));
            downloadBlob(result.protocolBlob, result.protocolFilename);
          }
        }
        // Aborto silencioso — el reporte ya está FINALIZADO, no hay rollback
        throw new Error('SIZE_LIMIT_EXCEEDED');
      }

      setStep('Enviando mail…');
      setStatus('sending');
      try {
        await sendGmail({
          accessToken,
          to,
          bcc: [BCC_INTERNO],
          subject,
          htmlBody,
          attachments,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`No se pudo enviar el mail: ${msg}`);
        setStatus('error');
        // Dejar traza del intento fallido antes de propagar el error.
        await persistEnvioRecord('error', { adjuntoTamanoMB: Number(sizeMB), error: msg });
        throw err;
      }

      // El mail ya salió. Registramos el envío (no-bloqueante).
      setStep('Registrando envío…');
      await persistEnvioRecord('enviado', { adjuntoTamanoMB: Number(sizeMB) });

      setStatus('sent');
      delivered = true;
    };

    try {
      await handleFinalSubmit(emailDelivery);
      if (delivered) {
        showAlert({
          title: 'Reporte enviado',
          message: `Se envió el reporte de la OT ${otNumber} a:\n\n${to.join('\n')}`,
          type: 'success',
        });
      } else if (!error) {
        // El delivery no llegó a completarse (p.ej. no se pudo generar el PDF) y
        // no hubo un error específico ya mostrado. NO mostramos "enviado".
        showAlert({
          title: 'No se envió',
          message: 'El reporte se guardó, pero el mail no llegó a enviarse. Revisá la conexión e intentá de nuevo.',
          type: 'warning',
        });
      }
    } catch (err) {
      // Errores ya fueron capturados y reportados dentro del delivery.
      // SIZE_LIMIT_EXCEEDED es flujo esperado (no mostrar alert extra).
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'SIZE_LIMIT_EXCEEDED') {
        console.error('[useSendReportByEmail] error:', err);
        if (!error) {
          showAlert({
            title: 'Error enviando mail',
            message: msg || 'Error desconocido. El reporte se guardó igual, podés reintentar.',
            type: 'error',
          });
        }
      }
    }
  }, [
    formState, contactosDB, otNumber, handleFinalSubmit, requestToken,
    firebase, showAlert, showConfirm, error,
  ]);

  return {
    sendByEmail,
    status,
    error,
    isSending: status !== 'idle' && status !== 'sent' && status !== 'error',
  };
}
