/**
 * Proxy de Vercel para la Cloud Function WebAuthn.
 * Reenvía Authorization y X-WebAuthn-Origin a la función externa,
 * ya que los rewrites de Vercel a URLs externas no reenvían esos headers.
 */
const CLOUD_FUNCTION_BASE = 'https://us-central1-agssop-e7353.cloudfunctions.net/webauthn';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WebAuthn-Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const pathSegments = req.query.path || [];
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const targetUrl = path ? `${CLOUD_FUNCTION_BASE}/${path}` : CLOUD_FUNCTION_BASE;

  const headers = {
    'Content-Type': 'application/json',
    ...(req.headers.authorization && { Authorization: req.headers.authorization }),
    ...(req.headers['x-webauthn-origin'] && { 'X-WebAuthn-Origin': req.headers['x-webauthn-origin'] }),
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
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).setHeader('Content-Type', contentType || 'text/plain').send(text);
    }
  } catch (err) {
    console.error('webauthn proxy error:', err);
    res.status(502).json({ error: 'Error de proxy', message: err.message });
  }
}
