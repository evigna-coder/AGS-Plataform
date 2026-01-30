/**
 * Proxy de Vercel para la Cloud Function WebAuthn.
 * Reenvía Authorization y X-WebAuthn-Origin a la función externa,
 * ya que los rewrites de Vercel a URLs externas no reenvían esos headers.
 */
const CLOUD_FUNCTION_BASE = 'https://us-central1-agssop-e7353.cloudfunctions.net/webauthn';

function getHeader(req, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (k.toLowerCase() === lower && v) return typeof v === 'string' ? v : v[0];
  }
  return undefined;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WebAuthn-Origin, X-Firebase-ID-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const pathSegments = req.query.path || [];
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const targetUrl = path ? `${CLOUD_FUNCTION_BASE}/${path}` : CLOUD_FUNCTION_BASE;

  let authHeader = getHeader(req, 'authorization');
  const idTokenHeader = getHeader(req, 'x-firebase-id-token');
  // Si Authorization fue eliminado por el proxy/CDN, usar token enviado en header alternativo
  if (!authHeader && idTokenHeader) {
    authHeader = idTokenHeader.startsWith('Bearer ') ? idTokenHeader : `Bearer ${idTokenHeader}`;
  }
  const originHeader = getHeader(req, 'x-webauthn-origin');
  // Log solo presencia del token (no el valor) para depurar 401 en Vercel
  console.log('webauthn proxy', path || '(root)', 'hasAuth:', !!authHeader, 'hasOrigin:', !!originHeader);

  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader && { Authorization: authHeader }),
    ...(originHeader && { 'X-WebAuthn-Origin': originHeader }),
  };

  let body;
  if (req.method !== 'GET' && req.body != null) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (response.status === 401) {
        console.log('webauthn proxy upstream 401:', data.error || data.message || JSON.stringify(data));
      }
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      if (response.status === 401) console.log('webauthn proxy upstream 401 (non-json):', text);
      res.status(response.status).setHeader('Content-Type', contentType || 'text/plain').send(text);
    }
  } catch (err) {
    console.error('webauthn proxy error:', err);
    res.status(502).json({ error: 'Error de proxy', message: err.message });
  }
}
