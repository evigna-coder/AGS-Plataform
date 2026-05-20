/**
 * Gmail API REST service — sends emails directly from the browser
 * using the user's OAuth access token.
 *
 * Ported from apps/sistema-modular/src/services/gmailService.ts.
 */

interface EmailParams {
  accessToken: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: { filename: string; mimeType: string; base64Data: string }[];
}

function buildMimeMessage(params: EmailParams): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const toHeader = params.to.join(', ');
  const ccHeader = params.cc?.length ? params.cc.join(', ') : '';
  const bccHeader = params.bcc?.length ? params.bcc.join(', ') : '';

  let message = '';
  message += `To: ${toHeader}\r\n`;
  if (ccHeader) message += `Cc: ${ccHeader}\r\n`;
  if (bccHeader) message += `Bcc: ${bccHeader}\r\n`;
  message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  message += `--${boundary}\r\n`;
  message += `Content-Type: text/html; charset="UTF-8"\r\n`;
  message += `Content-Transfer-Encoding: base64\r\n\r\n`;
  message += btoa(unescape(encodeURIComponent(params.htmlBody))) + '\r\n';

  for (const att of params.attachments || []) {
    message += `--${boundary}\r\n`;
    message += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
    message += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += att.base64Data + '\r\n';
  }

  message += `--${boundary}--\r\n`;
  return message;
}

function toUrlSafeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Timeout para el fetch a Gmail. Suficiente para subir ~20 MB MIME en red mobile lenta;
 *  más allá de esto asumimos que la conexión se murió y abortamos para no quedar colgados. */
const GMAIL_FETCH_TIMEOUT_MS = 90_000;

export async function sendGmail(params: EmailParams): Promise<{ id: string; threadId: string }> {
  const raw = buildMimeMessage(params);
  const encoded = toUrlSafeBase64(raw);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GMAIL_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('El envío del mail tardó demasiado (red lenta o caída). Reintentá con mejor conexión.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gmail API error: ${response.status}`);
  }

  return response.json();
}

/** Approximate MIME size of a base64-encoded payload in bytes. */
export function approxMimeSize(attachments: { base64Data: string }[], htmlBody: string): number {
  const headersOverhead = 2048;
  const attachmentsSize = attachments.reduce((sum, a) => sum + a.base64Data.length, 0);
  const bodySize = btoa(unescape(encodeURIComponent(htmlBody))).length;
  return headersOverhead + bodySize + attachmentsSize;
}

/** Gmail's hard limit is 25 MB MIME. We use 24 MB as the practical ceiling. */
export const GMAIL_SIZE_LIMIT_BYTES = 24 * 1024 * 1024;
