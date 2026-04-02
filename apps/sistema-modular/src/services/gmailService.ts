/**
 * Gmail API REST service — sends emails directly from the browser
 * using the user's OAuth access token.
 */

interface EmailParams {
  accessToken: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: { filename: string; mimeType: string; base64Data: string }[];
}

function buildMimeMessage(params: EmailParams): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const toHeader = params.to.join(', ');
  const ccHeader = params.cc?.length ? params.cc.join(', ') : '';

  let message = '';
  message += `To: ${toHeader}\r\n`;
  if (ccHeader) message += `Cc: ${ccHeader}\r\n`;
  message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // HTML body part
  message += `--${boundary}\r\n`;
  message += `Content-Type: text/html; charset="UTF-8"\r\n`;
  message += `Content-Transfer-Encoding: base64\r\n\r\n`;
  message += btoa(unescape(encodeURIComponent(params.htmlBody))) + '\r\n';

  // Attachments
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

export async function sendGmail(params: EmailParams): Promise<{ id: string; threadId: string }> {
  const raw = buildMimeMessage(params);
  // Gmail API expects URL-safe base64 of the raw MIME
  const encoded = toUrlSafeBase64(raw);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gmail API error: ${response.status}`);
  }

  return response.json();
}
